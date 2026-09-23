import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { PricingService } from './pricing.service.js';
import { ZonesService } from '../zones/zones.service.js';
import { QuoteRequestDto } from './dto/quote-request.dto.js';

@Controller('rides')
export class RidesController {
  constructor(
    private readonly pricingService: PricingService,
    private readonly zonesService: ZonesService,
  ) {}

  @Post('quote')
  getQuote(@Body() dto: QuoteRequestDto) {
    let distanceKm = dto.distanceKm;
    let pickupZone = dto.pickupZone;
    let destinationZone = dto.destinationZone;

    if (dto.pickupZone && dto.destinationZone) {
      const from = this.zonesService.getZone(dto.pickupZone);
      const to = this.zonesService.getZone(dto.destinationZone);
      pickupZone = from.name;
      destinationZone = to.name;
      distanceKm = this.zonesService.getDistanceKm(from.id, to.id);
    } else if (distanceKm === undefined || distanceKm === null) {
      throw new BadRequestException(
        'Please provide either pickupZone and destinationZone, or a valid distanceKm',
      );
    }

    return this.pricingService.generateQuote(distanceKm, pickupZone, destinationZone);
  }
}
