import { Injectable, Logger } from '@nestjs/common';
import {
  AiCorridorForecast,
  CorridorForecastRequestDto,
} from './dto/corridor-forecast.dto.js';
import { ZonesService } from '../zones/zones.service.js';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly zonesService: ZonesService) {}

  /**
   * Generates AI-powered corridor traffic delay, demand surge, and eco-recommendations.
   * Leverages Google Gemini model specified in environment (default: gemini-3.5-flash-lite)
   * with automated deterministic fallback for resilience.
   */
  async getCorridorForecast(
    dto: CorridorForecastRequestDto,
  ): Promise<AiCorridorForecast> {
    const pickupZone = dto.pickupZone;
    const destinationZone = dto.destinationZone;

    let distanceKm = dto.distanceKm;
    if (!distanceKm || distanceKm <= 0) {
      try {
        distanceKm = this.zonesService.getDistanceKm(pickupZone, destinationZone);
      } catch {
        distanceKm = 5.0; // Sensible default corridor fallback
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const now = new Date();
    const currentHour = now.getHours();
    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const currentDay = dayNames[now.getDay()];

    if (apiKey) {
      try {
        const aiResult = await this.callGeminiApi(
          apiKey,
          model,
          pickupZone,
          destinationZone,
          distanceKm,
          currentHour,
          currentDay,
        );
        if (aiResult) {
          return {
            pickupZone,
            destinationZone,
            distanceKm,
            ...aiResult,
            modelUsed: model,
            generatedAt: now.toISOString(),
          };
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Gemini API invocation failed (${errorMsg}), transitioning to deterministic corridor heuristic.`,
        );
      }
    } else {
      this.logger.log('No GEMINI_API_KEY configured; utilizing local corridor heuristics.');
    }

    // High-fidelity fallback heuristic model
    const fallback = this.calculateHeuristicForecast(
      pickupZone,
      destinationZone,
      distanceKm,
      currentHour,
    );

    return {
      pickupZone,
      destinationZone,
      distanceKm,
      ...fallback,
      modelUsed: `${model} (offline-heuristic)`,
      generatedAt: now.toISOString(),
    };
  }

  private async callGeminiApi(
    apiKey: string,
    model: string,
    pickupZone: string,
    destinationZone: string,
    distanceKm: number,
    currentHour: number,
    currentDay: string,
  ): Promise<Omit<
    AiCorridorForecast,
    'pickupZone' | 'destinationZone' | 'distanceKm' | 'modelUsed' | 'generatedAt'
  > | null> {
    const prompt = `You are the AI Corridor Traffic and Pooling Dispatch Assistant for "Dhaka Tesla Pool" (electric vehicle ridesharing in Dhaka, Bangladesh).
Analyze this corridor trip:
- Origin: ${pickupZone} (Dhaka)
- Destination: ${destinationZone} (Dhaka)
- Corridor Distance: ${distanceKm} km
- Time of Day: ${currentHour}:00 (${currentDay})

Consider Dhaka transit choke points (e.g., Banani 11, Mohakhali flyover / rail gate, Gulshan 1/2 circle, Airport Road, Farmgate).
Return STRICT raw JSON with NO markdown code fences and keys matching this exact schema:
{
  "congestionLevel": "LOW" | "MODERATE" | "HEAVY" | "SEVERE_GRIDLOCK",
  "predictedDurationMinutes": number (realistic travel minutes in Dhaka traffic),
  "nominalDurationMinutes": number (free-flow duration assuming 25 km/h),
  "delayMinutes": number (predictedDurationMinutes minus nominalDurationMinutes),
  "demandSurgeMultiplier": number (between 0.90 and 1.35 based on rush hour),
  "demandLevel": "LOW" | "NORMAL" | "PEAK_RUSH",
  "smartRecommendation": string (concise 1-2 sentence commuter advice in English advising why Tesla corridor pooling saves time and avoids congestion),
  "batteryConsumptionPercent": number (estimated Tesla Model Y battery % for this km, ~0.20-0.30% per km),
  "co2SavedKg": number (kg of CO2 emissions saved by sharing an EV vs petrol car, ~0.15kg per passenger-km),
  "confidenceScore": number (between 0.80 and 0.98)
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 150)}`);
      }

      const json = await response.json();
      const rawText =
        json?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      const cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/i, '')
        .trim();

      const parsed = JSON.parse(cleaned);

      return {
        congestionLevel: parsed.congestionLevel || 'MODERATE',
        predictedDurationMinutes: Number(parsed.predictedDurationMinutes) || Math.round(distanceKm * 4),
        nominalDurationMinutes: Number(parsed.nominalDurationMinutes) || Math.round(distanceKm * 2.4),
        delayMinutes: Number(parsed.delayMinutes) || Math.round(distanceKm * 1.6),
        demandSurgeMultiplier: Number(parsed.demandSurgeMultiplier) || 1.0,
        demandLevel: parsed.demandLevel || 'NORMAL',
        smartRecommendation: String(parsed.smartRecommendation || 'Corridor traffic is optimal. Pool with Bullet to reduce emissions.'),
        batteryConsumptionPercent: Number(parsed.batteryConsumptionPercent) || Number((distanceKm * 0.22).toFixed(1)),
        co2SavedKg: Number(parsed.co2SavedKg) || Number((distanceKm * 0.14).toFixed(2)),
        confidenceScore: Number(parsed.confidenceScore) || 0.92,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private calculateHeuristicForecast(
    pickup: string,
    destination: string,
    distanceKm: number,
    hour: number,
  ) {
    const isMorningRush = hour >= 8 && hour <= 11;
    const isEveningRush = hour >= 17 && hour <= 21;
    const isNight = hour >= 23 || hour <= 5;

    let congestionLevel: 'LOW' | 'MODERATE' | 'HEAVY' | 'SEVERE_GRIDLOCK' = 'MODERATE';
    let demandLevel: 'LOW' | 'NORMAL' | 'PEAK_RUSH' = 'NORMAL';
    let speedKmH = 18; // Nominal Dhaka urban speed
    let surgeMultiplier = 1.0;

    if (isMorningRush || isEveningRush) {
      congestionLevel = isEveningRush ? 'SEVERE_GRIDLOCK' : 'HEAVY';
      demandLevel = 'PEAK_RUSH';
      speedKmH = 9; // Gridlock speed
      surgeMultiplier = 1.2;
    } else if (isNight) {
      congestionLevel = 'LOW';
      demandLevel = 'LOW';
      speedKmH = 35;
      surgeMultiplier = 0.95;
    }

    const freeFlowMinutes = Math.max(3, Math.round((distanceKm / 30) * 60));
    const predictedMinutes = Math.max(
      freeFlowMinutes + 2,
      Math.round((distanceKm / speedKmH) * 60),
    );
    const delayMinutes = Math.max(0, predictedMinutes - freeFlowMinutes);

    return {
      congestionLevel,
      predictedDurationMinutes: predictedMinutes,
      nominalDurationMinutes: freeFlowMinutes,
      delayMinutes,
      demandSurgeMultiplier: surgeMultiplier,
      demandLevel,
      smartRecommendation:
        isEveningRush || isMorningRush
          ? `High corridor congestion detected near ${pickup} and ${destination}. Pooling into Bullet Model Y saves 25% on fare while taking advantage of dedicated corridor lane navigation.`
          : `Traffic flow along ${pickup} ➔ ${destination} is currently steady. Pooled booking available with immediate Captain matching.`,
      batteryConsumptionPercent: Number((distanceKm * 0.22).toFixed(1)),
      co2SavedKg: Number((distanceKm * 0.14).toFixed(2)),
      confidenceScore: 0.91,
    };
  }
}
