import { BadRequestException, Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';

import { LoggingService } from '../logging/logging.service';
import { ConversationsService } from '../conversations/conversations.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { TenantService } from '../tenant/tenant.service';
import { HostawayClient } from '../integrations/hostaway.client';

@Controller('webhooks')
export class HostawayWebhookController {
  private readonly logger = new Logger(HostawayWebhookController.name);

  constructor(
    private readonly schedulingService: SchedulingService,
    private readonly tenantService: TenantService,
    private readonly loggingService: LoggingService,
    private readonly conversationsService: ConversationsService,
    private readonly hostawayClient: HostawayClient,
  ) {}

  @Post('hostaway')
  @HttpCode(200)
  async handleHostawayWebhook(@Body() payload: Record<string, unknown>) {
    const event = this.readString(payload, 'event') || 'unknown';
    const clientIdentifier =
      this.readString(
        payload,
        'accountId',
        'account_id',
        'clientId',
        'client_id',
        'hostawayAccountId',
      ) || this.readString(payload, 'data.accountId', 'data.account_id');

    // Log webhook payload to file
    this.loggingService.logWebhook(payload, event, clientIdentifier);

    if (!clientIdentifier) {
      this.loggingService.logWebhookError(
        new Error('Unable to identify Hostaway client in webhook payload'),
        payload,
        event,
      );
      throw new BadRequestException('Unable to identify Hostaway client in webhook payload');
    }

    // Identify tenant primarily by Hostaway accountId (from webhook), fall back to clientId
    let tenant = await this.tenantService.findTenantByHostawayAccountId(clientIdentifier);
    if (!tenant) {
      tenant = await this.tenantService.findTenantByHostawayClientId(clientIdentifier);
    }

    if (!tenant) {
      this.loggingService.logWebhookError(
        new Error('Unknown Hostaway client identifier'),
        payload,
        event,
        clientIdentifier,
      );
      throw new BadRequestException('Unknown Hostaway client identifier');
    }

    this.loggingService.logWebhook(payload, event, tenant.id);

    // Handle incoming conversation messages immediately for logging, then queue for AI processing
    if (
      event === 'message.received' ||
      this.readString(payload, 'object') === 'conversationMessage'
    ) {
      const data = (this.resolvePath(payload, 'data') as Record<string, unknown>) || {};
      const reservationId = this.readString(data, 'reservationId', 'reservation_id');
      const conversationId = this.readString(data, 'conversationId', 'conversation_id');
      const body = this.readString(data, 'body') ?? '';

      if (reservationId) {
        try {
          const conversation = await this.conversationsService.upsertByReservationExternalId(
            tenant.id,
            String(reservationId),
            { hostawayConversationId: conversationId ?? null },
          );

          // Extract message ID and create hash for idempotency
          const messageId = this.readString(data, 'id', 'messageId', 'message_id');
          const timestamp =
            this.readString(data, 'createdAt', 'created_at', 'timestamp') ||
            new Date().toISOString();
          const messageHash = messageId
            ? undefined
            : `${body.substring(0, 100)}_${timestamp}`.substring(0, 100);

          await this.conversationsService.logGuestMessage(conversation, body, {
            source: 'hostaway.webhook',
            event,
            reservationId,
            hostawayConversationId: conversationId ?? null,
            hostawayMessageId: messageId,
            messageId: messageId, // Also store in messageId for compatibility
            messageHash,
          });
        } catch (e) {
          const error = e as Error;
          // If booking doesn't exist, try to fetch and sync the reservation first
          if (error.message?.includes('Booking not found for reservation')) {
            try {
              this.logger.log(
                `Booking not found for reservation ${reservationId}, attempting to sync from Hostaway for tenant ${tenant.id}`,
              );
              const reservation = await this.hostawayClient.getReservation(
                tenant,
                String(reservationId),
              );
              await this.schedulingService.scheduleProactiveMessagesFromReservation(
                tenant,
                reservation,
                {
                  initialSync: false,
                },
              );

              // Retry conversation creation after syncing reservation
              const conversation = await this.conversationsService.upsertByReservationExternalId(
                tenant.id,
                String(reservationId),
                { hostawayConversationId: conversationId ?? null },
              );

              await this.conversationsService.logGuestMessage(conversation, body, {
                source: 'hostaway.webhook',
                event,
                reservationId,
                hostawayConversationId: conversationId ?? null,
              });

              this.logger.log(
                `Successfully synced reservation ${reservationId} and created conversation`,
              );
            } catch (syncError) {
              this.logger.error(
                `Failed to sync reservation ${reservationId} from Hostaway: ${
                  (syncError as Error).message
                }`,
              );
              this.loggingService.logWebhookError(syncError as Error, payload, event, tenant.id);
            }
          } else {
            this.loggingService.logWebhookError(error, payload, event, tenant.id);
          }
        }

        // Queue message for AI processing after logging
        // Flatten payload to match scheduler's expected format
        const messagePayload = { event: 'message.received', ...data };
        await this.schedulingService.queueHostawayEvent(tenant.id, messagePayload);
      }
    } else {
      // Queue other events for downstream processing
      if (event.startsWith('reservation.')) {
        const data = (this.resolvePath(payload, 'data') as Record<string, unknown>) || {};
        // Flatten event + reservation fields at top-level for scheduler
        await this.schedulingService.queueHostawayEvent(tenant.id, { event, ...data });
      } else {
        await this.schedulingService.queueHostawayEvent(tenant.id, payload);
      }
    }

    return { received: true };
  }

  private readString(source: Record<string, unknown>, ...paths: string[]): string | undefined {
    for (const path of paths) {
      const value = this.resolvePath(source, path);
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
      if (typeof value === 'number') {
        return String(value);
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
