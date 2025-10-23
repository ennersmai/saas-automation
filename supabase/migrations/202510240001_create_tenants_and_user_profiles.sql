-- Migration: Create tenants and user_profiles tables
-- Dependencies: Supabase auth schema (auth.users), user_role enum

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  role user_role not null default 'client-tenant',
  display_name text,
  job_title text,
  phone_number text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_tenant_unique unique (tenant_id, user_id)
);

create index if not exists idx_user_profiles_tenant on public.user_profiles (tenant_id);

comment on table public.tenants is 'Top-level account representing a client company in the platform.';
comment on table public.user_profiles is 'Extends auth.users with tenant membership and authorization metadata.';

comment on column public.user_profiles.role is 'Authorization role for the user within their tenant.';
comment on column public.user_profiles.tenant_id is 'Tenant association for the user profile.';
