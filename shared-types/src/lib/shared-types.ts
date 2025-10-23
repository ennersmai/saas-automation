export type UserRole = 'super-admin' | 'client-tenant';

export interface TenantContext {
  tenantId: string;
  accountId: string;
  companyName: string;
  role: UserRole;
}

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string;
}

export interface HostawayCredentials {
  apiToken: string;
  accountId: string;
}

export interface OpenAiConfig {
  apiKey: string;
  defaultModel: string;
  temperature?: number;
}

export interface IntegrationSettings {
  hostaway?: HostawayCredentials;
  twilio?: TwilioCredentials;
  openAi?: OpenAiConfig;
  stripeCustomerId?: string;
}

export interface EscalationSettings {
  staffWhatsappNumber: string;
  onCallNumber?: string;
}

export const SCHEDULED_MESSAGE_TRIGGERS = [
  'booking-confirmation',
  'pre-arrival-24h',
  'pre-arrival-3h',
  'same-day-instant',
  'post-booking-thanks',
  'checkout-morning',
] as const;

export type ScheduledMessageTrigger = (typeof SCHEDULED_MESSAGE_TRIGGERS)[number];

export interface MessageTemplateDefinition {
  id: string;
  trigger: ScheduledMessageTrigger;
  name: string;
  body: string;
  enabled: boolean;
  offsetMinutes?: number;
  channel: 'twilio' | 'hostaway';
}

export interface BookingContext {
  bookingId: string;
  propertyId: string;
  guestName: string;
  guestPhone?: string;
  arrivalDate: string;
  departureDate: string;
  channel: 'whatsapp' | 'sms' | 'hostaway';
}

export const DEFAULT_TENANT_CONTEXT: TenantContext = {
  tenantId: '',
  accountId: '',
  companyName: '',
  role: 'client-tenant',
};
