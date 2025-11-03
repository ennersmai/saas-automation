import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { HostawayClient } from '../integrations/hostaway.client';
import { TemplatesService } from '../templates/templates.service';
import { TwilioClient } from '../messaging/twilio.client';
import { DatabaseService } from '../database/database.service';
import { TenantService, TenantSummary } from '../tenant/tenant.service';

const formatToIsoString = (value: string | Date | null | undefined): string => {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle PostgreSQL timestamp strings (e.g., "2025-10-31 10:00:00" or "2025-10-31T10:00:00.000Z")
  if (typeof value === 'string') {
    // If it's already an ISO string, use it directly
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }

    // Handle PostgreSQL format: "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD HH:MM:SS.mmm"
    // Add 'Z' to treat as UTC if no timezone is present
    const pgTimestampMatch =
      /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d{3})?)(?:Z|[+-]\d{2}:\d{2})?$/.exec(
        value.trim(),
      );
    if (pgTimestampMatch) {
      const dateStr = pgTimestampMatch[1];
      const timeStr = pgTimestampMatch[2];
      // Ensure milliseconds are present
      const timeParts = timeStr.split('.');
      const timeWithoutMs = timeParts[0];
      const ms = timeParts[1] ? `.${timeParts[1].padEnd(3, '0').substring(0, 3)}` : '.000';
      const isoString = `${dateStr}T${timeWithoutMs}${ms}Z`;
      const parsed = new Date(isoString);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }

    // Fallback to standard Date parsing
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  // If all parsing fails, return as-is (shouldn't happen for valid timestamps)
  return String(value);
};

export type ConversationStatus = 'automated' | 'paused_by_human';
export type SenderType = 'guest' | 'human' | 'ai' | 'system';
export type ConversationLogStatus = 'pending' | 'processing' | 'sent' | 'failed';

export interface ConversationRecord {
  id: string;
  tenantId: string;
  bookingId: string;
  bookingExternalId: string | null;
  hostawayConversationId: string | null;
  status: ConversationStatus;
  updatedAt: string;
}

export interface ConversationSummary extends ConversationRecord {
  lastMessageAt: string | null;
  pendingMessageCount: number;
  guestName: string | null;
  propertyName: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  nextPendingAt: string | null;
  nextPendingLocalAt: string | null;
  nextPendingType: string | null;
  nextPendingLabel: string | null;
  nextPendingTimezone: string | null;
}

export interface ConversationLogEntry {
  id: string;
  senderType: SenderType;
  direction: 'guest' | 'ai' | 'staff';
  messageBody: string;
  status: ConversationLogStatus;
  scheduledSendAt: string | null;
  actualSentAt: string | null;
  sentAt: string;
  metadata: Record<string, unknown>;
  errorMessage: string | null;
}

export interface ConversationDetail extends ConversationSummary {
  logs: ConversationLogEntry[];
}

export interface PendingOutboundMessage {
  id: string;
  tenantId: string;
  conversationId: string;
  bookingId: string;
  bookingExternalId: string | null;
  hostawayConversationId: string | null;
  messageType: string | null;
  messageLabel: string | null;
  hostawayReservationId: string | null;
  guestName: string | null;
  scheduledSendAt: string | null;
  scheduledLocalAt: string | null;
  scheduledTimezone: string | null;
  metadata: Record<string, unknown>;
}

interface ConversationRow {
  id: string;
  tenant_id: string;
  booking_id: string;
  booking_external_id: string | null;
  hostaway_conversation_id: string | null;
  status: ConversationStatus;
  updated_at: Date | string;
}

interface ConversationSummaryRow extends ConversationRow {
  last_message_at: Date | string | null;
  pending_count: string | null;
  guest_name?: string | null;
  check_in_at?: Date | string | null;
  check_out_at?: Date | string | null;
  next_pending_at?: Date | string | null;
  next_pending_local_at?: string | null;
  next_pending_type?: string | null;
  next_pending_label?: string | null;
  next_pending_timezone?: string | null;
}

interface ConversationLogRow {
  id: string;
  sender_type: SenderType;
  direction: 'guest' | 'ai' | 'staff';
  message_body: string;
  status: ConversationLogStatus;
  scheduled_send_at: string | null;
  actual_sent_at: string | null;
  sent_at: string;
  metadata: Record<string, unknown> | null;
  error_message: string | null;
}

interface ClaimRow {
  id: string;
  tenant_id: string;
  conversation_id: string;
  booking_id: string;
  booking_external_id: string | null;
  scheduled_send_at: string | null;
  metadata: Record<string, unknown> | null;
  hostaway_conversation_id: string | null;
}

interface CreateLogOptions {
  conversationId: string;
  tenantId: string;
  bookingId: string;
  direction: 'guest' | 'ai' | 'staff';
  senderType: SenderType;
  messageBody: string;
  status: ConversationLogStatus;
  scheduledSendAt?: Date | null;
  actualSentAt?: Date | null;
  sentAt?: Date | null;
  metadata?: Record<string, unknown>;
  errorMessage?: string | null;
}

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  thank_you_immediate: 'Booking Confirmation',
  pre_arrival_24h: '24h Pre-Arrival Instructions',
  door_code_3h: '3h Pre-Check-in Door Code',
  same_day_checkin: 'Same-Day Booking Instant Code',
  checkout_morning: 'Checkout Morning Reminder',
};

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly hostawayClient: HostawayClient,
    private readonly twilioClient: TwilioClient,
    private readonly databaseService: DatabaseService,
    private readonly tenantService: TenantService,
    private readonly templatesService: TemplatesService,
  ) {}

  private mapConversation(row: ConversationRow): ConversationRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      bookingId: row.booking_id,
      bookingExternalId: row.booking_external_id ?? null,
      hostawayConversationId: row.hostaway_conversation_id ?? null,
      status: row.status,
      updatedAt: formatToIsoString(row.updated_at),
    };
  }

  async sendTemplateReply(
    tenant: TenantSummary,
    conversationId: string,
    templateId: string,
  ): Promise<void> {
    const conversation = await this.getConversationById(tenant.id, conversationId);
    if (!conversation.bookingExternalId) {
      throw new Error('Conversation is not linked to a Hostaway reservation');
    }
    const tpl = await this.templatesService.getTemplate(tenant.id, templateId);
    const reservation = await this.hostawayClient.getReservation(
      tenant,
      conversation.bookingExternalId,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listingId = this.readString(
      reservation as any,
      'listingMapId',
      'listing_id',
      'propertyId',
      'property_id',
    );
    const listing = listingId ? await this.hostawayClient.getListing(tenant, listingId) : null;
    const variables: Record<string, string | number | null | undefined> = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      guestName: this.readString(reservation as any, 'guestName', 'guest_first_name') ?? 'Guest',
      propertyName:
        this.readString(listing ?? {}, 'internalListingName') || // Primary: internal listing name (e.g., "Cross Road")
        this.readString(listing ?? {}, 'name') || // Fallback: listing name field
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.readString(
          reservation as any,
          'listingName',
          'propertyName',
          'listing.name',
          'property.name',
        ) ||
        'your stay',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      guestPortalUrl: this.readString(reservation as any, 'guestPortalUrl', 'guest_portal_url'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      checkInDate: this.readString(reservation as any, 'arrivalDate', 'checkin_date_day'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      checkOutDate: this.readString(reservation as any, 'departureDate', 'checkout_date_day'),
    };
    const body = this.templatesService.substituteVariables(tpl.template_body, variables);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phoneNumber = this.readString(reservation as any, 'guestPhone', 'guest_phone', 'phone');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hostawayConversationId =
      conversation.hostawayConversationId ?? this.readString(reservation as any, 'conversationId');
    if (phoneNumber) {
      await this.twilioClient.sendWhatsAppMessage(tenant, phoneNumber, body);
    } else if (hostawayConversationId) {
      await this.hostawayClient.sendConversationMessage(
        tenant,
        hostawayConversationId,
        body,
        'channel',
      );
    } else {
      await this.hostawayClient.sendMessageToGuest(tenant, conversation.bookingExternalId, body);
    }
    await this.logHumanReply(conversation, body, { templateId });
  }

  private mapConversationSummary(row: ConversationSummaryRow): ConversationSummary {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rowAny = row as any;
    return {
      ...this.mapConversation(row),
      lastMessageAt: row.last_message_at ? formatToIsoString(row.last_message_at) : null,
      pendingMessageCount: row.pending_count ? Number(row.pending_count) : 0,
      guestName: rowAny.guest_name ?? null,
      propertyName: rowAny.property_name ?? null,
      checkInAt: row.check_in_at ? formatToIsoString(row.check_in_at) : null,
      checkOutAt: row.check_out_at ? formatToIsoString(row.check_out_at) : null,
      nextPendingAt: rowAny.next_pending_at ? formatToIsoString(rowAny.next_pending_at) : null,
      nextPendingLocalAt: rowAny.next_pending_local_at ?? null,
      nextPendingType: rowAny.next_pending_type ?? null,
      nextPendingLabel:
        (rowAny.next_pending_label as string | undefined | null) ??
        this.resolveMessageLabel(rowAny.next_pending_type ?? null),
      nextPendingTimezone: rowAny.next_pending_timezone ?? null,
    };
  }

  private resolveMessageLabel(messageType: string | null): string | null {
    if (!messageType) {
      return null;
    }
    return MESSAGE_TYPE_LABELS[messageType] ?? messageType;
  }

  private mapLogRow(row: ConversationLogRow): ConversationLogEntry {
    return {
      id: row.id,
      senderType: row.sender_type,
      direction: row.direction,
      messageBody: row.message_body,
      status: row.status,
      scheduledSendAt: row.scheduled_send_at,
      actualSentAt: row.actual_sent_at,
      sentAt: formatToIsoString(row.sent_at),
      metadata: row.metadata ?? {},
      errorMessage: row.error_message,
    };
  }

  async getOrCreateConversation(
    tenantId: string,
    bookingId: string,
    options: { hostawayConversationId?: string | null } = {},
  ): Promise<ConversationRecord> {
    const { rows } = await this.databaseService.runQuery<ConversationRow>(
      `with upsert as (
         insert into public.conversations (tenant_id, booking_id, hostaway_conversation_id)
         values ($1, $2, $3)
         on conflict (tenant_id, booking_id)
         do update set
           updated_at = now(),
           hostaway_conversation_id = coalesce(
             excluded.hostaway_conversation_id,
             public.conversations.hostaway_conversation_id
           )
         returning id,
                   tenant_id,
                   booking_id,
                   hostaway_conversation_id,
                   status,
                   updated_at
       )
       select u.id,
              u.tenant_id,
              u.booking_id,
              b.external_id as booking_external_id,
              u.hostaway_conversation_id,
              u.status,
              u.updated_at
         from upsert u
         left join public.bookings b on b.id = u.booking_id`,
      [tenantId, bookingId, options.hostawayConversationId ?? null],
    );

    return this.mapConversation(rows[0]);
  }

  async getConversationById(tenantId: string, conversationId: string): Promise<ConversationRecord> {
    const { rows } = await this.databaseService.runQuery<ConversationRow>(
      `select c.id,
              c.tenant_id,
              c.booking_id,
              b.external_id as booking_external_id,
              c.hostaway_conversation_id,
              c.status,
              c.updated_at
         from public.conversations c
         left join public.bookings b on b.id = c.booking_id
        where c.id = $1 and c.tenant_id = $2`,
      [conversationId, tenantId],
    );

    if (rows.length === 0) {
      throw new Error('Conversation not found');
    }

    return this.mapConversation(rows[0]);
  }

  async setStatus(
    tenantId: string,
    conversationId: string,
    status: ConversationStatus,
  ): Promise<void> {
    await this.databaseService.runQuery(
      `update public.conversations
          set status = $1,
              updated_at = now()
        where id = $2 and tenant_id = $3`,
      [status, conversationId, tenantId],
    );
  }

  async setStatusByReservation(
    tenantId: string,
    reservationExternalId: string,
    status: ConversationStatus,
  ): Promise<void> {
    const bookingId = await this.resolveBookingIdByExternalId(tenantId, reservationExternalId);
    if (!bookingId) {
      this.logger.warn(
        `Unable to update conversation status for tenant ${tenantId}; booking ${reservationExternalId} not found.`,
      );
      return;
    }

    const conversation = await this.getOrCreateConversation(tenantId, bookingId);
    if (conversation.status !== status) {
      await this.setStatus(tenantId, conversation.id, status);
    }
  }

  async upsertByReservationExternalId(
    tenantId: string,
    reservationExternalId: string,
    options: { hostawayConversationId?: string | null } = {},
  ): Promise<ConversationRecord> {
    const bookingId = await this.resolveBookingIdByExternalId(tenantId, reservationExternalId);
    if (!bookingId) {
      throw new Error(`Booking not found for reservation ${reservationExternalId}`);
    }
    const conversation = await this.getOrCreateConversation(tenantId, bookingId, {
      hostawayConversationId: options.hostawayConversationId ?? null,
    });
    if (options.hostawayConversationId) {
      await this.ensureHostawayConversationLink(
        tenantId,
        conversation.id,
        options.hostawayConversationId,
      );
    }
    return conversation;
  }

  async listConversations(
    tenantId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: 'automated' | 'paused_by_human';
      days?: number; // Show conversations with check-in dates in next N days
    } = {},
  ): Promise<{ conversations: ConversationSummary[]; total: number }> {
    const limit = Math.min(options.limit ?? 50, 100); // Max 100 per page
    const offset = options.offset ?? 0;
    const days = options.days ?? 365; // Default: next 365 days (show all upcoming reservations)
    // Filter by upcoming check-in dates (next N days), not past message dates
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);
    const cutoffDateStr = cutoffDate.toISOString();

    // Build WHERE conditions with proper parameterized queries
    const conditions: string[] = ['c.tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let paramIndex = 2;

    if (options.status) {
      conditions.push(`c.status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    // Build complex filter:
    // 1. Show valid upcoming reservations within date range, OR
    // 2. Show cancelled reservations with recent messages (last 7 days)
    const cancelledWithRecentMessages = `(
      lower(coalesce(b.status, '')) = 'cancelled'
      AND EXISTS (
        SELECT 1
        FROM public.conversation_logs cl
        WHERE cl.conversation_id = c.id
          AND cl.created_at >= now() - INTERVAL '7 days'
      )
    )`;

    const validUpcoming = `(
      (b.check_in_at IS NULL OR b.check_in_at >= now())
      AND (b.check_in_at IS NULL OR b.check_in_at <= CAST($${paramIndex} AS timestamp))
      AND lower(coalesce(b.status, '')) != 'cancelled'
    )`;

    params.push(cutoffDateStr);
    paramIndex++;
    conditions.push(`(${validUpcoming} OR ${cancelledWithRecentMessages})`);

    // Debug: Log total conversations vs filtered
    const allCountResult = await this.databaseService.runQuery<{ count: string }>(
      `select count(*) as count from public.conversations where tenant_id = $1`,
      [tenantId],
    );
    const allCount = parseInt(allCountResult.rows[0]?.count ?? '0', 10);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count - filter by upcoming check-in dates (next N days)
    const countResult = await this.databaseService.runQuery<{ count: string }>(
      `select count(distinct c.id) as count
         from public.conversations c
         left join public.bookings b on b.id = c.booking_id
        ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    // Log debug info if there's a discrepancy
    if (allCount > total) {
      this.logger.debug(
        `Conversation filter: ${allCount} total conversations, ${total} match filters (excluded ${
          allCount - total
        })`,
      );

      // Check why conversations are being filtered out
      const excludedCheck = await this.databaseService.runQuery<{
        reason: string;
        count: string;
      }>(
        `SELECT 
          CASE 
            WHEN b.check_in_at IS NOT NULL AND b.check_in_at < now() THEN 'past_checkin'
            WHEN b.check_in_at IS NOT NULL AND b.check_in_at > CAST($1 AS timestamp) THEN 'future_checkin'
            WHEN lower(coalesce(b.status, '')) = 'cancelled' THEN 'cancelled'
            ELSE 'other'
          END as reason,
          count(*) as count
         FROM public.conversations c
         LEFT JOIN public.bookings b ON b.id = c.booking_id
         WHERE c.tenant_id = $2
           AND NOT (
             (b.check_in_at IS NULL OR b.check_in_at >= now())
             AND (b.check_in_at IS NULL OR b.check_in_at <= CAST($1 AS timestamp))
             AND lower(coalesce(b.status, '')) != 'cancelled'
           )
         GROUP BY reason`,
        [cutoffDateStr, tenantId],
      );

      if (excludedCheck.rows.length > 0) {
        this.logger.debug(
          `Filtered conversations breakdown: ${excludedCheck.rows
            .map((r) => `${r.reason}: ${r.count}`)
            .join(', ')}`,
        );
      }
    }

    // Get paginated conversations - filter by date in HAVING clause
    const { rows } = await this.databaseService.runQuery<
      ConversationSummaryRow & {
        guest_name: string | null;
        next_pending_at: Date | string | null;
        next_pending_type: string | null;
      }
    >(
      `select c.id,
              c.tenant_id,
              c.booking_id,
              b.external_id as booking_external_id,
              c.hostaway_conversation_id,
              c.status,
              c.updated_at,
              coalesce(g.full_name, 'Guest') as guest_name,
              p.name as property_name,
              b.check_in_at,
              b.check_out_at,
              max(case when cl.status in ('sent', 'failed') then coalesce(cl.actual_sent_at, cl.sent_at, cl.created_at) else null end)::timestamp as last_message_at,
              count(*) filter (where cl.status in ('pending', 'processing')) as pending_count,
              np.next_pending_at,
              np.next_pending_local_at,
              np.next_pending_type,
              np.next_pending_label,
              np.next_pending_timezone
         from public.conversations c
         left join public.bookings b on b.id = c.booking_id
         left join public.properties p on p.id = b.property_id
         left join public.guests g on g.id = b.guest_id
         left join public.conversation_logs cl on cl.conversation_id = c.id
         left join lateral (
           select cl2.scheduled_send_at::timestamp as next_pending_at,
                  (cl2.metadata ->> 'scheduledLocalAt') as next_pending_local_at,
                  (cl2.metadata ->> 'messageType') as next_pending_type,
                  (cl2.metadata ->> 'messageLabel') as next_pending_label,
                  (cl2.metadata ->> 'scheduledTimezone') as next_pending_timezone
             from public.conversation_logs cl2
            where cl2.conversation_id = c.id
              and cl2.status in ('pending','processing')
            order by coalesce(cl2.scheduled_send_at, cl2.sent_at, cl2.created_at) asc
            limit 1
         ) np on true
        ${whereClause}
        group by c.id,
                 c.tenant_id,
                 c.booking_id,
                 b.external_id,
                 c.hostaway_conversation_id,
                 c.status,
                 c.updated_at,
                 p.name,
                 g.full_name,
                 b.check_in_at,
                 b.check_out_at,
                 np.next_pending_at,
                 np.next_pending_local_at,
                 np.next_pending_type,
                 np.next_pending_label,
                 np.next_pending_timezone
        order by coalesce(b.check_in_at, '9999-12-31'::timestamp) asc
        limit $${paramIndex} offset $${paramIndex + 1}`,
      [...params, limit, offset],
    );

    return {
      conversations: rows.map((row) => this.mapConversationSummary(row)),
      total,
    };
  }

  async getConversationDetail(
    tenantId: string,
    conversationId: string,
  ): Promise<ConversationDetail> {
    const conversation = await this.getConversationById(tenantId, conversationId);

    const { rows } = await this.databaseService.runQuery<ConversationLogRow>(
      `select id,
              sender_type,
              direction,
              message_body,
              status,
              scheduled_send_at,
              actual_sent_at,
              sent_at,
              metadata,
              error_message
         from public.conversation_logs
        where conversation_id = $1
        order by coalesce(scheduled_send_at, sent_at, created_at) asc`,
      [conversationId],
    );

    const meta = await this.databaseService.runQuery<{
      last_message_at: Date | string | null;
      pending_count: string | null;
    }>(
      `select
         max(case when cl.status in ('sent', 'failed') then coalesce(cl.actual_sent_at, cl.sent_at, cl.created_at) else null end)::timestamp as last_message_at,
         count(*) filter (where cl.status in ('pending','processing')) as pending_count
       from public.conversation_logs cl
      where cl.conversation_id = $1`,
      [conversationId],
    );
    // Only use lastMessageAt if we actually have sent messages, otherwise use conversation updatedAt
    const lastMessageAt = meta.rows[0]?.last_message_at
      ? formatToIsoString(meta.rows[0].last_message_at)
      : null;
    const pendingMessageCount = meta.rows[0]?.pending_count
      ? Number(meta.rows[0].pending_count)
      : 0;

    const guestResult = await this.databaseService.runQuery<{
      guest_name: string | null;
      property_name: string | null;
      check_in_at: Date | string | null;
      check_out_at: Date | string | null;
    }>(
      `select coalesce(g.full_name, 'Guest') as guest_name,
              p.name as property_name,
              b.check_in_at,
              b.check_out_at
         from public.bookings b
         left join public.guests g on g.id = b.guest_id
         left join public.properties p on p.id = b.property_id
        where b.id = $1 and b.tenant_id = $2
        limit 1`,
      [conversation.bookingId, conversation.tenantId],
    );
    const guestName = guestResult.rows[0]?.guest_name ?? 'Guest';
    const propertyName = guestResult.rows[0]?.property_name ?? null;
    const checkInAt = guestResult.rows[0]?.check_in_at
      ? formatToIsoString(guestResult.rows[0].check_in_at)
      : null;
    const checkOutAt = guestResult.rows[0]?.check_out_at
      ? formatToIsoString(guestResult.rows[0].check_out_at)
      : null;

    const nextPending = await this.databaseService.runQuery<{
      next_pending_at: Date | string | null;
      next_pending_local_at: string | null;
      next_pending_type: string | null;
      next_pending_label: string | null;
      next_pending_timezone: string | null;
    }>(
      `select cl2.scheduled_send_at::timestamp as next_pending_at,
              (cl2.metadata ->> 'scheduledLocalAt') as next_pending_local_at,
              (cl2.metadata ->> 'messageType') as next_pending_type,
              (cl2.metadata ->> 'messageLabel') as next_pending_label,
              (cl2.metadata ->> 'scheduledTimezone') as next_pending_timezone
         from public.conversation_logs cl2
        where cl2.conversation_id = $1
          and cl2.status in ('pending','processing')
        order by coalesce(cl2.scheduled_send_at, cl2.sent_at, cl2.created_at) asc
        limit 1`,
      [conversationId],
    );
    const nextPendingAt = nextPending.rows[0]?.next_pending_at
      ? formatToIsoString(nextPending.rows[0].next_pending_at)
      : null;
    const nextPendingLocalAt = nextPending.rows[0]?.next_pending_local_at ?? null;
    const nextPendingType = nextPending.rows[0]?.next_pending_type ?? null;
    const nextPendingLabel =
      nextPending.rows[0]?.next_pending_label ?? this.resolveMessageLabel(nextPendingType);
    const nextPendingTimezone = nextPending.rows[0]?.next_pending_timezone ?? null;

    return {
      ...conversation,
      lastMessageAt,
      pendingMessageCount,
      guestName,
      propertyName,
      checkInAt,
      checkOutAt,
      nextPendingAt,
      nextPendingLocalAt,
      nextPendingType,
      nextPendingLabel,
      nextPendingTimezone,
      logs: rows.map((row) => this.mapLogRow(row)),
    };
  }

  async logGuestMessage(
    conversation: ConversationRecord,
    body: string,
    metadata: Record<string, unknown> = {},
  ): Promise<string> {
    // Check for duplicate inbound message using Hostaway message ID if available
    const hostawayMessageId = metadata?.hostawayMessageId || metadata?.messageId;
    if (hostawayMessageId) {
      const existing = await this.databaseService.runQuery<{ id: string }>(
        `select id
         from public.conversation_logs
        where conversation_id = $1
          and direction = 'guest'
          and (metadata->>'hostawayMessageId' = $2 OR metadata->>'messageId' = $2)
        limit 1`,
        [conversation.id, String(hostawayMessageId)],
      );

      if (existing.rows.length > 0) {
        this.logger.debug(
          `Skipping duplicate inbound message: Hostaway message ID ${hostawayMessageId} already logged (conversation ${conversation.id})`,
        );
        return existing.rows[0].id;
      }
    }

    // Also check for duplicate by message body + timestamp (for webhook retries without message ID)
    const messageHash = metadata?.messageHash;
    if (messageHash) {
      const existing = await this.databaseService.runQuery<{ id: string }>(
        `select id
         from public.conversation_logs
        where conversation_id = $1
          and direction = 'guest'
          and metadata->>'messageHash' = $2
        limit 1`,
        [conversation.id, String(messageHash)],
      );

      if (existing.rows.length > 0) {
        this.logger.debug(
          `Skipping duplicate inbound message: message hash ${messageHash} already logged (conversation ${conversation.id})`,
        );
        return existing.rows[0].id;
      }
    }

    const result = await this.createLogEntry({
      conversationId: conversation.id,
      tenantId: conversation.tenantId,
      bookingId: conversation.bookingId,
      direction: 'guest',
      senderType: 'guest',
      messageBody: body,
      status: 'sent',
      actualSentAt: new Date(),
      sentAt: new Date(),
      metadata,
    });

    return result.id;
  }

  async logHumanReply(
    conversation: ConversationRecord,
    body: string,
    metadata: Record<string, unknown> = {},
  ): Promise<string> {
    const result = await this.createLogEntry({
      conversationId: conversation.id,
      tenantId: conversation.tenantId,
      bookingId: conversation.bookingId,
      direction: 'staff',
      senderType: 'human',
      messageBody: body,
      status: 'sent',
      actualSentAt: new Date(),
      sentAt: new Date(),
      metadata,
    });

    return result.id;
  }

  async createPendingAiReply(
    conversation: ConversationRecord,
    body: string,
    metadata: Record<string, unknown> = {},
  ): Promise<string> {
    // Check if we already created an AI reply for this guest message
    // Use the guest message log ID to prevent duplicate AI responses
    const guestMessageLogId = metadata?.guestMessageLogId || metadata?.inReplyTo;
    if (guestMessageLogId) {
      const existing = await this.databaseService.runQuery<{ id: string }>(
        `select id
         from public.conversation_logs
        where conversation_id = $1
          and direction = 'ai'
          and (metadata->>'guestMessageLogId' = $2 OR metadata->>'inReplyTo' = $2)
        limit 1`,
        [conversation.id, String(guestMessageLogId)],
      );

      if (existing.rows.length > 0) {
        this.logger.debug(
          `Skipping duplicate AI reply: already generated for guest message ${guestMessageLogId} (conversation ${conversation.id})`,
        );
        return existing.rows[0].id;
      }
    }

    const now = new Date();
    const result = await this.createLogEntry({
      conversationId: conversation.id,
      tenantId: conversation.tenantId,
      bookingId: conversation.bookingId,
      direction: 'ai',
      senderType: 'ai',
      messageBody: body,
      status: 'pending',
      scheduledSendAt: now,
      sentAt: now,
      metadata,
    });

    return result.id;
  }

  async createPendingOutboundMessage(
    conversation: ConversationRecord,
    options: {
      messageType: string;
      messageLabel: string;
      hostawayReservationId: string;
      guestName: string;
      scheduledSendAt: Date;
      scheduledLocal: Date;
      timezone: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<string | null> {
    // Check if a message with the same messageType was already created (pending, processing, or sent)
    // This prevents duplicates when the same reservation is synced multiple times (e.g., initial sync + re-sync)
    // We check all statuses because if a message was already sent, we shouldn't send it again
    const existing = await this.databaseService.runQuery<{ id: string; status: string }>(
      `select id, status
         from public.conversation_logs
        where conversation_id = $1
          and metadata->>'messageType' = $2
          and metadata->>'hostawayReservationId' = $3
        limit 1`,
      [conversation.id, options.messageType, options.hostawayReservationId],
    );

    if (existing.rows.length > 0) {
      const existingMsg = existing.rows[0];
      const createdAgo = existingMsg?.created_at
        ? Math.round((Date.now() - new Date(existingMsg.created_at).getTime()) / 1000)
        : null;

      this.logger.debug(
        `Skipping duplicate message: ${options.messageType} already exists for reservation ${options.hostawayReservationId} (conversation ${conversation.id})` +
          (createdAgo !== null
            ? ` - existing message created ${createdAgo}s ago (status: ${existingMsg.status})`
            : ` - status: ${existingMsg.status}`),
      );
      return existingMsg.id; // Return existing message ID
    }

    // Store placeholder body - template will be fetched at send time (so template updates are reflected)
    const placeholderBody = `Automated message scheduled (${options.messageLabel}) for ${options.guestName}`;
    const metadata = {
      messageType: options.messageType, // Store messageType so we can fetch the latest template at send time
      messageLabel: options.messageLabel,
      hostawayReservationId: options.hostawayReservationId,
      hostawayConversationId: conversation.hostawayConversationId,
      guestName: options.guestName,
      scheduledLocalAt: options.scheduledLocal.toISOString(),
      scheduledTimezone: options.timezone,
      // NOTE: We do NOT store template_body here - templates are fetched fresh at send time
      // This ensures that template updates will be reflected in all future scheduled messages
      ...(options.metadata ?? {}),
    };

    const result = await this.createLogEntry({
      conversationId: conversation.id,
      tenantId: conversation.tenantId,
      bookingId: conversation.bookingId,
      direction: 'ai',
      senderType: 'ai',
      messageBody: placeholderBody,
      status: 'pending',
      scheduledSendAt: options.scheduledSendAt,
      sentAt: options.scheduledSendAt,
      metadata,
    });

    return result.id;
  }

  async claimPendingOutboundMessages(limit: number): Promise<PendingOutboundMessage[]> {
    if (limit <= 0) {
      return [];
    }

    const rows = await this.databaseService.withClient(async (client) => {
      const result = await client.query<ClaimRow>(
        `with candidates as (
           select cl.id, cl.booking_id, cl.conversation_id
             from public.conversation_logs cl
            where cl.status = 'pending'
              and coalesce(cl.scheduled_send_at, cl.sent_at, now()) <= now()
            order by coalesce(cl.scheduled_send_at, cl.sent_at, cl.created_at) asc
            limit $1
            for update skip locked
         )
        update public.conversation_logs cl
           set status = 'processing',
               updated_at = now()
          from candidates
          left join public.bookings b on b.id = candidates.booking_id
          left join public.conversations c on c.id = candidates.conversation_id
          where cl.id = candidates.id
         returning cl.id,
                   cl.tenant_id,
                   cl.conversation_id,
                   cl.booking_id,
                   cl.scheduled_send_at,
                   cl.metadata,
                   b.external_id as booking_external_id,
                   c.hostaway_conversation_id`,
        [limit],
      );

      return result.rows;
    });

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      conversationId: row.conversation_id,
      bookingId: row.booking_id,
      bookingExternalId: row.booking_external_id ?? null,
      hostawayConversationId:
        row.hostaway_conversation_id ??
        this.readString(row.metadata ?? {}, 'hostawayConversationId') ??
        null,
      messageType: this.readString(row.metadata ?? {}, 'messageType') ?? null,
      messageLabel:
        this.readString(row.metadata ?? {}, 'messageLabel') ??
        this.resolveMessageLabel(this.readString(row.metadata ?? {}, 'messageType') ?? null),
      hostawayReservationId: this.readString(row.metadata ?? {}, 'hostawayReservationId') ?? null,
      guestName: this.readString(row.metadata ?? {}, 'guestName') ?? null,
      scheduledSendAt: row.scheduled_send_at,
      scheduledLocalAt: this.readString(row.metadata ?? {}, 'scheduledLocalAt') ?? null,
      scheduledTimezone: this.readString(row.metadata ?? {}, 'scheduledTimezone') ?? null,
      metadata: row.metadata ?? {},
    }));
  }

  async markMessageAsSent(
    logId: string,
    messageBody: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.databaseService.runQuery(
      `update public.conversation_logs
          set status = 'sent',
              message_body = $2,
              actual_sent_at = now(),
              sent_at = now(),
              metadata = coalesce(metadata, '{}'::jsonb) || $3::jsonb,
              updated_at = now(),
              error_message = null
        where id = $1`,
      [logId, messageBody, JSON.stringify(metadata)],
    );
  }

  async markMessageAsFailed(logId: string, error: unknown): Promise<void> {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : JSON.stringify(error);

    await this.databaseService.runQuery(
      `update public.conversation_logs
          set status = 'failed',
              error_message = $2,
              updated_at = now()
        where id = $1`,
      [logId, message],
    );
  }

  async cancelPendingMessage(
    tenantId: string,
    conversationId: string,
    logId: string,
  ): Promise<void> {
    const { rowCount } = await this.databaseService.runQuery(
      `update public.conversation_logs cl
          set status = 'failed',
              updated_at = now(),
              error_message = 'Cancelled by human operator'
        where cl.id = $1
          and cl.conversation_id = $2
          and cl.status in ('pending','processing')
          and exists (
            select 1
              from public.conversations c
             where c.id = cl.conversation_id
               and c.tenant_id = $3
          )`,
      [logId, conversationId, tenantId],
    );

    if (!rowCount) {
      throw new NotFoundException('Pending message not found or already processed');
    }
  }

  async cancelAllPendingMessages(
    tenantId: string,
    conversationId: string,
    reason?: string,
  ): Promise<number> {
    const errorMessage = reason ?? 'Cancelled by human operator';
    const { rowCount } = await this.databaseService.runQuery(
      `update public.conversation_logs cl
          set status = 'failed',
              updated_at = now(),
              error_message = $3
        where cl.conversation_id = $1
          and cl.status in ('pending','processing')
          and exists (
            select 1
              from public.conversations c
             where c.id = cl.conversation_id
               and c.tenant_id = $2
          )`,
      [conversationId, tenantId, errorMessage],
    );

    return rowCount ?? 0;
  }

  async sendHumanReply(
    tenant: TenantSummary,
    conversationId: string,
    message: string,
  ): Promise<void> {
    if (!message?.trim()) {
      throw new Error('Message body is required');
    }

    const conversation = await this.getConversationById(tenant.id, conversationId);

    if (!conversation.bookingExternalId) {
      throw new Error('Conversation is not linked to a Hostaway reservation');
    }

    const reservation = await this.hostawayClient.getReservation(
      tenant,
      conversation.bookingExternalId,
    );
    const phoneNumber = this.readString(
      reservation,
      'guestPhone',
      'guest_phone',
      'guest.phone',
      'guest.contact.phone',
      'phone',
    );
    const hostawayConversationId =
      conversation.hostawayConversationId ??
      this.readString(
        reservation as Record<string, unknown>,
        'conversationId',
        'conversation.id',
        'conversation_id',
      );

    await this.ensureHostawayConversationLink(tenant.id, conversation.id, hostawayConversationId);

    const metadata: Record<string, unknown> = {
      deliveryChannel: phoneNumber ? 'twilio' : 'hostaway',
      reservationId: conversation.bookingExternalId,
      hostawayConversationId,
    };

    if (phoneNumber) {
      await this.twilioClient.sendWhatsAppMessage(tenant, phoneNumber, message);
    } else {
      if (hostawayConversationId) {
        await this.hostawayClient.sendConversationMessage(
          tenant,
          hostawayConversationId,
          message,
          'channel',
        );
      } else {
        await this.hostawayClient.sendMessageToGuest(
          tenant,
          conversation.bookingExternalId,
          message,
        );
      }
    }

    await this.logHumanReply(conversation, message, metadata);
  }

  private async resolveBookingIdByExternalId(
    tenantId: string,
    externalId: string,
  ): Promise<string | null> {
    const { rows } = await this.databaseService.runQuery<{ id: string }>(
      `select id
         from public.bookings
        where tenant_id = $1 and external_id = $2
        limit 1`,
      [tenantId, externalId],
    );

    return rows[0]?.id ?? null;
  }

  private async createLogEntry(options: CreateLogOptions): Promise<{ id: string }> {
    const metadataJson = JSON.stringify(options.metadata ?? {});
    const scheduledSendAt = options.scheduledSendAt ? options.scheduledSendAt.toISOString() : null;
    const actualSentAt = options.actualSentAt ? options.actualSentAt.toISOString() : null;
    const sentAt = (options.sentAt ?? new Date()).toISOString();

    return this.databaseService.withClient(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `insert into public.conversation_logs (
           conversation_id,
           tenant_id,
           booking_id,
           direction,
           sender_type,
           message_body,
           status,
           scheduled_send_at,
           actual_sent_at,
           sent_at,
           metadata,
           updated_at,
           error_message
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now(), $12)
         returning id`,
        [
          options.conversationId,
          options.tenantId,
          options.bookingId,
          options.direction,
          options.senderType,
          options.messageBody,
          options.status,
          scheduledSendAt,
          actualSentAt,
          sentAt,
          metadataJson,
          options.errorMessage ?? null,
        ],
      );

      await client.query(
        `update public.conversations
            set updated_at = now()
          where id = $1 and tenant_id = $2`,
        [options.conversationId, options.tenantId],
      );

      return rows[0];
    });
  }

  async ensureHostawayConversationLink(
    tenantId: string,
    conversationId: string,
    hostawayConversationId: string | null,
  ): Promise<void> {
    if (!hostawayConversationId) {
      return;
    }

    await this.databaseService.runQuery(
      `update public.conversations
          set hostaway_conversation_id = $1,
              updated_at = now()
        where id = $2
          and tenant_id = $3
          and coalesce(hostaway_conversation_id, '') <> $1`,
      [hostawayConversationId, conversationId, tenantId],
    );
  }

  private readString(
    source: Record<string, unknown> | null | undefined,
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

  /**
   * Sync conversation history from Hostaway API
   * Fetches all messages from Hostaway and stores them in conversation_logs so they appear in the UI
   */
  async syncConversationHistory(
    tenantId: string,
    conversationId: string,
    reservationId: string,
  ): Promise<void> {
    try {
      let conversation: ConversationRecord;
      try {
        conversation = await this.getConversationById(tenantId, conversationId);
      } catch {
        this.logger.warn(`Conversation ${conversationId} not found for history sync`);
        return;
      }

      // Get tenant for API access
      const tenant = await this.tenantService.getTenantById(tenantId);
      if (!tenant?.encryptedHostawayAccessToken) {
        this.logger.warn(`Tenant ${tenantId} has no Hostaway access token for history sync`);
        return;
      }

      // Fetch conversations from Hostaway using listConversations
      const hostawayConversations = await this.hostawayClient.listConversations(tenant, {
        reservationId,
        includeResources: 1,
        limit: 100, // Fetch up to 100 conversations for this reservation
      });

      if (!hostawayConversations || hostawayConversations.length === 0) {
        this.logger.debug(`No Hostaway conversations found for reservation ${reservationId}`);
        return;
      }

      // Get booking ID for conversation_logs
      const bookingId = await this.resolveBookingIdByExternalId(tenantId, reservationId);

      // Process each conversation and fetch all messages using the dedicated messages endpoint
      let syncedCount = 0;
      for (const hostawayConversation of hostawayConversations) {
        const hostawayConversationId = this.readString(
          hostawayConversation,
          'id',
          'conversationId',
          'conversation_id',
        );

        if (!hostawayConversationId) {
          continue;
        }

        // Fetch ALL messages for this conversation using the dedicated messages endpoint
        // This ensures we get complete message history including scheduled messages
        let conversationMessages: Array<Record<string, unknown>> = [];
        try {
          const messagesResponse = await this.hostawayClient.getConversationMessages(
            tenant,
            String(hostawayConversationId),
            true, // includeScheduledMessages = true
          );
          conversationMessages = messagesResponse as Array<Record<string, unknown>>;
        } catch (error) {
          this.logger.warn(
            `Failed to fetch messages for conversation ${hostawayConversationId}, falling back to embedded messages`,
            error as Error,
          );
          // Fallback to embedded messages if the endpoint fails
          conversationMessages = Array.isArray(hostawayConversation.conversationMessages)
            ? (hostawayConversation.conversationMessages as Array<Record<string, unknown>>)
            : Array.isArray(hostawayConversation.messages)
            ? (hostawayConversation.messages as Array<Record<string, unknown>>)
            : [];
        }

        for (const message of conversationMessages) {
          if (!message || typeof message !== 'object') {
            continue;
          }

          const msg = message as Record<string, unknown>;
          const hostawayMessageId = this.readString(msg, 'id', 'messageId', 'message_id');
          const body = this.readString(msg, 'body', 'message', 'content', 'text');

          if (!hostawayMessageId || !body || body.trim().length === 0) {
            continue;
          }

          // Skip template placeholders
          if (body.includes('{{') && body.match(/^\s*Hi\s+{{\w+}}\s*$/i)) {
            continue;
          }

          const isIncoming = Boolean(msg.isIncoming || msg.is_incoming);

          // Map to conversation_logs fields
          const senderType = isIncoming ? 'guest' : 'human';
          const direction = isIncoming ? 'guest' : 'staff';

          // Get sent date (prefer date, then sentToChannelDate, then insertedOn)
          const sentDateStr =
            this.readString(
              msg,
              'date',
              'sentToChannelDate',
              'sentToChannelAttemptDate',
              'insertedOn',
              'inserted_on',
            ) || null;

          let sentDate: Date | null = null;
          if (sentDateStr) {
            const parsed = new Date(sentDateStr);
            if (!Number.isNaN(parsed.getTime())) {
              sentDate = parsed;
            }
          }

          // Use current time if no date found
          if (!sentDate) {
            sentDate = new Date();
          }

          // Check if message already exists (by hostaway message ID in metadata)
          const existingCheck = await this.databaseService.runQuery<{ id: string }>(
            `SELECT id FROM public.conversation_logs 
             WHERE conversation_id = $1 
             AND metadata->>'hostawayMessageId' = $2
             LIMIT 1`,
            [conversationId, String(hostawayMessageId)],
          );

          if (existingCheck.rows.length > 0) {
            // Message already exists, skip
            continue;
          }

          // Create metadata with Hostaway message info
          // Only store essential fields to avoid circular references or huge objects
          const metadata = {
            hostawayMessageId: String(hostawayMessageId),
            hostawayConversationId: String(hostawayConversationId),
            reservationId: String(reservationId),
            communicationType:
              this.readString(msg, 'communicationType', 'communication_type', 'type') || 'channel',
            messageHash: this.readString(msg, 'hash') || null,
            syncedFromHistory: true,
            syncedAt: new Date().toISOString(),
            // Store key fields for reference
            channelId: msg.channelId || null,
            messageSource: this.readString(msg, 'messageSource', 'message_source') || null,
          };

          // Insert into conversation_logs so it appears in the UI
          try {
            await this.createLogEntry({
              conversationId,
              tenantId,
              bookingId: bookingId || conversation.bookingId,
              direction,
              senderType,
              messageBody: body.trim(),
              status: 'sent', // Messages from history are already sent
              sentAt: sentDate,
              actualSentAt: sentDate,
              scheduledSendAt: null,
              metadata,
              errorMessage: null,
            });

            syncedCount++;
          } catch (error) {
            this.logger.warn(
              `Failed to sync message ${hostawayMessageId} for conversation ${conversationId}`,
              error as Error,
            );
          }
        }
      }

      if (syncedCount > 0) {
        this.logger.debug(
          `Synced ${syncedCount} messages from Hostaway conversation history for reservation ${reservationId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to sync conversation history for conversation ${conversationId}`,
        error as Error,
      );
      // Don't throw - this is a best-effort operation
    }
  }

  /**
   * Get conversation history for AI context
   * Returns recent messages in chronological order
   */
  async getConversationHistoryForAi(
    conversationId: string,
    limit = 10,
  ): Promise<Array<{ body: string; isIncoming: boolean; sentDate: Date | null }>> {
    try {
      const result = await this.databaseService.runQuery<{
        body: string;
        is_incoming: boolean;
        sent_date: Date | string | null;
        inserted_on: Date | string | null;
        created_at: Date | string | null;
      }>(
        `SELECT 
           body, 
           is_incoming, 
           sent_date,
           inserted_on,
           created_at
         FROM public.hostaway_conversation_history
         WHERE conversation_id = $1
         ORDER BY COALESCE(sent_date, inserted_on, created_at) ASC
         LIMIT $2`,
        [conversationId, limit],
      );

      return result.rows.map((row) => {
        const date = row.sent_date || row.inserted_on || row.created_at;
        return {
          body: row.body,
          isIncoming: row.is_incoming,
          sentDate: date ? new Date(date) : null,
        };
      });
    } catch (error) {
      // If table doesn't exist yet (migration not run), return empty array
      if ((error as Error).message?.includes('does not exist')) {
        this.logger.debug(
          `Conversation history table not found - migration may not have run yet (conversation ${conversationId})`,
        );
        return [];
      }
      this.logger.warn(
        `Failed to retrieve conversation history for AI context (conversation ${conversationId})`,
        error as Error,
      );
      return [];
    }
  }
}
