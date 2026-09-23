import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ZonesModule } from './modules/zones/zones.module.js';

@Module({
  imports: [PrismaModule, AuthModule, ZonesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
