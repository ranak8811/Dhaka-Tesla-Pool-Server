import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RidesService } from './rides.service.js';
import { PricingService } from './pricing.service.js';
import { ZonesService } from '../zones/zones.service.js';
import { PoolsService } from '../pools/pools.service.js';
import { BadRequestException } from '@nestjs/common';
import { PoolStatus, RideStatus } from '@prisma/client';

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
      rideRequest: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      rideStatusLog: {
        create: vi.fn(),
      },
      pool: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      vehicle: {
        findFirst: vi.fn(),
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
      // 1. Nusrat has no active ride
      mockPrisma.rideRequest.findFirst.mockResolvedValueOnce(null);

      // 2. No open pool exists yet on SouthEast corridor
      mockPrisma.pool.findMany.mockResolvedValueOnce([]);

      // 3. Online vehicle available: Jashim with Bullet
      mockPrisma.vehicle.findFirst.mockResolvedValueOnce(mockVehicle);

      // 4. Create new pool
      const createdPool = {
        id: 'pool-1',
        vehicleId: mockVehicle.id,
        pickupZone: 'Banani',
        corridor: 'SouthEast',
        occupiedSeats: 1,
        status: PoolStatus.OPEN,
      };
      mockPrisma.pool.create.mockResolvedValueOnce(createdPool);

      // 5. Create ride
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
      expect(mockPrisma.pool.create).toHaveBeenCalledWith({
        data: {
          vehicleId: mockVehicle.id,
          pickupZone: 'Banani',
          corridor: 'SouthEast',
          occupiedSeats: 1,
          status: PoolStatus.OPEN,
        },
      });
    });

    it("Scenario 2: Rafiq books Banani -> Gulshan 1 (joins Nusrat's existing pool, occupied=2)", async () => {
      // 1. Rafiq has no active ride
      mockPrisma.rideRequest.findFirst.mockResolvedValueOnce(null);

      // 2. Existing open pool on SouthEast corridor found (Nusrat's pool)
      const existingPool = {
        id: 'pool-1',
        vehicleId: mockVehicle.id,
        pickupZone: 'Banani',
        corridor: 'SouthEast',
        occupiedSeats: 1,
        status: PoolStatus.OPEN,
      };
      mockPrisma.pool.findMany.mockResolvedValueOnce([existingPool]);
      mockPrisma.pool.findUnique.mockResolvedValueOnce(existingPool);

      // 3. Increment seats to 2
      const updatedPool = {
        ...existingPool,
        occupiedSeats: 2,
        status: PoolStatus.OPEN,
      };
      mockPrisma.pool.update.mockResolvedValueOnce(updatedPool);

      // 4. Create ride for Rafiq
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
      expect(result.pool.occupiedSeats).toBe(2);
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
});
