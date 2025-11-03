import { Injectable, Logger } from '@nestjs/common';
import { addHours, isBefore, parseISO, startOfDay, subHours } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

import { AiEngineService } from '../ai/ai-engine.service';
import { TemplatesService } from '../templates/templates.service';
import { GuestContext } from '../ai/ai.types';
import { ConversationsService } from '../conversations/conversations.service';
import { HostawayClient } from '../integrations/hostaway.client';
import { TwilioClient } from '../messaging/twilio.client';
import { TenantService, TenantSummary } from '../tenant/tenant.service';
import { DatabaseService } from '../database/database.service';

type HostawayRecord = Record<string, unknown>;

export type ProactiveMessageType =
  | 'thank_you_immediate'
  | 'pre_arrival_24h'
  | 'door_code_3h'
  | 'same_day_checkin'
  | 'checkout_morning'
  | 'post_booking_followup'
  | 'pre_checkout_evening';

interface ScheduleOptions {
  initialSync?: boolean;
}

interface PendingMessagePlan {
  messageType: ProactiveMessageType;
  messageLabel: string;
  scheduledSendAt: Date;
  scheduledLocal: Date;
  timezone: string;
  guestName: string;
}

const PROACTIVE_MESSAGE_LABELS: Record<ProactiveMessageType, string> = {
  thank_you_immediate: 'Booking Confirmation',
  pre_arrival_24h: '24h Pre-Arrival Instructions',
  door_code_3h: '3h Pre-Check-in Door Code',
  same_day_checkin: 'Same-Day Booking Instant Code',
  checkout_morning: 'Checkout Morning Reminder',
  post_booking_followup: 'Post-booking Follow-up',
  pre_checkout_evening: 'Pre-Checkout Evening Reminder',
};

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);
  // Cache listing data to avoid repeated API calls - used for names, amenities, wifi, door codes, etc.
  private readonly listingCache = new Map<string, { listing: HostawayRecord; timestamp: number }>();
  private readonly cacheTimeout = 30 * 60 * 1000; // 30 minutes - listings don't change often

  constructor(
    private readonly tenantService: TenantService,
    private readonly conversationsService: ConversationsService,
    private readonly aiEngine: AiEngineService,
    private readonly twilioClient: TwilioClient,
    private readonly hostawayClient: HostawayClient,
    private readonly databaseService: DatabaseService,
    private readonly templatesService: TemplatesService,
  ) {}

  async queueHostawayEvent(tenantId: string, eventPayload: HostawayRecord): Promise<void> {
    try {
      await this.handleHostawayEvent(tenantId, eventPayload);
    } catch (error) {
      this.logger.error(`Failed to process Hostaway event for tenant ${tenantId}`, error as Error);
    }
  }

  async scheduleProactiveMessagesFromReservation(
    tenant: TenantSummary,
    reservation: HostawayRecord,
    options: ScheduleOptions = {},
  ): Promise<void> {
    // Check if reservation is cancelled before scheduling
    const status = (this.readString(reservation, 'status') ?? '').toLowerCase();
    if (status === 'cancelled') {
      const reservationId = this.readString(reservation, 'id', 'reservationId', 'reservation_id');
      this.logger.debug(
        `Skipping scheduling for cancelled reservation ${reservationId ?? 'unknown'} (tenant ${
          tenant.id
        })`,
      );
      if (reservationId) {
        // Cancel any existing pending messages for this reservation
        await this.handleReservationCancellation(tenant, reservationId);
      }
      return;
    }

    const bookingInfo = await this.ensureBookingRecord(tenant, reservation);
    if (!bookingInfo) {
      const reservationId = this.readString(reservation, 'id', 'reservationId', 'reservation_id');
      this.logger.warn(
        `Failed to create booking record for reservation ${reservationId ?? 'unknown'} (tenant ${
          tenant.id
        }) - conversation will not be created`,
      );
      return;
    }

    const conversation = await this.conversationsService.getOrCreateConversation(
      tenant.id,
      bookingInfo.bookingId,
      { hostawayConversationId: bookingInfo.hostawayConversationId },
    );

    // Log conversation creation for tracking
    if (options.initialSync) {
      this.logger.debug(
        `Created/retrieved conversation ${conversation.id} for reservation ${bookingInfo.hostawayReservationId} (tenant ${tenant.id})`,
      );
    }

    const plans = this.buildProactiveSchedule(reservation, options);

    if (plans.length === 0) {
      this.logger.debug(
        `No proactive messages generated for reservation ${
          bookingInfo.hostawayReservationId
        } (tenant ${tenant.id}) during ${
          options.initialSync ? 'initial-sync' : 'event'
        } processing, but conversation ${conversation.id} was created.`,
      );
      // Conversation was created above, so we're good even if no messages
      return;
    }

    let createdCount = 0;
    let skippedCount = 0;

    for (const plan of plans) {
      const result = await this.conversationsService.createPendingOutboundMessage(conversation, {
        messageType: plan.messageType,
        messageLabel: plan.messageLabel,
        hostawayReservationId: bookingInfo.hostawayReservationId,
        guestName: plan.guestName,
        scheduledSendAt: plan.scheduledSendAt,
        scheduledLocal: plan.scheduledLocal,
        timezone: plan.timezone,
        metadata: {
          initialSync: Boolean(options.initialSync),
          tenantId: tenant.id,
          hostawayReservationId: bookingInfo.hostawayReservationId,
          hostawayConversationId:
            conversation.hostawayConversationId ?? bookingInfo.hostawayConversationId,
        },
      });

      if (result) {
        createdCount++;
      } else {
        skippedCount++;
      }
    }

    if (options.initialSync && skippedCount > 0) {
      this.logger.warn(
        `Reservation ${bookingInfo.hostawayReservationId}: Created ${createdCount} messages, skipped ${skippedCount} duplicates. ` +
          `This suggests the reservation was processed multiple times or messages already existed.`,
      );
    }

    this.logger.log(
      `Queued ${plans.length} proactive messages for reservation ${
        bookingInfo.hostawayReservationId
      } (tenant ${tenant.id}) via ${options.initialSync ? 'initial sync' : 'event'} path.`,
    );
  }

  private async handleHostawayEvent(tenantId: string, eventPayload: HostawayRecord): Promise<void> {
    const tenant = await this.tenantService.getTenantById(tenantId);
    const eventType = (this.readString(eventPayload, 'event', 'type') ?? '').toLowerCase();

    switch (eventType) {
      case 'reservation.created':
      case 'reservation_created':
      case 'reservationcreate': {
        const reservationPayload =
          (this.resolveRecord(eventPayload, 'reservation') as HostawayRecord | undefined) ??
          eventPayload;
        await this.scheduleProactiveMessagesFromReservation(tenant, reservationPayload, {
          initialSync: false,
        });
        break;
      }
      case 'reservation.updated':
      case 'reservation_updated': {
        const reservationPayload =
          (this.resolveRecord(eventPayload, 'reservation') as HostawayRecord | undefined) ??
          eventPayload;
        const status = (this.readString(reservationPayload, 'status') ?? '').toLowerCase();
        const reservationId = this.readString(
          reservationPayload,
          'id',
          'reservationId',
          'reservation_id',
        );

        if (status === 'cancelled' && reservationId) {
          await this.handleReservationCancellation(tenant, reservationId);
        } else {
          // Re-schedule messages for updated reservations (e.g., date changes)
          await this.scheduleProactiveMessagesFromReservation(tenant, reservationPayload, {
            initialSync: false,
          });
        }
        break;
      }
      case 'message.received':
      case 'message_received':
      case 'guestmessage':
        await this.handleIncomingMessage(tenant, eventPayload);
        break;
      default:
        this.logger.debug(`Unhandled Hostaway event type "${eventType}" for tenant ${tenant.id}`);
    }
  }

  private async handleReservationCancellation(
    tenant: TenantSummary,
    reservationId: string,
  ): Promise<void> {
    try {
      // Find the booking by external reservation ID
      const bookingResult = await this.databaseService.runQuery<{ id: string; booking_id: string }>(
        `select b.id as booking_id, c.id
         from public.bookings b
         left join public.conversations c on c.booking_id = b.id and c.tenant_id = $1
         where b.tenant_id = $1 and b.external_id = $2
         limit 1`,
        [tenant.id, reservationId],
      );

      if (bookingResult.rows.length === 0) {
        this.logger.debug(
          `No booking found for cancelled reservation ${reservationId} (tenant ${tenant.id}), skipping cancellation cleanup.`,
        );
        return;
      }

      const conversationId = bookingResult.rows[0].id;
      if (!conversationId) {
        this.logger.debug(
          `No conversation found for cancelled reservation ${reservationId} (tenant ${tenant.id}), skipping cancellation cleanup.`,
        );
        return;
      }

      // Cancel all pending messages for this conversation
      const cancelledCount = await this.conversationsService.cancelAllPendingMessages(
        tenant.id,
        conversationId,
        'Reservation was cancelled',
      );
      this.logger.log(
        `Cancelled ${cancelledCount} pending messages for cancelled reservation ${reservationId} (tenant ${tenant.id})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to cancel pending messages for reservation ${reservationId} (tenant ${tenant.id})`,
        error as Error,
      );
    }
  }

  private getMessageTypeLabel(messageType: ProactiveMessageType): string {
    return PROACTIVE_MESSAGE_LABELS[messageType] ?? messageType;
  }

  private buildProactiveSchedule(
    reservation: HostawayRecord,
    options: ScheduleOptions,
  ): PendingMessagePlan[] {
    const timezone = this.determineTimezone(reservation);
    const guestName = this.buildGuestName(reservation);

    const checkInDate = this.resolveReservationDate(reservation, timezone, {
      datePaths: [
        'checkIn',
        'check_in',
        'startDate',
        'start_date',
        'arrivalDate',
        'arrival_date',
        'arrival',
        'start',
      ],
      timePaths: ['checkInTime', 'check_in_time', 'checkIn.time', 'check_in.time'],
      fallbackHour: 15,
    });
    const checkOutDate = this.resolveReservationDate(reservation, timezone, {
      datePaths: [
        'checkOut',
        'check_out',
        'endDate',
        'end_date',
        'departureDate',
        'departure_date',
        'departure',
        'end',
      ],
      timePaths: ['checkOutTime', 'check_out_time', 'checkOut.time', 'check_out.time'],
      fallbackHour: 10,
    });

    const checkInLocal = checkInDate ? toZonedTime(checkInDate, timezone) : null;
    const checkOutLocal = checkOutDate ? toZonedTime(checkOutDate, timezone) : null;
    const nowLocal = toZonedTime(new Date(), timezone);

    const plans: PendingMessagePlan[] = [];

    const pushPlan = (messageType: ProactiveMessageType, proposedLocal: Date | null) => {
      let effectiveLocal =
        proposedLocal !== null ? new Date(proposedLocal.getTime()) : new Date(nowLocal.getTime());

      if (isBefore(effectiveLocal, nowLocal)) {
        if (options.initialSync) {
          effectiveLocal = new Date(nowLocal.getTime());
        } else {
          effectiveLocal = new Date(nowLocal.getTime());
        }
      }

      const scheduledUtc = fromZonedTime(effectiveLocal, timezone);
      const scheduledSendAt = scheduledUtc < new Date() ? new Date() : scheduledUtc;

      plans.push({
        messageType,
        messageLabel: this.getMessageTypeLabel(messageType),
        scheduledSendAt,
        scheduledLocal: new Date(effectiveLocal.getTime()),
        timezone,
        guestName,
      });
    };

    if (!options.initialSync) {
      pushPlan('thank_you_immediate', null);
    }

    if (checkInLocal) {
      pushPlan('pre_arrival_24h', subHours(checkInLocal, 24));
      pushPlan('door_code_3h', subHours(checkInLocal, 3));
      pushPlan('same_day_checkin', checkInLocal);
    }

    if (checkOutLocal) {
      pushPlan('checkout_morning', addHours(startOfDay(checkOutLocal), 8));
      // Pre-checkout evening at 18:00 the day before checkout
      const evening = new Date(checkOutLocal.getTime());
      evening.setDate(evening.getDate() - 1);
      evening.setHours(18, 0, 0, 0);
      pushPlan('pre_checkout_evening', evening);
    }

    // Post-booking follow-up N hours after reservationDate (default 6h)
    const reservationLocal = this.resolveReservationCreatedLocal(reservation, timezone);
    if (reservationLocal && !options.initialSync) {
      const followup = addHours(
        reservationLocal,
        Number(process.env.POST_BOOKING_FOLLOWUP_HOURS ?? 6),
      );
      pushPlan('post_booking_followup', followup);
    }

    return plans;
  }

  private resolveReservationCreatedLocal(
    reservation: HostawayRecord,
    timezone: string,
  ): Date | null {
    const value = this.readString(reservation, 'reservationDate', 'reservation_date');
    if (!value) return null;
    try {
      const parsed = fromZonedTime(value.replace(' ', 'T'), timezone);
      return toZonedTime(parsed, timezone);
    } catch {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  private async handleIncomingMessage(
    tenant: TenantSummary,
    payload: HostawayRecord,
  ): Promise<void> {
    const message =
      (this.resolveRecord(payload, 'message') as HostawayRecord | undefined) ?? payload;
    const messageBody = this.readString(message, 'body', 'message_text', 'content');

    if (!messageBody) {
      this.logger.warn(`Received Hostaway message event without body for tenant ${tenant.id}`);
      return;
    }

    const reservationId =
      this.readString(payload, 'reservationId', 'reservation_id') ??
      this.readString(message, 'reservationId', 'reservation_id') ??
      this.readString(payload, 'reservation.id', 'thread.reservationId');

    if (!reservationId) {
      this.logger.warn(`Skipping AI reply for tenant ${tenant.id}: missing reservation id`);
      return;
    }

    const reservation = await this.hostawayClient.getReservation(tenant, reservationId);
    const bookingInfo = await this.ensureBookingRecord(tenant, reservation);
    if (!bookingInfo) {
      return;
    }

    const conversation = await this.conversationsService.getOrCreateConversation(
      tenant.id,
      bookingInfo.bookingId,
      { hostawayConversationId: bookingInfo.hostawayConversationId },
    );
    // Extract message ID for idempotency
    const messageId = this.readString(message, 'id', 'messageId', 'message_id');
    const timestamp =
      this.readString(message, 'createdAt', 'created_at', 'timestamp') || new Date().toISOString();
    const messageHash = messageId
      ? undefined
      : `${messageBody.substring(0, 100)}_${timestamp}`.substring(0, 100);

    const guestMessageLogId = await this.conversationsService.logGuestMessage(
      conversation,
      messageBody,
      {
        tenantId: tenant.id,
        hostawayReservationId: reservationId,
        hostawayConversationId:
          conversation.hostawayConversationId ?? bookingInfo.hostawayConversationId,
        hostawayMessageId: messageId,
        messageId: messageId, // Also store in messageId for compatibility
        messageHash,
      },
    );

    // Sync conversation history from Hostaway to provide context for AI
    // This ensures AI can understand responses like "yes please" in context
    try {
      await this.conversationsService.syncConversationHistory(
        tenant.id,
        conversation.id,
        reservationId,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to sync conversation history for reservation ${reservationId}`,
        error as Error,
      );
      // Continue processing - history sync is best-effort
    }

    const guest: GuestContext = {
      id:
        this.readString(payload, 'guestId', 'guest_id') ??
        this.readString(payload, 'guest.id') ??
        this.readString(reservation, 'guestId', 'guest_id', 'guest.id') ??
        reservationId,
      name:
        this.readString(payload, 'guestName', 'guest_name') ??
        this.readString(payload, 'guest.name') ??
        this.buildGuestName(reservation),
      phone:
        this.readString(payload, 'guestPhone', 'guest_phone') ??
        this.readString(payload, 'guest.phone', 'guest.contact.phone') ??
        this.readString(
          reservation,
          'guestPhone',
          'guest_phone',
          'phone',
          'guest.phone',
          'guest.contact.phone',
          'guest.phone_number',
        ),
      reservationId,
      rawPayload: payload,
      guestMessageLogId, // Link AI reply to the guest message
    };

    // Keyword auto-reply using bound template
    const lower = messageBody.toLowerCase();
    const keywords = [
      { k: 'wifi', type: 'message_received_keyword' },
      { k: 'parking', type: 'message_received_keyword' },
    ];
    const matched = keywords.find((x) => lower.includes(x.k));
    if (matched) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tpl = await this.templatesService.getTemplateForMessage(
        tenant.id,
        'message_received_keyword' as any,
      );
      if (tpl) {
        const listingId = this.readString(
          payload,
          'listingMapId',
          'listing_id',
          'propertyId',
          'property_id',
        );
        const listing = listingId ? await this.hostawayClient.getListing(tenant, listingId) : null;
        const variables = {
          guestName: guest.name,
          propertyName:
            this.readString(listing ?? {}, 'name') ||
            this.readString(payload, 'listingName') ||
            'your stay',
          guestPortalUrl: this.readString(payload, 'guestPortalUrl'),
          checkInDate: this.readString(payload, 'arrivalDate'),
          checkOutDate: this.readString(payload, 'departureDate'),
        } as Record<string, string | number | null | undefined>;
        const body = this.templatesService.substituteVariables(tpl.template_body, variables);
        const hostawayConversationId =
          conversation.hostawayConversationId ?? this.readString(payload, 'conversationId');
        if (hostawayConversationId) {
          await this.hostawayClient.sendConversationMessage(
            tenant,
            hostawayConversationId,
            body,
            'channel',
          );
        } else {
          await this.hostawayClient.sendMessageToGuest(tenant, reservationId, body);
        }
      }
    }

    const aiResult = await this.aiEngine.processMessage(tenant, conversation, guest, messageBody);
    if (!aiResult) {
      return;
    }

    const guestPhone =
      guest.phone ??
      this.readString(
        reservation,
        'guestPhone',
        'guest_phone',
        'phone',
        'guest.phone',
        'guest.contact.phone',
        'guest.phone_number',
      );

    if (conversation.status === 'paused_by_human') {
      this.logger.debug(`Conversation ${conversation.id} is paused; skipping automated reply.`);
      await this.conversationsService.markMessageAsFailed(
        aiResult.logId,
        new Error('Conversation paused by human agent'),
      );
      return;
    }

    const deliveryMetadata = {
      deliveryChannel: guestPhone ? 'twilio' : 'hostaway',
      reservationId,
      hostawayReservationId: bookingInfo.hostawayReservationId,
      hostawayConversationId:
        conversation.hostawayConversationId ?? bookingInfo.hostawayConversationId,
    };

    try {
      if (guestPhone) {
        await this.twilioClient.sendWhatsAppMessage(tenant, guestPhone, aiResult.message);
      } else {
        const hostawayConversationId =
          conversation.hostawayConversationId ?? bookingInfo.hostawayConversationId;
        if (hostawayConversationId) {
          await this.hostawayClient.sendConversationMessage(
            tenant,
            hostawayConversationId,
            aiResult.message,
            'channel',
          );
        } else {
          await this.hostawayClient.sendMessageToGuest(tenant, reservationId, aiResult.message);
        }
      }

      await this.conversationsService.markMessageAsSent(
        aiResult.logId,
        aiResult.message,
        deliveryMetadata,
      );
    } catch (error) {
      await this.conversationsService.markMessageAsFailed(aiResult.logId, error as Error);
      throw error;
    }
  }

  private resolveReservationDate(
    reservation: HostawayRecord,
    timezone: string,
    config: {
      datePaths: string[];
      timePaths?: string[];
      fallbackHour: number;
    },
  ): Date | null {
    const dateValue = this.readString(reservation, ...config.datePaths);
    if (!dateValue) {
      // Log missing date for debugging during initial sync
      const reservationId = this.readString(reservation, 'id', 'reservationId', 'reservation_id');
      this.logger.debug(
        `Reservation ${reservationId} missing date in paths: ${config.datePaths.join(', ')}`,
      );
      return null;
    }

    const hourInput =
      (config.timePaths && this.readNumber(reservation, ...config.timePaths)) ??
      config.fallbackHour;
    const normalized = this.normalizeDateTimeInput(
      dateValue,
      this.normalizeHour(hourInput, config.fallbackHour),
    );

    try {
      return fromZonedTime(normalized, timezone);
    } catch (error) {
      this.logger.warn(
        `Unable to interpret reservation date "${dateValue}" for timezone ${timezone}: ${
          (error as Error).message
        }`,
      );
      const parsed = parseISO(normalized);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  private determineTimezone(reservation: HostawayRecord): string {
    return (
      this.readString(
        reservation,
        'listingTimeZoneName', // Hostaway webhook field
        'timezone',
        'listing.timezone',
        'property.timezone',
        'unit.timezone',
      ) ?? 'UTC'
    );
  }

  private resolveRecord(source: HostawayRecord, key: string): HostawayRecord | undefined {
    const value = source[key];
    if (value && typeof value === 'object') {
      return value as HostawayRecord;
    }
    return undefined;
  }

  private readString(
    source: HostawayRecord | null | undefined,
    ...paths: string[]
  ): string | undefined {
    if (!source) {
      return undefined;
    }

    for (const path of paths) {
      const value = this.resolvePath(source, path);
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
      if (typeof value === 'number') {
        return String(value);
      }
    }

    return undefined;
  }

  private resolveHostawayConversationId(conversations: HostawayRecord[]): string | null {
    if (!Array.isArray(conversations) || conversations.length === 0) {
      return null;
    }

    const preferredTypes = ['host-guest-channel', 'host-guest-email', 'host-guest-whatsapp'];
    for (const type of preferredTypes) {
      const match = conversations.find((conversation) => {
        const conversationType = (this.readString(conversation, 'type') ?? '').toLowerCase();
        return conversationType === type;
      });
      if (match) {
        const identifier = this.readString(match, 'id', 'conversationId', 'conversation_id');
        if (identifier) {
          return identifier;
        }
      }
    }

    for (const conversation of conversations) {
      const identifier = this.readString(conversation, 'id', 'conversationId', 'conversation_id');
      if (identifier) {
        return identifier;
      }
    }

    return null;
  }

  private readNumber(
    source: HostawayRecord | null | undefined,
    ...paths: string[]
  ): number | undefined {
    if (!source) {
      return undefined;
    }

    for (const path of paths) {
      const value = this.resolvePath(source, path);
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }

    return undefined;
  }

  private normalizeHour(value: number | string | null | undefined, fallbackHour: number): number {
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        value = parsed;
      }
    }

    if (typeof value !== 'number' || Number.isNaN(value)) {
      return Math.max(0, Math.min(23, Math.round(fallbackHour)));
    }

    return Math.max(0, Math.min(23, Math.round(value)));
  }

  private normalizeDateTimeInput(dateValue: string, hour: number): string {
    const trimmed = dateValue.trim();
    const paddedHour = String(hour).padStart(2, '0');

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return `${trimmed}T${paddedHour}:00:00`;
    }

    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed.replace(' ', 'T');
    }

    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/.test(trimmed)) {
      return `${trimmed.replace(' ', 'T')}:00`;
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(trimmed)) {
      return `${trimmed}:00:00`;
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
      return `${trimmed}:00`;
    }

    return trimmed;
  }

  private resolvePath(source: HostawayRecord, path: string): unknown {
    if (!path.includes('.')) {
      return source[path];
    }

    let current: unknown = source;
    for (const segment of path.split('.')) {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      current = (current as HostawayRecord)[segment];
    }
    return current;
  }

  private buildGuestName(reservation: HostawayRecord): string {
    const explicit = this.readString(reservation, 'guestName', 'guest_name', 'guest.name');
    if (explicit) {
      return explicit;
    }

    const first = this.readString(
      reservation,
      'guest.firstName',
      'guest_first_name',
      'guest.first_name',
      'guest_firstname',
    );
    const last = this.readString(
      reservation,
      'guest.lastName',
      'guest_last_name',
      'guest.last_name',
      'guest_lastname',
    );

    const combined = [first, last].filter((part) => part && part.trim().length > 0).join(' ');
    return combined || 'Guest';
  }

  private async ensureBookingRecord(
    tenant: TenantSummary,
    reservation: HostawayRecord,
  ): Promise<{
    bookingId: string;
    hostawayReservationId: string;
    hostawayConversationId: string | null;
  } | null> {
    const hostawayReservationId =
      this.readString(reservation, 'id', 'reservationId', 'reservation_id') ?? undefined;

    if (!hostawayReservationId) {
      this.logger.warn(
        `Unable to sync reservation for tenant ${tenant.id}: missing reservation id.`,
      );
      return null;
    }

    // Log if check-in date is missing (this prevents booking creation)
    const checkInDateStr = this.readString(
      reservation,
      'arrivalDate',
      'arrival_date',
      'checkIn',
      'check_in',
      'startDate',
      'start_date',
    );
    if (!checkInDateStr) {
      this.logger.debug(
        `Reservation ${hostawayReservationId} has no check-in date - booking will be created without check_in_at`,
      );
    }

    let hostawayConversationId: string | null = null;
    try {
      const conversations = await this.hostawayClient.getReservationConversations(
        tenant,
        hostawayReservationId,
      );
      hostawayConversationId = this.resolveHostawayConversationId(conversations);
    } catch (error) {
      this.logger.warn(
        `Unable to resolve Hostaway conversation for reservation ${hostawayReservationId} (tenant ${tenant.id})`,
        error as Error,
      );
    }

    const listingExternalId =
      this.readString(
        reservation,
        'listingMapId',
        'listing_map_id',
        'listingId',
        'listing_id',
        'propertyId',
        'property_id',
      ) ?? undefined;

    // Try to get listing data: check in-memory cache, then database metadata, then API
    let listing: HostawayRecord | null = null;
    if (listingExternalId) {
      const cacheKey = `${tenant.id}-${listingExternalId}`;
      const now = Date.now();

      // Step 1: Check in-memory cache first
      const cached = this.listingCache.get(cacheKey);
      if (cached && now - cached.timestamp < this.cacheTimeout) {
        listing = cached.listing;
        this.logger.debug(`Using in-memory cache for listing ${listingExternalId}`);
      } else {
        // Step 2: Try to get from database property metadata (if property exists)
        try {
          const propertyResult = await this.databaseService.runQuery<{
            metadata: Record<string, unknown>;
          }>(
            `SELECT metadata FROM public.properties WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
            [tenant.id, listingExternalId],
          );

          if (propertyResult.rows.length > 0 && propertyResult.rows[0].metadata?.listing) {
            listing = propertyResult.rows[0].metadata.listing as HostawayRecord;
            // Cache in memory for faster access
            this.listingCache.set(cacheKey, { listing, timestamp: now });
            this.logger.debug(`Using database metadata cache for listing ${listingExternalId}`);
          }
        } catch {
          // Non-fatal - continue to API fetch
          this.logger.debug(
            `Could not load listing from database for ${listingExternalId}, will fetch from API`,
          );
        }

        // Step 3: If not in cache or DB, fetch from API
        if (!listing) {
          try {
            listing = await this.hostawayClient.getListing(tenant, listingExternalId);
            if (listing) {
              // Cache the listing in memory
              this.listingCache.set(cacheKey, { listing, timestamp: now });

              // Log listing data structure for debugging (first fetch only)
              this.logger.debug(
                `Fetched listing ${listingExternalId} from API. Fields: name=${this.readString(
                  listing,
                  'name',
                )}, ` +
                  `externalListingName=${this.readString(listing, 'externalListingName')}, ` +
                  `internalListingName=${this.readString(listing, 'internalListingName')}, ` +
                  `availableKeys=${Object.keys(listing).slice(0, 20).join(', ')}`,
              );
            }
          } catch (error) {
            this.logger.warn(
              `Failed to fetch listing ${listingExternalId} from API for reservation ${hostawayReservationId}`,
              error as Error,
            );
            listing = null;
          }
        }
      }
    }

    const propertyExternalId = listingExternalId ?? `reservation-${hostawayReservationId}`;
    // Priority: 1) internalListingName (internal property name), 2) name field, 3) listingName from reservation, 4) fallbacks
    // IMPORTANT: Use 'internalListingName' (e.g., "Cross Road") NOT 'externalListingName' or 'name' (which may be OTA names)
    // Do NOT use externalListingName, bookingcomPropertyName, airbnbName - these are external/OTA names
    const propertyName =
      this.readString(listing ?? {}, 'internalListingName') || // Primary: internal listing name (e.g., "Cross Road")
      this.readString(listing ?? {}, 'name') || // Fallback: listing name field
      this.readString(
        reservation,
        'listingName',
        'propertyName',
        'listing.name',
        'property.name',
      ) ||
      'Hostaway Listing';

    // Log what we're using for debugging
    if (
      listing &&
      this.readString(listing, 'externalListingName') &&
      !this.readString(listing, 'name')
    ) {
      this.logger.warn(
        `Listing ${listingExternalId} has externalListingName but no 'name' field. Using fallback: ${propertyName}`,
      );
    }
    const timezone =
      this.readString(reservation, 'timezone', 'listing.timezone', 'property.timezone') ?? 'UTC';

    const guestExternalId =
      this.readString(reservation, 'guestId', 'guest_id', 'guest.id') ??
      `reservation-${hostawayReservationId}`;
    const guestName = this.buildGuestName(reservation);
    const guestEmail = this.readString(reservation, 'guestEmail', 'guest_email', 'guest.email');
    const guestPhone =
      this.readString(reservation, 'guestPhone', 'guest_phone', 'phone') ??
      this.readString(reservation, 'guest.phone', 'guest.contact.phone', 'guest.phone_number');

    const status =
      this.readString(reservation, 'status', 'reservationStatus', 'reservation_status') ??
      'pending';
    const channel =
      this.readString(reservation, 'channel', 'reservationChannel', 'channel_name') ?? 'hostaway';

    const checkInDate = this.resolveReservationDate(reservation, timezone, {
      datePaths: [
        'checkIn',
        'check_in',
        'startDate',
        'start_date',
        'arrivalDate',
        'arrival_date',
        'arrival',
        'start',
      ],
      timePaths: ['checkInTime', 'check_in_time', 'checkIn.time', 'check_in.time'],
      fallbackHour: 15,
    });
    const checkOutDate = this.resolveReservationDate(reservation, timezone, {
      datePaths: [
        'checkOut',
        'check_out',
        'endDate',
        'end_date',
        'departureDate',
        'departure_date',
        'departure',
        'end',
      ],
      timePaths: ['checkOutTime', 'check_out_time', 'checkOut.time', 'check_out.time'],
      fallbackHour: 10,
    });

    const metadata = {
      source: 'hostaway',
      reservation,
    };

    try {
      return await this.databaseService.withClient(async (client) => {
        try {
          await client.query('BEGIN');

          // Store full listing data in metadata for future use (amenities, wifi, door codes, etc.)
          // Only store safe, serializable data (no functions, circular refs)
          const listingMetadata: Record<string, unknown> = {
            source: 'hostaway',
          };

          if (listing) {
            // Extract useful fields from listing for easy access - store in metadata for caching
            listingMetadata.listing = {
              id: listing.id,
              name: listing.name,
              externalListingName: listing.externalListingName,
              internalListingName: listing.internalListingName,
              amenities: listing.amenities,
              wifiUsername: listing.wifiUsername,
              wifiPassword: listing.wifiPassword,
              wifiNetwork: listing.wifiNetwork,
              wifiName: listing.wifiName,
              doorSecurityCode: listing.doorSecurityCode,
              doorCode: listing.doorCode,
              // Store other useful fields that might be needed
              address: listing.address,
              city: listing.city,
              country: listing.country,
              timezone: listing.timezone,
              checkInTime: listing.checkInTime,
              checkOutTime: listing.checkOutTime,
            };
          }

          const propertyResult = await client.query<{ id: string }>(
            `insert into public.properties (tenant_id, external_id, name, timezone, metadata, updated_at)
             values ($1, $2, $3, $4, $5::jsonb, now())
             on conflict (tenant_id, external_id)
             do update set
               name = excluded.name,
               timezone = excluded.timezone,
               metadata = excluded.metadata,
               updated_at = now()
             returning id`,
            [
              tenant.id,
              propertyExternalId,
              propertyName,
              timezone,
              JSON.stringify(listingMetadata),
            ],
          );
          const propertyId = propertyResult.rows[0].id;

          const guestResult = await client.query<{ id: string }>(
            `insert into public.guests (tenant_id, external_id, full_name, email, phone_number, metadata, updated_at)
             values ($1, $2, $3, $4, $5, $6::jsonb, now())
             on conflict (tenant_id, external_id)
             do update set
               full_name = excluded.full_name,
               email = excluded.email,
               phone_number = excluded.phone_number,
               metadata = excluded.metadata,
               updated_at = now()
             returning id`,
            [
              tenant.id,
              guestExternalId,
              guestName,
              guestEmail,
              guestPhone,
              JSON.stringify({ source: 'hostaway' }),
            ],
          );
          const guestId = guestResult.rows[0].id;

          const bookingResult = await client.query<{ id: string }>(
            `insert into public.bookings (
                tenant_id,
                property_id,
                guest_id,
                external_id,
                status,
                channel,
                check_in_at,
                check_out_at,
                metadata,
                updated_at
             )
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now())
             on conflict (tenant_id, external_id)
             do update set
               property_id = excluded.property_id,
               guest_id = excluded.guest_id,
               status = excluded.status,
               channel = excluded.channel,
               check_in_at = excluded.check_in_at,
               check_out_at = excluded.check_out_at,
               metadata = excluded.metadata,
               updated_at = now()
             returning id`,
            [
              tenant.id,
              propertyId,
              guestId,
              hostawayReservationId,
              status,
              channel,
              checkInDate ? checkInDate.toISOString() : null,
              checkOutDate ? checkOutDate.toISOString() : null,
              JSON.stringify(metadata),
            ],
          );

          await client.query('COMMIT');

          return {
            bookingId: bookingResult.rows[0].id,
            hostawayReservationId,
            hostawayConversationId,
          };
        } catch (innerError) {
          await client.query('ROLLBACK');
          throw innerError;
        }
      });
    } catch (error) {
      this.logger.error(
        `Failed to upsert booking for tenant ${tenant.id} (Hostaway reservation ${hostawayReservationId})`,
        error as Error,
      );
      return null;
    }
  }
}
