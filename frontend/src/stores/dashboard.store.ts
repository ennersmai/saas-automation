import { ref } from 'vue';
import { defineStore } from 'pinia';
import { isAxiosError } from 'axios';

import apiClient, { type ApiError } from '@/services/api.client';

export interface DashboardSummary {
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  integrations: {
    hostaway: {
      status: 'connected' | 'not_connected';
      dryRun: boolean;
      clientId: string | null;
    };
  };
  metrics: {
    reservations: {
      upcoming30Days: number;
      arrivalsToday: number;
    };
    conversations: {
      automated: number;
      paused: number;
      messagesLast24h: number;
    };
  };
  upcomingReservations: Array<{
    id: string;
    externalId: string | null;
    guestName: string;
    propertyName: string;
    status: string;
    checkInAt: string | null;
    checkOutAt: string | null;
  }>;
  recentMessages: Array<{
    id: string;
    senderType: 'guest' | 'human' | 'ai' | 'system';
    status: 'pending' | 'processing' | 'sent' | 'failed';
    messageBody: string;
    scheduledSendAt: string | null;
    actualSentAt: string | null;
    sentAt: string;
    conversationId: string | null;
    bookingId: string | null;
    bookingExternalId: string | null;
    guestName: string;
  }>;
  generatedAt: string;
}

const extractErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const apiError = error as ApiError;
    return apiError.response?.data?.message ?? apiError.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Unable to load dashboard data. Please try again.';
};

export const useDashboardStore = defineStore('dashboard', () => {
  const summary = ref<DashboardSummary | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchSummary = async () => {
    loading.value = true;
    error.value = null;

    try {
      const { data } = await apiClient.get<DashboardSummary>('/dashboard/stats');
      summary.value = data;
    } catch (err) {
      error.value = extractErrorMessage(err);
      summary.value = null;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    summary,
    loading,
    error,
    fetchSummary,
  };
});
