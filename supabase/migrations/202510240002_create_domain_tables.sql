-- Migration: Create properties, guests, and bookings tables linked to tenants

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  external_id text,
  timezone text default 'UTC',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_external_tenant_unique unique (tenant_id, external_id)
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  full_name text not null,
  email text,
  phone_number text,
  external_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guests_external_tenant_unique unique (tenant_id, external_id)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  guest_id uuid not null references public.guests (id) on delete restrict,
  external_id text,
  status text not null default 'pending',
  channel text,
  check_in_at timestamptz,
  check_out_at timestamptz,
  nightly_rate_cents integer,
  currency_code char(3),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_external_tenant_unique unique (tenant_id, external_id)
);

create index if not exists idx_properties_tenant on public.properties (tenant_id);
create index if not exists idx_properties_external on public.properties (external_id);

create index if not exists idx_guests_tenant on public.guests (tenant_id);
create index if not exists idx_guests_external on public.guests (external_id);

create index if not exists idx_bookings_tenant on public.bookings (tenant_id);
create index if not exists idx_bookings_property on public.bookings (property_id);
create index if not exists idx_bookings_guest on public.bookings (guest_id);

comment on table public.properties is 'Portfolio of properties under management for each tenant.';
comment on table public.guests is 'Guest directory scoped to a tenant.';
comment on table public.bookings is 'Booking records sourced from PMS integrations (e.g., Hostaway).';

