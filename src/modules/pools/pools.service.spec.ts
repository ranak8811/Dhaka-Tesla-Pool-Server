import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PoolsService } from './pools.service.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PoolStatus, RideStatus } from '@prisma/client';

describe('PoolsService', () => {
  let poolsService: PoolsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
      $queryRaw: vi.fn(),
      pool: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      rideRequest: {
        create: vi.fn(),
      },
      rideStatusLog: {
        create: vi.fn(),
      },
    };

    poolsService = new PoolsService(mockPrisma as any);
  });

  describe('reserveSeatAtomic', () => {
    const dummyFare = {
      pickupZone: 'Banani',
      destinationZone: 'Mohakhali',
      baseFarePoysha: 2500,
      distanceChargePoysha: 5250,
      poolDiscountPoysha: 1938,
      totalFarePoysha: 5812,
    };

    it('should successfully reserve seat and mark FULL when 3 seats reached', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        {
          id: 'pool-1',
          vehicle_id: 'veh-1',
          status: PoolStatus.OPEN,
          occupied_seats: 2,
          pickup_zone: 'Banani',
          corridor: 'SouthEast',
        },
      ]);

      mockPrisma.rideRequest.create.mockResolvedValueOnce({
        id: 'ride-1',
        status: RideStatus.MATCHED,
      });

      mockPrisma.pool.update.mockResolvedValueOnce({
        id: 'pool-1',
        occupiedSeats: 3,
        status: PoolStatus.FULL,
      });

      const res = await poolsService.reserveSeatAtomic(
        'pool-1',
        'passenger-shirin',
        1,
        dummyFare,
      );

      expect(res.id).toBe('ride-1');
      expect(mockPrisma.pool.update).toHaveBeenCalledWith({
        where: { id: 'pool-1' },
        data: {
          occupiedSeats: 3,
          status: PoolStatus.FULL,
        },
      });
    });

    it('should throw ConflictException (409) if seats requested exceed remaining capacity', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        {
          id: 'pool-1',
          vehicle_id: 'veh-1',
          status: PoolStatus.OPEN,
          occupied_seats: 2,
          pickup_zone: 'Banani',
          corridor: 'SouthEast',
        },
      ]);

      await expect(
        poolsService.reserveSeatAtomic('pool-1', 'passenger-farhan', 2, dummyFare),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException (409) if pool is not OPEN', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        {
          id: 'pool-1',
          vehicle_id: 'veh-1',
          status: PoolStatus.FULL,
          occupied_seats: 3,
          pickup_zone: 'Banani',
          corridor: 'SouthEast',
        },
      ]);

      await expect(
        poolsService.reserveSeatAtomic('pool-1', 'passenger-farhan', 1, dummyFare),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException (404) if pool row does not exist', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      await expect(
        poolsService.reserveSeatAtomic('non-existent', 'passenger-farhan', 1, dummyFare),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
