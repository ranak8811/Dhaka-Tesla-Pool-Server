import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DriverController } from './driver.controller.js';
import { DriverService } from './driver.service.js';

describe('DriverController', () => {
  let controller: DriverController;
  let driverService: DriverService;

  beforeEach(() => {
    driverService = {
      toggleStatus: vi.fn(),
      getActivePool: vi.fn(),
    } as any;

    controller = new DriverController(driverService);
  });

  it('delegates toggleStatus to DriverService with current user id', async () => {
    const mockResponse = { isOnline: true, vehicle: 'Bullet' };
    (driverService.toggleStatus as any).mockResolvedValueOnce(mockResponse);

    const res = await controller.toggleStatus(
      { id: 'driver-jashim' },
      { isOnline: true },
    );

    expect(res).toEqual(mockResponse);
    expect(driverService.toggleStatus).toHaveBeenCalledWith('driver-jashim', {
      isOnline: true,
    });
  });

  it('delegates getActivePool to DriverService with current user id', async () => {
    const mockManifest = { poolId: 'pool-1', occupiedSeats: 2 };
    (driverService.getActivePool as any).mockResolvedValueOnce(mockManifest);

    const res = await controller.getActivePool({ id: 'driver-jashim' });

    expect(res).toEqual(mockManifest);
    expect(driverService.getActivePool).toHaveBeenCalledWith('driver-jashim');
  });

  it('delegates getHistory to DriverService with current user id', async () => {
    const mockHistory = [{ poolId: 'pool-completed-1', totalEarningsBdt: 108.12 }];
    (driverService as any).getDriverHistory = vi.fn().mockResolvedValueOnce(mockHistory);

    const res = await controller.getHistory({ id: 'driver-jashim' });

    expect(res).toEqual(mockHistory);
    expect((driverService as any).getDriverHistory).toHaveBeenCalledWith('driver-jashim');
  });

  it('delegates acceptRide to DriverService with driverId and rideId', async () => {
    const mockResult = { rideId: 'ride-1', status: 'MATCHED' };
    (driverService as any).acceptRide = vi.fn().mockResolvedValueOnce(mockResult);

    const res = await controller.acceptRide({ id: 'driver-jashim' }, 'ride-1');

    expect(res).toEqual(mockResult);
    expect((driverService as any).acceptRide).toHaveBeenCalledWith('driver-jashim', 'ride-1');
  });

  it('delegates rejectRide to DriverService with driverId and rideId', async () => {
    const mockResult = { rideId: 'ride-1', status: 'CANCELLED' };
    (driverService as any).rejectRide = vi.fn().mockResolvedValueOnce(mockResult);

    const res = await controller.rejectRide({ id: 'driver-jashim' }, 'ride-1');

    expect(res).toEqual(mockResult);
    expect((driverService as any).rejectRide).toHaveBeenCalledWith('driver-jashim', 'ride-1');
  });
});
