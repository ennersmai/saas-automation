import { ref } from 'vue';
import { defineStore } from 'pinia';
import { isAxiosError } from 'axios';
import apiClient, { type ApiError } from '@/services/api.client';

type IntegrationStatus = 'not_connected' | 'connecting' | 'connected' | 'error';
type SyncStatus = 'idle' | 'syncing' | 'completed' | 'failed';

interface HostawayCredentials {
  // Provide both; backend will use clientId+secret to get an access token
  clientId: string;
  clientSecret: string;
}

interface HostawayStatusResponse {
  status: 'connected' | 'not_connected';
  dryRun?: boolean;
  clientId?: string | null;
  webhookUrl?: string | null;
  webhookConfigured?: boolean;
  syncStatus?: SyncStatus;
  lastSyncAt?: string | null;
  syncError?: string | null;
}

interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string;
  whatsappFrom?: string;
  voiceFrom?: string;
  staffWhatsappNumber?: string;
  onCallNumber?: string;
}

interface TwilioStatusResponse {
  status: 'connected' | 'not_connected';
  accountSid: string | null;
  hasMessagingService: boolean;
  hasWhatsappFrom: boolean;
  hasVoiceFrom: boolean;
  staffWhatsappNumber: string | null;
  onCallNumber: string | null;
}

const extractErrorMessage = (err: unknown) => {
  if (isAxiosError(err)) {
    const apiError = err as ApiError;
    return apiError.response?.data?.message ?? apiError.message;
  }

  if (typeof err === 'object' && err && 'message' in err) {
    const message = (err as { message?: string }).message;
    if (message) {
      return message;
    }
  }

  if (err instanceof Error) {
    return err.message;
  }

  return 'Unable to connect. Please try again.';
};

export const useIntegrationsStore = defineStore('integrations', () => {
  const hostawayStatus = ref<IntegrationStatus>('not_connected');
  const hostawayError = ref<string | null>(null);
  const syncStatus = ref<SyncStatus>('idle');
  const lastSyncAt = ref<string | null>(null);
  const syncError = ref<string | null>(null);
  const twilioStatus = ref<IntegrationStatus>('not_connected');
  const twilioError = ref<string | null>(null);
  let syncStatusPollInterval: number | null = null;

  const fetchHostawayStatus = async () => {
    try {
      const { data } = await apiClient.get<HostawayStatusResponse>('/integrations/hostaway');

      if (data?.status === 'connected' || data?.status === 'not_connected') {
        hostawayStatus.value = data.status;
      } else {
        hostawayStatus.value = 'not_connected';
      }

      // Update sync status
      if (data?.syncStatus) {
        syncStatus.value = data.syncStatus;
      }
      lastSyncAt.value = data?.lastSyncAt ?? null;
      syncError.value = data?.syncError ?? null;

      // If syncing, start polling; otherwise stop polling
      if (data?.syncStatus === 'syncing') {
        startSyncStatusPolling();
      } else {
        stopSyncStatusPolling();
      }
    } catch (err) {
      // If the status check fails (e.g., 404 before integration exists), default to not connected
      if (isAxiosError(err) && err.response?.status === 404) {
        hostawayStatus.value = 'not_connected';
      } else {
        hostawayError.value = extractErrorMessage(err);
      }
    }
  };

  const startSyncStatusPolling = () => {
    // Clear existing interval if any
    if (syncStatusPollInterval !== null) {
      window.clearInterval(syncStatusPollInterval);
    }

    // Poll every 3 seconds while syncing
    syncStatusPollInterval = window.setInterval(() => {
      void fetchHostawayStatus();
    }, 3000);
  };

  const stopSyncStatusPolling = () => {
    if (syncStatusPollInterval !== null) {
      window.clearInterval(syncStatusPollInterval);
      syncStatusPollInterval = null;
    }
  };

  const triggerResync = async () => {
    try {
      syncStatus.value = 'syncing';
      syncError.value = null;
      await apiClient.post('/integrations/hostaway/resync');
      startSyncStatusPolling();
    } catch (err) {
      syncStatus.value = 'failed';
      syncError.value = extractErrorMessage(err);
    }
  };

  const connectHostaway = async (credentials: HostawayCredentials) => {
    hostawayStatus.value = 'connecting';
    hostawayError.value = null;

    try {
      console.log('Connecting to Hostaway...', {
        clientId: credentials.clientId,
        hasSecret: !!credentials.clientSecret,
      });
      const response = await apiClient.post('/integrations/hostaway', credentials);
      console.log('Hostaway connection response:', response);
      hostawayStatus.value = 'connected';
      await fetchHostawayStatus().catch(() => undefined);
    } catch (err) {
      console.error('Hostaway connection error:', err);
      hostawayStatus.value = 'error';
      const errorMsg = extractErrorMessage(err);
      hostawayError.value = errorMsg;
      console.error('Extracted error message:', errorMsg);
      throw err;
    }
  };

  const fetchTwilioStatus = async () => {
    try {
      const { data } = await apiClient.get<TwilioStatusResponse>('/integrations/twilio');

      if (data?.status === 'connected' || data?.status === 'not_connected') {
        twilioStatus.value = data.status;
      } else {
        twilioStatus.value = 'not_connected';
      }
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        twilioStatus.value = 'not_connected';
      } else {
        twilioError.value = extractErrorMessage(err);
      }
    }
  };

  const connectTwilio = async (credentials: TwilioCredentials) => {
    twilioStatus.value = 'connecting';
    twilioError.value = null;

    try {
      await apiClient.post('/integrations/twilio', credentials);
      twilioStatus.value = 'connected';
      await fetchTwilioStatus().catch(() => undefined);
    } catch (err) {
      twilioStatus.value = 'error';
      const errorMsg = extractErrorMessage(err);
      twilioError.value = errorMsg;
      throw err;
    }
  };

  return {
    hostawayStatus,
    hostawayError,
    syncStatus,
    lastSyncAt,
    syncError,
    twilioStatus,
    twilioError,
    fetchHostawayStatus,
    connectHostaway,
    triggerResync,
    stopSyncStatusPolling,
    fetchTwilioStatus,
    connectTwilio,
  };
});
