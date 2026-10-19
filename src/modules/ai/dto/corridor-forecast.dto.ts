import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CorridorForecastRequestDto {
  @IsString()
  pickupZone: string;

  @IsString()
  destinationZone: string;

  @IsNumber()
  @IsOptional()
  distanceKm?: number;

  @IsString()
  @IsOptional()
  departureTime?: string;
}

export interface AiCorridorForecast {
  pickupZone: string;
  destinationZone: string;
  distanceKm: number;
  congestionLevel: 'LOW' | 'MODERATE' | 'HEAVY' | 'SEVERE_GRIDLOCK';
  predictedDurationMinutes: number;
  nominalDurationMinutes: number;
  delayMinutes: number;
  demandSurgeMultiplier: number;
  demandLevel: 'LOW' | 'NORMAL' | 'PEAK_RUSH';
  smartRecommendation: string;
  batteryConsumptionPercent: number;
  co2SavedKg: number;
  confidenceScore: number;
  modelUsed: string;
  generatedAt: string;
}
