-- Migration: Create message templates table for customizable automated messages

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  trigger_type text not null check (trigger_type in (
    'thank_you_immediate',
    'pre_arrival_24h', 
    'door_code_3h',
    'same_day_checkin',
    'checkout_morning'
  )),
  name text not null,
  template_body text not null,
  enabled boolean not null default true,
  variables jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_templates_tenant_trigger_unique unique (tenant_id, trigger_type)
);

create index if not exists idx_message_templates_tenant on public.message_templates (tenant_id);
create index if not exists idx_message_templates_trigger on public.message_templates (trigger_type);
create index if not exists idx_message_templates_enabled on public.message_templates (enabled);

comment on table public.message_templates is 'Customizable message templates for automated guest communications';
comment on column public.message_templates.trigger_type is 'Type of automated message trigger (thank_you_immediate, pre_arrival_24h, etc.)';
comment on column public.message_templates.template_body is 'Template content with {{variableName}} placeholders';
comment on column public.message_templates.variables is 'Available variables for this template type';

-- Enable RLS
alter table public.message_templates enable row level security;

-- RLS Policy: Users can only access templates for their tenant
create policy message_templates_tenant_isolation on public.message_templates
  for all using (
    tenant_id in (
      select up.tenant_id 
      from public.user_profiles up 
      where up.user_id = auth.uid()
    )
  );

-- Insert default templates for each tenant
-- This will be handled by the application when a tenant is created
-- Default templates are defined in the templates service

-- Function to create default templates for a new tenant
create or replace function create_default_message_templates(tenant_uuid uuid)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.message_templates (tenant_id, trigger_type, name, template_body, enabled) values
  (tenant_uuid, 'thank_you_immediate', 'Booking Confirmation', 
   'Hi {{guestName}}, thanks for booking {{propertyName}}! We''re excited to host you.', true),
  
  (tenant_uuid, 'pre_arrival_24h', '24h Pre-Arrival Instructions',
   'Hi {{guestName}}, your stay at {{propertyName}} is 24 hours away. Let us know if you need anything before arrival.', true),
   
  (tenant_uuid, 'door_code_3h', '3h Pre-Check-in Door Code',
   'Hi {{guestName}}, here is your door code for {{propertyName}}: {{doorCode}}. Safe travels!', true),
   
  (tenant_uuid, 'same_day_checkin', 'Same-Day Booking Instant Code',
   'Welcome {{guestName}}! Check-in for {{propertyName}} is available now. Wi-Fi: {{wifiName}} / {{wifiPassword}}. Enjoy your stay!', true),
   
  (tenant_uuid, 'checkout_morning', 'Checkout Morning Reminder',
   'Good morning {{guestName}}! Wishing you a smooth checkout today. Let us know if you need a late checkout.', true)
  on conflict (tenant_id, trigger_type) do nothing;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function create_default_message_templates(uuid) to authenticated;
