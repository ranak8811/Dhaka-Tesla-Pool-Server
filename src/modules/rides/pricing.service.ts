import { Injectable } from '@nestjs/common';

export interface FareBreakdown {
  distanceKm: number;
  baseFarePoysha: number;
  distanceChargePoysha: number;
  poolDiscountPoysha: number;
  totalFarePoysha: number;
  totalFareBdt: number;
}

export interface FareQuote {
  distanceKm: number;
  pickupZone?: string;
  destinationZone?: string;
  baseFarePoysha: number;
  distanceChargePoysha: number;
  solo: {
    totalFarePoysha: number;
    totalFareBdt: number;
  };
  pooled: {
    poolDiscountPoysha: number;
    totalFarePoysha: number;
    totalFareBdt: number;
    savingsBdt: number;
  };
}

@Injectable()
export class PricingService {
  readonly BASE_FARE_POYSHA = 2500;
  readonly PER_KM_POYSHA = 1500;
  readonly POOL_DISCOUNT_PERCENT = 0.25;

  /**
   * passengerFare = baseFare + distanceCharge - poolDiscount
   */
  calculateFare(distanceKm: number, isPooled = true): FareBreakdown {
    const distanceCharge = Math.round(distanceKm * this.PER_KM_POYSHA);
    const subtotal = this.BASE_FARE_POYSHA + distanceCharge;
    const poolDiscount = isPooled
      ? Math.round(subtotal * this.POOL_DISCOUNT_PERCENT)
      : 0;
    const totalFarePoysha = subtotal - poolDiscount;

    return {
      distanceKm,
      baseFarePoysha: this.BASE_FARE_POYSHA,
      distanceChargePoysha: distanceCharge,
      poolDiscountPoysha: poolDiscount,
      totalFarePoysha,
      totalFareBdt: Number((totalFarePoysha / 100).toFixed(2)),
    };
  }

  /**
   * Generates a side-by-side fare quote comparison between Solo and Pooled rides.
   */
  generateQuote(
    distanceKm: number,
    pickupZone?: string,
    destinationZone?: string,
  ): FareQuote {
    const solo = this.calculateFare(distanceKm, false);
    const pooled = this.calculateFare(distanceKm, true);

    const savingsBdt = Number(
      ((solo.totalFarePoysha - pooled.totalFarePoysha) / 100).toFixed(2),
    );

    return {
      distanceKm,
      pickupZone,
      destinationZone,
      baseFarePoysha: this.BASE_FARE_POYSHA,
      distanceChargePoysha: solo.distanceChargePoysha,
      solo: {
        totalFarePoysha: solo.totalFarePoysha,
        totalFareBdt: solo.totalFareBdt,
      },
      pooled: {
        poolDiscountPoysha: pooled.poolDiscountPoysha,
        totalFarePoysha: pooled.totalFarePoysha,
        totalFareBdt: pooled.totalFareBdt,
        savingsBdt,
      },
    };
  }
}
