-- Migration: extend conversation_logs for unified messaging pipeline

alter table if exists public.conversation_logs
  add column if not exists conversation_id uuid references public.conversations (id) on delete cascade;

alter table if exists public.conversation_logs
  add column if not exists sender_type text default 'system';

update public.conversation_logs
   set sender_type = case direction
       when 'guest' then 'guest'
       when 'staff' then 'human'
       when 'ai' then 'ai'
       else 'system'
     end
 where sender_type is null;

alter table if exists public.conversation_logs
  alter column sender_type set not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'conversation_logs_sender_type_check'
  ) then
    alter table public.conversation_logs
      add constraint conversation_logs_sender_type_check
        check (sender_type in ('guest', 'human', 'ai', 'system'));
  end if;
end
$$;

alter table if exists public.conversation_logs
  add column if not exists status text default 'sent';

update public.conversation_logs
   set status = 'sent'
 where status is null;

alter table if exists public.conversation_logs
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'conversation_logs_status_check'
  ) then
    alter table public.conversation_logs
      add constraint conversation_logs_status_check
        check (status in ('pending', 'processing', 'sent', 'failed'));
  end if;
end
$$;

alter table if exists public.conversation_logs
  add column if not exists scheduled_send_at timestamptz;

alter table if exists public.conversation_logs
  add column if not exists actual_sent_at timestamptz;

update public.conversation_logs
   set actual_sent_at = coalesce(actual_sent_at, sent_at)
 where actual_sent_at is null;

alter table if exists public.conversation_logs
  add column if not exists updated_at timestamptz default now();

update public.conversation_logs
   set updated_at = coalesce(updated_at, now())
 where updated_at is null;

alter table if exists public.conversation_logs
  alter column updated_at set not null;

alter table if exists public.conversation_logs
  add column if not exists error_message text;

-- Ensure booking_id exists for environments missing the original column
alter table if exists public.conversation_logs
  add column if not exists booking_id uuid;

-- Optional index for booking_id lookups
create index if not exists idx_conversation_logs_booking on public.conversation_logs (booking_id);

-- Backfill conversation_id from existing booking linkage when absent
update public.conversation_logs cl
   set conversation_id = c.id
  from public.conversations c
 where cl.conversation_id is null
   and c.tenant_id = cl.tenant_id
   and c.booking_id = cl.booking_id;

create index if not exists idx_conversation_logs_conversation on public.conversation_logs (conversation_id);
create index if not exists idx_conversation_logs_status_schedule on public.conversation_logs (status, scheduled_send_at);
create index if not exists idx_conversation_logs_sender_type on public.conversation_logs (sender_type);

comment on column public.conversation_logs.sender_type is 'Originator of the message: guest, human, ai, or system.';
comment on column public.conversation_logs.status is 'Delivery status for proactive messages.';
comment on column public.conversation_logs.scheduled_send_at is 'Intended send time for pending outbound messages.';
comment on column public.conversation_logs.actual_sent_at is 'Timestamp when the outbound message was actually delivered.';

