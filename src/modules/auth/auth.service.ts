import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
        role: dto.role ?? 'PASSENGER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        walletBalancePoysha: true,
        createdAt: true,
      },
    });

    const accessToken = this.generateToken(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        walletBalancePoysha: user.walletBalancePoysha,
        walletBalanceBdt: Number((user.walletBalancePoysha / 100).toFixed(2)),
      },
      accessToken,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.generateToken(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        walletBalancePoysha: user.walletBalancePoysha,
        walletBalanceBdt: Number((user.walletBalancePoysha / 100).toFixed(2)),
      },
      accessToken,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        walletBalancePoysha: true,
        createdAt: true,
        vehicle: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      ...user,
      walletBalanceBdt: Number((user.walletBalancePoysha / 100).toFixed(2)),
    };
  }

  async topupWallet(userId: string, amountBdt: number = 500) {
    const amountPoysha = Math.max(100, Math.round(amountBdt * 100));
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        walletBalancePoysha: {
          increment: amountPoysha,
        },
      },
      select: {
        id: true,
        name: true,
        walletBalancePoysha: true,
      },
    });

    return {
      message: `Successfully topped up ৳${(amountPoysha / 100).toFixed(2)} to TeslaPay Wallet`,
      walletBalancePoysha: user.walletBalancePoysha,
      walletBalanceBdt: Number((user.walletBalancePoysha / 100).toFixed(2)),
    };
  }

  private generateToken(userId: string, email: string, role: string): string {
    const payload = { sub: userId, email, role };
    return this.jwtService.sign(payload);
  }
}
