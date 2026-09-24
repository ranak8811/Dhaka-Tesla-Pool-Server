import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DriverService } from './driver.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PoolStatus, RideStatus } from '@prisma/client';

describe('DriverService', () => {
  let service: DriverService;
  let mockPrisma: any;

  const mockVehicle = {
    id: 'veh-1',
    driverId: 'driver-jashim',
    name: 'Bullet',
    maxCapacity: 3,
    isOnline: false,
    currentZone: 'Banani',
  };

  beforeEach(() => {
    mockPrisma = {
      vehicle: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      pool: {
        findFirst: vi.fn(),
      },
    };

    service = new DriverService(mockPrisma as any);
  });

  describe('toggleStatus', () => {
    it('Scenario 1: Jashim toggles online status from false to true', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValueOnce(mockVehicle);
      mockPrisma.vehicle.update.mockResolvedValueOnce({
        ...mockVehicle,
        isOnline: true,
      });

      const result = await service.toggleStatus('driver-jashim', {
        isOnline: true,
      });

      expect(result.isOnline).toBe(true);
      expect(result.vehicle).toBe('Bullet');
      expect(mockPrisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: 'veh-1' },
        data: { isOnline: true },
      });
    });

    it('Scenario 3: Driver attempts to go offline with active pool (rejects with 400)', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValueOnce({
        ...mockVehicle,
        isOnline: true,
      });

      mockPrisma.pool.findFirst.mockResolvedValueOnce({
        id: 'pool-1',
        status: PoolStatus.OPEN,
      });

      await expect(
        service.toggleStatus('driver-jashim', { isOnline: false }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if driver has no vehicle', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.toggleStatus('unknown-driver', { isOnline: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getActivePool', () => {
    it('Scenario 2: Jashim fetches active manifest with Nusrat and Rafiq', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValueOnce({
        ...mockVehicle,
        isOnline: true,
      });

      mockPrisma.pool.findFirst.mockResolvedValueOnce({
        id: 'pool-1',
        vehicleId: 'veh-1',
        status: PoolStatus.OPEN,
        occupiedSeats: 2,
        rideRequests: [
          {
            id: 'ride-1',
            seatsRequested: 1,
            pickupZone: 'Banani',
            destinationZone: 'Mohakhali',
            status: RideStatus.MATCHED,
            totalFarePoysha: 5812,
            passenger: { name: 'Nusrat' },
          },
          {
            id: 'ride-2',
            seatsRequested: 1,
            pickupZone: 'Banani',
            destinationZone: 'Gulshan 1',
            status: RideStatus.MATCHED,
            totalFarePoysha: 5250,
            passenger: { name: 'Rafiq' },
          },
        ],
      });

      const manifest = await service.getActivePool('driver-jashim');

      expect(manifest).not.toBeNull();
      expect(manifest?.poolId).toBe('pool-1');
      expect(manifest?.vehicleName).toBe('Bullet');
      expect(manifest?.occupiedSeats).toBe(2);
      expect(manifest?.maxCapacity).toBe(3);
      expect(manifest?.passengers.length).toBe(2);
      expect(manifest?.passengers[0].name).toBe('Nusrat');
      expect(manifest?.passengers[0].fareBdt).toBe(58.12);
      expect(manifest?.passengers[1].name).toBe('Rafiq');
      expect(manifest?.passengers[1].fareBdt).toBe(52.5);
    });

    it('returns null if driver has no active pool', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValueOnce(mockVehicle);
      mockPrisma.pool.findFirst.mockResolvedValueOnce(null);

      const result = await service.getActivePool('driver-jashim');
      expect(result).toBeNull();
    });
  });
});
