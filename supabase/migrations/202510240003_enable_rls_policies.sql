-- Migration: Enable RLS policies for multi-tenant isolation

create or replace function public.current_user_tenant_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select tenant_id
  from public.user_profiles
  where user_id = auth.uid()
  limit 1;
$$;

comment on function public.current_user_tenant_id is
  'Returns the tenant_id associated with the authenticated user (requires user_profiles row).';

grant execute on function public.current_user_tenant_id() to authenticated;

-- Tenants
alter table public.tenants enable row level security;

create policy tenants_select on public.tenants
  for select
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.tenant_id = tenants.id
    )
    or exists (
      select 1
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.role = 'super-admin'
    )
  );

create policy tenants_manage on public.tenants
  for all
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.role = 'super-admin'
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.role = 'super-admin'
    )
  );

-- User profiles
alter table public.user_profiles enable row level security;

create policy user_profiles_select_self on public.user_profiles
  for select
  using (user_id = auth.uid());

create policy user_profiles_update_self on public.user_profiles
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and tenant_id = public.current_user_tenant_id()
  );

create policy user_profiles_insert_self on public.user_profiles
  for insert
  with check (
    user_id = auth.uid()
    and tenant_id = public.current_user_tenant_id()
  );

-- Properties
alter table public.properties enable row level security;

create policy properties_access on public.properties
  for select using (tenant_id = public.current_user_tenant_id());

create policy properties_modify on public.properties
  for all
  using (tenant_id = public.current_user_tenant_id())
  with check (tenant_id = public.current_user_tenant_id());

-- Guests
alter table public.guests enable row level security;

create policy guests_access on public.guests
  for select using (tenant_id = public.current_user_tenant_id());

create policy guests_modify on public.guests
  for all
  using (tenant_id = public.current_user_tenant_id())
  with check (tenant_id = public.current_user_tenant_id());

-- Bookings
alter table public.bookings enable row level security;

create policy bookings_access on public.bookings
  for select using (tenant_id = public.current_user_tenant_id());

create policy bookings_modify on public.bookings
  for all
  using (tenant_id = public.current_user_tenant_id())
  with check (tenant_id = public.current_user_tenant_id());
