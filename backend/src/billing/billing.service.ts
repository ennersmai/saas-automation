import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { TenantService } from '../tenant/tenant.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@Injectable()
export class BillingService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly tenantService: TenantService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!stripeSecretKey) {
      this.logger.warn('STRIPE_SECRET_KEY is not configured - running in developer mode');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.stripe = null as any; // We'll handle this in the methods
      return;
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
    });
  }

  async createCheckoutSession(
    userId: string,
    userEmail: string | undefined,
    payload: CreateCheckoutSessionDto,
  ): Promise<{ checkoutUrl: string; sessionId: string }> {
    // If Stripe is not configured, return a mock success URL for developer mode
    if (!this.stripe) {
      this.logger.log('Developer mode: Skipping Stripe checkout session creation');
      const tenant = await this.tenantService.getTenantForUser(userId);

      // Mark subscription as active in developer mode
      await this.tenantService.updateTenantSubscription(tenant.id, {
        status: 'active',
      });

      return {
        checkoutUrl: payload.successUrl || '/subscribe-success',
        sessionId: 'dev-session-' + Date.now(),
      };
    }

    if (!payload.successUrl || !payload.cancelUrl) {
      throw new BadRequestException('successUrl and cancelUrl are required');
    }

    const priceId = payload.priceId ?? this.configService.get<string>('STRIPE_PRICE_ID');
    if (!priceId) {
      throw new BadRequestException('Stripe price id is not configured');
    }

    const tenant = await this.tenantService.getTenantForUser(userId);

    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        success_url: payload.successUrl,
        cancel_url: payload.cancelUrl,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        customer_email: payload.customerEmail ?? userEmail,
        metadata: {
          tenantId: tenant.id,
          userId,
        },
      });

      if (tenant.subscriptionStatus !== 'active') {
        await this.tenantService.updateTenantSubscription(tenant.id, {
          status: 'pending',
        });
      }

      if (!session.url || !session.id) {
        throw new InternalServerErrorException('Stripe did not return a checkout URL');
      }

      return {
        checkoutUrl: session.url,
        sessionId: session.id,
      };
    } catch (error) {
      this.logger.error('Stripe checkout session creation failed', error as Error);
      throw new InternalServerErrorException('Unable to create Stripe checkout session');
    }
  }

  async handleWebhook(rawBody: Buffer, signature: string | string[] | undefined): Promise<void> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    if (!signature || Array.isArray(signature)) {
      throw new BadRequestException('Stripe signature header is missing or invalid');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      this.logger.warn('Stripe webhook verification failed', error as Error);
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;

      if (!tenantId) {
        this.logger.warn('Checkout session completed without tenant metadata', session.id);
        return;
      }

      await this.tenantService.updateTenantSubscription(tenantId, {
        status: 'active',
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
        stripeSubscriptionId:
          typeof session.subscription === 'string' ? session.subscription : undefined,
      });
    } else {
      this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
    }
  }
}
