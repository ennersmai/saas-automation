import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabaseService } from '../database/database.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { TenantService } from '../tenant/tenant.service';

interface ReservationCountsRow {
  upcoming_count: string | null;
  arriving_today_count: string | null;
}

interface ConversationCountsRow {
  automated_count: string | null;
  paused_count: string | null;
}

interface CountRow {
  count: string | null;
}

interface UpcomingReservationRow {
  id: string;
  external_id: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  guest_name: string | null;
  property_name: string | null;
  status: string | null;
}

interface RecentMessageRow {
  id: string;
  sender_type: string;
  status: string;
  message_body: string;
  scheduled_send_at: string | null;
  actual_sent_at: string | null;
  sent_at: string;
  conversation_id: string | null;
  booking_id: string | null;
  booking_external_id: string | null;
  guest_name: string | null;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly tenantService: TenantService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  async getSummary(userId: string) {
    const tenant = await this.tenantService.getTenantForUser(userId);
    const automationTimezone =
      this.configService.get<string>('HOSTAWAY_AUTOMATION_TIMEZONE') ?? 'Europe/London';

    const now = new Date();
    this.logger.debug(
      `Preparing dashboard metrics for tenant ${
        tenant.id
      } at ${now.toISOString()} (tz ${automationTimezone})`,
    );

    const [
      hostawayStatus,
      reservationCountsResult,
      conversationCountsResult,
      messages24hResult,
      upcomingReservationsResult,
      recentMessagesResult,
    ] = await Promise.all([
      this.integrationsService.getHostawayStatus(userId).catch((error) => {
        this.logger.warn(
          `Unable to resolve Hostaway status for tenant ${tenant.id}: ${(error as Error).message}`,
        );
        return {
          status: 'not_connected',
          dryRun: false,
          clientId: null,
        };
      }),
      this.databaseService.runQuery<ReservationCountsRow>(
        `select
            count(*) filter (
              where b.check_in_at is not null
                and timezone($2, b.check_in_at) >= timezone($2, now())
                and timezone($2, b.check_in_at) < timezone($2, now()) + interval '30 days'
                and lower(b.status) != 'cancelled'
            ) as upcoming_count,
            count(*) filter (
              where b.check_in_at is not null
                and timezone($2, b.check_in_at)::date = timezone($2, now())::date
                and lower(b.status) != 'cancelled'
            ) as arriving_today_count
         from public.bookings b
         where b.tenant_id = $1`,
        [tenant.id, automationTimezone],
      ),
      this.databaseService.runQuery<ConversationCountsRow>(
        `select
            count(*) filter (where status = 'automated') as automated_count,
            count(*) filter (where status = 'paused_by_human') as paused_count
         from public.conversations
         where tenant_id = $1`,
        [tenant.id],
      ),
      this.databaseService.runQuery<CountRow>(
        `select count(*) as count
           from public.conversation_logs
          where tenant_id = $1
            and status = 'sent'
            and coalesce(actual_sent_at, sent_at) >= now() - interval '24 hours'`,
        [tenant.id],
      ),
      this.databaseService.runQuery<UpcomingReservationRow>(
        `select
            b.id,
            b.external_id,
            b.check_in_at,
            b.check_out_at,
            coalesce(g.full_name, 'Guest') as guest_name,
            coalesce(p.name, 'Listing') as property_name,
            b.status
         from public.bookings b
         left join public.guests g on g.id = b.guest_id
         left join public.properties p on p.id = b.property_id
        where b.tenant_id = $1
          and b.check_in_at is not null
          and b.check_in_at >= now()
          and b.check_in_at < now() + interval '30 days'
          and lower(b.status) != 'cancelled'
        order by b.check_in_at asc
        limit 5`,
        [tenant.id],
      ),
      this.databaseService.runQuery<RecentMessageRow>(
        `select
            cl.id,
            cl.sender_type,
            cl.status,
            cl.message_body,
            cl.scheduled_send_at,
            cl.actual_sent_at,
            cl.sent_at,
            cl.conversation_id,
            c.booking_id,
            b.external_id as booking_external_id,
            coalesce(g.full_name, 'Guest') as guest_name
         from public.conversation_logs cl
         left join public.conversations c on c.id = cl.conversation_id
         left join public.bookings b on b.id = c.booking_id
         left join public.guests g on g.id = b.guest_id
        where cl.tenant_id = $1
        order by coalesce(cl.actual_sent_at, cl.scheduled_send_at, cl.sent_at) desc
        limit 5`,
        [tenant.id],
      ),
    ]);

    const reservationCounts = reservationCountsResult.rows[0] ?? {
      upcoming_count: '0',
      arriving_today_count: '0',
    };
    const conversationCounts = conversationCountsResult.rows[0] ?? {
      automated_count: '0',
      paused_count: '0',
    };
    const messages24h = messages24hResult.rows[0] ?? { count: '0' };

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      integrations: {
        hostaway: hostawayStatus,
      },
      metrics: {
        reservations: {
          upcoming30Days: Number(reservationCounts.upcoming_count ?? 0),
          arrivalsToday: Number(reservationCounts.arriving_today_count ?? 0),
        },
        conversations: {
          automated: Number(conversationCounts.automated_count ?? 0),
          paused: Number(conversationCounts.paused_count ?? 0),
          messagesLast24h: Number(messages24h.count ?? 0),
        },
      },
      upcomingReservations: upcomingReservationsResult.rows.map((row) => ({
        id: row.id,
        externalId: row.external_id,
        guestName: row.guest_name ?? 'Guest',
        propertyName: row.property_name ?? 'Listing',
        status: row.status ?? 'pending',
        checkInAt: row.check_in_at,
        checkOutAt: row.check_out_at,
      })),
      recentMessages: recentMessagesResult.rows.map((row) => ({
        id: row.id,
        senderType: row.sender_type,
        status: row.status,
        messageBody: row.message_body,
        scheduledSendAt: row.scheduled_send_at,
        actualSentAt: row.actual_sent_at,
        sentAt: row.sent_at,
        conversationId: row.conversation_id,
        bookingId: row.booking_id,
        bookingExternalId: row.booking_external_id,
        guestName: row.guest_name ?? 'Guest',
      })),
      generatedAt: new Date().toISOString(),
    };
  }
}
