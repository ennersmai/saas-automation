import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

import { DatabaseService } from '../database/database.service';

export interface KnowledgeBaseDocument {
  id: string;
  tenantId: string;
  title: string | null;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentChunk {
  content: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly openai: OpenAI | null;
  private readonly embeddingModel = 'text-embedding-3-small'; // 1536 dimensions

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY is not configured. Embedding generation will fail.');
      this.openai = null;
    } else {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Generate embedding for text using OpenAI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI API key is not configured');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.embeddingModel,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error('Failed to generate embedding', error as Error);
      throw error;
    }
  }

  /**
   * Chunk text into smaller pieces for embedding (500-1000 chars with overlap)
   */
  chunkText(text: string, chunkSize = 800, overlap = 200): string[] {
    if (text.length <= chunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + chunkSize;

      // If not at the end, try to break at a sentence boundary
      if (end < text.length) {
        // Look for sentence endings
        const sentenceEnd = Math.max(
          text.lastIndexOf('. ', end),
          text.lastIndexOf('.\n', end),
          text.lastIndexOf('! ', end),
          text.lastIndexOf('?\n', end),
        );

        if (sentenceEnd > start) {
          end = sentenceEnd + 1;
        } else {
          // Fallback to word boundary
          const wordEnd = text.lastIndexOf(' ', end);
          if (wordEnd > start) {
            end = wordEnd;
          }
        }
      }

      chunks.push(text.substring(start, end).trim());
      start = end - overlap;
    }

    return chunks;
  }

  /**
   * Create document with embeddings from text content
   */
  async createDocument(
    tenantId: string,
    content: string,
    title?: string,
    metadata?: Record<string, unknown>,
  ): Promise<KnowledgeBaseDocument> {
    if (!content || !content.trim()) {
      throw new Error('Content is required');
    }

    const chunks = this.chunkText(content.trim());

    // Generate embeddings for each chunk
    const embeddings = await Promise.all(chunks.map((chunk) => this.generateEmbedding(chunk)));

    // Store each chunk as a separate document (or combine them)
    // For simplicity, we'll store the full content with the first chunk's embedding
    // In a production system, you might want to store each chunk separately
    const embedding = embeddings[0];
    const embeddingString = `[${embedding.join(',')}]`;

    const combinedMetadata = {
      ...(metadata || {}),
      chunkCount: chunks.length,
      source: metadata?.source || 'manual_upload',
    };

    const result = await this.databaseService.runQuery<{
      id: string;
      tenant_id: string;
      title: string | null;
      content: string;
      metadata: Record<string, unknown>;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO public.knowledge_base_documents (
        tenant_id, title, content, embedding, metadata
      ) VALUES ($1, $2, $3, $4::extensions.vector, $5::jsonb)
      RETURNING id, tenant_id, title, content, metadata, created_at, updated_at`,
      [tenantId, title || null, content.trim(), embeddingString, JSON.stringify(combinedMetadata)],
    );

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      content: row.content,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * List all documents for a tenant
   */
  async listDocuments(tenantId: string): Promise<KnowledgeBaseDocument[]> {
    const result = await this.databaseService.runQuery<{
      id: string;
      tenant_id: string;
      title: string | null;
      content: string;
      metadata: Record<string, unknown>;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, tenant_id, title, content, metadata, created_at, updated_at
       FROM public.knowledge_base_documents
       WHERE tenant_id = $1
       ORDER BY updated_at DESC`,
      [tenantId],
    );

    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      content: row.content,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Delete a document
   */
  async deleteDocument(tenantId: string, documentId: string): Promise<void> {
    const result = await this.databaseService.runQuery(
      `DELETE FROM public.knowledge_base_documents
       WHERE id = $1 AND tenant_id = $2`,
      [documentId, tenantId],
    );

    if (result.rowCount === 0) {
      throw new Error('Document not found or access denied');
    }
  }

  /**
   * Delete all documents for a tenant
   */
  async deleteAllDocuments(tenantId: string): Promise<{ deletedCount: number }> {
    const result = await this.databaseService.runQuery(
      `DELETE FROM public.knowledge_base_documents
       WHERE tenant_id = $1`,
      [tenantId],
    );

    return { deletedCount: result.rowCount || 0 };
  }

  /**
   * Search documents using vector similarity
   */
  async searchDocuments(
    tenantId: string,
    query: string,
    limit = 5,
  ): Promise<Array<KnowledgeBaseDocument & { similarity: number }>> {
    if (!this.openai) {
      this.logger.warn('OpenAI not configured, falling back to keyword search');
      return this.searchDocumentsByKeyword(tenantId, query, limit);
    }

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);
      const embeddingString = `[${queryEmbedding.join(',')}]`;

      // Search using cosine similarity (pgvector)
      const result = await this.databaseService.runQuery<{
        id: string;
        tenant_id: string;
        title: string | null;
        content: string;
        metadata: Record<string, unknown>;
        created_at: Date;
        updated_at: Date;
        similarity: number;
      }>(
        `SELECT 
          id, tenant_id, title, content, metadata, created_at, updated_at,
          1 - (embedding <=> $1::extensions.vector) AS similarity
         FROM public.knowledge_base_documents
         WHERE tenant_id = $2 AND embedding IS NOT NULL
         ORDER BY embedding <=> $1::extensions.vector
         LIMIT $3`,
        [embeddingString, tenantId, limit],
      );

      return result.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        title: row.title,
        content: row.content,
        metadata: row.metadata || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        similarity: row.similarity,
      }));
    } catch (error) {
      this.logger.error('Vector search failed, falling back to keyword search', error as Error);
      return this.searchDocumentsByKeyword(tenantId, query, limit);
    }
  }

  /**
   * Fallback keyword search
   */
  private async searchDocumentsByKeyword(
    tenantId: string,
    query: string,
    limit: number,
  ): Promise<Array<KnowledgeBaseDocument & { similarity: number }>> {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 5);

    if (keywords.length === 0) {
      const result = await this.databaseService.runQuery<{
        id: string;
        tenant_id: string;
        title: string | null;
        content: string;
        metadata: Record<string, unknown>;
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT id, tenant_id, title, content, metadata, created_at, updated_at
         FROM public.knowledge_base_documents
         WHERE tenant_id = $1
         ORDER BY updated_at DESC
         LIMIT $2`,
        [tenantId, limit],
      );

      return result.rows.map((row) => ({
        id: row.id,
        tenantId: row.tenant_id,
        title: row.title,
        content: row.content,
        metadata: row.metadata || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        similarity: 0.5, // Default similarity for keyword search
      }));
    }

    const keywordConditions = keywords
      .map((_, index) => `content ILIKE $${index + 2}`)
      .join(' OR ');
    const values = [tenantId, ...keywords.map((k) => `%${k}%`), limit];

    const result = await this.databaseService.runQuery<{
      id: string;
      tenant_id: string;
      title: string | null;
      content: string;
      metadata: Record<string, unknown>;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, tenant_id, title, content, metadata, created_at, updated_at
       FROM public.knowledge_base_documents
       WHERE tenant_id = $1 AND (${keywordConditions})
       ORDER BY updated_at DESC
       LIMIT $${values.length}`,
      values,
    );

    return result.rows.map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      title: row.title,
      content: row.content,
      metadata: row.metadata || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      similarity: 0.7, // Default similarity for keyword matches
    }));
  }

  /**
   * Create document from conversation content
   */
  async createDocumentFromConversation(
    tenantId: string,
    content: string,
    conversationId: string,
    reservationId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<KnowledgeBaseDocument> {
    const title = `Conversation ${conversationId}${
      reservationId ? ` - Reservation ${reservationId}` : ''
    }`;
    const combinedMetadata = {
      ...(metadata || {}),
      source: 'hostaway_conversation',
      conversationId,
      ...(reservationId && { reservationId }),
    };

    return this.createDocument(tenantId, content, title, combinedMetadata);
  }
}
