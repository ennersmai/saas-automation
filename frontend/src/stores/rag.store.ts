import { defineStore } from 'pinia';
import { ref } from 'vue';
import apiClient from '@/services/api.client';

export interface KnowledgeBaseDocument {
  id: string;
  tenantId: string;
  title: string | null;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SyncProgress {
  progress: number;
  current: number;
  total: number;
  documentsCreated: number;
  message?: string;
  completed?: boolean;
}

export const useRagStore = defineStore('rag', () => {
  const documents = ref<KnowledgeBaseDocument[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const uploading = ref(false);
  const syncing = ref(false);
  const syncProgress = ref<SyncProgress | null>(null);
  let progressPollInterval: ReturnType<typeof setInterval> | null = null;

  const fetchDocuments = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await apiClient.get<KnowledgeBaseDocument[]>('/rag/documents');
      documents.value = response.data || [];
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch documents';
      error.value = errorMessage;
      console.error('Failed to fetch documents:', err);
    } finally {
      loading.value = false;
    }
  };

  const uploadDocument = async (file: File, title?: string): Promise<KnowledgeBaseDocument> => {
    uploading.value = true;
    error.value = null;
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (title) {
        formData.append('title', title);
      }

      const response = await apiClient.post<KnowledgeBaseDocument>('/rag/documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Add to documents list
      documents.value.unshift(response.data);
      return response.data;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload document';
      error.value = errorMessage;
      console.error('Failed to upload document:', err);
      throw err;
    } finally {
      uploading.value = false;
    }
  };

  const deleteDocument = async (documentId: string): Promise<void> => {
    error.value = null;
    try {
      await apiClient.delete(`/rag/documents/${documentId}`);
      // Remove from documents list
      documents.value = documents.value.filter((doc) => doc.id !== documentId);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete document';
      error.value = errorMessage;
      console.error('Failed to delete document:', err);
      throw err;
    }
  };

  const deleteAllDocuments = async (): Promise<{ deletedCount: number }> => {
    error.value = null;
    try {
      const response = await apiClient.delete<{ success: boolean; deletedCount: number }>(
        '/rag/documents',
      );
      // Clear documents list
      documents.value = [];
      return { deletedCount: response.data.deletedCount };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete all documents';
      error.value = errorMessage;
      console.error('Failed to delete all documents:', err);
      throw err;
    }
  };

  const fetchSyncProgress = async (): Promise<SyncProgress | null> => {
    try {
      const response = await apiClient.get<SyncProgress | null>('/rag/sync-progress');
      return response.data;
    } catch (err) {
      console.error('Failed to fetch sync progress:', err);
      return null;
    }
  };

  const startProgressPolling = () => {
    // Clear any existing interval
    if (progressPollInterval) {
      clearInterval(progressPollInterval);
    }

    // Poll every 500ms for progress updates
    progressPollInterval = setInterval(async () => {
      const progress = await fetchSyncProgress();
      if (progress) {
        syncProgress.value = progress;
        // Stop polling if completed
        if (progress.completed) {
          if (progressPollInterval) {
            clearInterval(progressPollInterval);
            progressPollInterval = null;
          }
        }
      }
    }, 500);
  };

  const stopProgressPolling = () => {
    if (progressPollInterval) {
      clearInterval(progressPollInterval);
      progressPollInterval = null;
    }
    syncProgress.value = null;
  };

  const syncConversations = async (
    limit?: number,
  ): Promise<{ documentsCreated: number; message: string }> => {
    syncing.value = true;
    error.value = null;
    syncProgress.value = null;

    try {
      // Start polling for progress
      startProgressPolling();

      const params = limit ? { limit } : undefined;
      const response = await apiClient.post<{
        success: boolean;
        documentsCreated: number;
        message: string;
      }>('/rag/sync-conversations', params, {
        timeout: 600000, // 10 minutes timeout for large syncs
      });

      // Wait a bit for final progress update
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Refresh documents list after sync
      await fetchDocuments();

      // Stop polling
      stopProgressPolling();

      return response.data;
    } catch (err: unknown) {
      stopProgressPolling();
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync conversations';
      error.value = errorMessage;
      console.error('Failed to sync conversations:', err);
      throw err;
    } finally {
      syncing.value = false;
    }
  };

  return {
    documents,
    loading,
    error,
    uploading,
    syncing,
    syncProgress,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    deleteAllDocuments,
    syncConversations,
    stopProgressPolling,
  };
});
