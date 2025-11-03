export class TwilioIntegrationDto {
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string;
  whatsappFrom?: string;
  voiceFrom?: string;
  staffWhatsappNumber?: string;
  onCallNumber?: string;
}
