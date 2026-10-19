import { describe, it, expect, beforeEach } from 'vitest';
import { AiService } from './ai.service.js';
import { ZonesService } from '../zones/zones.service.js';

describe('AiService', () => {
  let aiService: AiService;
  let zonesService: ZonesService;

  beforeEach(() => {
    zonesService = new ZonesService();
    aiService = new AiService(zonesService);
  });

  it('should return a valid corridor forecast with congestion, delay, and recommendations', async () => {
    const result = await aiService.getCorridorForecast({
      pickupZone: 'banani',
      destinationZone: 'mohakhali',
      distanceKm: 3.5,
    });

    expect(result).toBeDefined();
    expect(result.pickupZone).toBe('banani');
    expect(result.destinationZone).toBe('mohakhali');
    expect(result.distanceKm).toBe(3.5);
    expect(['LOW', 'MODERATE', 'HEAVY', 'SEVERE_GRIDLOCK']).toContain(
      result.congestionLevel,
    );
    expect(result.predictedDurationMinutes).toBeGreaterThan(0);
    expect(result.nominalDurationMinutes).toBeGreaterThan(0);
    expect(result.delayMinutes).toBeGreaterThanOrEqual(0);
    expect(result.demandSurgeMultiplier).toBeGreaterThanOrEqual(0.8);
    expect(['LOW', 'NORMAL', 'PEAK_RUSH']).toContain(result.demandLevel);
    expect(result.smartRecommendation).toBeTruthy();
    expect(result.batteryConsumptionPercent).toBeGreaterThan(0);
    expect(result.co2SavedKg).toBeGreaterThan(0);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.8);
    expect(result.modelUsed).toBeTruthy();
  });

  it('should automatically compute distance if distanceKm is omitted', async () => {
    const result = await aiService.getCorridorForecast({
      pickupZone: 'banani',
      destinationZone: 'gulshan1',
    });

    expect(result.distanceKm).toBe(3.0);
    expect(result.predictedDurationMinutes).toBeGreaterThan(0);
  });
});
