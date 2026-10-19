import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AiService } from './ai.service.js';
import {
  AiCorridorForecast,
  CorridorForecastRequestDto,
} from './dto/corridor-forecast.dto.js';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('corridor-forecast')
  @HttpCode(HttpStatus.OK)
  async getForecast(
    @Body() dto: CorridorForecastRequestDto,
  ): Promise<AiCorridorForecast> {
    return this.aiService.getCorridorForecast(dto);
  }

  @Get('health')
  getAiHealth() {
    const configuredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const hasKey = Boolean(process.env.GEMINI_API_KEY);
    return {
      status: 'operational',
      model: configuredModel,
      provider: 'Google Gemini',
      geminiKeyConfigured: hasKey,
      timestamp: new Date().toISOString(),
    };
  }
}
