import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { IntegrationsModule } from '../integrations/integrations.module';
import { TenantModule } from '../tenant/tenant.module';
import { DatabaseModule } from '../database/database.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PassportModule, TenantModule, IntegrationsModule, DatabaseModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
