-- Migration: Create conversations table and refactor conversation logs

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  status text not null default 'automated' check (status in ('automated', 'paused_by_human')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, booking_id)
);

create index if not exists idx_conversations_tenant on public.conversations (tenant_id);
create index if not exists idx_conversations_booking on public.conversations (booking_id);

-- Adjust conversation logs to reference conversations
drop policy if exists conversation_logs_access on public.conversation_logs;
drop policy if exists conversation_logs_modify on public.conversation_logs;

alter table public.conversation_logs add column conversation_id uuid;

with existing_conversations as (
  insert into public.conversations (tenant_id, booking_id)
  select cl.tenant_id, cl.booking_id
  from public.conversation_logs cl
  group by cl.tenant_id, cl.booking_id
  on conflict (tenant_id, booking_id) do nothing
  returning id, tenant_id, booking_id
),
all_conversations as (
  select id, tenant_id, booking_id from public.conversations
)
update public.conversation_logs cl
set conversation_id = ac.id
from all_conversations ac
where cl.tenant_id = ac.tenant_id and cl.booking_id = ac.booking_id;

alter table public.conversation_logs
  alter column conversation_id set not null;

alter table public.conversation_logs
  drop constraint if exists conversation_logs_direction_check;

alter table public.conversation_logs
  add constraint conversation_logs_direction_check
    check (direction in ('guest', 'ai', 'staff'));

alter table public.conversation_logs
  drop column booking_id;

create index if not exists idx_conversation_logs_conversation on public.conversation_logs (conversation_id);

alter table public.conversation_logs enable row level security;

create policy conversation_logs_access on public.conversation_logs
  for select using (
    exists (
      select 1
      from public.conversations c
      where c.id = public.conversation_logs.conversation_id
        and c.tenant_id = public.current_user_tenant_id()
    )
  );

create policy conversation_logs_modify on public.conversation_logs
  for all using (
    exists (
      select 1
      from public.conversations c
      where c.id = public.conversation_logs.conversation_id
        and c.tenant_id = public.current_user_tenant_id()
    )
  )
  with check (
    exists (
      select 1
      from public.conversations c
      where c.id = public.conversation_logs.conversation_id
        and c.tenant_id = public.current_user_tenant_id()
    )
  );

comment on table public.conversations is 'Tracks the automation state for each booking conversation.';
