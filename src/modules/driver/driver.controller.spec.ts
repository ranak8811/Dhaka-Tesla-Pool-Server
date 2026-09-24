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
});
