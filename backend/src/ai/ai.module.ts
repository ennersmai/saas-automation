import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { IntegrationsModule } from '../integrations/integrations.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { DatabaseModule } from '../database/database.module';
import { MessagingModule } from '../messaging/messaging.module';
import { RagModule } from '../rag/rag.module';
import { TenantModule } from '../tenant/tenant.module';
import { AiEngineService } from './ai-engine.service';
import { DataRetrieverService } from './data.retriever';
import { EscalationService } from './escalation.service';
import { IntentService } from './intent.service';
import { ResponseGeneratorService } from './response.generator';

@Module({
  imports: [
    ConfigModule,
    TenantModule,
    MessagingModule,
    ConversationsModule,
    forwardRef(() => IntegrationsModule),
    DatabaseModule,
    RagModule,
  ],
  providers: [
    AiEngineService,
    IntentService,
    DataRetrieverService,
    ResponseGeneratorService,
    EscalationService,
  ],
  exports: [AiEngineService],
})
export class AiModule {}
