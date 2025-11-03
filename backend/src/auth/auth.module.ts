import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { SupabaseStrategy } from './supabase.strategy';

@Module({
  imports: [
    PassportModule,
    ConfigModule,
    JwtModule.register({}), // Empty config since we're using Supabase JWT
  ],
  controllers: [AuthController],
  providers: [SupabaseStrategy],
  exports: [SupabaseStrategy, PassportModule],
})
export class AuthModule {}
