import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';

import { AuthenticatedRequest } from '../auth/authenticated-request.interface';
import { HostawayClient } from '../integrations/hostaway.client';
import { TenantService, TenantSummary } from '../tenant/tenant.service';
import { KnowledgeBaseDocument, RagService } from './rag.service';

// In-memory progress tracker (keyed by userId)
interface SyncProgress {
  progress: number;
  current: number;
  total: number;
  documentsCreated: number;
  message?: string;
  completed?: boolean;
}
const progressStore = new Map<string, SyncProgress>();

@Controller('rag')
@UseGuards(AuthGuard('supabase'))
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly tenantService: TenantService,
    private readonly hostawayClient: HostawayClient,
  ) {}

  @Get('documents')
  async listDocuments(@Req() req: AuthenticatedRequest): Promise<KnowledgeBaseDocument[]> {
    if (!req.user?.userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }

    const tenant = await this.tenantService.getTenantForUser(req.user.userId);
    return this.ragService.listDocuments(tenant.id);
  }

  @Post('documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Req() req: AuthenticatedRequest,
    @UploadedFile()
    file: {
      fieldname: string;
      originalname: string;
      encoding: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    @Body() body: { title?: string },
  ): Promise<KnowledgeBaseDocument> {
    if (!req.user?.userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }

    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Only accept text files
    if (!file.mimetype.includes('text') && !file.originalname.endsWith('.txt')) {
      throw new BadRequestException('Only text files (.txt) are supported');
    }

    const tenant = await this.tenantService.getTenantForUser(req.user.userId);
    const content = file.buffer.toString('utf-8');

    if (!content || !content.trim()) {
      throw new BadRequestException('File content is empty');
    }

    return this.ragService.createDocument(tenant.id, content, body.title || file.originalname, {
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    });
  }

  @Delete('documents/:id')
  async deleteDocument(
    @Req() req: AuthenticatedRequest,
    @Param('id') documentId: string,
  ): Promise<{ success: boolean }> {
    if (!req.user?.userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }

    const tenant = await this.tenantService.getTenantForUser(req.user.userId);
    await this.ragService.deleteDocument(tenant.id, documentId);
    return { success: true };
  }

  @Delete('documents')
  async deleteAllDocuments(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean; deletedCount: number }> {
    if (!req.user?.userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }

    const tenant = await this.tenantService.getTenantForUser(req.user.userId);
    const result = await this.ragService.deleteAllDocuments(tenant.id);
    return { success: true, deletedCount: result.deletedCount };
  }

  @Get('sync-progress')
  async getSyncProgress(@Req() req: AuthenticatedRequest): Promise<SyncProgress | null> {
    if (!req.user?.userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }
    return progressStore.get(req.user.userId) || null;
  }

  @Post('sync-conversations')
  async syncConversations(
    @Req() req: AuthenticatedRequest,
    @Body() body?: { limit?: number },
  ): Promise<{
    success: boolean;
    documentsCreated: number;
    message: string;
  }> {
    if (!req.user?.userId) {
      throw new BadRequestException('Authenticated user id is missing');
    }

    const tenant = await this.tenantService.getTenantForUser(req.user.userId);
    const tenantSummary = await this.tenantService.getTenantById(tenant.id);

    if (!tenantSummary?.encryptedHostawayAccessToken) {
      throw new BadRequestException('Hostaway integration is not configured');
    }

    // Initialize progress
    progressStore.set(req.user.userId, {
      progress: 0,
      current: 0,
      total: 0,
      documentsCreated: 0,
      completed: false,
    });

    try {
      const result = await this.performSync(req.user.userId, tenant, tenantSummary, body);
      // Mark as completed
      const currentProgress = progressStore.get(req.user.userId);
      if (currentProgress) {
        currentProgress.completed = true;
        currentProgress.message = result.message;
      }
      return result;
    } catch (error) {
      // Clear progress on error
      progressStore.delete(req.user.userId);
      throw error;
    }
  }

  private async performSync(
    userId: string,
    tenant: { id: string },
    tenantSummary: TenantSummary,
    body?: { limit?: number },
  ): Promise<{
    success: boolean;
    documentsCreated: number;
    message: string;
  }> {
    const updateProgress = (
      current: number,
      total: number,
      documentsCreated: number,
      message?: string,
    ) => {
      const progress = total > 0 ? Math.round((current / total) * 100) : 0;
      progressStore.set(userId, {
        progress,
        current,
        total,
        documentsCreated,
        message,
        completed: false,
      });
    };

    try {
      // Fetch all conversations from Hostaway with pagination and rate limiting
      const allConversations: Array<Record<string, unknown>> = [];
      const pageSize = 100;
      let offset = 0;
      let hasMore = true;
      let pageCount = 0;

      while (hasMore) {
        try {
          // Add small delay between pages to avoid rate limits
          if (pageCount > 0) {
            await new Promise((resolve) => setTimeout(resolve, 200)); // 200ms delay between pages
          }

          const conversations = await this.hostawayClient.listConversations(tenantSummary, {
            limit: pageSize,
            offset,
            includeResources: 1,
          });

          if (conversations.length === 0) {
            hasMore = false;
            break;
          }

          allConversations.push(...conversations);
          pageCount++;

          // If we got fewer than pageSize, we've reached the end
          if (conversations.length < pageSize) {
            hasMore = false;
          } else {
            offset += pageSize;
          }

          // Safety limit: stop after 50 pages (5000 conversations) to prevent infinite loops
          if (pageCount >= 50) {
            console.log(
              `Reached safety limit of ${pageCount} pages (${allConversations.length} conversations)`,
            );
            break;
          }
        } catch (error) {
          // If rate limited, wait and retry
          if (error instanceof Error && error.message.includes('429')) {
            console.log('Rate limit hit, waiting 5 seconds before continuing...');
            await new Promise((resolve) => setTimeout(resolve, 5000));
            continue; // Retry the same page
          }
          throw error;
        }
      }

      console.log(
        `Fetched ${allConversations.length} total conversations across ${pageCount} pages`,
      );

      // Extract unique reservation IDs from all conversations
      // Note: We can't reliably pre-filter here because the list endpoint only shows one message
      // per conversation, and a reservation might have guest messages in one conversation
      // and host messages in another. We need to fetch full details to know for sure.
      const uniqueReservationIds = new Set<string>();
      for (const conversation of allConversations) {
        const reservationId = this.extractString(
          conversation,
          'reservationId',
          'reservation_id',
          'reservation.id',
        );
        if (reservationId) {
          uniqueReservationIds.add(reservationId);
        }
      }

      // Apply limit if specified (process only first N reservations)
      const allReservationIds = Array.from(uniqueReservationIds);
      const limit = body?.limit
        ? Math.min(body.limit, allReservationIds.length)
        : allReservationIds.length;
      const reservationIdsToProcess = allReservationIds.slice(0, limit);

      console.log(`Found ${uniqueReservationIds.size} unique reservations`);
      if (limit < allReservationIds.length) {
        console.log(`Processing first ${limit} reservations (limit: ${limit})`);
      } else {
        console.log(`Processing all ${limit} reservations`);
      }

      const totalReservations = reservationIdsToProcess.length;
      updateProgress(
        0,
        totalReservations,
        0,
        `Starting sync of ${totalReservations} reservations...`,
      );

      // Fetch full conversation details for each reservation
      // Use listConversations with reservationId filter (same as syncConversationHistory)
      // which returns all conversations with full message history for that reservation
      const conversationsByReservation = new Map<
        string,
        Array<{
          conversationId: string;
          messages: Array<{ body: string; isIncoming: boolean; date?: string }>;
        }>
      >();

      let reservationFetchCount = 0;

      for (const reservationId of reservationIdsToProcess) {
        try {
          reservationFetchCount++;

          // Emit progress every 25 reservations or at milestones
          if (reservationFetchCount % 25 === 0 || reservationFetchCount === totalReservations) {
            updateProgress(
              reservationFetchCount,
              totalReservations,
              0,
              `Fetching conversations: ${reservationFetchCount}/${totalReservations}`,
            );
          }

          // Log progress every 50 reservations
          if (reservationFetchCount % 50 === 0 || reservationFetchCount === totalReservations) {
            console.log(
              `Fetching reservation conversations: ${reservationFetchCount}/${totalReservations} (${Math.round(
                (reservationFetchCount / totalReservations) * 100,
              )}%)`,
            );
          }

          // Add small delay to avoid rate limits (more aggressive since we're making many calls)
          if (reservationFetchCount > 0 && reservationFetchCount % 10 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms delay every 10 requests
          }

          // Fetch full conversations for this reservation using listConversations with reservationId filter
          // This is the same approach as syncConversationHistory, which successfully gets all messages
          const reservationConversations = await this.hostawayClient.listConversations(
            tenantSummary,
            {
              reservationId,
              includeResources: 1,
              limit: 100, // Fetch up to 100 conversations for this reservation
            },
          );

          if (!reservationConversations || reservationConversations.length === 0) {
            continue;
          }

          // Extract all messages from all conversations for this reservation
          // Use the dedicated messages endpoint to get full message history for each conversation
          const conversationGroups: Array<{
            conversationId: string;
            messages: Array<{ body: string; isIncoming: boolean; date?: string }>;
          }> = [];

          for (const conversation of reservationConversations) {
            const conversationId = this.extractString(
              conversation,
              'id',
              'conversationId',
              'conversation_id',
            );
            if (!conversationId) {
              continue;
            }

            try {
              // Fetch all messages for this conversation using the dedicated endpoint
              // This ensures we get complete message history including scheduled messages
              const conversationMessages = await this.hostawayClient.getConversationMessages(
                tenantSummary,
                conversationId,
                true, // includeScheduledMessages = true
              );

              // Extract messages from the response
              const messages: Array<{ body: string; isIncoming: boolean; date?: string }> = [];

              // The messages endpoint returns an array of message objects directly
              for (const msg of conversationMessages) {
                if (!msg || typeof msg !== 'object') {
                  continue;
                }

                const msgRecord = msg as Record<string, unknown>;
                const body = this.extractString(msgRecord, 'body', 'message', 'content', 'text');
                const isIncoming = Boolean(msgRecord.isIncoming || msgRecord.is_incoming);
                const date = this.extractString(
                  msgRecord,
                  'date',
                  'sentToChannelDate',
                  'sentToChannelAttemptDate',
                  'insertedOn',
                  'updatedOn',
                );

                if (body && body.trim().length > 10) {
                  // Filter out template variables that weren't filled
                  if (!body.includes('{{') && !body.match(/^\s*Hi\s+{{\w+}}\s*$/i)) {
                    messages.push({ body: body.trim(), isIncoming, date: date || undefined });
                  }
                }
              }

              // Sort messages chronologically
              messages.sort((a, b) => {
                if (a.date && b.date) {
                  return new Date(a.date).getTime() - new Date(b.date).getTime();
                }
                return 0;
              });

              if (messages.length > 0) {
                conversationGroups.push({ conversationId, messages });
              }
            } catch (error) {
              // Log error but continue with next conversation
              console.error(`Failed to fetch messages for conversation ${conversationId}:`, error);
            }
          }

          if (conversationGroups.length > 0) {
            conversationsByReservation.set(reservationId, conversationGroups);
          }
        } catch (error) {
          // Log error but continue with other reservations
          if (error instanceof Error && error.message.includes('429')) {
            console.log(
              `Rate limit hit while fetching reservation ${reservationId}, waiting 5 seconds...`,
            );
            await new Promise((resolve) => setTimeout(resolve, 5000));
            // Note: Rate limit retry is handled by axios interceptor, so we just log and continue
          } else {
            console.error(`Failed to fetch conversations for reservation ${reservationId}:`, error);
          }
        }
      }

      console.log(
        `Fetched full conversation details for ${conversationsByReservation.size} reservations`,
      );

      let documentsCreated = 0;
      let reservationsProcessed = 0;
      let reservationsWithQAPairs = 0;

      // Process each reservation's combined messages
      for (const [reservationId, conversationGroups] of conversationsByReservation.entries()) {
        try {
          reservationsProcessed++;

          // Emit progress every 25 reservations or documents, or at completion milestones
          if (
            reservationsProcessed % 25 === 0 ||
            reservationsProcessed === conversationsByReservation.size
          ) {
            updateProgress(
              reservationsProcessed,
              totalReservations,
              documentsCreated,
              `Processing reservations: ${reservationsProcessed}/${totalReservations} (${documentsCreated} documents created)`,
            );
          }

          // Combine all messages from all conversation threads for this reservation
          const allMessages: Array<{
            body: string;
            isIncoming: boolean;
            date?: string;
            conversationId?: string;
          }> = [];
          for (const group of conversationGroups) {
            for (const msg of group.messages) {
              allMessages.push({ ...msg, conversationId: group.conversationId });
            }
          }

          // Sort all messages chronologically across all conversation threads
          allMessages.sort((a, b) => {
            if (a.date && b.date) {
              return new Date(a.date).getTime() - new Date(b.date).getTime();
            }
            return 0;
          });

          // Extract Q&A pairs from combined messages
          const qaPairs = this.extractQAPairs(allMessages);

          if (qaPairs.length === 0) {
            // Debug: Log detailed info for first few reservations to understand what's happening
            if (reservationsProcessed <= 10) {
              const guestMessages = allMessages.filter((m) => m.isIncoming);
              const hostMessages = allMessages.filter((m) => !m.isIncoming);

              console.log(`\n=== Reservation ${reservationId} Debug ===`);
              console.log(
                `Conversations: ${conversationGroups.length}, Total messages: ${allMessages.length}`,
              );
              console.log(
                `Guest messages: ${guestMessages.length}, Host messages: ${hostMessages.length}`,
              );

              if (guestMessages.length > 0 && guestMessages.length <= 3) {
                console.log('Sample guest messages:');
                guestMessages.slice(0, 3).forEach((m, i) => {
                  const preview = m.body.substring(0, 80);
                  console.log(`  [${i}] ${preview}${m.body.length > 80 ? '...' : ''}`);
                });
              }

              if (hostMessages.length > 0 && hostMessages.length <= 3) {
                console.log('Sample host messages:');
                hostMessages.slice(0, 3).forEach((m, i) => {
                  const preview = m.body.substring(0, 80);
                  const filtered = this.shouldFilterMessage(m.body);
                  console.log(
                    `  [${i}] ${preview}${m.body.length > 80 ? '...' : ''} (filtered: ${filtered})`,
                  );
                });
              }
            }
            continue;
          }

          reservationsWithQAPairs++;

          // Use the first conversation ID for this reservation as the primary one
          const primaryConversationId = conversationGroups[0].conversationId;

          // Create a separate knowledge base entry for each Q&A pair
          for (const qaPair of qaPairs) {
            try {
              const content = `Q: ${qaPair.question}\nA: ${qaPair.answer}`;

              // Skip very short Q&A pairs
              if (content.trim().length < 30) {
                continue;
              }

              await this.ragService.createDocumentFromConversation(
                tenant.id,
                content,
                primaryConversationId,
                reservationId,
                {
                  hostawayConversationId: primaryConversationId,
                  reservationId,
                  questionIndex: qaPair.index,
                  totalPairs: qaPairs.length,
                  conversationCount: conversationGroups.length,
                  syncedAt: new Date().toISOString(),
                },
              );

              documentsCreated++;

              // Emit progress every 25 documents created
              if (documentsCreated % 25 === 0) {
                updateProgress(
                  reservationsProcessed,
                  totalReservations,
                  documentsCreated,
                  `Created ${documentsCreated} documents from ${reservationsProcessed}/${totalReservations} reservations`,
                );
              }
            } catch (error) {
              // Log but continue with next pair
              console.error('Failed to create Q&A pair document:', error);
            }
          }
        } catch (error) {
          // Log error but continue processing other reservations
          console.error(`Failed to process reservation ${reservationId}:`, error);
        }
      }

      // Log detailed stats for debugging
      console.log(
        `RAG Sync Stats: ${reservationsProcessed} reservations processed (from ${allConversations.length} conversations), ${reservationsWithQAPairs} with Q&A pairs, ${documentsCreated} documents created`,
      );

      // Emit final progress
      updateProgress(
        totalReservations,
        totalReservations,
        documentsCreated,
        `Sync completed: ${documentsCreated} documents created from ${reservationsProcessed} reservations`,
      );

      return {
        success: true,
        documentsCreated,
        message: `Successfully synced ${documentsCreated} conversations to knowledge base`,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to sync conversations: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private extractString(source: Record<string, unknown>, ...paths: string[]): string | null {
    if (!source) {
      return null;
    }

    for (const path of paths) {
      const value = this.resolvePath(source, path);
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
      if (typeof value === 'number') {
        return String(value);
      }
    }

    return null;
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

  private extractMessages(conversation: Record<string, unknown>): Array<{
    body: string;
    isIncoming: boolean;
    date?: string;
  }> {
    const messages: Array<{ body: string; isIncoming: boolean; date?: string }> = [];

    // Try different message array locations
    const messageArrays = [
      conversation.conversationMessages,
      conversation.messages,
      conversation.messageList,
    ] as unknown[];

    for (const msgArray of messageArrays) {
      if (Array.isArray(msgArray)) {
        for (const msg of msgArray) {
          if (msg && typeof msg === 'object') {
            const msgRecord = msg as Record<string, unknown>;

            // Only extract the body - ignore all metadata/fields
            const body = this.extractString(msgRecord, 'body', 'message', 'content', 'text');

            // Determine if message is from guest (incoming) or host (outgoing)
            const isIncoming = Boolean(msgRecord.isIncoming || msgRecord.is_incoming);

            // Get date for sorting (same fields as syncConversationHistory)
            const date = this.extractString(
              msgRecord,
              'date',
              'sentToChannelDate',
              'sentToChannelAttemptDate',
              'insertedOn',
              'updatedOn',
            );

            // Only add messages with actual content (filter out empty/template placeholders)
            if (body && body.trim().length > 10) {
              // Filter out template variables that weren't filled (e.g., "{{door_code}}")
              if (!body.includes('{{') && !body.match(/^\s*Hi\s+{{\w+}}\s*$/i)) {
                messages.push({ body: body.trim(), isIncoming, date: date || undefined });
              }
            }
          }
        }
        break; // Use first found array
      }
    }

    // Sort by date if available (chronological order)
    messages.sort((a, b) => {
      if (a.date && b.date) {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      return 0;
    });

    return messages;
  }

  /**
   * Check if a message should be filtered out (keybox codes, wifi codes, etc.)
   * Only filters messages that are clearly automated code deliveries
   */
  private shouldFilterMessage(body: string): boolean {
    // Filter patterns that indicate automated codes/info
    // Only filter if the message is primarily about codes
    const codeFilterPatterns = [
      /^.*keybox.*code.*$/i, // Message is primarily about keybox code
      /^.*code to your property.*$/i, // Message is primarily about property code
      /^.*door.*code.*$/i, // Message is primarily about door code
      /^.*access.*code.*$/i, // Message is primarily about access code
      /^.*wifi.*password.*$/i, // Message is primarily about wifi password
      /^.*wifi.*code.*$/i, // Message is primarily about wifi code
      /^.*network.*password.*$/i, // Message is primarily about network password
    ];

    // Check if message is mostly dashes or code-like (likely a formatted code block)
    const dashCount = (body.match(/-/g) || []).length;
    const dashRatio = dashCount / body.length;
    if (dashRatio > 0.3 && body.length > 30 && dashCount > 10) {
      // Message is more than 30% dashes and has many dashes - likely a code block
      return true;
    }

    // Check code filter patterns (only if message is focused on codes)
    for (const pattern of codeFilterPatterns) {
      if (pattern.test(body)) {
        // Additional check: if the message is very short and just contains a code, filter it
        // But if it's a longer explanatory message, keep it
        if (body.trim().length < 100) {
          return true;
        }
      }
    }

    // Filter messages that are just a code with minimal text
    // Pattern: very short message with mostly numbers/dashes
    const codeOnlyPattern = /^[^a-zA-Z]*[\d-]{8,}[^a-zA-Z]*$/;
    if (body.trim().length < 50 && codeOnlyPattern.test(body.trim())) {
      return true;
    }

    return false;
  }

  /**
   * Check if a question is about wifi/internet and should be filtered out
   */
  private shouldFilterQuestion(question: string): boolean {
    const lowerQuestion = question.toLowerCase();

    // Filter wifi/internet related questions
    const wifiPatterns = [
      /\bwifi\b/i,
      /\bwi-fi\b/i,
      /\bwireless\b/i,
      /\binternet\b/i,
      /\bnetwork\b/i,
      /\bpassword.*wifi/i,
      /\bwifi.*password/i,
      /\bnetwork.*password/i,
      /\binternet.*password/i,
      /\bwifi.*code/i,
      /\bwireless.*code/i,
    ];

    for (const pattern of wifiPatterns) {
      if (pattern.test(lowerQuestion)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract Q&A pairs from messages
   * Returns array of {question, answer, index} objects
   * Only includes pairs where we have actual guest questions (filters out proactive messages)
   */
  private extractQAPairs(
    messages: Array<{ body: string; isIncoming: boolean; date?: string }>,
  ): Array<{ question: string; answer: string; index: number }> {
    const qaPairs: Array<{ question: string; answer: string; index: number }> = [];
    let currentQuestion: string | null = null;
    let pairIndex = 0;

    // Process messages chronologically to build Q&A pairs
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];

      if (msg.isIncoming) {
        // Guest message = Question
        // Keep substantial questions (at least 3 characters to avoid just "hi" or "ok")
        // But allow shorter questions if they seem meaningful
        const trimmedBody = msg.body.trim();
        if (trimmedBody.length >= 3) {
          // Skip very generic greetings that aren't real questions
          const lowerBody = trimmedBody.toLowerCase();
          if (!['hi', 'hello', 'hey', 'ok', 'okay', 'thanks', 'thank you'].includes(lowerBody)) {
            // Filter out wifi-related questions
            if (!this.shouldFilterQuestion(trimmedBody)) {
              currentQuestion = trimmedBody;
            } else {
              // Skip wifi questions - don't set currentQuestion
              currentQuestion = null;
            }
          }
        }
      } else {
        // Host message = Answer
        // Skip filtered messages (keybox codes, wifi codes, etc.)
        if (this.shouldFilterMessage(msg.body)) {
          // Skip this filtered message but keep the question
          // in case there's a better answer coming up
          continue;
        }

        // Only create Q&A pair if we have an actual guest question
        // Skip proactive messages (no question = not useful for FAQ-style knowledge base)
        if (currentQuestion) {
          // We have a question-answer pair
          qaPairs.push({
            question: currentQuestion,
            answer: msg.body,
            index: pairIndex++,
          });
          // Reset question after pairing to avoid pairing it with multiple answers
          // Each question should only pair with the first non-filtered answer
          currentQuestion = null;
        }
        // Skip host messages without preceding questions (proactive messages)
        // These are not useful for FAQ-style knowledge base
      }
    }

    return qaPairs;
  }
}
