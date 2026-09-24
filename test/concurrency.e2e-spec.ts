import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { PoolStatus, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

describe('CONC-01 · Pool Capacity Concurrency Test (PRD Section 12)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let shirinToken: string;
  let farhanToken: string;
  let bulletVehicleId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    const passwordHash = await bcrypt.hash('Tesla2026!', 10);
    const jashim = await prisma.user.upsert({
      where: { email: 'jashim@dhakatesla.com' },
      update: {},
      create: {
        email: 'jashim@dhakatesla.com',
        passwordHash,
        name: 'Jashim',
        role: Role.DRIVER,
      },
    });

    const bullet = await prisma.vehicle.upsert({
      where: { driverId: jashim.id },
      update: { isOnline: true },
      create: {
        driverId: jashim.id,
        name: 'Bullet',
        maxCapacity: 3,
        isOnline: true,
        currentZone: 'Banani',
      },
    });
    bulletVehicleId = bullet.id;

    const shirin = await prisma.user.upsert({
      where: { email: 'shirin@dhakatesla.com' },
      update: {},
      create: {
        email: 'shirin@dhakatesla.com',
        passwordHash,
        name: 'Shirin',
        role: Role.PASSENGER,
      },
    });

    const farhan = await prisma.user.upsert({
      where: { email: 'farhan@dhakatesla.com' },
      update: {},
      create: {
        email: 'farhan@dhakatesla.com',
        passwordHash,
        name: 'Farhan',
        role: Role.PASSENGER,
      },
    });

    shirinToken = jwtService.sign({
      sub: shirin.id,
      email: shirin.email,
      role: Role.PASSENGER,
    });

    farhanToken = jwtService.sign({
      sub: farhan.id,
      email: farhan.email,
      role: Role.PASSENGER,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function setupPoolWithOccupiedSeats(occupiedSeats: number) {
    const testUsers = await prisma.user.findMany({
      where: { email: { in: ['shirin@dhakatesla.com', 'farhan@dhakatesla.com'] } },
      select: { id: true },
    });
    await prisma.rideRequest.deleteMany({
      where: { passengerId: { in: testUsers.map((u) => u.id) } },
    });

    return prisma.pool.create({
      data: {
        vehicleId: bulletVehicleId,
        pickupZone: 'Banani',
        corridor: 'SouthEast',
        occupiedSeats,
        status: occupiedSeats >= 3 ? PoolStatus.FULL : PoolStatus.OPEN,
      },
    });
  }

  function requestRideAsUser(token: string, body: any) {
    return request(app.getHttpServer())
      .post('/api/v1/rides/request')
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  it('prevents overbooking when 2 requests compete simultaneously for 1 seat', async () => {
    const pool = await setupPoolWithOccupiedSeats(2);

    const [resShirin, resFarhan] = await Promise.allSettled([
      requestRideAsUser(shirinToken, { poolId: pool.id, seats: 1 }),
      requestRideAsUser(farhanToken, { poolId: pool.id, seats: 1 }),
    ]);

    const statuses = [
      (resShirin as any).value?.status,
      (resFarhan as any).value?.status,
    ].sort();

    expect(statuses).toEqual([201, 409]);

    const updatedPool = await prisma.pool.findUnique({
      where: { id: pool.id },
    });

    expect(updatedPool).not.toBeNull();
    expect(updatedPool?.occupiedSeats).toBe(3);
    expect(updatedPool?.status).toBe(PoolStatus.FULL);
  });

  it('rejects booking when requesting 2 seats but only 1 is available (EC-04)', async () => {
    const pool = await setupPoolWithOccupiedSeats(2);

    const res = await requestRideAsUser(shirinToken, {
      poolId: pool.id,
      seats: 2,
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Pool capacity exceeded');

    const currentPool = await prisma.pool.findUnique({ where: { id: pool.id } });
    expect(currentPool?.occupiedSeats).toBe(2);
  });

  it('rejects booking when pool is already FULL', async () => {
    const fullPool = await setupPoolWithOccupiedSeats(3);

    const res = await requestRideAsUser(shirinToken, {
      poolId: fullPool.id,
      seats: 1,
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('not open');
  });
});
