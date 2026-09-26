import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DriverService } from './driver.service.js';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
      vehicle: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      pool: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      rideRequest: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      rideStatusLog: {
        create: vi.fn(),
      },
      user: {
        update: vi.fn(),
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

  describe('updatePoolStatus (FSM)', () => {
    const activeRides = [
      { id: 'ride-1', status: RideStatus.MATCHED },
      { id: 'ride-2', status: RideStatus.MATCHED },
    ];

    it('Scenario 1: Jashim transitions MATCHED -> DRIVER_ARRIVED', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValueOnce(mockVehicle);
      mockPrisma.pool.findUnique.mockResolvedValueOnce({
        id: 'pool-1',
        vehicleId: 'veh-1',
        status: PoolStatus.OPEN,
        rideRequests: activeRides,
      });

      mockPrisma.pool.update.mockResolvedValueOnce({
        id: 'pool-1',
        status: PoolStatus.OPEN,
      });

      const result = await service.updatePoolStatus(
        'driver-jashim',
        'pool-1',
        RideStatus.DRIVER_ARRIVED,
      );

      expect(result.rideStatus).toBe(RideStatus.DRIVER_ARRIVED);
      expect(result.updatedRidesCount).toBe(2);
      expect(mockPrisma.rideRequest.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['ride-1', 'ride-2'] } },
        data: { status: RideStatus.DRIVER_ARRIVED },
      });
      expect(mockPrisma.rideStatusLog.create).toHaveBeenCalledTimes(2);
    });

    it('Scenario 2: Jashim transitions DRIVER_ARRIVED -> STARTED', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValueOnce(mockVehicle);
      mockPrisma.pool.findUnique.mockResolvedValueOnce({
        id: 'pool-1',
        vehicleId: 'veh-1',
        status: PoolStatus.OPEN,
        rideRequests: [
          { id: 'ride-1', status: RideStatus.DRIVER_ARRIVED },
          { id: 'ride-2', status: RideStatus.DRIVER_ARRIVED },
        ],
      });

      mockPrisma.pool.update.mockResolvedValueOnce({
        id: 'pool-1',
        status: PoolStatus.IN_TRANSIT,
      });

      const result = await service.updatePoolStatus(
        'driver-jashim',
        'pool-1',
        RideStatus.STARTED,
      );

      expect(result.status).toBe(PoolStatus.IN_TRANSIT);
      expect(result.rideStatus).toBe(RideStatus.STARTED);
    });

    it('transitions STARTED -> COMPLETED and deducts passenger wallet balance for TeslaPay rides', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValueOnce(mockVehicle);
      mockPrisma.pool.findUnique.mockResolvedValueOnce({
        id: 'pool-1',
        vehicleId: 'veh-1',
        status: PoolStatus.IN_TRANSIT,
        rideRequests: [
          {
            id: 'ride-1',
            passengerId: 'passenger-nusrat-1',
            status: RideStatus.STARTED,
            paymentMethod: 'TESLAPAY',
            totalFarePoysha: 5812,
          },
        ],
      });

      mockPrisma.pool.update.mockResolvedValueOnce({
        id: 'pool-1',
        status: PoolStatus.COMPLETED,
      });

      const result = await service.updatePoolStatus(
        'driver-jashim',
        'pool-1',
        RideStatus.COMPLETED,
      );

      expect(result.status).toBe(PoolStatus.COMPLETED);
      expect(result.rideStatus).toBe(RideStatus.COMPLETED);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'passenger-nusrat-1' },
        data: {
          walletBalancePoysha: {
            decrement: 5812,
          },
        },
      });
    });

    it('Scenario 5: Invalid transition MATCHED -> COMPLETED throws 400 Bad Request', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValueOnce(mockVehicle);
      mockPrisma.pool.findUnique.mockResolvedValueOnce({
        id: 'pool-1',
        vehicleId: 'veh-1',
        status: PoolStatus.OPEN,
        rideRequests: activeRides,
      });

      await expect(
        service.updatePoolStatus(
          'driver-jashim',
          'pool-1',
          RideStatus.COMPLETED,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException if driver does not own vehicle', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValueOnce(mockVehicle);
      mockPrisma.pool.findUnique.mockResolvedValueOnce({
        id: 'pool-1',
        vehicleId: 'other-vehicle',
        status: PoolStatus.OPEN,
        rideRequests: activeRides,
      });

      await expect(
        service.updatePoolStatus(
          'driver-jashim',
          'pool-1',
          RideStatus.DRIVER_ARRIVED,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getDriverHistory', () => {
    it('returns completed pools with calculated earnings and passenger list', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValueOnce(mockVehicle);

      const mockCompletedPool = {
        id: 'pool-completed-1',
        vehicleId: 'veh-1',
        pickupZone: 'Banani',
        corridor: 'SouthEast',
        status: PoolStatus.COMPLETED,
        occupiedSeats: 2,
        createdAt: new Date('2026-09-26T08:00:00Z'),
        rideRequests: [
          {
            id: 'ride-1',
            pickupZone: 'Banani',
            destinationZone: 'Mohakhali',
            seatsRequested: 1,
            status: RideStatus.COMPLETED,
            totalFarePoysha: 5812,
            passenger: {
              id: 'p-1',
              name: 'Nusrat Jahan',
              email: 'nusrat@tesla.dhaka',
            },
          },
          {
            id: 'ride-2',
            pickupZone: 'Banani',
            destinationZone: 'Gulshan 1',
            seatsRequested: 1,
            status: RideStatus.COMPLETED,
            totalFarePoysha: 5000,
            passenger: {
              id: 'p-2',
              name: 'Rafiq Islam',
              email: 'rafiq@tesla.dhaka',
            },
          },
        ],
      };

      mockPrisma.pool.findMany.mockResolvedValueOnce([mockCompletedPool]);

      const result = await service.getDriverHistory('driver-jashim');

      expect(mockPrisma.vehicle.findUnique).toHaveBeenCalledWith({
        where: { driverId: 'driver-jashim' },
      });
      expect(mockPrisma.pool.findMany).toHaveBeenCalledWith({
        where: {
          vehicleId: 'veh-1',
          status: PoolStatus.COMPLETED,
        },
        include: {
          rideRequests: {
            include: {
              passenger: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].poolId).toBe('pool-completed-1');
      expect(result[0].totalEarningsBdt).toBe(108.12); // (5812 + 5000) / 100
      expect(result[0].passengers).toHaveLength(2);
      expect(result[0].passengers[0].name).toBe('Nusrat Jahan');
      expect(result[0].passengers[0].fareBdt).toBe(58.12);
    });

    it('throws NotFoundException if vehicle not found for driver', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValueOnce(null);

      await expect(service.getDriverHistory('unknown-driver')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('acceptRide', () => {
    it('successfully accepts incoming ride request and transitions to MATCHED', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValueOnce(mockVehicle);
      mockPrisma.rideRequest.findUnique.mockResolvedValueOnce({
        id: 'ride-req-1',
        status: RideStatus.REQUESTED,
        seatsRequested: 1,
        pool: { id: 'pool-1', vehicleId: 'veh-1' },
        passenger: { id: 'p-1', name: 'Nusrat Jahan', email: 'nusrat@tesla.dhaka' },
      });

      mockPrisma.rideRequest.update.mockResolvedValueOnce({
        id: 'ride-req-1',
        status: RideStatus.MATCHED,
        passenger: { id: 'p-1', name: 'Nusrat Jahan', email: 'nusrat@tesla.dhaka' },
      });

      const res = await service.acceptRide('driver-jashim', 'ride-req-1');

      expect(res.status).toBe(RideStatus.MATCHED);
      expect(res.passengerName).toBe('Nusrat Jahan');
      expect(mockPrisma.rideRequest.update).toHaveBeenCalledWith({
        where: { id: 'ride-req-1' },
        data: { status: RideStatus.MATCHED },
        include: {
          passenger: {
            select: { id: true, name: true, email: true },
          },
        },
      });
      expect(mockPrisma.rideStatusLog.create).toHaveBeenCalledWith({
        data: {
          rideId: 'ride-req-1',
          previousStatus: RideStatus.REQUESTED,
          newStatus: RideStatus.MATCHED,
          changedBy: 'driver-jashim',
        },
      });
    });

    it('throws BadRequestException if ride is already MATCHED or not REQUESTED', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValueOnce(mockVehicle);
      mockPrisma.rideRequest.findUnique.mockResolvedValueOnce({
        id: 'ride-req-1',
        status: RideStatus.MATCHED,
        pool: { id: 'pool-1', vehicleId: 'veh-1' },
      });

      await expect(
        service.acceptRide('driver-jashim', 'ride-req-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException if ride belongs to a different vehicle', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValueOnce(mockVehicle);
      mockPrisma.rideRequest.findUnique.mockResolvedValueOnce({
        id: 'ride-req-1',
        status: RideStatus.REQUESTED,
        pool: { id: 'pool-2', vehicleId: 'different-veh' },
      });

      await expect(
        service.acceptRide('driver-jashim', 'ride-req-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('rejectRide', () => {
    it('successfully declines ride, marks CANCELLED, releases pool seats, and logs status', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValueOnce(mockVehicle);
      mockPrisma.rideRequest.findUnique.mockResolvedValueOnce({
        id: 'ride-req-1',
        status: RideStatus.REQUESTED,
        seatsRequested: 1,
        pool: {
          id: 'pool-1',
          vehicleId: 'veh-1',
          occupiedSeats: 1,
          status: PoolStatus.OPEN,
          rideRequests: [
            { id: 'ride-req-1', status: RideStatus.REQUESTED },
          ],
        },
      });

      mockPrisma.rideRequest.update.mockResolvedValueOnce({
        id: 'ride-req-1',
        status: RideStatus.CANCELLED,
      });

      const res = await service.rejectRide('driver-jashim', 'ride-req-1');

      expect(res.status).toBe(RideStatus.CANCELLED);
      expect(mockPrisma.pool.update).toHaveBeenCalledWith({
        where: { id: 'pool-1' },
        data: {
          occupiedSeats: 0,
          status: PoolStatus.CANCELLED,
        },
      });
      expect(mockPrisma.rideStatusLog.create).toHaveBeenCalledWith({
        data: {
          rideId: 'ride-req-1',
          previousStatus: RideStatus.REQUESTED,
          newStatus: RideStatus.CANCELLED,
          changedBy: 'driver-jashim',
        },
      });
    });
  });
});
