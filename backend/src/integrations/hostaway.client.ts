import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { addDays, subDays } from 'date-fns';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import http from 'http';
import https from 'https';

import { CryptoService } from '../security/crypto.service';
import { LoggingService } from '../logging/logging.service';
import { TenantSummary } from '../tenant/tenant.service';

interface HostawayAccessTokenResponse {
  access_token?: string;
  token?: string;
  expires_in?: number;
  accessToken?: string;
}

interface HostawayUnifiedWebhook {
  id: number;
  url: string;
  status: string;
}

type HostawayRecord = Record<string, unknown>;

interface HostawayReservationQuery {
  arrivalStartDate?: string;
  arrivalEndDate?: string;
  reservationStartDate?: string;
  reservationEndDate?: string;
  modifiedStartDate?: string;
  modifiedEndDate?: string;
  status?: string;
  includeCancelled?: boolean;
  sortOrder?: 'asc' | 'desc';
}

interface AutomationReservationWindow {
  timezone: string;
  today: string;
  tomorrow: string;
  yesterday: string;
  todayArrivals: HostawayRecord[];
  tomorrowArrivals: HostawayRecord[];
  yesterdayBookings: HostawayRecord[];
  combined: HostawayRecord[];
}

@Injectable()
export class HostawayClient {
  private readonly api: AxiosInstance;
  private readonly logger = new Logger(HostawayClient.name);
  private readonly dryRun: boolean;
  private readonly automationTimezone: string;
  private readonly maxReservationPages: number;
  private readonly loggedListingSamples = new Set<string>(); // Track logged samples

  constructor(
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
    private readonly loggingService: LoggingService,
  ) {
    const baseURL =
      this.configService.get<string>('HOSTAWAY_API_BASE_URL') ?? 'https://api.hostaway.com';

    // Configure HTTP agents with connection pooling limits to prevent socket leaks
    const httpAgent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 60000,
    });

    const httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 60000,
    });

    this.api = axios.create({
      baseURL,
      timeout: 30000, // Increased timeout for API calls
      httpAgent,
      httpsAgent,
      // Add response interceptor for rate limit handling
      validateStatus: (status) => status < 500, // Don't throw on 4xx, handle manually
    });

    // Add response interceptor for rate limit handling
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 429) {
          const retryAfter =
            error.response.headers['x-ratelimit-retry-after'] ||
            error.response.headers['retry-after'];
          const waitTime = retryAfter ? parseInt(String(retryAfter), 10) * 1000 : 60000; // Default 60s
          this.logger.warn(`Rate limit hit. Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, Math.min(waitTime, 60000))); // Max 60s wait
          // Retry the request
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          return this.api.request(error.config!);
        }
        return Promise.reject(error);
      },
    );

    this.dryRun =
      (this.configService.get<string>('HOSTAWAY_DRY_RUN') ?? '').toLowerCase() === 'true';
    this.automationTimezone =
      this.configService.get<string>('HOSTAWAY_AUTOMATION_TIMEZONE') ?? 'Europe/London';
    this.maxReservationPages = Number(
      this.configService.get<string>('HOSTAWAY_PAGINATION_LIMIT') ?? 10,
    );
  }

  async generateAccessToken(clientId: string, clientSecret: string): Promise<string> {
    try {
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'general',
      });

      const { data } = await this.api.post<HostawayAccessTokenResponse>(
        '/v1/accessTokens',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const token = data.access_token ?? data.token ?? data.accessToken;

      if (!token) {
        throw new InternalServerErrorException('Hostaway did not return an access token');
      }

      return token;
    } catch (error) {
      this.logger.error('Failed to generate Hostaway access token', error as Error);
      throw new InternalServerErrorException('Unable to generate Hostaway access token');
    }
  }

  async ensureUnifiedWebhook(
    accessToken: string,
    webhookUrl: string,
  ): Promise<{ status: 'already_exists' | 'created'; webhook: HostawayUnifiedWebhook | null }> {
    try {
      const existing = await this.listUnifiedWebhooks(accessToken);

      const match = existing.find(
        (webhook) => webhook.url?.toLowerCase() === webhookUrl.toLowerCase(),
      );

      if (match) {
        return { status: 'already_exists', webhook: match };
      }

      const created = await this.createUnifiedWebhook(accessToken, webhookUrl);
      return { status: 'created', webhook: created };
    } catch (error) {
      const normalized = this.unwrapAxiosError(error);
      this.logger.error('Failed to ensure Hostaway unified webhook setup', normalized);
      throw new InternalServerErrorException('Unable to configure Hostaway unified webhook', {
        cause: normalized,
      });
    }
  }

  async listFutureReservations(tenant: TenantSummary): Promise<Record<string, unknown>[]> {
    const accessToken = this.decryptAccessToken(tenant);
    return this.listFutureReservationsWithToken(accessToken);
  }

  async listFutureReservationsWithToken(accessToken: string): Promise<Record<string, unknown>[]> {
    try {
      return await this.listReservationsWithQuery(accessToken, {
        status: 'booked',
        includeCancelled: false,
        sortOrder: 'asc',
      });
    } catch (error) {
      this.logger.error('Failed to list Hostaway reservations', error as Error);
      throw new InternalServerErrorException('Unable to fetch Hostaway reservations');
    }
  }

  async listReservationsWithQuery(
    accessToken: string,
    query: HostawayReservationQuery,
  ): Promise<HostawayRecord[]> {
    const accum: HostawayRecord[] = [];
    let page = 1;
    let nextPageToken: string | undefined;
    const limit = 100;
    // Default to 20 pages (2000 reservations) to ensure we fetch all reservations
    // For 184 reservations, this is more than enough
    const maxPages =
      Number.isFinite(this.maxReservationPages) && this.maxReservationPages > 0
        ? this.maxReservationPages
        : 20;

    while (page <= maxPages) {
      try {
        const params: Record<string, unknown> = {
          limit,
          page,
          ...query,
        };

        // Set default sortOrder if not provided
        if (!params.sortOrder) {
          params.sortOrder = 'arrivalDate';
        }

        // Only include status filter if explicitly provided
        if (query.status) {
          params.status = query.status;
        }

        if (nextPageToken) {
          params.nextPageToken = nextPageToken;
        }

        let data;
        let attempts = 0;
        const maxRetries = 3;

        while (attempts < maxRetries) {
          try {
            const response = await this.api.get('/v1/reservations', {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              params,
            });

            // Check for rate limiting in response headers
            if (response.status === 429 || response.headers['x-ratelimit-remaining'] === '0') {
              const retryAfter =
                response.headers['x-ratelimit-retry-after'] ||
                response.headers['retry-after'] ||
                '60';
              const waitTime = Math.min(parseInt(String(retryAfter), 10) * 1000, 60000);
              this.logger.warn(
                `Rate limit approaching. Waiting ${waitTime}ms before continuing...`,
              );
              await new Promise((resolve) => setTimeout(resolve, waitTime));
              attempts++;
              continue;
            }

            data = response.data;
            break; // Success, exit retry loop
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (error: any) {
            if (error.response?.status === 429 && attempts < maxRetries - 1) {
              const retryAfter =
                error.response.headers['x-ratelimit-retry-after'] ||
                error.response.headers['retry-after'] ||
                '60';
              const waitTime = Math.min(parseInt(String(retryAfter), 10) * 1000, 60000);
              this.logger.warn(
                `Rate limit exceeded. Waiting ${waitTime}ms before retry ${
                  attempts + 1
                }/${maxRetries}...`,
              );
              await new Promise((resolve) => setTimeout(resolve, waitTime));
              attempts++;
              continue;
            }
            throw error; // Re-throw if not rate limit or max retries reached
          }
        }

        if (!data) {
          throw new Error('Failed to fetch reservations after rate limit retries');
        }

        // Add small delay between pages to avoid hitting rate limits
        if (page > 1) {
          await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay between pages
        }

        const reservations =
          (Array.isArray(data?.result) && data.result) ||
          (Array.isArray(data?.reservations) && data.reservations) ||
          [];

        // Log the raw response structure and status distribution to file (page 1 only)
        if (page === 1) {
          // Safely extract pagination info without circular references
          const paginationInfo = data?.pagination
            ? {
                totalPages: data.pagination.totalPages,
                currentPage: data.pagination.currentPage,
                nextPageToken:
                  typeof data.pagination.nextPageToken === 'string'
                    ? data.pagination.nextPageToken
                    : undefined,
              }
            : data?.meta
            ? {
                totalPages: data.meta.totalPages,
                currentPage: data.meta.currentPage,
                nextPageToken:
                  typeof data.meta.nextPageToken === 'string' ? data.meta.nextPageToken : undefined,
              }
            : data?.metadata
            ? {
                totalPages: data.metadata.totalPages,
                currentPage: data.metadata.currentPage,
                nextPageToken:
                  typeof data.metadata.nextPageToken === 'string'
                    ? data.metadata.nextPageToken
                    : undefined,
              }
            : undefined;

          const responseMetadata = {
            hasResult: !!data?.result,
            resultIsArray: Array.isArray(data?.result),
            resultLength: Array.isArray(data?.result) ? data.result.length : undefined,
            hasReservations: !!data?.reservations,
            reservationsIsArray: Array.isArray(data?.reservations),
            reservationsLength: Array.isArray(data?.reservations)
              ? data.reservations.length
              : undefined,
            dataKeys: data ? Object.keys(data).slice(0, 10) : [],
            pagination: paginationInfo,
            query: {
              limit: params.limit,
              page: params.page,
              sortOrder: params.sortOrder,
              arrivalStartDate: params.arrivalStartDate,
              arrivalEndDate: params.arrivalEndDate,
            },
          };

          // Safely extract sample reservation without circular references
          // Include more fields to understand the full structure
          const sampleReservationRaw = Array.isArray(data?.result)
            ? data.result[0]
            : Array.isArray(data?.reservations)
            ? data.reservations[0]
            : null;

          const sampleReservation = sampleReservationRaw
            ? {
                id: sampleReservationRaw.id,
                status: sampleReservationRaw.status,
                arrivalDate: sampleReservationRaw.arrivalDate,
                departureDate: sampleReservationRaw.departureDate,
                reservationDate: sampleReservationRaw.reservationDate,
                checkInTime: sampleReservationRaw.checkInTime,
                checkOutTime: sampleReservationRaw.checkOutTime,
                guestName: sampleReservationRaw.guestName,
                guestFirstName: sampleReservationRaw.guestFirstName,
                guestLastName: sampleReservationRaw.guestLastName,
                guestEmail: sampleReservationRaw.guestEmail,
                guestPhone: sampleReservationRaw.guestPhone,
                listingName: sampleReservationRaw.listingName,
                listingMapId: sampleReservationRaw.listingMapId,
                listingId: sampleReservationRaw.listingId,
                listingTimeZoneName: sampleReservationRaw.listingTimeZoneName,
                channelName: sampleReservationRaw.channelName,
                channelId: sampleReservationRaw.channelId,
                totalPrice: sampleReservationRaw.totalPrice,
                currency: sampleReservationRaw.currency,
                adults: sampleReservationRaw.adults,
                children: sampleReservationRaw.children,
                // Include all top-level keys for reference
                availableKeys: sampleReservationRaw
                  ? Object.keys(sampleReservationRaw).slice(0, 30)
                  : [],
              }
            : null;

          const statusCounts: Record<string, number> = {};
          reservations.forEach((r: Record<string, unknown>) => {
            const status = String(r.status || 'unknown').toLowerCase();
            statusCounts[status] = (statusCounts[status] || 0) + 1;
          });

          this.loggingService.logApiResponse('Hostaway', '/v1/reservations', {
            responseStructure: responseMetadata,
            sampleReservation,
            statusDistribution: statusCounts,
            totalReservations: reservations.length,
          });
        }

        for (const reservation of reservations) {
          if (reservation && typeof reservation === 'object') {
            accum.push(reservation as HostawayRecord);
          }
        }

        const token =
          (typeof data?.nextPageToken === 'string' && data.nextPageToken) ||
          (typeof data?.pagination?.nextPageToken === 'string' && data.pagination.nextPageToken) ||
          (typeof data?.meta?.nextPageToken === 'string' && data.meta.nextPageToken) ||
          (typeof data?.metadata?.nextPageToken === 'string' && data.metadata.nextPageToken) ||
          undefined;

        const totalPages =
          Number(data?.pagination?.totalPages) ||
          Number(data?.metadata?.totalPages) ||
          Number(data?.meta?.totalPages) ||
          undefined;
        const currentPage =
          Number(data?.pagination?.currentPage) ||
          Number(data?.metadata?.currentPage) ||
          Number(data?.meta?.currentPage) ||
          page;

        if (token) {
          nextPageToken = token;
          page += 1;
          continue;
        }

        if (totalPages && currentPage < totalPages) {
          page += 1;
          continue;
        }

        if (reservations.length === limit) {
          page += 1;
          continue;
        }

        break;
      } catch (error) {
        this.logger.error('Failed to fetch paginated Hostaway reservations', error as Error);
        throw new InternalServerErrorException('Unable to fetch Hostaway reservations');
      }
    }

    if (page > maxPages) {
      this.logger.warn(
        `Reached Hostaway pagination cap (${maxPages} pages, ${
          accum.length
        } reservations fetched). Results may be incomplete for query ${JSON.stringify(query)}`,
      );
    } else {
      this.logger.debug(
        `Fetched ${accum.length} reservations from Hostaway (${page - 1} pages processed)`,
      );
    }

    return accum;
  }

  async listAutomationReservationWindow(
    accessToken: string,
    options: { now?: Date; timezone?: string } = {},
  ): Promise<AutomationReservationWindow> {
    const timezone = options.timezone ?? this.automationTimezone;
    const nowUtc = options.now ?? new Date();
    const zoned = toZonedTime(nowUtc, timezone);
    const today = format(zoned, 'yyyy-MM-dd');
    const tomorrow = format(addDays(zoned, 1), 'yyyy-MM-dd');
    const yesterday = format(subDays(zoned, 1), 'yyyy-MM-dd');

    const [todayArrivals, tomorrowArrivals, yesterdayBookings] = await Promise.all([
      this.listReservationsWithQuery(accessToken, {
        arrivalStartDate: today,
        arrivalEndDate: today,
      }),
      this.listReservationsWithQuery(accessToken, {
        arrivalStartDate: tomorrow,
        arrivalEndDate: tomorrow,
      }),
      this.listReservationsWithQuery(accessToken, {
        reservationStartDate: yesterday,
        reservationEndDate: yesterday,
        arrivalStartDate: today,
        arrivalEndDate: today,
      }),
    ]);

    const combinedMap = new Map<string, HostawayRecord>();
    const register = (records: HostawayRecord[]) => {
      for (const record of records) {
        const id = this.resolveReservationId(record);
        if (!id) {
          this.logger.debug(
            'Encountered Hostaway reservation without resolvable id during automation window fetch.',
          );
          continue;
        }
        if (!combinedMap.has(id)) {
          combinedMap.set(id, record);
        }
      }
    };

    register(todayArrivals);
    register(tomorrowArrivals);
    register(yesterdayBookings);

    this.logger.log(
      `Hostaway reservation window fetched (timezone ${timezone}): today=${todayArrivals.length}, tomorrow=${tomorrowArrivals.length}, same-day bookings=${yesterdayBookings.length}`,
    );

    return {
      timezone,
      today,
      tomorrow,
      yesterday,
      todayArrivals,
      tomorrowArrivals,
      yesterdayBookings,
      combined: Array.from(combinedMap.values()),
    };
  }

  async getReservation(
    tenant: TenantSummary,
    reservationId: string,
  ): Promise<Record<string, unknown>> {
    const token = this.decryptAccessToken(tenant);

    try {
      const { data } = await this.api.get(`/v1/reservations/${reservationId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          includeResources: 1,
        },
      });

      const reservation = (data?.result ?? data) as Record<string, unknown>;

      // Log the reservation response to file for debugging date format issues
      // This will be written to logs/general/app-YYYY-MM-DD.log
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
        timezone: typeof reservation.timezone === 'function' ? '[Function]' : reservation.timezone,
        // Include all top-level keys for reference
        availableKeys: reservation ? Object.keys(reservation).slice(0, 50) : [],
      };

      this.loggingService.logApiResponse('Hostaway', `/v1/reservations/${reservationId}`, {
        reservationData: logData,
        dateFields: {
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
        },
      });

      return reservation;
    } catch (error) {
      this.logger.error(`Failed to retrieve Hostaway reservation ${reservationId}`, error as Error);
      throw new InternalServerErrorException('Unable to fetch reservation from Hostaway');
    }
  }

  async getListing(
    tenant: TenantSummary,
    listingId: string,
  ): Promise<Record<string, unknown> | null> {
    const token = this.decryptAccessToken(tenant);

    try {
      const { data } = await this.api.get(`/v1/listings/${listingId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          includeResources: 1,
        },
      });

      const listing = (data?.result ?? data ?? null) as Record<string, unknown> | null;

      // Log listing structure for first few calls to understand field names
      if (listing && typeof listing === 'object') {
        // Only log occasionally to avoid spam (first 5 listings)
        if (
          this.loggedListingSamples.size < 5 &&
          !this.loggedListingSamples.has(String(listingId))
        ) {
          this.loggedListingSamples.add(String(listingId));

          // Extract safe fields for logging (avoid circular references)
          const sampleListing = {
            id: listing.id,
            name: listing.name,
            externalListingName: listing.externalListingName,
            internalListingName: listing.internalListingName,
            bookingcomPropertyName: listing.bookingcomPropertyName,
            airbnbName: listing.airbnbName,
            // Get all top-level keys for reference
            availableKeys: Object.keys(listing).slice(0, 50),
            // Log a few more potential name fields
            title: listing.title,
            propertyName: listing.propertyName,
            listingTitle: listing.listingTitle,
          };

          this.loggingService.logApiResponse('Hostaway', `/v1/listings/${listingId}`, {
            sampleListing,
            fieldValues: {
              name: listing.name,
              externalListingName: listing.externalListingName,
              internalListingName: listing.internalListingName,
              bookingcomPropertyName: listing.bookingcomPropertyName,
            },
          });
        }
      }

      return listing;
    } catch (error) {
      this.logger.error(`Failed to retrieve Hostaway listing ${listingId}`, error as Error);
      return null;
    }
  }

  async listUnifiedWebhooks(accessToken: string): Promise<HostawayUnifiedWebhook[]> {
    const { data } = await this.api.get<{ result: HostawayUnifiedWebhook[] }>(
      '/v1/webhooks/unifiedWebhooks',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return data?.result ?? [];
  }

  async getAnyListingAccountId(accessToken: string): Promise<string | null> {
    try {
      const { data } = await this.api.get('/v1/listings', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { limit: 1, page: 1 },
      });

      const list = this.normalizeHostawayList(data);
      const first = list[0] as Record<string, unknown> | undefined;
      if (!first) return null;
      const accountId = this.readString(first as HostawayRecord, 'accountId', 'account_id');
      return accountId ?? null;
    } catch (error) {
      this.logger.warn('Unable to determine Hostaway account id from listings', error as Error);
      return null;
    }
  }

  async getAccountIdFromUsers(accessToken: string): Promise<string | null> {
    try {
      const { data } = await this.api.get('/v1/users', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { limit: 1, page: 1 },
      });

      // Expected shape: { status: 'success', result: [ { accountId: 151651, ... } ] }
      const results = (data?.result ?? []) as Array<Record<string, unknown>>;
      const first = results[0];
      if (!first) return null;
      const accountId = this.readString(first as HostawayRecord, 'accountId', 'account_id');
      return accountId ?? null;
    } catch (error) {
      this.logger.warn(
        'Unable to determine Hostaway account id from users endpoint',
        error as Error,
      );
      return null;
    }
  }

  async getMessageTemplates(
    accessToken: string,
    params: {
      listingMapId?: string;
      channelId?: string;
      messageTemplateGroupId?: string;
      reservationId?: string;
    } = {},
  ): Promise<Record<string, unknown>[]> {
    try {
      const { data } = await this.api.get('/v1/messageTemplates', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params,
      });
      return this.normalizeHostawayList(data);
    } catch (error) {
      this.logger.error('Failed to fetch Hostaway message templates', error as Error);
      throw new InternalServerErrorException('Unable to fetch Hostaway message templates');
    }
  }

  private async createUnifiedWebhook(
    accessToken: string,
    url: string,
  ): Promise<HostawayUnifiedWebhook | null> {
    const { data } = await this.api.post(
      '/v1/webhooks/unifiedWebhooks',
      {
        url,
        isEnabled: 1,
        events: ['reservation.created', 'reservation.updated', 'message.received'],
        status: 'active',
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return (data?.result ?? data ?? null) as HostawayUnifiedWebhook | null;
  }

  async getBooking(tenant: TenantSummary, bookingId: string): Promise<unknown> {
    const token = this.decryptAccessToken(tenant);

    try {
      const { data } = await this.api.get(`/v1/bookings/${bookingId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return data;
    } catch (error) {
      this.logger.error(`Failed to retrieve Hostaway booking ${bookingId}`, error as Error);
      throw new InternalServerErrorException('Unable to fetch booking from Hostaway');
    }
  }

  async listConversations(
    tenant: TenantSummary,
    options: {
      limit?: number;
      offset?: number;
      reservationId?: string;
      includeResources?: number;
    } = {},
  ): Promise<HostawayRecord[]> {
    const token = this.decryptAccessToken(tenant);

    try {
      const params: Record<string, unknown> = {};
      if (options.limit !== undefined) {
        params.limit = options.limit;
      }
      if (options.offset !== undefined) {
        params.offset = options.offset;
      }
      if (options.reservationId) {
        params.reservationId = options.reservationId;
      }
      if (options.includeResources !== undefined) {
        params.includeResources = options.includeResources;
      } else {
        params.includeResources = 1; // Default to including resources
      }

      const { data } = await this.api.get('/v1/conversations', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      });

      return this.normalizeHostawayList(data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }

      this.logger.error('Failed to retrieve Hostaway conversations list', error as Error);
      throw new InternalServerErrorException('Unable to fetch conversations list from Hostaway');
    }
  }

  async getReservationConversations(
    tenant: TenantSummary,
    reservationId: string,
  ): Promise<HostawayRecord[]> {
    const token = this.decryptAccessToken(tenant);

    try {
      const { data } = await this.api.get(`/v1/reservations/${reservationId}/conversations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          includeResources: 1,
        },
      });

      return this.normalizeHostawayList(data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }

      this.logger.error(
        `Failed to retrieve Hostaway conversations for reservation ${reservationId}`,
        error as Error,
      );
      throw new InternalServerErrorException(
        'Unable to fetch reservation conversations from Hostaway',
      );
    }
  }

  async sendMessageToGuest(
    tenant: TenantSummary,
    reservationId: string,
    message: string,
  ): Promise<unknown> {
    if (this.dryRun) {
      this.logger.log(
        `(dry-run) Hostaway message for reservation ${reservationId} (tenant ${tenant.id}): ${message}`,
      );
      return { dryRun: true };
    }

    const token = this.decryptAccessToken(tenant);

    try {
      const { data } = await this.api.post(
        `/v1/reservations/${reservationId}/messages`,
        { message },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        `Failed to send Hostaway message for reservation ${reservationId}`,
        error as Error,
      );
      throw new InternalServerErrorException('Unable to send message to Hostaway reservation');
    }
  }

  async getConversationMessages(
    tenant: TenantSummary,
    conversationId: string,
    includeScheduledMessages = true,
  ): Promise<HostawayRecord[]> {
    const token = this.decryptAccessToken(tenant);

    try {
      const params: Record<string, unknown> = {};
      if (includeScheduledMessages) {
        params.includeScheduledMessages = 1;
      }

      const { data } = await this.api.get(`/v1/conversations/${conversationId}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      });

      return this.normalizeHostawayList(data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return [];
      }

      this.logger.error(
        `Failed to retrieve messages for conversation ${conversationId}`,
        error as Error,
      );
      throw new InternalServerErrorException('Unable to fetch conversation messages from Hostaway');
    }
  }

  async sendConversationMessage(
    tenant: TenantSummary,
    conversationId: string,
    body: string,
    communicationType: 'email' | 'channel' | 'sms' | 'whatsapp' = 'channel',
  ): Promise<unknown> {
    if (this.dryRun) {
      this.logger.log(
        `(dry-run) Hostaway conversation message for conversation ${conversationId} (tenant ${tenant.id}): ${body}`,
      );
      return { dryRun: true };
    }

    const token = this.decryptAccessToken(tenant);

    try {
      const { data } = await this.api.post(
        `/v1/conversations/${conversationId}/messages`,
        {
          body,
          communicationType,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      return data;
    } catch (error) {
      this.logger.error(
        `Failed to send Hostaway conversation message for conversation ${conversationId}`,
        error as Error,
      );
      throw new InternalServerErrorException('Unable to send Hostaway conversation message');
    }
  }

  private decryptAccessToken(tenant: TenantSummary): string {
    if (!tenant.encryptedHostawayAccessToken) {
      throw new InternalServerErrorException('Tenant Hostaway access token is not configured');
    }

    return this.cryptoService.decrypt(tenant.encryptedHostawayAccessToken);
  }

  private unwrapAxiosError(input: unknown): Error {
    if (axios.isAxiosError(input)) {
      const axiosError = input as AxiosError<{ message?: string } | undefined>;
      const responseData = axiosError.response?.data;
      const serialized =
        typeof responseData === 'string'
          ? responseData
          : responseData
          ? JSON.stringify(responseData)
          : undefined;
      const message = serialized ? `${axiosError.message}: ${serialized}` : axiosError.message;
      return new Error(message);
    }

    return input instanceof Error ? input : new Error(String(input));
  }

  private resolveReservationId(reservation: HostawayRecord): string | null {
    const candidate = this.readString(
      reservation,
      'id',
      'reservationId',
      'reservation_id',
      'reservation.id',
      'bookingId',
    );

    return candidate ?? null;
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
      if (typeof value === 'string' && value.trim()) {
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

  private normalizeHostawayList(payload: unknown): HostawayRecord[] {
    const results: HostawayRecord[] = [];

    const walk = (value: unknown): void => {
      if (!value) {
        return;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object') {
            results.push(item as HostawayRecord);
          }
        }
        return;
      }

      if (typeof value === 'object') {
        const objectValue = value as Record<string, unknown>;
        for (const key of ['result', 'results', 'items', 'data', 'conversations']) {
          if (key in objectValue) {
            walk(objectValue[key]);
          }
        }
      }
    };

    walk(payload);

    return results;
  }
}
