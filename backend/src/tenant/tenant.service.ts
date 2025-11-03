import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PoolClient } from 'pg';

import { DatabaseService } from '../database/database.service';
import { CreateTenantOnSignupDto } from './dto/create-tenant-on-signup.dto';

interface TenantRecord {
  id: string;
  name: string;
  slug: string;
}

export interface TenantSummary extends TenantRecord {
  subscriptionStatus: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  hostawayClientId?: string;
  hostawayAccountId?: string;
  encryptedHostawayClientSecret?: string | null;
  encryptedHostawayAccessToken?: string | null;
  twilioAccountSid?: string | null;
  encryptedTwilioAuthToken?: string | null;
  twilioMessagingServiceSid?: string | null;
  twilioWhatsappFrom?: string | null;
  twilioVoiceFrom?: string | null;
  twilioStaffWhatsappNumber?: string | null;
  twilioOnCallNumber?: string | null;
}

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async createTenantOnSignup(
    userId: string,
    payload: CreateTenantOnSignupDto,
  ): Promise<{ tenant: TenantRecord; alreadyLinked: boolean }> {
    if (!payload?.tenantName?.trim()) {
      throw new BadRequestException('tenantName is required');
    }

    return await this.databaseService.withClient(async (client) => {
      await client.query('BEGIN');

      let existingProfile;
      try {
        existingProfile = await client.query<{ tenant_id: string }>(
          'select tenant_id from public.user_profiles where user_id = $1',
          [userId],
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (queryError: any) {
        // If query fails, rollback and re-throw
        await client.query('ROLLBACK');
        this.logger.error('Failed to check existing user profile', queryError);
        throw queryError;
      }

      if (existingProfile.rowCount > 0) {
        try {
          const tenant = await this.fetchTenantById(client, existingProfile.rows[0].tenant_id);
          await client.query('COMMIT');
          return { tenant, alreadyLinked: true };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (fetchError: any) {
          await client.query('ROLLBACK');
          this.logger.error('Failed to fetch existing tenant', fetchError);
          throw fetchError;
        }
      }

      // Check if a tenant exists with matching email/name but no user_profile
      // This can happen if tenant creation succeeded but linking failed
      const orphanedTenant = await client.query<{ id: string; name: string; slug: string }>(
        `SELECT id, name, slug FROM public.tenants 
         WHERE (contact_email = $1 OR name = $2)
         AND NOT EXISTS (
           SELECT 1 FROM public.user_profiles WHERE tenant_id = public.tenants.id
         )
         LIMIT 1`,
        [payload.contactEmail ?? null, payload.tenantName.trim()],
      );

      if (orphanedTenant.rowCount > 0) {
        // Link existing tenant to user
        this.logger.log(
          `Found existing tenant ${orphanedTenant.rows[0].id} for user ${userId}, linking...`,
        );
        try {
          await this.linkUserToTenant(client, {
            userId,
            tenantId: orphanedTenant.rows[0].id,
            displayName: payload.displayName,
          });
          await client.query('COMMIT');
          return {
            tenant: {
              id: orphanedTenant.rows[0].id,
              name: orphanedTenant.rows[0].name,
              slug: orphanedTenant.rows[0].slug,
            },
            alreadyLinked: false,
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (linkError: any) {
          await client.query('ROLLBACK');
          this.logger.error('Failed to link to existing tenant', {
            error: linkError,
            userId,
            tenantId: orphanedTenant.rows[0].id,
            errorCode: linkError?.code,
            errorMessage: linkError?.message,
          });
          // Don't continue - rethrow to see what went wrong
          throw linkError;
        }
      }

      let tenant;
      try {
        tenant = await this.createTenantRecord(client, payload);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (createError: any) {
        // If transaction is aborted, it might be due to concurrent request
        // Check if tenant was already created by another request
        if (createError?.code === '25P02') {
          // Transaction aborted - might be due to concurrent creation
          // Rollback and check if tenant/user_profile already exists
          try {
            await client.query('ROLLBACK');
          } catch {
            // Transaction might already be aborted, that's okay
          }

          // Check outside transaction if tenant/user_profile was already created
          const checkResult = await this.databaseService.runQuery<{ tenant_id: string }>(
            'SELECT tenant_id FROM public.user_profiles WHERE user_id = $1',
            [userId],
          );

          if (checkResult.rowCount > 0) {
            // Tenant was already created by another request - return it
            const existingTenant = await this.getTenantById(checkResult.rows[0].tenant_id);
            this.logger.log(
              `Tenant already exists for user ${userId} (likely from concurrent request)`,
            );
            return { tenant: existingTenant, alreadyLinked: true };
          }
        }

        // Transaction might be aborted, try to rollback
        try {
          await client.query('ROLLBACK');
        } catch {
          // Ignore rollback errors if transaction is already aborted
        }
        this.logger.error('Failed to create tenant record', createError);
        throw createError;
      }

      try {
        await this.linkUserToTenant(client, {
          userId,
          tenantId: tenant.id,
          displayName: payload.displayName,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (linkError: any) {
        await client.query('ROLLBACK');
        this.logger.error('Failed to link user to tenant', linkError);
        throw linkError;
      }

      await client.query('COMMIT');
      return { tenant, alreadyLinked: false };
    });
  }

  async getTenantForUser(userId: string): Promise<TenantSummary> {
    const result = await this.databaseService.runQuery<TenantSummary>(
      `select ${this.tenantSelectColumns()}
       from public.user_profiles up
       join public.tenants t on t.id = up.tenant_id
       where up.user_id = $1
       limit 1`,
      [userId],
    );

    if (result.rowCount === 0) {
      throw new BadRequestException('User is not associated with a tenant');
    }

    return result.rows[0];
  }

  async getTenantById(tenantId: string): Promise<TenantSummary> {
    const result = await this.databaseService.runQuery<TenantSummary>(
      `select ${this.tenantSelectColumns()}
       from public.tenants t
       where t.id = $1
       limit 1`,
      [tenantId],
    );

    if (result.rowCount === 0) {
      throw new BadRequestException('Tenant not found');
    }

    return result.rows[0];
  }

  async findTenantByHostawayClientId(clientId: string): Promise<TenantSummary | null> {
    const result = await this.databaseService.runQuery<TenantSummary>(
      `select ${this.tenantSelectColumns()}
       from public.tenants t
       where lower(t.hostaway_client_id) = lower($1)
       limit 1`,
      [clientId],
    );

    return result.rowCount > 0 ? result.rows[0] : null;
  }

  async findTenantByHostawayAccountId(accountId: string): Promise<TenantSummary | null> {
    const result = await this.databaseService.runQuery<TenantSummary>(
      `select ${this.tenantSelectColumns()}
       from public.tenants t
       where t.hostaway_account_id = $1
       limit 1`,
      [accountId],
    );

    return result.rowCount > 0 ? result.rows[0] : null;
  }

  async updateTenantSubscription(
    tenantId: string,
    update: {
      status?: string;
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
    },
  ): Promise<void> {
    const { status, stripeCustomerId, stripeSubscriptionId } = update;
    await this.databaseService.runQuery(
      `update public.tenants
         set subscription_status = coalesce($2, subscription_status),
             stripe_customer_id = coalesce($3, stripe_customer_id),
             stripe_subscription_id = coalesce($4, stripe_subscription_id),
             updated_at = now()
       where id = $1`,
      [tenantId, status ?? null, stripeCustomerId ?? null, stripeSubscriptionId ?? null],
    );
  }

  async updateHostawayIntegration(
    tenantId: string,
    update: {
      clientId?: string;
      encryptedClientSecret?: string | null;
      encryptedAccessToken?: string | null;
      accountId?: string | null;
    },
  ): Promise<void> {
    const assignments: string[] = [];
    const values: unknown[] = [tenantId];
    let index = 2;

    if (update.clientId !== undefined) {
      assignments.push(`hostaway_client_id = $${index++}`);
      values.push(update.clientId);
    }

    if (update.encryptedClientSecret !== undefined) {
      assignments.push(`encrypted_hostaway_client_secret = $${index++}`);
      values.push(update.encryptedClientSecret);
    }

    if (update.encryptedAccessToken !== undefined) {
      assignments.push(`encrypted_hostaway_access_token = $${index++}`);
      values.push(update.encryptedAccessToken);
    }

    if (update.accountId !== undefined) {
      assignments.push(`hostaway_account_id = $${index++}`);
      values.push(update.accountId);
    }

    if (assignments.length === 0) {
      await this.databaseService.runQuery(
        `update public.tenants set updated_at = now() where id = $1`,
        [tenantId],
      );
      return;
    }

    const sql = `update public.tenants
        set ${assignments.join(', ')}, updated_at = now()
        where id = $1`;

    await this.databaseService.runQuery(sql, values);
  }

  async updateTwilioIntegration(
    tenantId: string,
    update: {
      accountSid?: string | null;
      encryptedAuthToken?: string | null;
      messagingServiceSid?: string | null;
      whatsappFrom?: string | null;
      voiceFrom?: string | null;
      staffWhatsappNumber?: string | null;
      onCallNumber?: string | null;
    },
  ): Promise<void> {
    const assignments: string[] = [];
    const values: unknown[] = [tenantId];
    let index = 2;

    if (update.accountSid !== undefined) {
      assignments.push(`twilio_account_sid = $${index++}`);
      values.push(update.accountSid);
    }

    if (update.encryptedAuthToken !== undefined) {
      assignments.push(`encrypted_twilio_auth_token = $${index++}`);
      values.push(update.encryptedAuthToken);
    }

    if (update.messagingServiceSid !== undefined) {
      assignments.push(`twilio_messaging_service_sid = $${index++}`);
      values.push(update.messagingServiceSid);
    }

    if (update.whatsappFrom !== undefined) {
      assignments.push(`twilio_whatsapp_from = $${index++}`);
      values.push(update.whatsappFrom);
    }

    if (update.voiceFrom !== undefined) {
      assignments.push(`twilio_voice_from = $${index++}`);
      values.push(update.voiceFrom);
    }

    if (update.staffWhatsappNumber !== undefined) {
      assignments.push(`twilio_staff_whatsapp_number = $${index++}`);
      values.push(update.staffWhatsappNumber);
    }

    if (update.onCallNumber !== undefined) {
      assignments.push(`twilio_on_call_number = $${index++}`);
      values.push(update.onCallNumber);
    }

    if (assignments.length === 0) {
      await this.databaseService.runQuery(
        `update public.tenants set updated_at = now() where id = $1`,
        [tenantId],
      );
      return;
    }

    const sql = `update public.tenants
        set ${assignments.join(', ')}, updated_at = now()
        where id = $1`;

    await this.databaseService.runQuery(sql, values);
  }

  private async fetchTenantById(client: PoolClient, tenantId: string): Promise<TenantRecord> {
    const result = await client.query<TenantRecord>(
      'select id, name, slug from public.tenants where id = $1',
      [tenantId],
    );

    if (result.rowCount === 0) {
      throw new InternalServerErrorException('Linked tenant not found');
    }

    return result.rows[0];
  }

  private async createTenantRecord(
    client: PoolClient,
    payload: CreateTenantOnSignupDto,
  ): Promise<TenantRecord> {
    const baseSlug = payload.tenantSlug ?? this.slugify(payload.tenantName);

    let attempts = 0;
    let slugCandidate = baseSlug;

    while (attempts < 5) {
      try {
        const result = await client.query<TenantRecord>(
          `insert into public.tenants (name, slug, contact_email, contact_phone)
           values ($1, $2, $3, $4)
           returning id, name, slug`,
          [
            payload.tenantName.trim(),
            slugCandidate,
            payload.contactEmail ?? null,
            payload.contactPhone ?? null,
          ],
        );

        return result.rows[0];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        // Check if transaction is aborted
        if (error?.code === '25P02') {
          // Transaction is aborted, can't continue
          throw error;
        }

        // Unique violation on slug, try a new candidate
        if ((error as { code?: string }).code === '23505') {
          attempts += 1;
          slugCandidate = `${baseSlug}-${this.randomSuffix()}`;
          continue;
        }

        throw error;
      }
    }

    throw new InternalServerErrorException('Unable to create tenant with unique slug');
  }

  private async linkUserToTenant(
    client: PoolClient,
    options: { userId: string; tenantId: string; displayName?: string },
  ): Promise<void> {
    try {
      // Try to insert/update user_profile directly
      // The foreign key constraint will enforce user existence
      await client.query(
        `insert into public.user_profiles (user_id, tenant_id, role, display_name, created_at, updated_at)
         values ($1, $2, 'client-tenant', $3, now(), now())
         on conflict (user_id) do update
           set tenant_id = excluded.tenant_id,
               display_name = coalesce(excluded.display_name, public.user_profiles.display_name),
               updated_at = now()`,
        [options.userId, options.tenantId, options.displayName ?? null],
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Check for foreign key violation
      if (error.code === '23503') {
        this.logger.error(
          `Foreign key violation: User ${options.userId} does not exist in auth.users`,
          error,
        );
        throw new Error(
          `Cannot create tenant: User account does not exist. Please ensure you are properly authenticated.`,
        );
      }
      throw error;
    }
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .replace(/-{2,}/g, '-')
      .substring(0, 48);
  }

  private randomSuffix(): string {
    return Math.random().toString(36).slice(2, 6);
  }

  private tenantSelectColumns(): string {
    return `t.id,
         t.name,
         t.slug,
         t.subscription_status as "subscriptionStatus",
         t.stripe_customer_id as "stripeCustomerId",
         t.stripe_subscription_id as "stripeSubscriptionId",
         t.hostaway_client_id as "hostawayClientId",
         t.hostaway_account_id as "hostawayAccountId",
         t.encrypted_hostaway_client_secret as "encryptedHostawayClientSecret",
         t.encrypted_hostaway_access_token as "encryptedHostawayAccessToken",
         t.twilio_account_sid as "twilioAccountSid",
         t.encrypted_twilio_auth_token as "encryptedTwilioAuthToken",
         t.twilio_messaging_service_sid as "twilioMessagingServiceSid",
         t.twilio_whatsapp_from as "twilioWhatsappFrom",
         t.twilio_voice_from as "twilioVoiceFrom",
         t.twilio_staff_whatsapp_number as "twilioStaffWhatsappNumber",
         t.twilio_on_call_number as "twilioOnCallNumber"`;
  }
}
