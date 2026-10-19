import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service.js';
import { RidesService } from './rides.service.js';
import { RidesController } from './rides.controller.js';
import { ZonesModule } from '../zones/zones.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [ZonesModule, AiModule],
  controllers: [RidesController],
  providers: [PricingService, RidesService],
  exports: [PricingService, RidesService],
})
export class RidesModule {}
