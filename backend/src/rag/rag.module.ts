import { forwardRef, Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { TenantModule } from '../tenant/tenant.module';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';

@Module({
  imports: [DatabaseModule, TenantModule, forwardRef(() => IntegrationsModule)],
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
