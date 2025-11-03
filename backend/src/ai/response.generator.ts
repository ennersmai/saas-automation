import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import { AiIntent } from './ai.types';
import { IntentData } from './data.retriever';

@Injectable()
export class ResponseGeneratorService {
  private readonly logger = new Logger(ResponseGeneratorService.name);
  private readonly openai: OpenAI | null;
  private readonly responseModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.responseModel =
      this.configService.get<string>('OPENAI_RESPONSE_MODEL') ?? 'gpt-4.1-2025-04-14';

    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY is not configured. Responses will use template fallbacks.');
      this.openai = null;
      return;
    }

    this.openai = new OpenAI({ apiKey });
  }

  async generateResponse(
    intent: AiIntent,
    tenantName: string,
    guestName: string | undefined,
    message: string,
    data: IntentData,
    conversationContext?: string,
  ): Promise<string> {
    if (!this.openai) {
      return this.templateFallback(intent, guestName, tenantName, data);
    }

    try {
      const prompt = this.buildPrompt(
        intent,
        tenantName,
        guestName,
        message,
        data,
        conversationContext,
      );
      const response = await this.openai.chat.completions.create({
        model: this.responseModel,
        messages: [
          {
            role: 'system',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      const output = response.choices[0]?.message?.content;
      if (!output) {
        throw new Error('No output from OpenAI');
      }

      return output.trim();
    } catch (error) {
      this.logger.error('Failed to generate AI response', error as Error);
      return this.templateFallback(intent, guestName, tenantName, data);
    }
  }

  private buildPrompt(
    intent: AiIntent,
    tenantName: string,
    guestName: string | undefined,
    message: string,
    data: IntentData,
    conversationContext?: string,
  ): string {
    // Log knowledge base entries being used
    if (data.knowledgeBaseEntries && data.knowledgeBaseEntries.length > 0) {
      this.logger.debug(
        `Using ${data.knowledgeBaseEntries.length} knowledge base entries for ${intent} intent`,
      );
    } else {
      this.logger.debug(`No knowledge base entries found for ${intent} intent`);
    }

    const kbText = (data.knowledgeBaseEntries ?? [])
      .map((entry) => `- ${entry.title ?? 'Info'}: ${entry.content}`)
      .join('\n');

    const contextSection = conversationContext
      ? `\n\nConversation context (recent messages for reference):${conversationContext}\n\nUse this context to understand what the guest is responding to. For example, if a guest says "yes please", check the conversation history to see what question they're answering.`
      : '';

    return `You are the AI concierge for ${tenantName}. Respond to the guest in a friendly, concise tone.
Guest name: ${guestName ?? 'Guest'}
Intent: ${intent}
Guest message: ${message}${contextSection}
Reservation data: ${JSON.stringify(data.reservation ?? {}, null, 2)}
Listing data: ${JSON.stringify(data.listing ?? {}, null, 2)}
Knowledge base snippets:
${kbText || 'None'}

Compose a clear response tailored to the guest. If the guest's message seems like a response (e.g., "yes please", "sounds good"), use the conversation context to understand what they're responding to.`;
  }

  private templateFallback(
    intent: AiIntent,
    guestName: string | undefined,
    tenantName: string,
    data: IntentData,
  ): string {
    const name = guestName ?? 'there';

    switch (intent) {
      case 'check_in_info': {
        const doorCode = this.readString(data.reservation, 'doorCode', 'door_code');
        return `Hi ${name}! Check-in details for ${tenantName}: your door code is ${
          doorCode ?? 'available in your guest portal'
        }. Let us know if you need anything else!`;
      }
      case 'check_out_info':
        return `Hi ${name}! Checkout is by ${
          this.readString(data.reservation, 'checkoutTime', 'checkOut', 'check_out') ?? '11:00 AM'
        }. Please leave the keys on the kitchen counter. Safe travels!`;
      case 'emergency':
        return `Hi ${name}, we're alerting our on-call team now. If you're in immediate danger, dial emergency services.`;
      case 'support_request':
        return `Hi ${name}, thanks for letting us know. Our support team is reviewing your message and will follow up shortly.`;
      case 'general_info':
        return `Hi ${name}! Here's what I found:
${
  (data.knowledgeBaseEntries ?? [])
    .map((entry) => `- ${entry.title ?? 'Info'}: ${entry.content.slice(0, 200)}`)
    .join('\n') || 'I will follow up with more details soon.'
}`;
      default:
        return `Hi ${name}, thanks for reaching out. We'll review your message and get back to you shortly.`;
    }
  }

  private readString(
    source: Record<string, unknown> | null | undefined,
    ...paths: string[]
  ): string | undefined {
    if (!source) {
      return undefined;
    }

    for (const path of paths) {
      const value = this.resolvePath(source, path);
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
