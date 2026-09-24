import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

describe('AuthService (STORY-005)', () => {
  let authService: AuthService;
  let prismaService: any;
  let jwtService: any;

  const mockUser = {
    id: 'user-uuid-123',
    email: 'nusrat@dhakatesla.com',
    passwordHash: '$2b$10$hashedpasswordstringfornusrat',
    name: 'Nusrat',
    role: 'PASSENGER',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    };

    jwtService = {
      sign: vi.fn().mockReturnValue('mock-signed-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  describe('Scenario 1: Register new passenger (FR-AUTH-01)', () => {
    it('should register a new passenger, return sanitized user without passwordHash, and return accessToken', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: 'newuser@dhakatesla.com',
        name: 'New User',
        role: 'PASSENGER',
        createdAt: new Date(),
      });

      const result = await authService.register({
        email: 'newuser@dhakatesla.com',
        password: 'ValidPassword123!',
        name: 'New User',
        role: 'PASSENGER' as any,
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('newuser@dhakatesla.com');
      expect((result.user as any).passwordHash).toBeUndefined();
      expect(result.accessToken).toBe('mock-signed-jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'new-user-id',
        email: 'newuser@dhakatesla.com',
        role: 'PASSENGER',
      });
    });
  });

  describe('Scenario 2: Register with duplicate email (FR-AUTH-01)', () => {
    it('should throw 409 ConflictException when email is already registered', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.register({
          email: 'nusrat@dhakatesla.com',
          password: 'Password123!',
          name: 'Nusrat',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Scenario 3: Login with correct password (FR-AUTH-02)', () => {
    it('should return 200 with sanitized user and valid signed JWT token for valid credentials', async () => {
      const realHashedPassword = await bcrypt.hash('Tesla2026!', 10);
      const userWithRealHash = { ...mockUser, passwordHash: realHashedPassword };

      prismaService.user.findUnique.mockResolvedValue(userWithRealHash);

      const result = await authService.login({
        email: 'nusrat@dhakatesla.com',
        password: 'Tesla2026!',
      });

      expect(result.user).toBeDefined();
      expect(result.user.name).toBe('Nusrat');
      expect((result.user as any).passwordHash).toBeUndefined();
      expect(result.accessToken).toBe('mock-signed-jwt-token');
    });
  });

  describe('Scenario 4: Login with invalid password (FR-AUTH-02)', () => {
    it('should throw 401 UnauthorizedException when password does not match', async () => {
      const realHashedPassword = await bcrypt.hash('Tesla2026!', 10);
      const userWithRealHash = { ...mockUser, passwordHash: realHashedPassword };

      prismaService.user.findUnique.mockResolvedValue(userWithRealHash);

      await expect(
        authService.login({
          email: 'nusrat@dhakatesla.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw 401 UnauthorizedException when email does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'unknown@dhakatesla.com',
          password: 'AnyPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
