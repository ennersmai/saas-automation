import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { TenantModule } from '../tenant/tenant.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [PassportModule, TenantModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
