import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RidesService } from './rides.service.js';
import { PricingService } from './pricing.service.js';
import { ZonesService } from '../zones/zones.service.js';
import { PoolsService } from '../pools/pools.service.js';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentMethod, PoolStatus, RideStatus } from '@prisma/client';

describe('RidesService', () => {
  let ridesService: RidesService;
  let pricingService: PricingService;
  let zonesService: ZonesService;
  let poolsService: PoolsService;
  let mockPrisma: any;

  const mockDriver = {
    id: 'driver-jashim-1',
    name: 'Jashim Uddin',
    email: 'jashim@tesla.dhaka',
  };

  const mockVehicle = {
    id: 'vehicle-bullet-1',
    driverId: 'driver-jashim-1',
    name: 'Bullet',
    maxCapacity: 3,
    isOnline: true,
    currentZone: 'Banani',
    driver: mockDriver,
  };

  beforeEach(() => {
    pricingService = new PricingService();
    zonesService = new ZonesService();

    mockPrisma = {
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
      $queryRaw: vi.fn(),
      rideRequest: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      rideStatusLog: {
        create: vi.fn(),
      },
      pool: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      vehicle: {
        findFirst: vi.fn(),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue({ walletBalancePoysha: 50000 }),
      },
    };

    poolsService = new PoolsService(mockPrisma as any);
    ridesService = new RidesService(
      mockPrisma as any,
      zonesService,
      pricingService,
      poolsService,
    );
  });

  describe('requestRide & corridor matching', () => {
    it('Scenario 1: Nusrat books Banani -> Mohakhali (creates new pool, status MATCHED, occupied=1)', async () => {
      mockPrisma.rideRequest.findFirst.mockResolvedValueOnce(null);
      mockPrisma.pool.findMany.mockResolvedValueOnce([]);
      mockPrisma.vehicle.findFirst.mockResolvedValueOnce(mockVehicle);
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: mockVehicle.id, is_online: true }]);
      mockPrisma.pool.findFirst.mockResolvedValueOnce(null);

      const createdPool = {
        id: 'pool-1',
        vehicleId: mockVehicle.id,
        pickupZone: 'Banani',
        corridor: 'SouthEast',
        occupiedSeats: 1,
        status: PoolStatus.OPEN,
      };
      mockPrisma.pool.create.mockResolvedValueOnce(createdPool);

      const createdRide = {
        id: 'ride-nusrat-1',
        passengerId: 'passenger-nusrat-1',
        poolId: 'pool-1',
        pickupZone: 'Banani',
        destinationZone: 'Mohakhali',
        seatsRequested: 1,
        status: RideStatus.MATCHED,
        baseFarePoysha: 2500,
        distanceChargePoysha: 5250,
        poolDiscountPoysha: 1938,
        totalFarePoysha: 5812,
        pool: {
          ...createdPool,
          vehicle: mockVehicle,
        },
      };
      mockPrisma.rideRequest.create.mockResolvedValueOnce(createdRide);
      mockPrisma.rideStatusLog.create.mockResolvedValueOnce({});

      const result = await ridesService.requestRide('passenger-nusrat-1', {
        pickupZone: 'banani',
        destinationZone: 'mohakhali',
        seatsRequested: 1,
      });

      expect(result.status).toBe(RideStatus.MATCHED);
      expect(result.totalFarePoysha).toBe(5812);
      expect(result.pool.occupiedSeats).toBe(1);
      expect(result.pool.vehicle.name).toBe('Bullet');
    });

    it("Scenario 2: Rafiq books Banani -> Gulshan 1 (joins Nusrat's existing pool, occupied=2)", async () => {
      mockPrisma.rideRequest.findFirst.mockResolvedValueOnce(null);

      const existingPool = {
        id: 'pool-1',
        vehicle_id: mockVehicle.id,
        pickup_zone: 'Banani',
        corridor: 'SouthEast',
        occupied_seats: 1,
        status: PoolStatus.OPEN,
      };
      mockPrisma.pool.findMany.mockResolvedValueOnce([{
        id: 'pool-1',
        vehicleId: mockVehicle.id,
        pickupZone: 'Banani',
        corridor: 'SouthEast',
        occupiedSeats: 1,
        status: PoolStatus.OPEN,
      }]);

      mockPrisma.$queryRaw.mockResolvedValueOnce([existingPool]);

      const updatedPool = {
        ...existingPool,
        occupied_seats: 2,
        status: PoolStatus.OPEN,
      };
      mockPrisma.pool.update.mockResolvedValueOnce(updatedPool);

      const createdRide = {
        id: 'ride-rafiq-1',
        passengerId: 'passenger-rafiq-1',
        poolId: 'pool-1',
        pickupZone: 'Banani',
        destinationZone: 'Gulshan 1',
        seatsRequested: 1,
        status: RideStatus.MATCHED,
        baseFarePoysha: 2500,
        distanceChargePoysha: 4500,
        poolDiscountPoysha: 1750,
        totalFarePoysha: 5250,
        pool: {
          ...updatedPool,
          vehicle: mockVehicle,
        },
      };
      mockPrisma.rideRequest.create.mockResolvedValueOnce(createdRide);
      mockPrisma.rideStatusLog.create.mockResolvedValueOnce({});

      const result = await ridesService.requestRide('passenger-rafiq-1', {
        pickupZone: 'banani',
        destinationZone: 'gulshan1',
        seatsRequested: 1,
      });

      expect(result.status).toBe(RideStatus.MATCHED);
      expect(result.totalFarePoysha).toBe(5250);
      expect(result.pool.occupied_seats).toBe(2);
      expect(mockPrisma.pool.update).toHaveBeenCalledWith({
        where: { id: 'pool-1' },
        data: {
          occupiedSeats: 2,
          status: PoolStatus.OPEN,
        },
      });
    });

    it('Scenario 3: Should prevent booking if passenger already has active ride', async () => {
      mockPrisma.rideRequest.findFirst.mockResolvedValueOnce({
        id: 'existing-ride',
        status: RideStatus.MATCHED,
      });

      await expect(
        ridesService.requestRide('passenger-nusrat-1', {
          pickupZone: 'banani',
          destinationZone: 'mohakhali',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects ride booking if TeslaPay wallet balance is insufficient', async () => {
      mockPrisma.rideRequest.findFirst.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique.mockResolvedValueOnce({ walletBalancePoysha: 1000 }); // only ৳10

      await expect(
        ridesService.requestRide('passenger-nusrat-1', {
          pickupZone: 'Banani',
          destinationZone: 'Mohakhali',
          paymentMethod: PaymentMethod.TESLAPAY,
        }),
      ).rejects.toThrow(/Insufficient TeslaPay balance/);
    });
  });

  describe('getActiveRide', () => {
    it("Scenario 4: Query /rides/active for Nusrat returns active ride with Jashim's Bullet", async () => {
      const activeRide = {
        id: 'ride-nusrat-1',
        passengerId: 'passenger-nusrat-1',
        status: RideStatus.MATCHED,
        pickupZone: 'Banani',
        destinationZone: 'Mohakhali',
        totalFarePoysha: 5812,
        pool: {
          id: 'pool-1',
          occupiedSeats: 2,
          vehicle: mockVehicle,
        },
      };
      mockPrisma.rideRequest.findFirst.mockResolvedValueOnce(activeRide);

      const result = await ridesService.getActiveRide('passenger-nusrat-1');

      expect(result).not.toBeNull();
      expect(result?.status).toBe(RideStatus.MATCHED);
      expect(result?.pool?.vehicle?.driver?.name).toBe('Jashim Uddin');
    });
  });

  describe('cancelRide', () => {
    const mockRide = {
      id: 'ride-1',
      passengerId: 'passenger-nusrat-1',
      poolId: 'pool-1',
      seatsRequested: 1,
      status: RideStatus.MATCHED,
      pool: {
        id: 'pool-1',
        occupiedSeats: 2,
        status: PoolStatus.OPEN,
      },
    };

    it('Scenario 3: Nusrat cancels while status is MATCHED (succeeds and releases seat)', async () => {
      mockPrisma.rideRequest.findUnique.mockResolvedValueOnce(mockRide);
      mockPrisma.rideRequest.update.mockResolvedValueOnce({
        ...mockRide,
        status: RideStatus.CANCELLED,
      });
      mockPrisma.pool.update.mockResolvedValueOnce({});
      mockPrisma.rideStatusLog.create.mockResolvedValueOnce({});

      const result = await ridesService.cancelRide('ride-1', 'passenger-nusrat-1');

      expect(result.status).toBe(RideStatus.CANCELLED);
      expect(mockPrisma.pool.update).toHaveBeenCalledWith({
        where: { id: 'pool-1' },
        data: {
          occupiedSeats: 1,
          status: PoolStatus.OPEN,
        },
      });
      expect(mockPrisma.rideStatusLog.create).toHaveBeenCalledWith({
        data: {
          rideId: 'ride-1',
          previousStatus: RideStatus.MATCHED,
          newStatus: RideStatus.CANCELLED,
          changedBy: 'passenger-nusrat-1',
        },
      });
    });

    it('Scenario 4: Nusrat attempts to cancel while STARTED (rejects with 400)', async () => {
      mockPrisma.rideRequest.findUnique.mockResolvedValueOnce({
        ...mockRide,
        status: RideStatus.STARTED,
      });

      await expect(
        ridesService.cancelRide('ride-1', 'passenger-nusrat-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when user attempts cross-tenant cancellation', async () => {
      mockPrisma.rideRequest.findUnique.mockResolvedValueOnce(mockRide);

      await expect(
        ridesService.cancelRide('ride-1', 'other-passenger-id'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when ride does not exist', async () => {
      mockPrisma.rideRequest.findUnique.mockResolvedValueOnce(null);

      await expect(
        ridesService.cancelRide('non-existent', 'passenger-nusrat-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPassengerHistory', () => {
    it('returns formatted past rides with driver info and status logs', async () => {
      const mockHistoryRecord = {
        id: 'ride-past-1',
        passengerId: 'passenger-nusrat-1',
        pickupZone: 'Banani',
        destinationZone: 'Mohakhali',
        seatsRequested: 1,
        status: RideStatus.COMPLETED,
        totalFarePoysha: 5812,
        paymentStatus: 'PAID',
        createdAt: new Date('2026-09-26T10:00:00Z'),
        updatedAt: new Date('2026-09-26T10:20:00Z'),
        pool: {
          vehicle: {
            name: 'Bullet',
            driver: {
              id: 'driver-jashim-1',
              name: 'Jashim Uddin',
              email: 'jashim@tesla.dhaka',
            },
          },
        },
        statusLogs: [
          {
            previousStatus: RideStatus.REQUESTED,
            newStatus: RideStatus.MATCHED,
            createdAt: new Date('2026-09-26T10:01:00Z'),
          },
          {
            previousStatus: RideStatus.STARTED,
            newStatus: RideStatus.COMPLETED,
            createdAt: new Date('2026-09-26T10:20:00Z'),
          },
        ],
      };

      mockPrisma.rideRequest.findMany.mockResolvedValueOnce([mockHistoryRecord]);

      const result = await ridesService.getPassengerHistory('passenger-nusrat-1');

      expect(mockPrisma.rideRequest.findMany).toHaveBeenCalledWith({
        where: {
          passengerId: 'passenger-nusrat-1',
          status: {
            in: [RideStatus.COMPLETED, RideStatus.CANCELLED],
          },
        },
        include: {
          pool: {
            include: {
              vehicle: {
                include: {
                  driver: {
                    select: { id: true, name: true, email: true },
                  },
                },
              },
            },
          },
          statusLogs: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'ride-past-1',
        pickupZone: 'Banani',
        destinationZone: 'Mohakhali',
        seatsRequested: 1,
        status: RideStatus.COMPLETED,
        totalFarePoysha: 5812,
        fareBdt: 58.12,
        paymentStatus: 'PAID',
        createdAt: mockHistoryRecord.createdAt,
        updatedAt: mockHistoryRecord.updatedAt,
        driver: {
          name: 'Jashim Uddin',
          vehicleName: 'Bullet',
        },
        statusLogs: [
          {
            previousStatus: RideStatus.REQUESTED,
            newStatus: RideStatus.MATCHED,
            timestamp: mockHistoryRecord.statusLogs[0].createdAt,
          },
          {
            previousStatus: RideStatus.STARTED,
            newStatus: RideStatus.COMPLETED,
            timestamp: mockHistoryRecord.statusLogs[1].createdAt,
          },
        ],
      });
    });

    it('returns empty array when passenger has no completed or cancelled rides', async () => {
      mockPrisma.rideRequest.findMany.mockResolvedValueOnce([]);

      const result = await ridesService.getPassengerHistory('passenger-new-1');

      expect(result).toEqual([]);
    });
  });
});
