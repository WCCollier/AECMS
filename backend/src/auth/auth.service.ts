import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponse, TokenPayload } from './interfaces/auth-response.interface';
import { UserRole } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly bcryptRounds = 12;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Register a new user
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(registerDto.password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password_hash: passwordHash,
        first_name: registerDto.firstName,
        last_name: registerDto.lastName,
        role: UserRole.member, // Default role
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Store refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name || undefined,
        lastName: user.last_name || undefined,
        role: user.role,
      },
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
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password_hash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Store refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name || undefined,
        lastName: user.last_name || undefined,
        role: user.role,
      },
    };
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

      // Generate new tokens
      const tokens = await this.generateTokens(
        storedToken.user.id,
        storedToken.user.email,
        storedToken.user.role,
      );

      // Store new refresh token
      await this.storeRefreshToken(storedToken.user.id, tokens.refreshToken);

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
  async logout(userId: string, refreshToken: string): Promise<void> {
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
   * Generate access and refresh tokens
   */
  private async generateTokens(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const jwtSecret = this.configService.get<string>('jwt.secret');
    const jwtExpiration = this.configService.get<string>('jwt.expiresIn');
    const refreshExpiration = this.configService.get<string>('jwt.refreshExpiresIn');

    if (!jwtSecret || !jwtExpiration || !refreshExpiration) {
      throw new Error('JWT configuration is missing');
    }

    // Create unique access token payload
    const accessPayload: TokenPayload = {
      sub: userId,
      email,
      role,
      jti: crypto.randomUUID(), // Unique identifier for access token
    };

    // Create unique refresh token payload
    const refreshPayload: TokenPayload = {
      sub: userId,
      email,
      role,
      jti: crypto.randomUUID(), // Unique identifier for refresh token
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
  ): Promise<void> {
    const refreshExpiration = this.configService.get<string>('jwt.refreshExpiresIn');
    if (!refreshExpiration) {
      throw new Error('Refresh token expiration not configured');
    }

    const expiresAt = this.calculateExpiration(refreshExpiration);
    const tokenHash = this.hashToken(token);

    await this.prisma.refreshToken.create({
      data: {
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });
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
}
