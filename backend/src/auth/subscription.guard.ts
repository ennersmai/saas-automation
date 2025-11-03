import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly tenantService: TenantService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if Stripe API key is present
    const stripeApiKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    // If Stripe key is NOT present, allow access (developer mode)
    if (!stripeApiKey) {
      return true;
    }

    // If Stripe key IS present, check subscription status
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('User ID not found in request');
    }

    try {
      const tenant = await this.tenantService.getTenantForUser(userId);

      if (tenant.subscriptionStatus !== 'active') {
        throw new ForbiddenException('Active subscription required');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('Unable to verify subscription status');
    }
  }
}
