import { describe, it, expect, beforeEach } from 'vitest';
import { PricingService } from './pricing.service.js';

describe('PricingService', () => {
  let pricingService: PricingService;

  beforeEach(() => {
    pricingService = new PricingService();
  });

  describe('calculateFare', () => {
    it('should calculate Nusrat trip correctly (Banani -> Mohakhali = 3.5 km, pooled)', () => {
      const fare = pricingService.calculateFare(3.5, true);

      expect(fare.distanceKm).toBe(3.5);
      expect(fare.baseFarePoysha).toBe(2500);
      expect(fare.distanceChargePoysha).toBe(5250);
      expect(fare.poolDiscountPoysha).toBe(1938);
      expect(fare.totalFarePoysha).toBe(5812);
      expect(fare.totalFareBdt).toBe(58.12);
    });

    it('should calculate Rafiq trip correctly (Banani -> Gulshan 1 = 3.0 km, pooled)', () => {
      const fare = pricingService.calculateFare(3.0, true);

      expect(fare.distanceKm).toBe(3.0);
      expect(fare.baseFarePoysha).toBe(2500);
      expect(fare.distanceChargePoysha).toBe(4500);
      expect(fare.poolDiscountPoysha).toBe(1750);
      expect(fare.totalFarePoysha).toBe(5250);
      expect(fare.totalFareBdt).toBe(52.50);
    });

    it('should calculate Solo Ride fare without discount (3.5 km, solo)', () => {
      const fare = pricingService.calculateFare(3.5, false);

      expect(fare.distanceKm).toBe(3.5);
      expect(fare.baseFarePoysha).toBe(2500);
      expect(fare.distanceChargePoysha).toBe(5250);
      expect(fare.poolDiscountPoysha).toBe(0);
      expect(fare.totalFarePoysha).toBe(7750);
      expect(fare.totalFareBdt).toBe(77.50);
    });
  });

  describe('generateQuote', () => {
    it('should return instant comparison with solo, pooled fares and savings', () => {
      const quote = pricingService.generateQuote(3.5, 'Banani', 'Mohakhali');

      expect(quote.pickupZone).toBe('Banani');
      expect(quote.destinationZone).toBe('Mohakhali');
      expect(quote.distanceKm).toBe(3.5);
      expect(quote.baseFarePoysha).toBe(2500);
      expect(quote.distanceChargePoysha).toBe(5250);

      expect(quote.solo.totalFarePoysha).toBe(7750);
      expect(quote.solo.totalFareBdt).toBe(77.50);

      expect(quote.pooled.poolDiscountPoysha).toBe(1938);
      expect(quote.pooled.totalFarePoysha).toBe(5812);
      expect(quote.pooled.totalFareBdt).toBe(58.12);

      expect(quote.pooled.savingsBdt).toBe(19.38);
    });
  });
});
