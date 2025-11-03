import { Module } from '@nestjs/common';

import { SchedulingModule } from '../scheduling/scheduling.module';
import { TenantModule } from '../tenant/tenant.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { HostawayWebhookController } from './hostaway.webhook.controller';

@Module({
  imports: [SchedulingModule, TenantModule, ConversationsModule, IntegrationsModule],
  controllers: [HostawayWebhookController],
})
export class WebhooksModule {}
