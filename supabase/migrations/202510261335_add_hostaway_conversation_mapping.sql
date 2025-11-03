-- Migration: add Hostaway conversation references to conversations table

alter table if exists public.conversations
  add column if not exists hostaway_conversation_id text;

create index if not exists idx_conversations_hostaway
  on public.conversations (hostaway_conversation_id)
  where hostaway_conversation_id is not null;

comment on column public.conversations.hostaway_conversation_id is 'External Hostaway conversation identifier used for messaging.';
