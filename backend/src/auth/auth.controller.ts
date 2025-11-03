import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Pool } from 'pg';

import { AuthenticatedRequest } from './authenticated-request.interface';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    if (connectionString) {
      this.pool = new Pool({ connectionString });
    }
  }

  @Get('me')
  @UseGuards(AuthGuard('supabase'))
  async getMe(@Req() req: AuthenticatedRequest) {
    if (!req.user?.userId) {
      return { user: null };
    }

    let tenantName: string | null = null;

    // Fetch tenant name from user_profiles if tenantId is available
    // tenantId should be set by SupabaseStrategy from user_profiles lookup
    if (req.user.tenantId && this.pool) {
      try {
        const client = await this.pool.connect();
        try {
          const result = await client.query('SELECT name FROM public.tenants WHERE id = $1', [
            req.user.tenantId,
          ]);
          if (result.rows.length > 0) {
            tenantName = result.rows[0].name;
          }
        } finally {
          client.release();
        }
      } catch {
        // Silently handle errors - tenant name is optional
      }
    } else if (this.pool) {
      // If tenantId is not in JWT, try to fetch it directly from user_profiles
      // This handles cases where tenant was just created but JWT hasn't been refreshed
      try {
        const client = await this.pool.connect();
        try {
          const result = await client.query<{ tenant_id: string; name: string }>(
            `SELECT t.id as tenant_id, t.name 
             FROM public.user_profiles up
             JOIN public.tenants t ON t.id = up.tenant_id
             WHERE up.user_id = $1
             LIMIT 1`,
            [req.user.userId],
          );
          if (result.rows.length > 0) {
            tenantName = result.rows[0].name;
            // Update req.user.tenantId for consistency
            req.user.tenantId = result.rows[0].tenant_id;
          }
        } finally {
          client.release();
        }
      } catch {
        // Silently handle errors - tenant name is optional
      }
    }

    return {
      user: {
        id: req.user.userId,
        email: req.user.email,
        role: req.user.role,
        tenantName,
      },
    };
  }
}
