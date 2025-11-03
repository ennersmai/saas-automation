import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TwilioClient } from '../messaging/twilio.client';
import { ConversationsService } from '../conversations/conversations.service';
import { TenantSummary } from '../tenant/tenant.service';
import { GuestContext } from './ai.types';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);
  private readonly defaultStaffWhatsapp?: string;
  private readonly defaultOnCallNumber?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly twilioClient: TwilioClient,
    private readonly conversationsService: ConversationsService,
  ) {
    this.defaultStaffWhatsapp = this.configService.get<string>('STAFF_WHATSAPP_NUMBER');
    this.defaultOnCallNumber = this.configService.get<string>('ON_CALL_NUMBER');
  }

  async notifyLowConfidence(
    tenant: TenantSummary,
    guest: GuestContext,
    message: string,
    intentLabel: string,
  ): Promise<void> {
    // Get staff number from tenant or fallback to env var
    const staffNumber = tenant.twilioStaffWhatsappNumber || this.defaultStaffWhatsapp;

    if (!staffNumber) {
      this.logger.warn(
        'No staff WhatsApp number configured; cannot send low confidence escalation.',
      );
      return;
    }

    const body = `Low-confidence AI response alert for tenant ${tenant.name}.
Intent: ${intentLabel}
Guest: ${guest.name ?? 'Unknown'} (${guest.phone ?? 'no phone'})
Message: ${message}`;

    await this.twilioClient.sendWhatsAppMessage(tenant, staffNumber, body);

    const reservationId = guest.reservationId ?? this.extractReservationId(guest);
    if (reservationId) {
      await this.conversationsService.setStatusByReservation(
        tenant.id,
        reservationId,
        'paused_by_human',
      );
    }
  }

  async triggerEmergencyCall(
    tenant: TenantSummary,
    guest: GuestContext,
    message: string,
  ): Promise<void> {
    // Get on-call number from tenant or fallback to env var
    const onCallNumber = tenant.twilioOnCallNumber || this.defaultOnCallNumber;

    if (!onCallNumber) {
      this.logger.warn('No on-call number configured; cannot trigger emergency call.');
      return;
    }

    const voiceMessage = `Emergency reported by guest ${guest.name ?? 'guest'} for tenant ${
      tenant.name
    }. Message: ${message}`;
    await this.twilioClient.initiateVoiceCall(tenant, onCallNumber, voiceMessage);

    const reservationId = guest.reservationId ?? this.extractReservationId(guest);
    if (reservationId) {
      await this.conversationsService.setStatusByReservation(
        tenant.id,
        reservationId,
        'paused_by_human',
      );
    }
  }

  private extractReservationId(guest: GuestContext): string | undefined {
    const raw = guest.rawPayload;
    if (!raw) {
      return undefined;
    }

    const candidates = [
      'reservationId',
      'reservation_id',
      'reservation.id',
      'thread.reservationId',
    ];
    for (const path of candidates) {
      const value = this.resolvePath(raw, path);
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    return undefined;
  }

  private resolvePath(source: Record<string, unknown>, path: string): unknown {
    const segments = path.split('.');
    let current: unknown = source;

    for (const segment of segments) {
      if (!current || typeof current !== 'object') {
        return undefined;
      }

      current = (current as Record<string, unknown>)[segment];
    }

    return current;
  }
}
