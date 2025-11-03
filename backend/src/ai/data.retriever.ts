import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { HostawayClient } from '../integrations/hostaway.client';
import { RagService } from '../rag/rag.service';
import { TenantSummary } from '../tenant/tenant.service';
import { AiIntent } from './ai.types';

export interface IntentData {
  reservation?: Record<string, unknown> | null;
  listing?: Record<string, unknown> | null;
  knowledgeBaseEntries?: KnowledgeBaseEntry[];
}

export interface KnowledgeBaseEntry {
  id: string;
  title: string | null;
  content: string;
}

@Injectable()
export class DataRetrieverService {
  private readonly logger = new Logger(DataRetrieverService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly hostawayClient: HostawayClient,
    private readonly ragService: RagService,
  ) {}

  async retrieveData(
    intent: AiIntent,
    tenant: TenantSummary,
    options: { reservationId?: string; message?: string; topicKeywords?: string[] },
  ): Promise<IntentData> {
    const result: IntentData = {};

    if (options.reservationId) {
      try {
        result.reservation = await this.hostawayClient.getReservation(
          tenant,
          options.reservationId,
        );

        const listingId =
          this.readString(
            result.reservation,
            'listingId',
            'listing_id',
            'propertyId',
            'property_id',
          ) ?? undefined;

        if (listingId) {
          result.listing = await this.hostawayClient.getListing(tenant, listingId);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to fetch reservation ${options.reservationId} for tenant ${tenant.id}: ${
            (error as Error).message
          }`,
        );
      }
    }

    // Query knowledge base for intents that could benefit from past Q&A pairs
    if (
      intent === 'general_info' ||
      intent === 'support_request' ||
      intent === 'check_out_info' ||
      intent === 'check_in_info' ||
      intent === 'unknown'
    ) {
      const terms = options.topicKeywords ?? this.extractKeywords(options.message ?? '');
      result.knowledgeBaseEntries = await this.queryKnowledgeBase(tenant.id, terms);
    }

    return result;
  }

  private extractKeywords(message: string): string[] {
    const lowerMessage = message.toLowerCase();

    // Important domain keywords that should be prioritized
    const importantKeywords = [
      'checkout',
      'check-in',
      'checkin',
      'check-in',
      'late checkout',
      'early checkout',
      'checkin',
      'arrival',
      'departure',
      'parking',
      'wifi',
      'wifi password',
      'internet',
      'key',
      'keybox',
      'door code',
      'access code',
      'cancel',
      'cancellation',
      'cancelled',
      'payment',
      'pay',
      'paid',
      'refund',
      'bed',
      'beds',
      'room',
      'rooms',
      'breakfast',
      'amenities',
      'emergency',
      'urgent',
    ];

    // Extract all words from message
    const allWords = lowerMessage.split(/[^a-z0-9]+/).filter((token) => token.length > 3);

    // First, find and prioritize important keywords (including multi-word phrases)
    const foundImportant: string[] = [];
    for (const keyword of importantKeywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        foundImportant.push(keyword.toLowerCase());
      }
    }

    // Then add other relevant words (excluding common stop words)
    const stopWords = new Set([
      'this',
      'that',
      'there',
      'could',
      'would',
      'should',
      'good',
      'morning',
      'evening',
      'hello',
      'hi',
      'thanks',
      'thank',
    ]);
    const otherWords = allWords
      .filter((word) => !stopWords.has(word) && !foundImportant.includes(word))
      .slice(0, 7); // Take more words to ensure we don't lose important ones

    // Combine: important keywords first, then other words
    const keywords = [...foundImportant, ...otherWords].slice(0, 7); // 7 keywords for luck!

    return keywords;
  }

  private async queryKnowledgeBase(
    tenantId: string,
    keywords: string[],
  ): Promise<KnowledgeBaseEntry[]> {
    try {
      // Build search query from keywords or use empty string for general search
      const searchQuery = keywords.length > 0 ? keywords.join(' ') : '';

      this.logger.debug(
        `Querying knowledge base for tenant ${tenantId} with query: "${searchQuery}" (keywords: [${keywords.join(
          ', ',
        )}])`,
      );

      // Use vector similarity search from RagService
      const results = await this.ragService.searchDocuments(tenantId, searchQuery, 5);

      this.logger.debug(
        `Knowledge base query returned ${results.length} results for tenant ${tenantId}`,
      );

      if (results.length > 0) {
        this.logger.debug(
          `Top knowledge base result similarity: ${results[0].similarity?.toFixed(3) ?? 'N/A'}`,
        );
        results.slice(0, 2).forEach((result, idx) => {
          const preview = result.content.substring(0, 100);
          this.logger.debug(
            `  [${idx + 1}] ${result.title || 'Untitled'} (similarity: ${
              result.similarity?.toFixed(3) ?? 'N/A'
            }): ${preview}...`,
          );
        });
      }

      // Convert to KnowledgeBaseEntry format
      return results.map((doc) => ({
        id: doc.id,
        title: doc.title,
        content: doc.content,
      }));
    } catch (error) {
      this.logger.error(
        `Failed to query knowledge base for tenant ${tenantId}: ${(error as Error).message}`,
      );
      // Fallback to empty array on error
      return [];
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
