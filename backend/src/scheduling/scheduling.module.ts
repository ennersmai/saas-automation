import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AiModule } from '../ai/ai.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagingModule } from '../messaging/messaging.module';
import { TenantModule } from '../tenant/tenant.module';
import { TemplatesModule } from '../templates/templates.module';
import { HostawayClient } from '../integrations/hostaway.client';
import { SchedulingService } from './scheduling.service';
import { DatabaseModule } from '../database/database.module';
import { MessageProcessorService } from './message.processor.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TenantModule,
    ConversationsModule,
    AiModule,
    MessagingModule,
    DatabaseModule,
    TemplatesModule,
  ],
  providers: [SchedulingService, MessageProcessorService, HostawayClient],
  exports: [SchedulingService],
})
export class SchedulingModule {}
