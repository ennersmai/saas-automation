import { Body, Controller, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { CreateTenantOnSignupDto } from './dto/create-tenant-on-signup.dto';
import { TenantService } from './tenant.service';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post('create-on-signup')
  @UseGuards(AuthGuard('supabase'))
  async createOnSignup(@Req() req: AuthenticatedRequest, @Body() body: CreateTenantOnSignupDto) {
    const userId = req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('Authenticated user id is missing');
    }

    try {
      const result = await this.tenantService.createTenantOnSignup(userId, body);

      return {
        tenantId: result.tenant.id,
        tenantName: result.tenant.name,
        tenantSlug: result.tenant.slug,
        alreadyLinked: result.alreadyLinked,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Log the actual error for debugging
      console.error('Tenant creation error details:', {
        userId,
        errorMessage: error.message,
        errorCode: error.code,
        errorStack: error.stack,
        body,
      });
      throw error;
    }
  }
}
