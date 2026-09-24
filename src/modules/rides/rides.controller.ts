import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PricingService } from './pricing.service.js';
import { ZonesService } from '../zones/zones.service.js';
import { RidesService } from './rides.service.js';
import { QuoteRequestDto } from './dto/quote-request.dto.js';
import { CreateRideDto } from './dto/create-ride.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '@prisma/client';

@Controller('rides')
export class RidesController {
  constructor(
    private readonly pricingService: PricingService,
    private readonly zonesService: ZonesService,
    private readonly ridesService: RidesService,
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

  @Post('request')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PASSENGER)
  requestRide(@CurrentUser() user: { id: string }, @Body() dto: CreateRideDto) {
    return this.ridesService.requestRide(user.id, dto);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PASSENGER)
  getActiveRide(@CurrentUser() user: { id: string }) {
    return this.ridesService.getActiveRide(user.id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PASSENGER)
  cancelRide(@CurrentUser() user: { id: string }, @Param('id') rideId: string) {
    return this.ridesService.cancelRide(rideId, user.id);
  }
}
