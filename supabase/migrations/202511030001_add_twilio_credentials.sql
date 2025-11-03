-- Migration: Add Twilio credential storage to tenants table

alter table public.tenants
  add column if not exists twilio_account_sid text,
  add column if not exists encrypted_twilio_auth_token text,
  add column if not exists twilio_messaging_service_sid text,
  add column if not exists twilio_whatsapp_from text,
  add column if not exists twilio_voice_from text,
  add column if not exists twilio_staff_whatsapp_number text,
  add column if not exists twilio_on_call_number text;

create index if not exists idx_tenants_twilio_account_sid on public.tenants (lower(twilio_account_sid));

