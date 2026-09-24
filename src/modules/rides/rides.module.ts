import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service.js';
import { RidesService } from './rides.service.js';
import { RidesController } from './rides.controller.js';

@Module({
  controllers: [RidesController],
  providers: [PricingService, RidesService],
  exports: [PricingService, RidesService],
})
export class RidesModule {}
