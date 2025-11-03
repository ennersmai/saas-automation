export type AiIntent =
  | 'emergency'
  | 'check_in_info'
  | 'check_out_info'
  | 'general_info'
  | 'support_request'
  | 'unknown';

export interface IntentClassification {
  intent: AiIntent;
  confidence: number;
  reason?: string;
}

export interface GuestContext {
  id?: string;
  name?: string;
  phone?: string;
  reservationId?: string;
  rawPayload?: Record<string, unknown>;
  guestMessageLogId?: string; // ID of the logged guest message for AI reply deduplication
}
