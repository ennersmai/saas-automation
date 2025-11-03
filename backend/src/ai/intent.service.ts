import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import { AiIntent, IntentClassification } from './ai.types';

const INTENT_LABELS: AiIntent[] = [
  'emergency',
  'check_in_info',
  'check_out_info',
  'general_info',
  'support_request',
  'unknown',
];

@Injectable()
export class IntentService {
  private readonly logger = new Logger(IntentService.name);
  private readonly openai: OpenAI | null;
  private readonly intentModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.intentModel =
      this.configService.get<string>('OPENAI_INTENT_MODEL') ?? 'gpt-4.1-2025-04-14';

    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY is not configured. Falling back to keyword intent detection.',
      );
      this.openai = null;
      return;
    }

    this.openai = new OpenAI({ apiKey });
  }

  async classify(message: string): Promise<IntentClassification> {
    if (!message?.trim()) {
      return { intent: 'unknown', confidence: 0, reason: 'Empty message' };
    }

    if (!this.openai) {
      return this.keywordFallback(message);
    }

    try {
      const prompt =
        `You are an intent classification system for a hospitality guest messaging platform.` +
        ` Classify the guest's message into one of the following intents: ${INTENT_LABELS.join(
          ', ',
        )}.` +
        ` Also provide a confidence score between 0 and 1.` +
        `\nGuest message: "${message}"\n` +
        `Return a JSON object with keys intent, confidence, and an optional reason.`;

      const response = await this.openai.chat.completions.create({
        model: this.intentModel,
        messages: [
          {
            role: 'system',
            content: prompt,
          },
        ],
        temperature: 0,
        max_tokens: 200,
      });

      const output = response.choices[0]?.message?.content;
      if (!output) {
        throw new Error('No output from OpenAI');
      }

      // Extract JSON from potentially markdown-wrapped response
      const jsonText = this.extractJsonFromMarkdown(output.trim());
      const parsed = JSON.parse(jsonText);
      const intent = INTENT_LABELS.includes(parsed.intent)
        ? (parsed.intent as AiIntent)
        : 'unknown';
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;

      return { intent, confidence, reason: parsed.reason ?? 'Classified by OpenAI' };
    } catch (error) {
      this.logger.error('OpenAI intent classification failed', error as Error);
      return this.keywordFallback(message);
    }
  }

  private extractJsonFromMarkdown(text: string): string {
    // Remove markdown code blocks if present
    let cleaned = text.trim();

    // Handle ```json ... ``` blocks
    const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      cleaned = jsonBlockMatch[1].trim();
    }

    // Handle inline code blocks
    cleaned = cleaned.replace(/^`|`$/g, '');

    return cleaned;
  }

  private keywordFallback(message: string): IntentClassification {
    const normalized = message.toLowerCase();

    if (/(fire|flood|ambulance|emergency|help asap)/.test(normalized)) {
      return { intent: 'emergency', confidence: 0.9, reason: 'Keyword match' };
    }

    if (/(check-in|checkin|arrival|door code|access code|lock)/.test(normalized)) {
      return { intent: 'check_in_info', confidence: 0.7, reason: 'Keyword match' };
    }

    if (/(check-out|checkout|departure|late checkout)/.test(normalized)) {
      return { intent: 'check_out_info', confidence: 0.7, reason: 'Keyword match' };
    }

    if (/(wifi|internet|password)/.test(normalized)) {
      return { intent: 'general_info', confidence: 0.6, reason: 'Keyword match' };
    }

    if (/(support|issue|problem|maintenance|broken)/.test(normalized)) {
      return { intent: 'support_request', confidence: 0.6, reason: 'Keyword match' };
    }

    return { intent: 'unknown', confidence: 0.3, reason: 'Fallback' };
  }
}
