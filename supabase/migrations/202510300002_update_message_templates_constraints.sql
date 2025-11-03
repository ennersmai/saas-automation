-- Allow importing custom Hostaway templates and multiple entries per tenant

alter table if exists public.message_templates
  drop constraint if exists message_templates_trigger_type_check;

alter table if exists public.message_templates
  add constraint message_templates_trigger_type_check
  check (trigger_type in (
    'thank_you_immediate',
    'pre_arrival_24h',
    'door_code_3h',
    'same_day_checkin',
    'checkout_morning',
    'custom_hostaway'
  ));

-- Relax uniqueness to allow multiple custom_hostaway templates distinguished by name
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints 
    where table_schema = 'public' and table_name = 'message_templates' and constraint_type = 'UNIQUE'
  ) then
    -- try dropping old unique constraints that only cover (tenant_id, trigger_type)
    begin
      alter table public.message_templates drop constraint if exists message_templates_tenant_trigger_unique;
    exception when others then
      -- ignore if named differently
      null;
    end;
  end if;
end $$;

-- Create a consistent unique constraint
alter table public.message_templates
  add constraint message_templates_tenant_trigger_name_unique
  unique (tenant_id, trigger_type, name);


