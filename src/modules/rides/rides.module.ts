import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service.js';
import { RidesController } from './rides.controller.js';

@Module({
  controllers: [RidesController],
  providers: [PricingService],
  exports: [PricingService],
})
export class RidesModule {}
