import { Module } from '@nestjs/common';
import { DriverService } from './driver.service.js';
import { DriverController } from './driver.controller.js';

@Module({
  controllers: [DriverController],
  providers: [DriverService],
  exports: [DriverService],
})
export class DriverModule {}
