import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: { findByEmail: jest.fn(), create: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed-token') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('throws ConflictException if the email is already taken', async () => {
      usersService.findByEmail.mockResolvedValue({ id: '1' } as any);

      await expect(
        service.register({ email: 'jane@example.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes the password and returns a token on success', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      usersService.create.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
      } as any);

      const result = await service.register({
        email: 'jane@example.com',
        password: 'password123',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(usersService.create).toHaveBeenCalledWith(
        'jane@example.com',
        'hashed-password',
      );
      expect(result.accessToken).toBe('signed-token');
      expect(result.user).toEqual({ id: 'user-1', email: 'jane@example.com' });
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException if the user does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException if the password does not match', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        password: 'hashed-password',
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'jane@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns a token on valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
        password: 'hashed-password',
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'jane@example.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('signed-token');
    });
  });
});