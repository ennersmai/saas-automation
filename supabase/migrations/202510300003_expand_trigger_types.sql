-- Expand allowed trigger types to include new events

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
    'post_booking_followup',
    'pre_checkout_evening',
    'message_received_keyword',
    'host_message_reply',
    'custom_hostaway'
  ));


