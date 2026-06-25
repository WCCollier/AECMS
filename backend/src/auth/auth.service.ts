import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponse, AdminLoginResponse, TokenPayload } from './interfaces/auth-response.interface';
import { UserRole } from '@prisma/client';
import * as crypto from 'crypto';
import { EMAIL_PROVIDER } from '../email/email.interface';
import type { EmailProvider } from '../email/email.interface';
import { AuditLogService } from '../audit/audit.service';
import { CAPABILITY_DEFINITIONS } from '../capabilities/capability-definitions';

@Injectable()
export class AuthService {
  private readonly bcryptRounds = 12;
  private readonly verificationTokenExpiry = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(EMAIL_PROVIDER) private emailProvider: EmailProvider,
    private auditLog: AuditLogService,
  ) {}

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto): Promise<{ message: string; userId: string }> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Check if username is taken
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: registerDto.username },
    });

    if (existingUsername) {
      throw new ConflictException('Username is already taken');
    }

    // Hash password
    const passwordHash = await this.hashPassword(registerDto.password);

    // Generate verification token
    const verificationToken = this.generateVerificationToken();
    const verificationExpires = new Date(Date.now() + this.verificationTokenExpiry);

    // Resolve default registration role from settings (fallback: 'member')
    const defaultRoleSetting = await this.prisma.siteSettings.findUnique({
      where: { key: 'general.default_role' },
    });
    const defaultRole = defaultRoleSetting?.value ?? 'member';
    const canonicalRoles: string[] = ['owner', 'admin', 'member', 'guest'];
    const roleEnumValue: UserRole = canonicalRoles.includes(defaultRole)
      ? (defaultRole as UserRole)
      : UserRole.member;

    // Create user with email_verified = false
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        username: registerDto.username,
        password_hash: passwordHash,
        first_name: registerDto.firstName,
        last_name: registerDto.lastName,
        role: roleEnumValue,
        role_name: defaultRole,
        email_verified: false,
        email_verification_token: verificationToken,
        email_verification_expires: verificationExpires,
      },
    });

    // Send verification email
    await this.sendVerificationEmail(user.email, verificationToken, user.first_name);

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id,
    };
  }

  /**
   * Login user
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user || !user.password_hash) {
      await this.auditLog.log({ event_type: 'auth.login_failed', metadata: { email_attempted: loginDto.email, reason: 'user_not_found' } });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password_hash,
    );

    if (!isPasswordValid) {
      await this.auditLog.log({ event_type: 'auth.login_failed', metadata: { email_attempted: loginDto.email, reason: 'invalid_password' } });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified
    if (!user.email_verified) {
      throw new UnauthorizedException(
        'Email not verified. Please check your email and verify your account before logging in.',
      );
    }

    // Check registration approval gate
    await this.assertApproved(user);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
      },
    });

    // Generate tokens (prefer role_name for JWT; falls back to legacy role enum)
    const tokens = await this.generateTokens(user.id, user.email, user.role_name ?? user.role, undefined, 'customer');

    // Store refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken, undefined, 'customer');

    await this.auditLog.log({ event_type: 'auth.login', user_id: user.id, metadata: { session_type: 'customer' } });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name || undefined,
        lastName: user.last_name || undefined,
        role: user.role,
        emailVerified: user.email_verified,
      },
    };
  }

  /**
   * Admin back-door login — enforces admin/owner role, handles 2FA gating
   */
  async adminLogin(loginDto: LoginDto): Promise<AdminLoginResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password_hash);
    if (!isPasswordValid) {
      await this.auditLog.log({ event_type: 'auth.login_failed', metadata: { email_attempted: loginDto.email, reason: 'invalid_password' } });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.email_verified) {
      throw new UnauthorizedException('Email not verified');
    }

    // Check registration approval gate
    await this.assertApproved(user);

    // Owner always has backstage access; others must hold at least one backstage-scoped capability
    const effectiveRole = user.role_name ?? user.role;
    if (effectiveRole !== 'owner') {
      const backstageCap = await this.prisma.capability.findFirst({
        where: {
          scope: 'backstage',
          OR: [
            { user_capabilities: { some: { user_id: user.id } } },
            { role_capabilities: { some: { role_name: effectiveRole, enabled: true } } },
          ],
        },
      });
      if (!backstageCap) {
        throw new ForbiddenException('Backstage access requires at least one backstage-scoped capability');
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    if (user.totp_enabled) {
      const preAuthToken = await this.generatePreAuthToken(user.id);
      return { requiresTwoFactor: true, preAuthToken };
    }

    // 2FA not yet set up — grant backstage access with 7-day tokens and flag setup required
    const tokens = await this.generateTokens(user.id, user.email, user.role_name ?? user.role, '7d', 'backstage');
    await this.storeRefreshToken(user.id, tokens.refreshToken, '7d', 'backstage');

    if (user.role === UserRole.owner) {
      this.syncOwnerCapabilities(user.id).catch((e) =>
        console.error('[auth] syncOwnerCapabilities failed:', e?.message),
      );
    }

    await this.auditLog.log({ event_type: 'auth.login', user_id: user.id, metadata: { session_type: 'backstage', two_factor_setup_required: true } });

    return {
      requiresTwoFactor: false,
      twoFactorSetupRequired: true,
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name || undefined,
        lastName: user.last_name || undefined,
        role: user.role,
        emailVerified: user.email_verified,
      },
    };
  }

  /**
   * Verify TOTP code during back-door login — exchanges pre-auth token for full tokens
   */
  async verifyTwoFactor(preAuthToken: string, code: string): Promise<AuthResponse> {
    const jwtSecret = this.configService.get<string>('jwt.secret');
    if (!jwtSecret) throw new Error('JWT secret not configured');

    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(preAuthToken, { secret: jwtSecret });
    } catch {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    if (payload.scope !== 'pre_2fa') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.totp_secret || !user.totp_enabled) {
      throw new UnauthorizedException('2FA not configured for this account');
    }

    const isValid = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token: code, window: 1 });
    if (!isValid) {
      throw new UnauthorizedException('Invalid authenticator code');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role_name ?? user.role, '7d', 'backstage');
    const storedToken = await this.storeRefreshToken(user.id, tokens.refreshToken, '7d', 'backstage');
    const revoked = await this.revokeOtherBackstageSessions(user.id, storedToken.id);

    if (user.role === UserRole.owner) {
      this.syncOwnerCapabilities(user.id).catch((e) =>
        console.error('[auth] syncOwnerCapabilities failed:', e?.message),
      );
    }

    await this.auditLog.log({ event_type: 'auth.2fa_success', user_id: user.id, metadata: { session_type: 'backstage' } });
    if (revoked > 0) {
      await this.auditLog.log({ event_type: 'auth.sessions_revoked', user_id: user.id, metadata: { count: revoked, session_type: 'backstage' } });
    }

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name || undefined,
        lastName: user.last_name || undefined,
        role: user.role,
        emailVerified: user.email_verified,
      },
    };
  }

  /**
   * Generate TOTP secret and return QR code URL for authenticator app setup
   */
  async setupTwoFactor(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.totp_enabled) throw new BadRequestException('2FA is already enabled');

    const generated = speakeasy.generateSecret({ name: `AECMS:${user.email}`, length: 20 });
    const secret = generated.base32;
    const otpauthUrl = generated.otpauth_url ?? speakeasy.otpauthURL({ secret, label: user.email, issuer: 'AECMS', encoding: 'base32' });

    await this.prisma.user.update({
      where: { id: userId },
      data: { totp_secret: secret },
    });

    return { secret, otpauthUrl };
  }

  /**
   * Verify setup code and permanently enable 2FA for the user
   */
  async enableTwoFactor(userId: string, code: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totp_secret) throw new BadRequestException('2FA setup not initiated');
    if (user.totp_enabled) throw new BadRequestException('2FA is already enabled');

    const isValid = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token: code, window: 1 });
    if (!isValid) throw new BadRequestException('Invalid verification code');

    await this.prisma.user.update({
      where: { id: userId },
      data: { totp_enabled: true },
    });

    return { success: true };
  }

  /**
   * Issue a short-lived (5 min) pre-auth token scoped only to 2FA verification
   */
  private async generatePreAuthToken(userId: string): Promise<string> {
    const jwtSecret = this.configService.get<string>('jwt.secret');
    if (!jwtSecret) throw new Error('JWT secret not configured');
    return this.jwtService.signAsync(
      { sub: userId, scope: 'pre_2fa' },
      { secret: jwtSecret, expiresIn: '5m' },
    );
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    try {
      // Verify refresh token
      const jwtSecret = this.configService.get<string>('jwt.secret');
      if (!jwtSecret) {
        throw new Error('JWT secret not configured');
      }

      const payload = this.jwtService.verify<TokenPayload>(refreshToken, {
        secret: jwtSecret,
      });

      // Hash the token to find it in database
      const tokenHash = this.hashToken(refreshToken);

      // Check if refresh token exists in database
      const storedToken = await this.prisma.refreshToken.findFirst({
        where: {
          user_id: payload.sub,
          token_hash: tokenHash,
          revoked_at: null,
          expires_at: {
            gt: new Date(),
          },
        },
        include: {
          user: true,
        },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Revoke old refresh token
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revoked_at: new Date() },
      });

      // Propagate session_type so the session type survives rotation
      const sessionType = (storedToken.session_type as 'customer' | 'backstage') ?? 'customer';
      const refreshExpiry = sessionType === 'backstage' ? '7d' : undefined;

      // Generate new tokens
      const tokens = await this.generateTokens(
        storedToken.user.id,
        storedToken.user.email,
        storedToken.user.role_name ?? storedToken.user.role,
        refreshExpiry,
        sessionType,
      );

      // Store new refresh token
      await this.storeRefreshToken(storedToken.user.id, tokens.refreshToken, refreshExpiry, sessionType);

      return {
        ...tokens,
        user: {
          id: storedToken.user.id,
          email: storedToken.user.email,
          firstName: storedToken.user.first_name || undefined,
          lastName: storedToken.user.last_name || undefined,
          role: storedToken.user.role,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * Logout user (revoke refresh token)
   */
  async logout(userId: string, refreshToken: string, sessionType?: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: {
        user_id: userId,
        token_hash: tokenHash,
      },
      data: {
        revoked_at: new Date(),
      },
    });
    await this.auditLog.log({ event_type: 'auth.logout', user_id: userId, metadata: { session_type: sessionType ?? 'customer' } });
  }

  /**
   * Logout from all devices (revoke all refresh tokens)
   */
  async logoutAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        user_id: userId,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
      },
    });
  }

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async getShippingAddress(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        shipping_street: true,
        shipping_city: true,
        shipping_state: true,
        shipping_postal_code: true,
        shipping_country: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const hasAddress = !!(user.shipping_street || user.shipping_city);
    return { ...user, has_address: hasAddress };
  }

  async updateShippingAddress(userId: string, dto: {
    shipping_street?: string;
    shipping_city?: string;
    shipping_state?: string;
    shipping_postal_code?: string;
    shipping_country?: string;
  }) {
    await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
    return this.getShippingAddress(userId);
  }

  async hasBackstageAccess(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true, role_name: true } });
    if (!user) return false;
    const effectiveRole = user.role_name ?? user.role;
    if (effectiveRole === 'owner') return true;
    const cap = await this.prisma.capability.findFirst({
      where: {
        scope: 'backstage',
        OR: [
          { user_capabilities: { some: { user_id: userId } } },
          { role_capabilities: { some: { role_name: effectiveRole, enabled: true } } },
        ],
      },
    });
    return cap !== null;
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        email_verification_token: token,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.email_verified) {
      return { message: 'Email already verified' };
    }

    if (user.email_verification_expires && user.email_verification_expires < new Date()) {
      throw new BadRequestException(
        'Verification token has expired. Please request a new verification email.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email_verified: true,
        email_verification_token: null,
        email_verification_expires: null,
      },
    });

    // If approval gate is on, notify all approvers and return a distinct message
    const requireApproval = await this.isApprovalRequired();
    if (requireApproval) {
      await this.notifyApprovers(user.email, user.first_name).catch((e) =>
        console.error('[auth] notifyApprovers failed:', e?.message),
      );
      return { message: 'Email verified. Your account is awaiting admin approval. You will receive an email once it is reviewed.' };
    }

    return { message: 'Email verified successfully. You can now log in.' };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return { message: 'If an account exists with this email, a verification link will be sent.' };
    }

    if (user.email_verified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification token
    const verificationToken = this.generateVerificationToken();
    const verificationExpires = new Date(Date.now() + this.verificationTokenExpiry);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email_verification_token: verificationToken,
        email_verification_expires: verificationExpires,
      },
    });

    // Send verification email
    await this.sendVerificationEmail(user.email, verificationToken, user.first_name);

    return { message: 'If an account exists with this email, a verification link will be sent.' };
  }

  /**
   * Generate a random verification token
   */
  private generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Send verification email
   */
  private async sendVerificationEmail(
    email: string,
    token: string,
    firstName?: string | null,
  ): Promise<void> {
    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;
    const name = firstName || 'there';

    await this.emailProvider.send({
      to: email,
      subject: 'Verify your email address - AECMS',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Welcome to AECMS!</h1>
          <p>Hi ${name},</p>
          <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}"
               style="background-color: #4F46E5; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Verify Email Address
            </a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
          </p>
        </div>
      `,
      text: `
        Welcome to AECMS!

        Hi ${name},

        Thank you for registering. Please verify your email address by visiting:
        ${verificationUrl}

        This link will expire in 24 hours.

        If you didn't create an account, you can safely ignore this email.
      `,
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!user.password_hash) throw new BadRequestException('Account uses OAuth login — password change not supported');
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const newHash = await this.hashPassword(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { password_hash: newHash } });
    await this.logoutAll(userId);

    return { message: 'Password changed successfully. Please log in again.' };
  }

  async deleteAccount(userId: string, password: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'owner') throw new ForbiddenException('Owner account cannot be deleted');

    if (!user.password_hash) throw new BadRequestException('Account uses OAuth login — deletion not supported via password');
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new BadRequestException('Password is incorrect');

    await this.prisma.user.update({
      where: { id: userId },
      data: { deleted_at: new Date() },
    });

    return { message: 'Account deleted successfully' };
  }

  /**
   * Hash password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.bcryptRounds);
  }

  /**
   * Hash token using SHA-256 (for storing refresh tokens)
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Generate access and refresh tokens. refreshExpiryOverride allows the admin
   * back-door to enforce a fixed 7-day expiry independent of global config.
   * role accepts either a UserRole enum value or a string role_name.
   */
  private async generateTokens(
    userId: string,
    email: string,
    role: UserRole | string,
    refreshExpiryOverride?: string,
    sessionType: 'customer' | 'backstage' = 'customer',
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const jwtSecret = this.configService.get<string>('jwt.secret');
    const jwtExpiration = this.configService.get<string>('jwt.expiresIn');
    const refreshExpiration = refreshExpiryOverride ?? this.configService.get<string>('jwt.refreshExpiresIn');

    if (!jwtSecret || !jwtExpiration || !refreshExpiration) {
      throw new Error('JWT configuration is missing');
    }

    const accessPayload: TokenPayload = {
      sub: userId,
      email,
      role,
      jti: crypto.randomUUID(),
      session_type: sessionType,
    };

    const refreshPayload: TokenPayload = {
      sub: userId,
      email,
      role,
      jti: crypto.randomUUID(),
      session_type: sessionType,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: jwtSecret,
        expiresIn: jwtExpiration as any,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: jwtSecret,
        expiresIn: refreshExpiration as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Store refresh token in database
   */
  private async storeRefreshToken(
    userId: string,
    token: string,
    expiryOverride?: string,
    sessionType: 'customer' | 'backstage' = 'customer',
  ): Promise<{ id: string }> {
    const refreshExpiration = expiryOverride ?? this.configService.get<string>('jwt.refreshExpiresIn');
    if (!refreshExpiration) {
      throw new Error('Refresh token expiration not configured');
    }

    const expiresAt = this.calculateExpiration(refreshExpiration);
    const tokenHash = this.hashToken(token);

    return this.prisma.refreshToken.create({
      data: {
        user_id: userId,
        token_hash: tokenHash,
        session_type: sessionType,
        expires_at: expiresAt,
      },
      select: { id: true },
    });
  }

  private async revokeOtherBackstageSessions(userId: string, excludeTokenId: string): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: {
        user_id: userId,
        session_type: 'backstage',
        id: { not: excludeTokenId },
        revoked_at: null,
      },
      data: { revoked_at: new Date() },
    });
    return result.count;
  }

  /**
   * Calculate expiration date from duration string (e.g., "7d", "15m")
   */
  private calculateExpiration(duration: string): Date {
    const now = new Date();
    const match = duration.match(/^(\d+)([dhms])$/);

    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const [, value, unit] = match;
    const numValue = parseInt(value, 10);

    switch (unit) {
      case 'd':
        return new Date(now.getTime() + numValue * 24 * 60 * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + numValue * 60 * 60 * 1000);
      case 'm':
        return new Date(now.getTime() + numValue * 60 * 1000);
      case 's':
        return new Date(now.getTime() + numValue * 1000);
      default:
        throw new Error(`Unsupported duration unit: ${unit}`);
    }
  }

  // ── User Management (Owner-only) ──────────────────────────────────────────

  async listUsers(page: number, limit: number, search?: string) {
    const where: Record<string, unknown> = { deleted_at: null };
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          first_name: true,
          last_name: true,
          role: true,
          role_name: true,
          email_verified: true,
          created_at: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const normalized = users.map(({ role_name, role, ...rest }) => ({
      ...rest,
      role: role_name ?? role,
    }));
    return { data: normalized, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async updateUserRole(actorId: string, targetId: string, newRole: string): Promise<{ message: string }> {
    if (actorId === targetId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    // Validate the role exists in the roles table
    const roleExists = await this.prisma.role.findUnique({ where: { name: newRole } });
    if (!roleExists) {
      throw new NotFoundException(`Role '${newRole}' not found`);
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetId, deleted_at: null },
    });
    if (!target) throw new NotFoundException('User not found');

    const oldRole = target.role_name ?? target.role;

    // Write both role_name (new) and role enum (legacy compat — only for canonical roles)
    const canonicalRoles: string[] = ['owner', 'admin', 'member', 'guest'];
    const updateData: Record<string, unknown> = { role_name: newRole };
    if (canonicalRoles.includes(newRole)) {
      updateData.role = newRole as UserRole;
    }

    await this.prisma.user.update({ where: { id: targetId }, data: updateData });

    await this.auditLog.log({
      event_type: 'user.role_changed',
      user_id: actorId,
      metadata: { target_id: targetId, target_email: target.email, from: oldRole, to: newRole },
    });

    return { message: `Role changed from ${oldRole} to ${newRole}` };
  }

  // ── Registration Approval ─────────────────────────────────────────────────

  private async isApprovalRequired(): Promise<boolean> {
    const row = await this.prisma.siteSettings.findUnique({
      where: { key: 'general.require_registration_approval' },
    });
    return row?.value === 'true';
  }

  private async assertApproved(user: { id: string; role: UserRole | string; role_name: string; approved_at: Date | null }): Promise<void> {
    // Owner is always exempt from the approval gate
    const effectiveRole = user.role_name ?? user.role;
    if (effectiveRole === 'owner') return;

    const requireApproval = await this.isApprovalRequired();
    if (!requireApproval) return;

    if (!user.approved_at) {
      throw new UnauthorizedException(
        'Your registration is pending approval. You will receive an email when it is reviewed.',
      );
    }
  }

  async listPendingRegistrations() {
    const users = await this.prisma.user.findMany({
      where: {
        email_verified: true,
        approved_at: null,
        deleted_at: null,
        role_name: { not: 'owner' },
      },
      select: {
        id: true,
        email: true,
        username: true,
        first_name: true,
        last_name: true,
        role_name: true,
        email_verified: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    });
    return { data: users, total: users.length };
  }

  async approveRegistration(actorId: string, targetId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: targetId, deleted_at: null, email_verified: true, approved_at: null },
    });
    if (!user) throw new NotFoundException('Pending registration not found');

    await this.prisma.user.update({
      where: { id: targetId },
      data: { approved_at: new Date(), approved_by: actorId },
    });

    await this.auditLog.log({
      event_type: 'user.registration_approved',
      user_id: actorId,
      metadata: { target_id: targetId, target_email: user.email },
    });

    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    await this.emailProvider.send({
      to: user.email,
      subject: 'Your account has been approved',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Welcome!</h1>
          <p>Hi ${user.first_name || 'there'},</p>
          <p>Your account registration has been approved. You can now log in at:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}/login"
               style="background-color: #4F46E5; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px; display: inline-block;">
              Log In Now
            </a>
          </p>
        </div>
      `,
      text: `Hi ${user.first_name || 'there'},\n\nYour account has been approved. Log in at: ${appUrl}/login`,
    }).catch((e) => console.error('[auth] approval email failed:', e?.message));

    return { message: 'Registration approved' };
  }

  async rejectRegistration(actorId: string, targetId: string, reason: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: targetId, deleted_at: null, email_verified: true, approved_at: null },
    });
    if (!user) throw new NotFoundException('Pending registration not found');

    await this.auditLog.log({
      event_type: 'user.registration_rejected',
      user_id: actorId,
      metadata: { target_id: targetId, target_email: user.email, reason },
    });

    await this.prisma.user.update({
      where: { id: targetId },
      data: { deleted_at: new Date() },
    });

    return { message: 'Registration rejected' };
  }

  private async notifyApprovers(applicantEmail: string, applicantName?: string | null): Promise<void> {
    // Find all users who hold the registration.approve capability
    const cap = await this.prisma.capability.findUnique({
      where: { name: 'registration.approve' },
    });
    if (!cap) return;

    const approverIds = new Set<string>();

    // Via role assignment
    const roleCaps = await this.prisma.roleCapability.findMany({
      where: { capability_id: cap.id },
      select: { role_name: true },
    });
    if (roleCaps.length > 0) {
      const roleNames = [...new Set(roleCaps.map((rc) => rc.role_name).filter(Boolean))];
      const roleUsers = await this.prisma.user.findMany({
        where: { role_name: { in: roleNames }, deleted_at: null, email_verified: true },
        select: { id: true },
      });
      roleUsers.forEach((u) => approverIds.add(u.id));
    }

    // Via direct user capability grants
    const userCaps = await this.prisma.userCapability.findMany({
      where: { capability_id: cap.id },
      select: { user_id: true },
    });
    userCaps.forEach((uc) => approverIds.add(uc.user_id));

    if (approverIds.size === 0) return;

    const approvers = await this.prisma.user.findMany({
      where: { id: { in: [...approverIds] }, deleted_at: null },
      select: { email: true },
    });

    const appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3000');
    const displayName = applicantName ? `${applicantName} (${applicantEmail})` : applicantEmail;

    for (const approver of approvers) {
      await this.emailProvider.send({
        to: approver.email,
        subject: `New registration pending approval — ${applicantEmail}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New registration pending approval</h2>
            <p><strong>${displayName}</strong> has verified their email and is waiting for account approval.</p>
            <p style="text-align: center; margin: 30px 0;">
              <a href="${appUrl}/admin/registrations"
                 style="background-color: #4F46E5; color: white; padding: 12px 24px;
                        text-decoration: none; border-radius: 6px; display: inline-block;">
                Review Pending Registrations
              </a>
            </p>
          </div>
        `,
        text: `New registration pending approval: ${displayName}\n\nReview at: ${appUrl}/admin/registrations`,
      }).catch((e) => console.error('[auth] approver notification email failed:', e?.message));
    }
  }

  /**
   * Upsert all defined capabilities and assign every one to the given Owner user.
   * Called on every Owner backstage login so the Owner always holds the full
   * capability set regardless of seed state, enabling them to delegate to other roles.
   * Runs fire-and-forget (errors are logged but never surface to the login response).
   */
  async syncOwnerCapabilities(userId: string): Promise<void> {
    for (const def of CAPABILITY_DEFINITIONS) {
      const cap = await this.prisma.capability.upsert({
        where: { name: def.name },
        create: def,
        update: { scope: def.scope, description: def.description },
      });

      const existing = await this.prisma.userCapability.findFirst({
        where: { user_id: userId, capability_id: cap.id },
      });
      if (!existing) {
        await this.prisma.userCapability.create({
          data: { user_id: userId, capability_id: cap.id, granted_by: userId },
        });
      }
    }
  }
}
