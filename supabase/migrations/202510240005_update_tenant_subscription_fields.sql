-- Migration: Add subscription tracking columns to tenants

alter table public.tenants
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create index if not exists idx_tenants_subscription_status on public.tenants (subscription_status);
