import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { EMAIL_PROVIDER } from '../email/email.interface';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    password_hash: '$2b$12$KIXhash...',
    first_name: 'Test',
    last_name: 'User',
    role: UserRole.member,
    email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        'jwt.secret': 'test-secret',
        'jwt.expiresIn': '15m',
        'jwt.refreshExpiresIn': '7d',
        'APP_URL': 'http://localhost:3000',
      };
      return config[key] || defaultValue;
    }),
  };

  const mockEmailProvider = {
    send: jest.fn().mockResolvedValue({ success: true, messageId: 'test-msg-id' }),
    sendWithAttachment: jest.fn().mockResolvedValue({ success: true }),
    verify: jest.fn().mockResolvedValue(true),
    getProviderType: jest.fn().mockReturnValue('console'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EMAIL_PROVIDER, useValue: mockEmailProvider },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should successfully register a new user and send verification email', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        ...mockUser,
        id: 'new-user-id',
        email: registerDto.email,
        first_name: registerDto.firstName,
        last_name: registerDto.lastName,
        email_verified: false,
      });

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('userId');
      expect(result.message).toContain('verify');
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: registerDto.email,
          email_verified: false,
          email_verification_token: expect.any(String),
          email_verification_expires: expect.any(Date),
        }),
      });
      expect(mockEmailProvider.send).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'Password123!',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const hashedPassword = await bcrypt.hash(loginDto.password, 12);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        password_hash: hashedPassword,
      });
      mockPrismaService.user.update.mockResolvedValue(mockUser);
      mockJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(loginDto.email);
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException with invalid email', async () => {
      const loginDto = {
        email: 'nonexistent@example.com',
        password: 'Password123!',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException with invalid password', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'WrongPassword123!',
      };

      const hashedPassword = await bcrypt.hash('CorrectPassword123!', 12);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        password_hash: hashedPassword,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if email not verified', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const hashedPassword = await bcrypt.hash(loginDto.password, 12);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        password_hash: hashedPassword,
        email_verified: false,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshTokens', () => {
    it('should successfully refresh tokens', async () => {
      const refreshToken = 'valid-refresh-token';
      const tokenPayload = {
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      };

      mockJwtService.verify.mockReturnValue(tokenPayload);
      mockPrismaService.refreshToken.findFirst.mockResolvedValue({
        id: 'token-id',
        user_id: mockUser.id,
        token_hash: 'hashed-token',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        created_at: new Date(),
        revoked_at: null,
        user: mockUser,
      });
      mockPrismaService.refreshToken.update.mockResolvedValue({});
      mockJwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshTokens(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrismaService.refreshToken.update).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException with invalid refresh token', async () => {
      const refreshToken = 'invalid-refresh-token';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshTokens(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should successfully logout user', async () => {
      const userId = mockUser.id;
      const refreshToken = 'refresh-token';

      mockPrismaService.refreshToken.updateMany.mockResolvedValue({
        count: 1,
      });

      await service.logout(userId, refreshToken);

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          user_id: userId,
        }),
        data: expect.objectContaining({
          revoked_at: expect.any(Date),
        }),
      });
    });
  });

  describe('logoutAll', () => {
    it('should revoke all refresh tokens for user', async () => {
      const userId = mockUser.id;

      mockPrismaService.refreshToken.updateMany.mockResolvedValue({
        count: 3,
      });

      await service.logoutAll(userId);

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          user_id: userId,
          revoked_at: null,
        }),
        data: expect.objectContaining({
          revoked_at: expect.any(Date),
        }),
      });
    });
  });

  describe('validateUser', () => {
    it('should return user if found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.validateUser(mockUser.id);

      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.validateUser('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('verifyEmail', () => {
    beforeEach(() => {
      mockPrismaService.user.findFirst = jest.fn();
    });

    it('should verify email with valid token', async () => {
      const token = 'valid-verification-token';
      mockPrismaService.user.findFirst.mockResolvedValue({
        ...mockUser,
        email_verified: false,
        email_verification_token: token,
        email_verification_expires: new Date(Date.now() + 3600000),
      });
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        email_verified: true,
      });

      const result = await service.verifyEmail(token);

      expect(result.message).toContain('verified');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          email_verified: true,
          email_verification_token: null,
          email_verification_expires: null,
        },
      });
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for expired token', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        ...mockUser,
        email_verified: false,
        email_verification_token: 'expired-token',
        email_verification_expires: new Date(Date.now() - 3600000), // 1 hour ago
      });

      await expect(service.verifyEmail('expired-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return success message if already verified', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({
        ...mockUser,
        email_verified: true,
      });

      const result = await service.verifyEmail('some-token');

      expect(result.message).toContain('already verified');
    });
  });

  describe('resendVerificationEmail', () => {
    beforeEach(() => {
      mockPrismaService.user.findUnique.mockReset();
    });

    it('should resend verification email for unverified user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        email_verified: false,
      });
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        email_verification_token: 'new-token',
      });

      const result = await service.resendVerificationEmail(mockUser.email);

      expect(result.message).toContain('verification link');
      expect(mockPrismaService.user.update).toHaveBeenCalled();
      expect(mockEmailProvider.send).toHaveBeenCalled();
    });

    it('should throw BadRequestException if already verified', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        email_verified: true,
      });

      await expect(
        service.resendVerificationEmail(mockUser.email),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return generic message for non-existent email (security)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.resendVerificationEmail('nonexistent@example.com');

      // Should not reveal whether account exists
      expect(result.message).toContain('If an account exists');
    });
  });
});
