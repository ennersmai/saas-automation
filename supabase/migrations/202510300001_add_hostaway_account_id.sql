-- Add Hostaway account id to tenants for webhook identification

alter table if exists public.tenants
  add column if not exists hostaway_account_id text;

create index if not exists idx_tenants_hostaway_account_id on public.tenants (hostaway_account_id);


