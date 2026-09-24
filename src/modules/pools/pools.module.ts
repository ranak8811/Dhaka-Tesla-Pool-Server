import { Global, Module } from '@nestjs/common';
import { PoolsService } from './pools.service.js';

@Global()
@Module({
  providers: [PoolsService],
  exports: [PoolsService],
})
export class PoolsModule {}
