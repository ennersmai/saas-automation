-- Migration: Create application-specific tables for conversations and knowledge base

-- Ensure pgvector extension is available in extensions schema
create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create table if not exists public.conversation_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  direction text not null check (direction in ('guest', 'ai', 'staff')),
  message_body text not null,
  metadata jsonb default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_conversation_logs_tenant on public.conversation_logs (tenant_id);
create index if not exists idx_conversation_logs_booking on public.conversation_logs (booking_id);
create index if not exists idx_conversation_logs_sent_at on public.conversation_logs (sent_at);

create table if not exists public.knowledge_base_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  title text,
  content text not null,
  embedding extensions.vector(1536),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_kb_documents_tenant on public.knowledge_base_documents (tenant_id);
create index if not exists idx_kb_documents_title on public.knowledge_base_documents (title);

-- Optional vector similarity index; ensure pgvector configured with ivfflat
create index if not exists idx_kb_documents_embedding on public.knowledge_base_documents
  using ivfflat (embedding extensions.vector_l2_ops)
  with (lists = 100);

comment on table public.conversation_logs is 'Message transcripts exchanged between guests, AI agent, and staff.';
comment on table public.knowledge_base_documents is 'Documents and embeddings powering RAG retrieval for each tenant.';

-- Row Level Security for application tables
alter table public.conversation_logs enable row level security;

create policy conversation_logs_access on public.conversation_logs
  for select using (tenant_id = public.current_user_tenant_id());

create policy conversation_logs_modify on public.conversation_logs
  for all
  using (tenant_id = public.current_user_tenant_id())
  with check (tenant_id = public.current_user_tenant_id());

alter table public.knowledge_base_documents enable row level security;

create policy kb_documents_access on public.knowledge_base_documents
  for select using (tenant_id = public.current_user_tenant_id());

create policy kb_documents_modify on public.knowledge_base_documents
  for all
  using (tenant_id = public.current_user_tenant_id())
  with check (tenant_id = public.current_user_tenant_id());

