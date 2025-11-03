import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

import { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { BillingService } from './billing.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('billing/create-checkout-session')
  @UseGuards(AuthGuard('supabase'))
  async createCheckoutSession(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateCheckoutSessionDto,
  ) {
    if (!req.user?.userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }

    const session = await this.billingService.createCheckoutSession(
      req.user.userId,
      req.user.email,
      body,
    );

    return {
      checkoutUrl: session.checkoutUrl,
      sessionId: session.sessionId,
    };
  }

  @Post('webhooks/stripe')
  @HttpCode(200)
  async handleStripeWebhook(@Req() req: StripeWebhookRequest) {
    const signature = req.headers['stripe-signature'];
    const rawBody = req.rawBody;

    if (!rawBody) {
      throw new BadRequestException('Missing raw request body for Stripe webhook');
    }

    await this.billingService.handleWebhook(rawBody, signature);

    return { received: true };
  }
}
type StripeWebhookRequest = Request & { rawBody: Buffer };
