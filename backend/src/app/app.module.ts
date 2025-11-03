import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { AuthModule } from '../auth/auth.module';
import { SupabaseStrategy } from '../auth/supabase.strategy';
import { BillingModule } from '../billing/billing.module';
import { LoggingModule } from '../logging/logging.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { RagModule } from '../rag/rag.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { SecurityModule } from '../security/security.module';
import { TenantModule } from '../tenant/tenant.module';
import { TemplatesModule } from '../templates/templates.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggingModule,
    SecurityModule,
    PassportModule.register({ defaultStrategy: 'supabase' }),
    AuthModule,
    BillingModule,
    SchedulingModule,
    ConversationsModule,
    IntegrationsModule,
    DashboardModule,
    WebhooksModule,
    TenantModule,
    TemplatesModule,
    DatabaseModule,
    RagModule,
  ],
  controllers: [AppController],
  providers: [AppService, SupabaseStrategy],
})
export class AppModule {}
