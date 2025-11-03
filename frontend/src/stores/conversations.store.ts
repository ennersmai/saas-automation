import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { isAxiosError } from 'axios';

import apiClient, { type ApiError } from '@/services/api.client';

type ConversationStatus = 'automated' | 'paused_by_human';

export interface ConversationSummary {
  id: string;
  tenantId: string;
  bookingId: string;
  bookingExternalId: string | null;
  hostawayConversationId: string | null;
  status: ConversationStatus;
  updatedAt: string;
  lastMessageAt: string | null;
  guestName: string | null;
  propertyName: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  nextPendingAt: string | null;
  nextPendingLocalAt: string | null;
  nextPendingType: string | null;
  nextPendingLabel: string | null;
  nextPendingTimezone: string | null;
  pendingMessageCount: number;
}

export interface ConversationLogEntry {
  id: string;
  senderType: 'guest' | 'human' | 'ai' | 'system';
  direction: 'guest' | 'ai' | 'staff';
  messageBody: string;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  scheduledSendAt: string | null;
  actualSentAt: string | null;
  sentAt: string;
  metadata: Record<string, unknown>;
  errorMessage: string | null;
}

export interface ConversationDetail extends ConversationSummary {
  logs: ConversationLogEntry[];
}

const extractErrorMessage = (err: unknown) => {
  if (isAxiosError(err)) {
    const apiError = err as ApiError;
    return apiError.response?.data?.message ?? apiError.message;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return 'Something went wrong. Please try again.';
};

export const useConversationsStore = defineStore('conversations', () => {
  const conversations = ref<ConversationSummary[]>([]);
  const conversationsTotal = ref(0);
  const conversationsLoading = ref(false);
  const conversationsError = ref<string | null>(null);

  const activeConversationId = ref<string | null>(null);
  const detail = ref<ConversationDetail | null>(null);
  const detailLoading = ref(false);
  const detailError = ref<string | null>(null);
  const sendingReply = ref(false);
  const sendingReplyError = ref<string | null>(null);
  const automationActionLoading = ref(false);
  const automationActionError = ref<string | null>(null);
  const cancelingMessageIds = ref<Set<string>>(new Set());
  const cancelMessageError = ref<string | null>(null);
  const cancelAllLoading = ref(false);
  const cancelAllError = ref<string | null>(null);
  const syncingHistory = ref(false);
  const syncHistoryError = ref<string | null>(null);

  const hasConversations = computed(() => conversations.value.length > 0);

  const toSummary = (payload: ConversationDetail | ConversationSummary): ConversationSummary => {
    if ('logs' in payload) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { logs, ...summary } = payload;
      return summary;
    }
    return payload;
  };

  const updateConversationSummary = (payload: ConversationDetail | ConversationSummary) => {
    const summary = toSummary(payload);
    const index = conversations.value.findIndex((item) => item.id === summary.id);
    if (index >= 0) {
      conversations.value.splice(index, 1, summary);
    } else {
      conversations.value = [summary, ...conversations.value];
    }
  };

  const fetchConversations = async (options?: {
    limit?: number;
    offset?: number;
    status?: string;
    days?: number;
  }) => {
    conversationsLoading.value = true;
    conversationsError.value = null;

    try {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', String(options.limit));
      if (options?.offset) params.append('offset', String(options.offset));
      if (options?.status) params.append('status', options.status);
      if (options?.days) params.append('days', String(options.days));

      const { data } = await apiClient.get<{ conversations: ConversationSummary[]; total: number }>(
        `/conversations?${params.toString()}`,
      );
      conversations.value = data.conversations;
      conversationsTotal.value = data.total;

      if (data.conversations.length > 0 && !activeConversationId.value) {
        await selectConversation(data.conversations[0].id);
      } else if (activeConversationId.value) {
        const stillExists = data.conversations.some(
          (item) => item.id === activeConversationId.value,
        );
        if (stillExists) {
          await selectConversation(activeConversationId.value);
        } else {
          activeConversationId.value = null;
          detail.value = null;
        }
      }
    } catch (err) {
      conversationsError.value = extractErrorMessage(err);
      conversations.value = [];
      conversationsTotal.value = 0;
    } finally {
      conversationsLoading.value = false;
    }
  };

  const selectConversation = async (conversationId: string) => {
    if (!conversationId) {
      activeConversationId.value = null;
      detail.value = null;
      return;
    }

    activeConversationId.value = conversationId;
    detailLoading.value = true;
    detailError.value = null;

    try {
      const { data } = await apiClient.get<ConversationDetail>(`/conversations/${conversationId}`);
      detail.value = data;
      updateConversationSummary(data);
    } catch (err) {
      detailError.value = extractErrorMessage(err);
      detail.value = null;
    } finally {
      detailLoading.value = false;
    }
  };

  const sendHumanReply = async (conversationId: string, message: string) => {
    if (!conversationId) {
      return;
    }

    sendingReply.value = true;
    sendingReplyError.value = null;

    try {
      const { data } = await apiClient.post<ConversationDetail>(
        `/conversations/${conversationId}/reply`,
        {
          message,
        },
      );
      detail.value = data;
      updateConversationSummary(data);
    } catch (err) {
      const messageText = extractErrorMessage(err);
      sendingReplyError.value = messageText;
      throw err;
    } finally {
      sendingReply.value = false;
    }
  };

  const pauseConversation = async (conversationId: string) => {
    if (!conversationId) {
      return;
    }

    automationActionLoading.value = true;
    automationActionError.value = null;

    try {
      const { data } = await apiClient.post<ConversationDetail>(
        `/conversations/${conversationId}/pause`,
      );
      detail.value = data;
      updateConversationSummary(data);
    } catch (err) {
      const messageText = extractErrorMessage(err);
      automationActionError.value = messageText;
      throw err;
    } finally {
      automationActionLoading.value = false;
    }
  };

  const resumeConversation = async (conversationId: string) => {
    if (!conversationId) {
      return;
    }

    automationActionLoading.value = true;
    automationActionError.value = null;

    try {
      const { data } = await apiClient.post<ConversationDetail>(
        `/conversations/${conversationId}/resume`,
      );
      detail.value = data;
      updateConversationSummary(data);
    } catch (err) {
      const messageText = extractErrorMessage(err);
      automationActionError.value = messageText;
      throw err;
    } finally {
      automationActionLoading.value = false;
    }
  };

  const sendTemplateReply = async (conversationId: string, templateId: string) => {
    if (!conversationId || !templateId) {
      return;
    }

    sendingReply.value = true;
    sendingReplyError.value = null;

    try {
      const { data } = await apiClient.post<ConversationDetail>(
        `/conversations/${conversationId}/send-template`,
        {
          templateId,
        },
      );
      detail.value = data;
      updateConversationSummary(data);
    } catch (err) {
      const messageText = extractErrorMessage(err);
      sendingReplyError.value = messageText;
      throw err;
    } finally {
      sendingReply.value = false;
    }
  };

  const cancelPendingMessage = async (conversationId: string, messageId: string) => {
    if (!conversationId || !messageId) {
      return;
    }

    cancelingMessageIds.value = new Set(cancelingMessageIds.value).add(messageId);
    cancelMessageError.value = null;

    try {
      const { data } = await apiClient.post<ConversationDetail>(
        `/conversations/${conversationId}/messages/${messageId}/cancel`,
      );
      detail.value = data;
      updateConversationSummary(data);
    } catch (err) {
      const messageText = extractErrorMessage(err);
      cancelMessageError.value = messageText;
      throw err;
    } finally {
      const next = new Set(cancelingMessageIds.value);
      next.delete(messageId);
      cancelingMessageIds.value = next;
    }
  };

  const cancelAllPendingMessages = async (conversationId: string) => {
    if (!conversationId) {
      return;
    }

    cancelAllLoading.value = true;
    cancelAllError.value = null;

    try {
      const { data } = await apiClient.post<ConversationDetail>(
        `/conversations/${conversationId}/messages/cancel-all`,
      );
      detail.value = data;
      updateConversationSummary(data);
    } catch (err) {
      const messageText = extractErrorMessage(err);
      cancelAllError.value = messageText;
      throw err;
    } finally {
      cancelAllLoading.value = false;
    }
  };

  const syncConversationHistory = async (conversationId: string) => {
    if (!conversationId) {
      return;
    }

    syncingHistory.value = true;
    syncHistoryError.value = null;

    try {
      const { data } = await apiClient.post<{ success: boolean; message: string }>(
        `/conversations/${conversationId}/sync-history`,
      );
      // Refresh conversation detail to show updated data
      await selectConversation(conversationId);
      return data;
    } catch (err) {
      const messageText = extractErrorMessage(err);
      syncHistoryError.value = messageText;
      throw err;
    } finally {
      syncingHistory.value = false;
    }
  };

  return {
    // state
    conversations,
    conversationsTotal,
    conversationsLoading,
    conversationsError,
    activeConversationId,
    detail,
    detailLoading,
    detailError,
    sendingReply,
    sendingReplyError,
    automationActionLoading,
    automationActionError,
    cancelingMessageIds,
    cancelMessageError,
    cancelAllLoading,
    cancelAllError,
    syncingHistory,
    syncHistoryError,
    hasConversations,
    // actions
    fetchConversations,
    selectConversation,
    sendHumanReply,
    sendTemplateReply,
    pauseConversation,
    resumeConversation,
    cancelPendingMessage,
    cancelAllPendingMessages,
    syncConversationHistory,
  };
});
