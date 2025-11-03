import { forwardRef, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';

import { DatabaseModule } from '../database/database.module';
import { TenantModule } from '../tenant/tenant.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { LoggingModule } from '../logging/logging.module';
import { HostawayClient } from './hostaway.client';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [
    PassportModule,
    ScheduleModule,
    TenantModule,
    forwardRef(() => SchedulingModule),
    LoggingModule,
    DatabaseModule,
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, HostawayClient],
  exports: [IntegrationsService, HostawayClient],
})
export class IntegrationsModule {}
