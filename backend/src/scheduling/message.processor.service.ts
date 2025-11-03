import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { LoggingService } from '../logging/logging.service';
import { TenantService, TenantSummary } from '../tenant/tenant.service';
import {
  ConversationsService,
  PendingOutboundMessage,
} from '../conversations/conversations.service';
import { DatabaseService } from '../database/database.service';
import { HostawayClient } from '../integrations/hostaway.client';
import { TwilioClient } from '../messaging/twilio.client';
import { TemplatesService } from '../templates/templates.service';
import { ProactiveMessageType } from './scheduling.service';

type HostawayRecord = Record<string, unknown>;

@Injectable()
export class MessageProcessorService {
  private readonly logger = new Logger(MessageProcessorService.name);
  private readonly batchSize = 25;
  // Cache listing data to avoid repeated API calls - check DB metadata first
  private readonly listingCache = new Map<string, { listing: HostawayRecord; timestamp: number }>();
  private readonly cacheTimeout = 30 * 60 * 1000; // 30 minutes - listings don't change often

  constructor(
    private readonly tenantService: TenantService,
    private readonly conversationsService: ConversationsService,
    private readonly hostawayClient: HostawayClient,
    private readonly twilioClient: TwilioClient,
    private readonly templatesService: TemplatesService,
    private readonly loggingService: LoggingService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingMessages(): Promise<void> {
    let iteration = 0;

    while (iteration < 10) {
      const claimed = await this.claimPendingMessages(this.batchSize);
      if (claimed.length === 0) {
        if (iteration === 0) {
          this.logger.debug('No scheduled messages ready for processing.');
        }
        break;
      }

      for (const row of claimed) {
        await this.processMessage(row);
      }

      if (claimed.length < this.batchSize) {
        break;
      }

      iteration += 1;
    }
  }

  private async claimPendingMessages(limit: number): Promise<PendingOutboundMessage[]> {
    if (limit <= 0) {
      return [];
    }

    return this.conversationsService.claimPendingOutboundMessages(limit);
  }

  private async processMessage(message: PendingOutboundMessage): Promise<void> {
    try {
      if (!message.messageType) {
        throw new Error('Missing message type in metadata');
      }

      const tenant = await this.tenantService.getTenantById(message.tenantId);
      const conversation = await this.conversationsService.getOrCreateConversation(
        tenant.id,
        message.bookingId,
        { hostawayConversationId: message.hostawayConversationId },
      );

      if (conversation.status === 'paused_by_human') {
        this.logger.debug(
          `Skipping scheduled message ${message.id} because conversation ${conversation.id} is paused.`,
        );
        await this.conversationsService.markMessageAsFailed(
          message.id,
          new Error('Conversation paused by human agent'),
        );
        return;
      }

      const reservationExternalId =
        message.hostawayReservationId ?? message.bookingExternalId ?? null;

      if (!reservationExternalId) {
        throw new Error('Hostaway reservation identifier is missing');
      }

      const reservation = await this.hostawayClient.getReservation(tenant, reservationExternalId);

      // Check if reservation is cancelled before processing
      const status = (this.readString(reservation, 'status') ?? '').toLowerCase();
      if (status === 'cancelled') {
        this.logger.debug(
          `Skipping message ${message.id} for cancelled reservation ${reservationExternalId} (tenant ${message.tenantId})`,
        );
        await this.conversationsService.markMessageAsFailed(
          message.id,
          new Error('Reservation was cancelled'),
        );
        return;
      }

      const listingId = this.readString(
        reservation,
        'listingMapId',
        'listing_map_id',
        'listingId',
        'listing_id',
        'propertyId',
        'property_id',
      );
      const listing = listingId ? await this.getListingWithCache(tenant, listingId) : null;

      const messageLabel =
        message.messageLabel ??
        this.readString(message.metadata ?? {}, 'messageLabel') ??
        message.messageType ??
        'scheduled message';

      this.logger.debug(
        `Processing ${messageLabel} for booking ${
          message.bookingExternalId ?? message.bookingId
        } (tenant ${message.tenantId})`,
      );

      // Log message processing to file
      this.loggingService.logMessageProcessing(
        message.id,
        message.tenantId,
        message.messageType as string,
        {
          messageLabel,
          bookingExternalId: message.bookingExternalId,
          bookingId: message.bookingId,
          reservationExternalId,
          listingId,
          hasReservation: !!reservation,
          hasListing: !!listing,
        },
      );

      const body = await this.composeProactiveMessage(
        message.messageType as ProactiveMessageType,
        tenant,
        reservation,
        listing,
        message.guestName ?? 'Guest',
      );

      const phoneNumber = this.readString(
        reservation,
        'guestPhone',
        'guest_phone',
        'phone',
        'guest.phone',
        'guest.contact.phone',
        'guest.phone_number',
      );

      let hostawayConversationId =
        message.hostawayConversationId ?? conversation.hostawayConversationId ?? null;

      // Attempt to resolve missing Hostaway conversation id before sending
      if (!hostawayConversationId && reservationExternalId) {
        try {
          const convos = await this.hostawayClient.getReservationConversations(
            tenant,
            reservationExternalId,
          );

          // Strictly link by reservation id fields present on conversation objects
          const match =
            (convos ?? []).find((c) => {
              const convoResId = this.readString(
                c as Record<string, unknown>,
                'reservationId',
                'reservation_id',
                'reservation.id',
                'hostawayReservationId',
              );
              return (
                (convoResId && convoResId === reservationExternalId) ||
                (convoResId && String(convoResId) === String(reservationExternalId))
              );
            }) || (Array.isArray(convos) && convos.length === 1 ? convos[0] : null);

          const resolvedId = this.readString(
            (match ?? {}) as Record<string, unknown>,
            'id',
            'conversationId',
            'conversation_id',
          );
          if (resolvedId) {
            hostawayConversationId = resolvedId;
            // Persist link to our conversation record
            await this.conversationsService.ensureHostawayConversationLink(
              tenant.id,
              conversation.id,
              hostawayConversationId,
            );
          }
        } catch {
          // Non-fatal; fallback logic below will send by reservation
        }
      }

      const deliveryMetadata = {
        messageType: message.messageType,
        messageLabel,
        scheduledSendAt: message.scheduledSendAt,
        scheduledLocalAt:
          message.scheduledLocalAt ??
          this.readString(message.metadata ?? {}, 'scheduledLocalAt') ??
          null,
        scheduledTimezone:
          message.scheduledTimezone ??
          this.readString(message.metadata ?? {}, 'scheduledTimezone') ??
          null,
        reservationId: reservationExternalId,
        deliveryChannel: phoneNumber ? 'twilio' : 'hostaway',
        hostawayConversationId,
      };

      if (phoneNumber) {
        await this.twilioClient.sendWhatsAppMessage(tenant, phoneNumber, body);
        this.loggingService.logMessageSent(
          message.id,
          message.tenantId,
          'twilio',
          phoneNumber,
          body,
        );
      } else {
        if (hostawayConversationId) {
          await this.hostawayClient.sendConversationMessage(
            tenant,
            hostawayConversationId,
            body,
            'channel',
          );
          this.loggingService.logMessageSent(
            message.id,
            message.tenantId,
            'hostaway_conversation',
            hostawayConversationId,
            body,
          );
        } else {
          await this.hostawayClient.sendMessageToGuest(tenant, reservationExternalId, body);
          this.loggingService.logMessageSent(
            message.id,
            message.tenantId,
            'hostaway_guest',
            reservationExternalId,
            body,
          );
        }
      }

      await this.conversationsService.markMessageAsSent(message.id, body, deliveryMetadata);
    } catch (error) {
      await this.conversationsService.markMessageAsFailed(message.id, error as Error);
      this.logger.error(
        `Failed to process scheduled message ${message.id} for tenant ${message.tenantId}`,
        error as Error,
      );
    }
  }

  private async composeProactiveMessage(
    messageType: ProactiveMessageType,
    tenant: TenantSummary,
    reservation: HostawayRecord,
    listing: HostawayRecord | null,
    fallbackGuestName: string,
  ): Promise<string> {
    // Ensure default templates exist for this tenant
    await this.templatesService.ensureDefaultTemplates(tenant.id);

    // Get the template from database
    const template = await this.templatesService.getTemplateForMessage(tenant.id, messageType);

    if (!template) {
      this.logger.warn(
        `No template found for message type ${messageType} for tenant ${tenant.id}, using fallback`,
      );
      return this.getFallbackMessage(messageType, reservation, listing, fallbackGuestName);
    }

    // For door-code messages, refresh listing data right before sending to ensure code availability
    // Even though we cache, door codes might be generated just-in-time, so we need fresh data
    let effectiveListing: HostawayRecord | null = listing;
    if (messageType === 'door_code_3h') {
      try {
        const listingId = this.readString(
          reservation,
          'listingMapId',
          'listing_map_id',
          'listingId',
          'listing_id',
          'propertyId',
          'property_id',
        );
        if (listingId) {
          // Always fetch fresh for door codes (they're generated 3h before check-in)
          const fresh = await this.hostawayClient.getListing(tenant, listingId);
          if (fresh) {
            effectiveListing = fresh;
            // Update cache with fresh data
            const cacheKey = `${tenant.id}-${listingId}`;
            this.listingCache.set(cacheKey, { listing: fresh, timestamp: Date.now() });
          }
        }
      } catch {
        // ignore and use existing listing if available
      }
    }

    // Extract variables from reservation and (possibly refreshed) listing data
    const variables = this.extractVariables(reservation, effectiveListing, fallbackGuestName);

    // Substitute variables in template
    return this.templatesService.substituteVariables(template.template_body, variables);
  }

  private extractVariables(
    reservation: HostawayRecord,
    listing: HostawayRecord | null,
    fallbackGuestName: string,
  ): Record<string, string | number | null | undefined> {
    // Guest name - from reservation data
    const guestName =
      this.readString(
        reservation,
        'guestName',
        'guest_name',
        'guestFirstName',
        'guest_first_name',
      ) ?? fallbackGuestName;

    // Property name - prioritize listing name over external/OTA name
    // Use listing.name (e.g., "Flat B | Charlotte St") over externalListingName
    const propertyName =
      this.readString(listing ?? {}, 'internalListingName') || // Primary: internal listing name (e.g., "Cross Road")
      this.readString(listing ?? {}, 'name') || // Fallback: listing name field
      this.readString(
        reservation,
        'listingName',
        'listing_name',
        'propertyName',
        'property_name',
      ) ||
      'your stay';

    // Door code - from listing data (more reliable than reservation)
    const doorCode =
      this.readString(
        listing ?? {},
        'doorSecurityCode',
        'door_security_code',
        'doorCode',
        'door_code',
      ) || this.readString(reservation, 'doorCode', 'door_code', 'accessCode', 'access_code');

    // WiFi info - from listing data
    const wifiName = this.readString(
      listing ?? {},
      'wifiUsername',
      'wifi_username',
      'wifiName',
      'wifi_name',
      'wifiNetwork',
      'wifi_network',
    );
    const wifiPassword = this.readString(
      listing ?? {},
      'wifiPassword',
      'wifi_password',
      'wifiPass',
      'wifi_pass',
    );

    // Format dates - from reservation data
    const checkInDate = this.formatDate(
      this.readString(reservation, 'arrivalDate', 'arrival_date', 'checkIn', 'check_in'),
    );
    const checkOutDate = this.formatDate(
      this.readString(reservation, 'departureDate', 'departure_date', 'checkOut', 'check_out'),
    );

    return {
      guestName,
      propertyName,
      doorCode: doorCode || 'Not available',
      wifiName: wifiName || 'Not available',
      wifiPassword: wifiPassword || 'Not available',
      checkInDate,
      checkOutDate,
    };
  }

  private formatDate(dateString: string | undefined): string {
    if (!dateString) return '';

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  }

  private getFallbackMessage(
    messageType: ProactiveMessageType,
    reservation: HostawayRecord,
    listing: HostawayRecord | null,
    fallbackGuestName: string,
  ): string {
    const guestName =
      this.readString(reservation, 'guestName', 'guest_name', 'guest.name') ?? fallbackGuestName;
    // Property name - prioritize internalListingName (e.g., "Cross Road")
    const propertyName =
      this.readString(listing ?? {}, 'internalListingName') || // Primary: internal listing name
      this.readString(listing ?? {}, 'name') || // Fallback: listing name field
      this.readString(reservation, 'propertyName', 'listing.name', 'property.name') ||
      'your stay';
    const doorCode = this.readString(
      reservation,
      'doorCode',
      'door_code',
      'accessCode',
      'access_code',
    );
    const wifiName = this.readString(listing ?? {}, 'wifiName', 'wifi_name');
    const wifiPassword = this.readString(listing ?? {}, 'wifiPassword', 'wifi_password');

    let wifiDetails = '';
    if (wifiName && wifiPassword) {
      wifiDetails = ` Wi-Fi ${wifiName} / ${wifiPassword}.`;
    } else if (wifiName) {
      wifiDetails = ` Wi-Fi ${wifiName}.`;
    } else if (wifiPassword) {
      wifiDetails = ` Wi-Fi password: ${wifiPassword}.`;
    }

    switch (messageType) {
      case 'thank_you_immediate':
        return `Hi ${guestName}, thanks for booking ${propertyName}! We're excited to host you.`;
      case 'pre_arrival_24h':
        return `Hi ${guestName}, your stay at ${propertyName} is 24 hours away. Let us know if you need anything before arrival.`;
      case 'door_code_3h':
        return doorCode
          ? `Hi ${guestName}, here is your door code for ${propertyName}: ${doorCode}. Safe travels!`
          : `Hi ${guestName}, we're preparing your door access for ${propertyName}. We'll send your code shortly.`;
      case 'same_day_checkin':
        return `Welcome ${guestName}! Check-in for ${propertyName} is available now.${wifiDetails} Enjoy your stay!`;
      case 'checkout_morning':
        return `Good morning ${guestName}! Wishing you a smooth checkout today. Let us know if you need a late checkout.`;
      default:
        return `Hello ${guestName}, we're here if you need any assistance during your stay at ${propertyName}.`;
    }
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

  private async getListingWithCache(
    tenant: TenantSummary,
    listingId: string,
  ): Promise<HostawayRecord | null> {
    const cacheKey = `${tenant.id}-${listingId}`;
    const now = Date.now();

    // Step 1: Check in-memory cache first
    const cached = this.listingCache.get(cacheKey);
    if (cached && now - cached.timestamp < this.cacheTimeout) {
      return cached.listing;
    }

    // Step 2: Try to get from database property metadata (persistent cache)
    try {
      const propertyResult = await this.databaseService.runQuery<{
        metadata: Record<string, unknown>;
      }>(
        `SELECT metadata FROM public.properties WHERE tenant_id = $1 AND external_id = $2 LIMIT 1`,
        [tenant.id, listingId],
      );

      if (propertyResult.rows.length > 0 && propertyResult.rows[0].metadata?.listing) {
        const listing = propertyResult.rows[0].metadata.listing as HostawayRecord;
        // Cache in memory for faster access
        this.listingCache.set(cacheKey, { listing, timestamp: now });
        return listing;
      }
    } catch {
      // Non-fatal - continue to API fetch
      this.logger.debug(
        `Could not load listing from database for ${listingId}, will fetch from API`,
      );
    }

    // Step 3: If not in cache or DB, fetch from API
    try {
      const listing = await this.hostawayClient.getListing(tenant, listingId);
      if (listing) {
        // Cache the listing in memory
        this.listingCache.set(cacheKey, { listing, timestamp: now });
      }
      return listing;
    } catch (error) {
      this.logger.warn(`Failed to fetch listing ${listingId} from API`, error as Error);
      return null;
    }
  }
}
