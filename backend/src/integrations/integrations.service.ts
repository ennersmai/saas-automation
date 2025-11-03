import { BadRequestException, Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

import { CryptoService } from '../security/crypto.service';
import { DatabaseService } from '../database/database.service';
import { LoggingService } from '../logging/logging.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { TenantService } from '../tenant/tenant.service';
import { HostawayIntegrationDto } from './dto/hostaway-integration.dto';
import { TwilioIntegrationDto } from './dto/twilio-integration.dto';
import { HostawayClient } from './hostaway.client';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly tenantService: TenantService,
    private readonly cryptoService: CryptoService,
    private readonly hostawayClient: HostawayClient,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly loggingService: LoggingService,
    @Inject(forwardRef(() => SchedulingService))
    private readonly schedulingService: SchedulingService,
  ) {}

  async listHostawayMessageTemplates(
    userId: string,
    query: {
      listingMapId?: string;
      channelId?: string;
      messageTemplateGroupId?: string;
      reservationId?: string;
    },
  ): Promise<Record<string, unknown>[]> {
    const tenant = await this.tenantService.getTenantForUser(userId);
    if (!tenant.encryptedHostawayAccessToken) {
      throw new BadRequestException('Hostaway is not connected');
    }
    const accessToken = this.cryptoService.decrypt(tenant.encryptedHostawayAccessToken);
    return this.hostawayClient.getMessageTemplates(accessToken, query);
  }

  async configureHostaway(userId: string, payload: HostawayIntegrationDto): Promise<void> {
    this.logger.log(`Starting Hostaway configuration for user ${userId}`);

    // Support API key only (no clientId): treat clientSecret as access token
    if (!payload.clientSecret?.trim()) {
      throw new BadRequestException('API key (clientSecret) is required');
    }

    this.logger.log(`Fetching tenant for user ${userId}`);
    const tenant = await this.tenantService.getTenantForUser(userId);
    this.logger.log(`Found tenant ${tenant.id} for user ${userId}`);

    if (tenant.encryptedHostawayAccessToken && tenant.hostawayClientId) {
      throw new BadRequestException('Hostaway integration is already configured for this tenant');
    }

    const encryptedSecret = this.cryptoService.encrypt(payload.clientSecret.trim());

    await this.tenantService.updateHostawayIntegration(tenant.id, {
      clientId: payload.clientId?.trim() ?? null,
      encryptedClientSecret: encryptedSecret,
      encryptedAccessToken: null,
    });

    try {
      this.logger.log(
        `Generating access token for tenant ${tenant.id}${
          payload.clientId?.trim() ? ` with clientId ${payload.clientId.trim()}` : ' (API key only)'
        }`,
      );
      const accessToken = payload.clientId?.trim()
        ? await this.hostawayClient.generateAccessToken(
            payload.clientId.trim(),
            payload.clientSecret.trim(),
          )
        : payload.clientSecret.trim();
      this.logger.log(`Access token generated successfully for tenant ${tenant.id}`);

      const webhookUrl = this.configService.get<string>('HOSTAWAY_WEBHOOK_URL');
      const hostawayDryRun =
        (this.configService.get<string>('HOSTAWAY_DRY_RUN') ?? '').toLowerCase() === 'true';

      if (webhookUrl) {
        this.logger.log(
          `Attempting Hostaway unified webhook registration for tenant ${
            tenant.id
          } at URL ${webhookUrl}${
            hostawayDryRun
              ? ' (DRY RUN MODE - webhook will be registered but no messages will be sent)'
              : ''
          }`,
        );

        // Validate webhook URL format
        if (!this.isValidWebhookUrl(webhookUrl)) {
          const error = new Error(
            `Invalid webhook URL format: ${webhookUrl}. Expected format: https://domain.com/api/webhooks/hostaway`,
          );
          this.logger.error(error.message);
          throw error;
        }

        try {
          const webhookResult = await this.hostawayClient.ensureUnifiedWebhook(
            accessToken,
            webhookUrl,
          );
          const payload = webhookResult.webhook ? JSON.stringify(webhookResult.webhook) : 'null';
          if (webhookResult.status === 'already_exists') {
            this.logger.log(
              `Hostaway unified webhook already registered for tenant ${tenant.id}: ${payload}`,
            );
          } else {
            this.logger.log(
              `Hostaway unified webhook registered for tenant ${tenant.id}: ${payload}`,
            );
          }
        } catch (webhookError) {
          const errorWithCause = webhookError as Error & { cause?: unknown };
          const detailedError =
            errorWithCause.cause instanceof Error ? errorWithCause.cause : errorWithCause;

          // Enhanced error logging with more context
          this.logger.error(
            `Hostaway unified webhook registration failed for tenant ${tenant.id} at URL ${webhookUrl}`,
            {
              error: detailedError?.message ?? 'Unknown error',
              stack: detailedError?.stack,
              tenantId: tenant.id,
              webhookUrl,
              clientId: payload.clientId,
            },
          );

          // Don't throw the error, just log it and continue
          this.logger.warn(
            'Continuing with Hostaway integration despite webhook registration failure',
          );
        }
      } else if (!webhookUrl) {
        this.logger.warn(
          'HOSTAWAY_WEBHOOK_URL is not configured. Skipping unified webhook registration.',
        );
      } else {
        this.logger.warn(
          'HOSTAWAY_DRY_RUN enabled; skipping Hostaway unified webhook registration.',
        );
      }

      const encryptedToken = this.cryptoService.encrypt(accessToken);
      await this.tenantService.updateHostawayIntegration(tenant.id, {
        encryptedAccessToken: encryptedToken,
      });

      // Run initial sync in background to avoid blocking the connection response
      // This allows the connection to complete successfully even if sync takes a while
      await this.tenantService.getTenantById(tenant.id);
      setImmediate(async () => {
        await this.performHostawaySync(tenant.id, accessToken);
      });
    } catch (error) {
      await this.updateSyncStatus(
        tenant.id,
        'failed',
        null,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Perform Hostaway sync - fetches and processes all future reservations
   * Updates sync status in database throughout the process
   */
  async performHostawaySync(tenantId: string, accessToken?: string): Promise<void> {
    const tenant = await this.tenantService.getTenantById(tenantId);
    if (!tenant.encryptedHostawayAccessToken) {
      this.logger.warn(`Cannot sync tenant ${tenantId}: no Hostaway access token`);
      return;
    }

    const token = accessToken ?? this.cryptoService.decrypt(tenant.encryptedHostawayAccessToken);

    try {
      // Set status to syncing
      await this.updateSyncStatus(tenantId, 'syncing', null, null);

      // Fetch ALL future reservations (no date limit) - filter by valid statuses
      const automationTimezone =
        this.configService.get<string>('HOSTAWAY_AUTOMATION_TIMEZONE') ?? 'Europe/London';
      const now = new Date();
      const zonedNow = new Date(
        now.toLocaleString('en-US', {
          timeZone: automationTimezone,
        }),
      );
      const today = zonedNow.toISOString().split('T')[0];

      this.logger.log(`Starting Hostaway sync for tenant ${tenantId} from ${today}...`);

      // Fetch all reservations with arrival dates from today onwards (no end date)
      // Note: sortOrder 'arrivalDate' will be applied as default by listReservationsWithQuery
      const allReservations = await this.hostawayClient.listReservationsWithQuery(token, {
        arrivalStartDate: today,
      });

      // Filter to only include statuses that represent confirmed bookings or potential bookings
      // Statuses that block calendar: new, modified, ownerStay, pending, awaitingPayment, unconfirmed, awaitingGuestVerification
      // Statuses to exclude: cancelled, inquiry*, declined, expired, unknown
      const validStatuses = new Set([
        'new',
        'modified',
        'ownerStay',
        'pending',
        'awaitingPayment',
        'unconfirmed',
        'awaitingGuestVerification',
      ]);

      const reservations = allReservations.filter((reservation) => {
        const status = String(reservation.status || '').toLowerCase();
        return validStatuses.has(status);
      });

      this.logger.log(
        `Hostaway sync for tenant ${tenantId} (${automationTimezone}): fetched ${allReservations.length} total future reservations, ${reservations.length} with valid statuses (from ${today} onwards)`,
      );

      // Log sample reservations (first 5) with date fields to verify date parsing
      // This helps debug date format issues
      const sampleReservations = reservations.slice(0, 5);
      for (const reservation of sampleReservations) {
        const reservationId = String(reservation.id ?? reservation.reservationId ?? 'unknown');
        const logData: Record<string, unknown> = {
          reservationId,
          id: reservation.id,
          status: reservation.status,
          arrivalDate: reservation.arrivalDate,
          departureDate: reservation.departureDate,
          reservationDate: reservation.reservationDate,
          checkInTime: reservation.checkInTime,
          checkOutTime: reservation.checkOutTime,
          listingTimeZoneName:
            typeof reservation.listingTimeZoneName === 'function'
              ? '[Function]'
              : reservation.listingTimeZoneName,
          timezone:
            typeof reservation.timezone === 'function' ? '[Function]' : reservation.timezone,
          // Include all top-level keys for reference
          availableKeys: reservation ? Object.keys(reservation).slice(0, 50) : [],
        };

        // Log reservation data for debugging date formats to file
        // This will be written to logs/general/app-YYYY-MM-DD.log
        this.loggingService.logApiResponse('Hostaway', `/v1/reservations (initial-sync-sample)`, {
          reservationData: logData,
          dateFields: {
            arrivalDate: reservation.arrivalDate,
            departureDate: reservation.departureDate,
            reservationDate: reservation.reservationDate,
            checkInTime: reservation.checkInTime,
            checkOutTime: reservation.checkOutTime,
            listingTimeZoneName: reservation.listingTimeZoneName,
          },
        });
      }

      if (reservations.length > 0) {
        // Process ALL future valid reservations (no date limit)
        // This ensures we capture all reservations even if they're far in the future
        // Optimizations: listing caching, batch processing, and rate limit handling prevent overwhelming the API

        this.logger.log(
          `Processing all ${reservations.length} valid future reservations for tenant ${tenantId}`,
        );

        // Process reservations in batches with progress logging
        const batchSize = 10;
        const totalBatches = Math.ceil(reservations.length / batchSize);
        let processedCount = 0;

        let successCount = 0;
        let failureCount = 0;
        const failures: Array<{ reservationId: string | undefined; error: string }> = [];

        for (let i = 0; i < reservations.length; i += batchSize) {
          const batch = reservations.slice(i, i + batchSize);
          const batchNum = Math.floor(i / batchSize) + 1;

          // Track reservation IDs to detect duplicates in the same sync
          const reservationIdsInBatch = new Set<string>();
          for (const reservation of batch) {
            const reservationId =
              reservation?.id?.toString() ?? reservation?.reservationId?.toString();
            if (reservationId) {
              if (reservationIdsInBatch.has(reservationId)) {
                this.logger.warn(
                  `Duplicate reservation ${reservationId} detected in the same batch - this will cause duplicate message skips`,
                );
              }
              reservationIdsInBatch.add(reservationId);
            }
          }

          // Process each reservation with error handling to prevent one failure from breaking the batch
          const results = await Promise.allSettled(
            batch.map((reservation) =>
              this.schedulingService
                .scheduleProactiveMessagesFromReservation(tenant, reservation, {
                  initialSync: true,
                })
                .catch((error) => {
                  const reservationId =
                    reservation?.id?.toString() ??
                    reservation?.reservationId?.toString() ??
                    'unknown';
                  this.logger.error(
                    `Failed to process reservation ${reservationId} during sync (tenant ${tenantId})`,
                    error as Error,
                  );
                  failures.push({
                    reservationId: reservationId !== 'unknown' ? reservationId : undefined,
                    error: error instanceof Error ? error.message : String(error),
                  });
                  throw error; // Re-throw to mark as rejected in Promise.allSettled
                }),
            ),
          );

          const batchSuccesses = results.filter((r) => r.status === 'fulfilled').length;
          const batchFailures = results.filter((r) => r.status === 'rejected').length;
          successCount += batchSuccesses;
          failureCount += batchFailures;
          processedCount += batch.length;

          // Log progress every 10 batches or every 50 reservations, whichever comes first
          if (batchNum % 10 === 0 || processedCount % 50 === 0 || batchNum === totalBatches) {
            this.logger.log(
              `Sync progress: ${processedCount}/${reservations.length} reservations processed (${batchNum}/${totalBatches} batches) - ${successCount} succeeded, ${failureCount} failed`,
            );
          }

          // Small delay between batches to avoid rate limits
          if (i + batchSize < reservations.length) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }

        // Log summary of failures if any
        if (failures.length > 0) {
          this.logger.warn(
            `Sync completed with ${failures.length} failures. First 10 failures: ${JSON.stringify(
              failures.slice(0, 10),
            )}`,
          );
        }

        // Count actual bookings and conversations created
        const bookingCountResult = await this.databaseService.runQuery<{ count: string }>(
          `select count(*) as count from public.bookings where tenant_id = $1`,
          [tenantId],
        );
        const bookingCount = parseInt(bookingCountResult.rows[0]?.count ?? '0', 10);

        const conversationCountResult = await this.databaseService.runQuery<{ count: string }>(
          `select count(*) as count from public.conversations where tenant_id = $1`,
          [tenantId],
        );
        const conversationCount = parseInt(conversationCountResult.rows[0]?.count ?? '0', 10);

        // Count unique properties/listings
        const propertyCountResult = await this.databaseService.runQuery<{ count: string }>(
          `select count(distinct external_id) as count from public.properties where tenant_id = $1`,
          [tenantId],
        );
        const propertyCount = parseInt(propertyCountResult.rows[0]?.count ?? '0', 10);

        // Check how many unique listing IDs were in the reservations
        const uniqueListingIds = new Set<string>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reservations.forEach((r: any) => {
          const listingId =
            r.listingMapId ||
            r.listing_map_id ||
            r.listingId ||
            r.listing_id ||
            r.propertyId ||
            r.property_id;
          if (listingId) {
            uniqueListingIds.add(String(listingId));
          }
        });

        this.logger.log(
          `Hostaway sync completed for tenant ${tenantId}: processed ${reservations.length} reservations (${successCount} succeeded, ${failureCount} failed), created ${bookingCount} bookings, ${conversationCount} conversations, ${propertyCount} properties (${uniqueListingIds.size} unique listing IDs in reservations)`,
        );
      } else {
        this.logger.log(
          `No Hostaway reservations with valid statuses found for tenant ${tenantId}.`,
        );
      }

      // Update status to completed
      await this.updateSyncStatus(tenantId, 'completed', new Date(), null);
    } catch (syncError) {
      const errorMessage = syncError instanceof Error ? syncError.message : String(syncError);
      this.logger.error(`Hostaway sync failed for tenant ${tenantId}`, syncError as Error);
      await this.updateSyncStatus(tenantId, 'failed', null, errorMessage);
    }
  }

  /**
   * Update sync status in database
   */
  private async updateSyncStatus(
    tenantId: string,
    status: 'idle' | 'syncing' | 'completed' | 'failed',
    lastSyncAt: Date | null,
    error: string | null,
  ): Promise<void> {
    try {
      // Handle lastSyncAt separately to avoid type inference issues
      if (lastSyncAt !== null) {
        await this.databaseService.runQuery(
          `UPDATE public.tenants 
           SET hostaway_sync_status = $2,
               hostaway_last_sync_at = CAST($3 AS TIMESTAMP WITH TIME ZONE),
               hostaway_sync_error = $4,
               updated_at = now()
           WHERE id = $1`,
          [tenantId, status, lastSyncAt, error],
        );
      } else {
        await this.databaseService.runQuery(
          `UPDATE public.tenants 
           SET hostaway_sync_status = $2,
               hostaway_sync_error = $3,
               updated_at = now()
           WHERE id = $1`,
          [tenantId, status, error],
        );
      }
    } catch (error) {
      this.logger.error(`Failed to update sync status for tenant ${tenantId}`, error as Error);
    }
  }

  /**
   * Manual re-sync trigger
   */
  async triggerResync(userId: string): Promise<{ status: string; message: string }> {
    const tenant = await this.tenantService.getTenantForUser(userId);

    if (!tenant.encryptedHostawayAccessToken) {
      throw new BadRequestException('Hostaway integration is not configured');
    }

    // Run sync in background
    setImmediate(async () => {
      await this.performHostawaySync(tenant.id);
    });

    return {
      status: 'syncing',
      message: 'Re-sync started. Status will update automatically.',
    };
  }

  /**
   * Daily scheduled sync - runs every day at 2 AM
   */
  @Cron('0 2 * * *') // 2 AM every day
  async dailySync(): Promise<void> {
    this.logger.log('Starting daily Hostaway sync for all connected tenants...');

    try {
      // Get all tenants with Hostaway integration
      const tenantsResult = await this.databaseService.runQuery<{
        id: string;
        hostaway_client_id: string | null;
      }>(
        `SELECT id, hostaway_client_id 
         FROM public.tenants 
         WHERE encrypted_hostaway_access_token IS NOT NULL 
           AND hostaway_client_id IS NOT NULL`,
      );

      const tenants = tenantsResult.rows;
      this.logger.log(`Found ${tenants.length} tenants with Hostaway integration for daily sync`);

      // Sync each tenant
      for (const tenant of tenants) {
        try {
          this.logger.log(`Starting daily sync for tenant ${tenant.id}`);
          await this.performHostawaySync(tenant.id);
        } catch (error) {
          this.logger.error(`Daily sync failed for tenant ${tenant.id}`, error as Error);
          // Continue with other tenants even if one fails
        }
      }

      this.logger.log(`Daily Hostaway sync completed for ${tenants.length} tenants`);
    } catch (error) {
      this.logger.error('Daily sync job failed', error as Error);
    }
  }

  async getHostawayStatus(userId: string): Promise<{
    status: 'connected' | 'not_connected';
    dryRun: boolean;
    clientId: string | null;
    webhookUrl: string | null;
    webhookConfigured: boolean;
    syncStatus: 'idle' | 'syncing' | 'completed' | 'failed';
    lastSyncAt: string | null;
    syncError: string | null;
  }> {
    const tenant = await this.tenantService.getTenantForUser(userId);
    const hasIntegration =
      Boolean(tenant.hostawayClientId) && Boolean(tenant.encryptedHostawayAccessToken);

    const dryRun =
      (this.configService.get<string>('HOSTAWAY_DRY_RUN') ?? '').toLowerCase() === 'true';

    const webhookUrl = this.configService.get<string>('HOSTAWAY_WEBHOOK_URL');

    // Get sync status from database
    const syncStatusResult = await this.databaseService.runQuery<{
      hostaway_sync_status: string | null;
      hostaway_last_sync_at: Date | string | null;
      hostaway_sync_error: string | null;
    }>(
      `SELECT hostaway_sync_status, hostaway_last_sync_at, hostaway_sync_error 
       FROM public.tenants WHERE id = $1`,
      [tenant.id],
    );

    const syncData = syncStatusResult.rows[0];
    const syncStatus = (syncData?.hostaway_sync_status ?? 'idle') as
      | 'idle'
      | 'syncing'
      | 'completed'
      | 'failed';
    const lastSyncAt = syncData?.hostaway_last_sync_at
      ? new Date(syncData.hostaway_last_sync_at).toISOString()
      : null;

    return {
      status: hasIntegration ? 'connected' : 'not_connected',
      dryRun,
      clientId: tenant.hostawayClientId ?? null,
      webhookUrl,
      webhookConfigured: Boolean(webhookUrl && this.isValidWebhookUrl(webhookUrl)),
      syncStatus,
      lastSyncAt,
      syncError: syncData?.hostaway_sync_error ?? null,
    };
  }

  async verifyWebhookStatus(userId: string): Promise<{
    webhookUrl: string | null;
    webhookConfigured: boolean;
    webhookRegistered: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webhookDetails: any | null;
  }> {
    const tenant = await this.tenantService.getTenantForUser(userId);
    const webhookUrl = this.configService.get<string>('HOSTAWAY_WEBHOOK_URL');
    const webhookConfigured = Boolean(webhookUrl && this.isValidWebhookUrl(webhookUrl));

    let webhookRegistered = false;
    let webhookDetails = null;

    if (tenant.encryptedHostawayAccessToken && webhookConfigured) {
      try {
        const accessToken = this.cryptoService.decrypt(tenant.encryptedHostawayAccessToken);
        const webhooks = await this.hostawayClient.listUnifiedWebhooks(accessToken);
        const matchingWebhook = webhooks.find(
          (w) => w.url?.toLowerCase() === webhookUrl?.toLowerCase(),
        );

        webhookRegistered = Boolean(matchingWebhook);
        webhookDetails = matchingWebhook || null;
      } catch (error) {
        this.logger.warn('Failed to verify webhook status', error as Error);
      }
    }

    return {
      webhookUrl,
      webhookConfigured,
      webhookRegistered,
      webhookDetails,
    };
  }

  private isValidWebhookUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return (
        parsedUrl.protocol === 'https:' && parsedUrl.pathname.endsWith('/api/webhooks/hostaway')
      );
    } catch {
      return false;
    }
  }

  async configureTwilio(userId: string, payload: TwilioIntegrationDto): Promise<void> {
    this.logger.log(`Starting Twilio configuration for user ${userId}`);

    if (!payload.accountSid?.trim() || !payload.authToken?.trim()) {
      throw new BadRequestException('Account SID and Auth Token are required');
    }

    const tenant = await this.tenantService.getTenantForUser(userId);

    const encryptedAuthToken = this.cryptoService.encrypt(payload.authToken.trim());

    await this.tenantService.updateTwilioIntegration(tenant.id, {
      accountSid: payload.accountSid.trim(),
      encryptedAuthToken: encryptedAuthToken,
      messagingServiceSid: payload.messagingServiceSid?.trim() || null,
      whatsappFrom: payload.whatsappFrom?.trim() || null,
      voiceFrom: payload.voiceFrom?.trim() || null,
      staffWhatsappNumber: payload.staffWhatsappNumber?.trim() || null,
      onCallNumber: payload.onCallNumber?.trim() || null,
    });

    this.logger.log(`Twilio integration configured successfully for tenant ${tenant.id}`);
  }

  async getTwilioStatus(userId: string): Promise<{
    status: 'connected' | 'not_connected';
    accountSid: string | null;
    hasMessagingService: boolean;
    hasWhatsappFrom: boolean;
    hasVoiceFrom: boolean;
    staffWhatsappNumber: string | null;
    onCallNumber: string | null;
  }> {
    const tenant = await this.tenantService.getTenantForUser(userId);
    const hasIntegration = Boolean(tenant.twilioAccountSid && tenant.encryptedTwilioAuthToken);

    return {
      status: hasIntegration ? 'connected' : 'not_connected',
      accountSid: tenant.twilioAccountSid ?? null,
      hasMessagingService: Boolean(tenant.twilioMessagingServiceSid),
      hasWhatsappFrom: Boolean(tenant.twilioWhatsappFrom),
      hasVoiceFrom: Boolean(tenant.twilioVoiceFrom),
      staffWhatsappNumber: tenant.twilioStaffWhatsappNumber ?? null,
      onCallNumber: tenant.twilioOnCallNumber ?? null,
    };
  }
}
