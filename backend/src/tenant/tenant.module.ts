import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [PassportModule, DatabaseModule],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
