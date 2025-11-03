import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from 'jsonwebtoken';
import { Pool } from 'pg';

export interface SupabaseJwtPayload extends JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  user_role?: string;
  app_metadata?: {
    [key: string]: unknown;
  };
  user_metadata?: {
    [key: string]: unknown;
  };
}

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, 'supabase') {
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const supabaseJwtSecret = configService.get<string>('SUPABASE_JWT_SECRET');

    if (!supabaseJwtSecret) {
      console.error('SUPABASE_JWT_SECRET is not configured');
      throw new Error('SUPABASE_JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: supabaseJwtSecret,
      algorithms: ['HS256'], // Add explicit algorithm
    });

    // Initialize database pool after super()
    const connectionString = configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for SupabaseStrategy');
    }
    this.pool = new Pool({ connectionString });
  }

  async validate(payload: SupabaseJwtPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid Supabase token payload');
    }

    // Get tenant ID from user metadata or payload first
    let tenantId = payload.user_metadata?.tenant_id || payload.app_metadata?.tenant_id;

    // If not found in JWT, look it up in the database
    if (!tenantId) {
      try {
        const client = await this.pool.connect();
        try {
          const result = await client.query(
            'SELECT tenant_id FROM public.user_profiles WHERE user_id = $1',
            [payload.sub],
          );
          if (result.rows.length > 0) {
            tenantId = result.rows[0].tenant_id;
          }
        } finally {
          client.release();
        }
      } catch {
        // Silently handle database lookup errors
      }
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role ?? payload.user_role,
      tenantId,
      payload,
    };
  }
}
