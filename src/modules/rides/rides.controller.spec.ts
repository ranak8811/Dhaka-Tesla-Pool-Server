import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RidesController } from './rides.controller.js';
import { PricingService } from './pricing.service.js';
import { ZonesService } from '../zones/zones.service.js';
import { BadRequestException } from '@nestjs/common';

describe('RidesController', () => {
  let controller: RidesController;
  let pricingService: PricingService;
  let zonesService: ZonesService;
  let mockRidesService: any;
  let mockAiService: any;

  beforeEach(() => {
    pricingService = new PricingService();
    zonesService = new ZonesService();
    mockRidesService = {
      requestRide: vi.fn(),
      getActiveRide: vi.fn(),
      getPassengerHistory: vi.fn(),
      cancelRide: vi.fn(),
    };
    mockAiService = {
      getCorridorForecast: vi.fn().mockResolvedValue({
        congestionLevel: 'MODERATE',
        predictedDurationMinutes: 15,
        nominalDurationMinutes: 10,
        delayMinutes: 5,
        demandSurgeMultiplier: 1.0,
        demandLevel: 'NORMAL',
        smartRecommendation: 'Smooth corridor flow.',
        batteryConsumptionPercent: 0.8,
        co2SavedKg: 0.49,
        confidenceScore: 0.92,
        modelUsed: 'gemini-3.5-flash-lite',
      }),
    };
    controller = new RidesController(
      pricingService,
      zonesService,
      mockRidesService,
      mockAiService,
    );
  });

  it('should return accurate quote using pickupZone and destinationZone (Nusrat case)', async () => {
    const quote = await controller.getQuote({
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

  it('should return accurate quote using distanceKm directly', async () => {
    const quote = await controller.getQuote({
      distanceKm: 3.0,
    });

    expect(quote.distanceKm).toBe(3.0);
    expect(quote.solo.totalFarePoysha).toBe(7000);
    expect(quote.pooled.totalFarePoysha).toBe(5250);
    expect(quote.pooled.totalFareBdt).toBe(52.50);
  });

  it('should throw BadRequestException if neither zones nor distanceKm provided', async () => {
    await expect(controller.getQuote({})).rejects.toThrow(BadRequestException);
  });

  it('should delegate getHistory to ridesService.getPassengerHistory with current user id', async () => {
    const mockRidesService: any = {
      getPassengerHistory: vi.fn().mockResolvedValueOnce([{ id: 'ride-1' }]),
    };
    const ctrl = new RidesController(
      pricingService,
      zonesService,
      mockRidesService,
      mockAiService,
    );
    const result = await ctrl.getHistory({ id: 'passenger-nusrat-1' });

    expect(mockRidesService.getPassengerHistory).toHaveBeenCalledWith('passenger-nusrat-1');
    expect(result).toEqual([{ id: 'ride-1' }]);
  });
});
