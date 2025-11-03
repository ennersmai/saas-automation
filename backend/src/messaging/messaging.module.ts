import { Module } from '@nestjs/common';

import { SecurityModule } from '../security/security.module';
import { TwilioClient } from './twilio.client';

@Module({
  imports: [SecurityModule],
  providers: [TwilioClient],
  exports: [TwilioClient],
})
export class MessagingModule {}
