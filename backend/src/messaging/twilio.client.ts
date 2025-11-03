import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

import { CryptoService } from '../security/crypto.service';
import { TenantSummary } from '../tenant/tenant.service';

@Injectable()
export class TwilioClient {
  private readonly logger = new Logger(TwilioClient.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {}

  private getTwilioClient(tenant: TenantSummary): Twilio | null {
    if (!tenant.twilioAccountSid || !tenant.encryptedTwilioAuthToken) {
      // Fallback to env vars for backward compatibility during migration
      const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
      const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

      if (!accountSid || !authToken) {
        return null;
      }

      return new Twilio(accountSid, authToken);
    }

    const authToken = this.cryptoService.decrypt(tenant.encryptedTwilioAuthToken);
    return new Twilio(tenant.twilioAccountSid, authToken);
  }

  private getWhatsappFrom(tenant: TenantSummary): string | null {
    return (
      tenant.twilioWhatsappFrom || this.configService.get<string>('TWILIO_WHATSAPP_FROM') || null
    );
  }

  private getVoiceFrom(tenant: TenantSummary): string | null {
    return tenant.twilioVoiceFrom || this.configService.get<string>('TWILIO_VOICE_FROM') || null;
  }

  private getMessagingServiceSid(tenant: TenantSummary): string | null {
    return (
      tenant.twilioMessagingServiceSid ||
      this.configService.get<string>('TWILIO_MESSAGING_SERVICE_SID') ||
      null
    );
  }

  async sendWhatsAppMessage(tenant: TenantSummary, to: string, body: string): Promise<void> {
    const dryRun = this.configService.get<string>('DRY_RUN') === 'true';
    const client = this.getTwilioClient(tenant);
    const whatsappFrom = this.getWhatsappFrom(tenant);

    if (dryRun || !client || !whatsappFrom) {
      this.logger.log(`(dry-run) WhatsApp message to ${to}: ${body}`);
      return;
    }

    try {
      await client.messages.create({
        from: whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`,
        to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
        body,
      });
    } catch (error) {
      this.logger.error(`Failed to send WhatsApp message to ${to}`, error as Error);
    }
  }

  async sendSms(tenant: TenantSummary, to: string, body: string): Promise<void> {
    const dryRun = this.configService.get<string>('DRY_RUN') === 'true';
    const client = this.getTwilioClient(tenant);
    const messagingServiceSid = this.getMessagingServiceSid(tenant);

    if (dryRun || !client || !messagingServiceSid) {
      this.logger.log(`(dry-run) SMS message to ${to}: ${body}`);
      return;
    }

    try {
      await client.messages.create({
        messagingServiceSid,
        to,
        body,
      });
    } catch (error) {
      this.logger.error(`Failed to send SMS message to ${to}`, error as Error);
    }
  }

  async initiateVoiceCall(tenant: TenantSummary, to: string, message: string): Promise<void> {
    const dryRun = this.configService.get<string>('DRY_RUN') === 'true';
    const client = this.getTwilioClient(tenant);
    const voiceFrom = this.getVoiceFrom(tenant);

    if (dryRun || !client || !voiceFrom) {
      this.logger.log(`(dry-run) Voice call to ${to}: ${message}`);
      return;
    }

    try {
      await client.calls.create({
        to,
        from: voiceFrom,
        twiml: `<Response><Say>${this.escapeForTwiml(message)}</Say></Response>`,
      });
    } catch (error) {
      this.logger.error(`Failed to initiate voice call to ${to}`, error as Error);
    }
  }

  private escapeForTwiml(input: string): string {
    return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
