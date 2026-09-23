import { Global, Module } from '@nestjs/common';
import { ZonesService } from './zones.service.js';
import { ZonesController } from './zones.controller.js';

@Global()
@Module({
  controllers: [ZonesController],
  providers: [ZonesService],
  exports: [ZonesService],
})
export class ZonesModule {}
