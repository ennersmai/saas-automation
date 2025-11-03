-- Fix create_default_message_templates function to use correct ON CONFLICT clause
-- The unique constraint is now (tenant_id, trigger_type, name), not (tenant_id, trigger_type)

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
  on conflict (tenant_id, trigger_type, name) do nothing;
end;
$$;

