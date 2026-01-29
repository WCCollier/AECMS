import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/auth/register (POST)', () => {
    it('should register a new user', () => {
      const timestamp = Date.now();
      const registerDto = {
        email: `testuser${timestamp}@example.com`,
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
      };

      return request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user.email).toBe(registerDto.email);
          expect(res.body.user.role).toBe('member');
        });
    });

    it('should fail with duplicate email', async () => {
      const registerDto = {
        email: 'owner@aecms.local', // Already exists from seed
        password: 'Password123!',
      };

      return request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(409); // Conflict
    });

    it('should fail with invalid email format', () => {
      const registerDto = {
        email: 'invalid-email',
        password: 'Password123!',
      };

      return request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400); // Bad Request
    });

    it('should fail with weak password', () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'weak', // Too short, no uppercase, no special char
      };

      return request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400);
    });
  });

  describe('/auth/login (POST)', () => {
    it('should login with valid credentials', () => {
      const loginDto = {
        email: 'owner@aecms.local',
        password: 'Admin123!@#',
      };

      return request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user.email).toBe(loginDto.email);
          expect(res.body.user.role).toBe('owner');
        });
    });

    it('should fail with invalid email', () => {
      const loginDto = {
        email: 'nonexistent@example.com',
        password: 'Password123!',
      };

      return request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(401); // Unauthorized
    });

    it('should fail with invalid password', () => {
      const loginDto = {
        email: 'owner@aecms.local',
        password: 'WrongPassword123!',
      };

      return request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(401);
    });
  });

  describe('/auth/refresh (POST)', () => {
    it('should refresh access token with valid refresh token', async () => {
      // First login to get a refresh token
      const loginDto = {
        email: 'owner@aecms.local',
        password: 'Admin123!@#',
      };

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      const { refreshToken } = loginRes.body;

      // Use refresh token to get new tokens
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body.refreshToken).not.toBe(refreshToken); // Should be different
        });
    });

    it('should fail with invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  describe('/auth/logout (POST)', () => {
    it('should logout successfully', async () => {
      // First login
      const loginDto = {
        email: 'owner@aecms.local',
        password: 'Admin123!@#',
      };

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      const { accessToken, refreshToken } = loginRes.body;

      // Logout
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(204); // No Content
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: 'some-token' })
        .expect(401);
    });
  });

  describe('/auth/logout-all (POST)', () => {
    it('should logout from all devices successfully', async () => {
      // First login
      const loginDto = {
        email: 'owner@aecms.local',
        password: 'Admin123!@#',
      };

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      const { accessToken } = loginRes.body;

      // Logout from all devices
      return request(app.getHttpServer())
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });

    it('should fail without authentication', () => {
      return request(app.getHttpServer())
        .post('/auth/logout-all')
        .expect(401);
    });
  });

  describe('JWT Authentication Guard', () => {
    it('should protect routes that require authentication', async () => {
      // Try to access a protected route without token
      return request(app.getHttpServer())
        .post('/auth/logout-all')
        .expect(401);
    });

    it('should allow access with valid token', async () => {
      // Login first
      const loginDto = {
        email: 'owner@aecms.local',
        password: 'Admin123!@#',
      };

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      const { accessToken } = loginRes.body;

      // Access protected route with token
      return request(app.getHttpServer())
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });
  });
});
