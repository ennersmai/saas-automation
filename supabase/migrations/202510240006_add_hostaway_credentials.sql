-- Migration: Add Hostaway credential storage to tenants table

alter table public.tenants
  add column if not exists hostaway_client_id text,
  add column if not exists encrypted_hostaway_client_secret text,
  add column if not exists encrypted_hostaway_access_token text;

create index if not exists idx_tenants_hostaway_client on public.tenants (lower(hostaway_client_id));

