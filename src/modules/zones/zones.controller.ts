import { Controller, Get, Query } from '@nestjs/common';
import { ZonesService } from './zones.service.js';

@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get()
  getAllZones() {
    return this.zonesService.getAllZones();
  }

  @Get('distance')
  getDistance(@Query('from') from: string, @Query('to') to: string) {
    const distanceKm = this.zonesService.getDistanceKm(from, to);
    return {
      from,
      to,
      distanceKm,
    };
  }
}
