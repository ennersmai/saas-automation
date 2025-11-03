import { Injectable, Logger } from '@nestjs/common';

import { HostawayClient } from '../integrations/hostaway.client';
import { ConversationRecord, ConversationsService } from '../conversations/conversations.service';
import { TenantSummary } from '../tenant/tenant.service';
import { GuestContext } from './ai.types';
import { DataRetrieverService } from './data.retriever';
import { EscalationService } from './escalation.service';
import { IntentService } from './intent.service';
import { ResponseGeneratorService } from './response.generator';

interface AiResponsePayload {
  message: string;
  logId: string;
}

@Injectable()
export class AiEngineService {
  private readonly logger = new Logger(AiEngineService.name);

  constructor(
    private readonly intentService: IntentService,
    private readonly dataRetriever: DataRetrieverService,
    private readonly conversationsService: ConversationsService,
    private readonly responseGenerator: ResponseGeneratorService,
    private readonly escalationService: EscalationService,
    private readonly hostawayClient: HostawayClient,
  ) {}

  async processMessage(
    tenant: TenantSummary,
    conversation: ConversationRecord,
    guest: GuestContext,
    message: string,
  ): Promise<AiResponsePayload | null> {
    if (conversation.status === 'paused_by_human') {
      this.logger.debug('Conversation is paused by a human agent; skipping AI response.');
      return null;
    }

    // Get conversation history for context
    const history = await this.conversationsService.getConversationHistoryForAi(
      conversation.id,
      10,
    );

    // Build context string from recent messages
    let conversationContext = '';
    if (history.length > 0) {
      const recentMessages = history
        .slice(-5) // Last 5 messages for context
        .map((msg) => {
          const sender = msg.isIncoming ? 'Guest' : 'Host';
          const timestamp = msg.sentDate ? ` (${msg.sentDate.toLocaleString()})` : '';
          return `${sender}${timestamp}: ${msg.body}`;
        })
        .join('\n');

      conversationContext = `\n\nRecent conversation history:\n${recentMessages}`;
    }

    // Include context in message for classification
    const messageWithContext = conversationContext ? `${message}${conversationContext}` : message;

    const classification = await this.intentService.classify(messageWithContext);
    this.logger.debug(
      `Intent classified as ${
        classification.intent
      } (confidence ${classification.confidence.toFixed(2)}) for tenant ${tenant.id}`,
    );

    let reply: string | null = null;

    if (classification.intent === 'emergency') {
      await this.escalationService.triggerEmergencyCall(tenant, guest, message);
      reply = `Hi ${
        guest.name ?? 'there'
      }, we've alerted our emergency response team and will reach out immediately.`;
    } else if (classification.confidence < 0.45) {
      await this.escalationService.notifyLowConfidence(
        tenant,
        guest,
        message,
        classification.intent,
      );
      reply = `Thanks for your message! I'm looping in our team to make sure we give you the best answer shortly.`;
    } else {
      const reservationId = guest.reservationId ?? this.extractReservationId(guest);
      const data = await this.dataRetriever.retrieveData(classification.intent, tenant, {
        reservationId,
        message,
        topicKeywords: this.extractKeywords(message),
      });

      if (!data.reservation && reservationId) {
        try {
          data.reservation = await this.hostawayClient.getReservation(tenant, reservationId);
        } catch (error) {
          this.logger.warn(
            `Failed to pull reservation ${reservationId} for AI response: ${
              (error as Error).message
            }`,
          );
        }
      }

      reply = await this.responseGenerator.generateResponse(
        classification.intent,
        tenant.name,
        guest.name,
        message,
        data,
        conversationContext, // Pass conversation context for better understanding
      );
    }

    if (!reply) {
      return null;
    }

    const logId = await this.conversationsService.createPendingAiReply(conversation, reply, {
      intent: classification.intent,
      confidence: classification.confidence,
      reservationId: guest.reservationId ?? null,
    });

    return { message: reply, logId };
  }

  private extractKeywords(message: string): string[] {
    return message
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 3)
      .slice(0, 5);
  }

  private extractReservationId(guest: GuestContext): string | undefined {
    const raw = guest.rawPayload;
    if (!raw) {
      return undefined;
    }

    const candidates = [
      'reservationId',
      'reservation_id',
      'reservation.id',
      'thread.reservationId',
    ];
    for (const path of candidates) {
      const value = this.resolvePath(raw, path);
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }

    return undefined;
  }

  private resolvePath(source: Record<string, unknown>, path: string): unknown {
    const segments = path.split('.');
    let current: unknown = source;

    for (const segment of segments) {
      if (!current || typeof current !== 'object') {
        return undefined;
      }

      current = (current as Record<string, unknown>)[segment];
    }

    return current;
  }
}
