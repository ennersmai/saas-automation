-- Migration: Enable RLS and tenant-isolated policies for conversations

alter table public.conversations
  enable row level security;

alter table public.conversation_logs
  enable row level security;

drop policy if exists conversations_tenant_isolation on public.conversations;

create policy conversations_tenant_isolation on public.conversations
  for all
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.tenant_id = public.conversations.tenant_id
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.tenant_id = public.conversations.tenant_id
    )
  );

drop policy if exists conversation_logs_access on public.conversation_logs;
drop policy if exists conversation_logs_modify on public.conversation_logs;
drop policy if exists conversation_logs_tenant_isolation on public.conversation_logs;

create policy conversation_logs_tenant_isolation on public.conversation_logs
  for all
  using (
    exists (
      select 1
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.tenant_id = public.conversation_logs.tenant_id
    )
  )
  with check (
    exists (
      select 1
      from public.user_profiles up
      where up.user_id = auth.uid()
        and up.tenant_id = public.conversation_logs.tenant_id
    )
  );
