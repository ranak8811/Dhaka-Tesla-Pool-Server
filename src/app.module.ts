import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ZonesModule } from './modules/zones/zones.module.js';
import { RidesModule } from './modules/rides/rides.module.js';
import { PoolsModule } from './modules/pools/pools.module.js';
import { DriverModule } from './modules/driver/driver.module.js';
import { AiModule } from './modules/ai/ai.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ZonesModule,
    RidesModule,
    PoolsModule,
    DriverModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
