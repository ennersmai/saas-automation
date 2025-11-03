import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { MessagingModule } from '../messaging/messaging.module';
import { TenantModule } from '../tenant/tenant.module';
import { HostawayClient } from '../integrations/hostaway.client';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { DatabaseModule } from '../database/database.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    TenantModule,
    MessagingModule,
    DatabaseModule,
    TemplatesModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService, HostawayClient],
  exports: [ConversationsService],
})
export class ConversationsModule {}
