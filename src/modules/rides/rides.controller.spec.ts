import { describe, it, expect, beforeEach } from 'vitest';
import { RidesController } from './rides.controller.js';
import { PricingService } from './pricing.service.js';
import { ZonesService } from '../zones/zones.service.js';
import { BadRequestException } from '@nestjs/common';

describe('RidesController', () => {
  let controller: RidesController;
  let pricingService: PricingService;
  let zonesService: ZonesService;

  beforeEach(() => {
    pricingService = new PricingService();
    zonesService = new ZonesService();
    controller = new RidesController(pricingService, zonesService);
  });

  it('should return accurate quote using pickupZone and destinationZone (Nusrat case)', () => {
    const quote = controller.getQuote({
      pickupZone: 'banani',
      destinationZone: 'mohakhali',
    });

    expect(quote.pickupZone).toBe('Banani');
    expect(quote.destinationZone).toBe('Mohakhali');
    expect(quote.distanceKm).toBe(3.5);
    expect(quote.solo.totalFarePoysha).toBe(7750);
    expect(quote.solo.totalFareBdt).toBe(77.50);
    expect(quote.pooled.totalFarePoysha).toBe(5812);
    expect(quote.pooled.totalFareBdt).toBe(58.12);
    expect(quote.pooled.savingsBdt).toBe(19.38);
  });

  it('should return accurate quote using distanceKm directly', () => {
    const quote = controller.getQuote({
      distanceKm: 3.0,
    });

    expect(quote.distanceKm).toBe(3.0);
    expect(quote.solo.totalFarePoysha).toBe(7000);
    expect(quote.pooled.totalFarePoysha).toBe(5250);
    expect(quote.pooled.totalFareBdt).toBe(52.50);
  });

  it('should throw BadRequestException if neither zones nor distanceKm provided', () => {
    expect(() => controller.getQuote({})).toThrow(BadRequestException);
  });

  it('should delegate getHistory to ridesService.getPassengerHistory with current user id', async () => {
    const mockRidesService: any = {
      getPassengerHistory: vi.fn().mockResolvedValueOnce([{ id: 'ride-1' }]),
    };
    const ctrl = new RidesController(pricingService, zonesService, mockRidesService);
    const result = await ctrl.getHistory({ id: 'passenger-nusrat-1' });

    expect(mockRidesService.getPassengerHistory).toHaveBeenCalledWith('passenger-nusrat-1');
    expect(result).toEqual([{ id: 'ride-1' }]);
  });
});
