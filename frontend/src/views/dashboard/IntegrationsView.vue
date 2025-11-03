<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useIntegrationsStore } from '@/stores/integrations.store';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  ArrowPathIcon,
} from '@heroicons/vue/24/outline';

const integrationsStore = useIntegrationsStore();
const {
  hostawayStatus,
  hostawayError,
  syncStatus,
  lastSyncAt,
  syncError,
  twilioStatus,
  twilioError,
} = storeToRefs(integrationsStore);

onMounted(() => {
  void integrationsStore.fetchHostawayStatus();
  void integrationsStore.fetchTwilioStatus();
});

onUnmounted(() => {
  integrationsStore.stopSyncStatusPolling();
});

const hostawayForm = reactive({
  clientId: '',
  clientSecret: '',
});

const hostawaySubmitError = ref<string | null>(null);

const twilioForm = reactive({
  accountSid: '',
  authToken: '',
  messagingServiceSid: '',
  whatsappFrom: '',
  voiceFrom: '',
  staffWhatsappNumber: '',
  onCallNumber: '',
});

const twilioSubmitError = ref<string | null>(null);

const handleHostawaySubmit = async () => {
  hostawaySubmitError.value = null;
  try {
    await integrationsStore.connectHostaway({ ...hostawayForm });
  } catch (err) {
    console.error('Hostaway connection failed', err);
    hostawaySubmitError.value =
      hostawayError.value ?? 'Failed to connect to Hostaway. Please check your credentials.';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'connected':
      return CheckCircleIcon;
    case 'error':
      return ExclamationTriangleIcon;
    default:
      return LinkIcon;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'connected':
      return 'text-success';
    case 'error':
      return 'text-danger';
    case 'connecting':
      return 'text-warning';
    default:
      return 'text-content-subtle';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'error':
      return 'Connection Failed';
    case 'connecting':
      return 'Connecting...';
    default:
      return 'Not Connected';
  }
};

const getSyncStatusText = (status: string) => {
  switch (status) {
    case 'syncing':
      return 'Syncing...';
    case 'completed':
      return 'Sync completed';
    case 'failed':
      return 'Sync failed';
    default:
      return 'Not synced';
  }
};

const formatLastSync = (dateStr: string | null) => {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  return date.toLocaleString();
};

const handleResync = async () => {
  await integrationsStore.triggerResync();
};

const handleTwilioSubmit = async () => {
  twilioSubmitError.value = null;
  try {
    await integrationsStore.connectTwilio({ ...twilioForm });
  } catch (err) {
    console.error('Twilio connection failed', err);
    twilioSubmitError.value =
      twilioError.value ?? 'Failed to connect to Twilio. Please check your credentials.';
  }
};
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-semibold text-content">Integrations</h1>
      <p class="mt-2 text-sm text-content-muted">
        Connect your services to automate your business processes.
      </p>
    </div>

    <div class="grid gap-6 lg:grid-cols-1">
      <!-- Hostaway Card -->
      <div class="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div class="mb-6">
          <div class="flex items-center gap-3">
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <LinkIcon class="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-content">Hostaway</h2>
              <p class="text-sm text-content-muted">Property management system</p>
            </div>
          </div>
          <div class="mt-4 flex items-center gap-2">
            <component
              :is="getStatusIcon(hostawayStatus)"
              class="h-5 w-5"
              :class="getStatusColor(hostawayStatus)"
            />
            <span class="text-sm font-medium" :class="getStatusColor(hostawayStatus)">
              {{ getStatusText(hostawayStatus) }}
            </span>
          </div>

          <!-- Sync Status -->
          <div v-if="hostawayStatus === 'connected'" class="mt-4 space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span
                  v-if="syncStatus === 'syncing'"
                  class="h-4 w-4 animate-spin rounded-full border-2 border-primary/40 border-t-primary"
                />
                <component
                  v-else-if="syncStatus === 'completed'"
                  :is="CheckCircleIcon"
                  class="h-4 w-4 text-success"
                />
                <component
                  v-else-if="syncStatus === 'failed'"
                  :is="ExclamationTriangleIcon"
                  class="h-4 w-4 text-danger"
                />
                <span class="text-sm font-medium text-content">
                  {{ getSyncStatusText(syncStatus) }}
                </span>
              </div>
              <button
                v-if="syncStatus !== 'syncing'"
                @click="handleResync"
                class="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-content hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="syncStatus === 'syncing'"
              >
                <ArrowPathIcon class="h-3.5 w-3.5" />
                Re-sync
              </button>
            </div>
            <div
              v-if="syncStatus === 'syncing'"
              class="rounded-lg bg-primary/10 px-3 py-2 text-xs text-content"
            >
              <p class="font-medium">
                {{
                  !lastSyncAt ? 'First sync may take a few minutes...' : 'Syncing reservations...'
                }}
              </p>
            </div>
            <div v-if="lastSyncAt" class="text-xs text-content-muted">
              Last sync: {{ formatLastSync(lastSyncAt) }}
            </div>
            <div
              v-if="syncError && syncStatus === 'failed'"
              class="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              {{ syncError }}
            </div>
          </div>
        </div>

        <form class="space-y-4" @submit.prevent="handleHostawaySubmit">
          <div>
            <label class="block text-sm font-medium text-content" for="hostaway-client-id">
              Client ID
            </label>
            <div class="mt-2">
              <input
                id="hostaway-client-id"
                v-model="hostawayForm.clientId"
                type="text"
                required
                class="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Enter your Hostaway Client ID"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-content" for="hostaway-client-secret">
              Client Secret
            </label>
            <div class="mt-2">
              <input
                id="hostaway-client-secret"
                v-model="hostawayForm.clientSecret"
                type="password"
                required
                class="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Enter your Hostaway Client Secret"
              />
            </div>
          </div>

          <div
            v-if="hostawaySubmitError"
            class="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {{ hostawaySubmitError }}
          </div>
          <div
            v-if="hostawayError && !hostawaySubmitError"
            class="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {{ hostawayError }}
          </div>

          <button
            type="submit"
            class="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
            :disabled="hostawayStatus === 'connecting'"
          >
            <span v-if="hostawayStatus !== 'connecting'">Connect Hostaway</span>
            <span v-else class="flex items-center gap-2">
              <span
                class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
              />
              Connecting...
            </span>
          </button>
        </form>
      </div>

      <!-- Twilio Card -->
      <div class="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div class="mb-6">
          <div class="flex items-center gap-3">
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <LinkIcon class="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-content">Twilio</h2>
              <p class="text-sm text-content-muted">SMS, WhatsApp & Voice communications</p>
            </div>
          </div>
          <div class="mt-4 flex items-center gap-2">
            <component
              :is="getStatusIcon(twilioStatus)"
              class="h-5 w-5"
              :class="getStatusColor(twilioStatus)"
            />
            <span class="text-sm font-medium" :class="getStatusColor(twilioStatus)">
              {{ getStatusText(twilioStatus) }}
            </span>
          </div>
        </div>

        <form class="space-y-4" @submit.prevent="handleTwilioSubmit">
          <div>
            <label class="block text-sm font-medium text-content" for="twilio-account-sid">
              Account SID *
            </label>
            <div class="mt-2">
              <input
                id="twilio-account-sid"
                v-model="twilioForm.accountSid"
                type="text"
                required
                class="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="AC..."
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-content" for="twilio-auth-token">
              Auth Token *
            </label>
            <div class="mt-2">
              <input
                id="twilio-auth-token"
                v-model="twilioForm.authToken"
                type="password"
                required
                class="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Enter your Twilio Auth Token"
              />
            </div>
          </div>

          <div>
            <label
              class="block text-sm font-medium text-content"
              for="twilio-messaging-service-sid"
            >
              Messaging Service SID
            </label>
            <div class="mt-2">
              <input
                id="twilio-messaging-service-sid"
                v-model="twilioForm.messagingServiceSid"
                type="text"
                class="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="MG... (for SMS)"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-content" for="twilio-whatsapp-from">
              WhatsApp From Number
            </label>
            <div class="mt-2">
              <input
                id="twilio-whatsapp-from"
                v-model="twilioForm.whatsappFrom"
                type="text"
                class="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="whatsapp:+1234567890"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-content" for="twilio-voice-from">
              Voice From Number
            </label>
            <div class="mt-2">
              <input
                id="twilio-voice-from"
                v-model="twilioForm.voiceFrom"
                type="text"
                class="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="+1234567890"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-content" for="twilio-staff-whatsapp">
              Staff WhatsApp Number
            </label>
            <div class="mt-2">
              <input
                id="twilio-staff-whatsapp"
                v-model="twilioForm.staffWhatsappNumber"
                type="text"
                class="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="whatsapp:+1234567890"
              />
            </div>
            <p class="mt-1 text-xs text-content-muted">
              Number to receive low-confidence AI alerts
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-content" for="twilio-on-call">
              On-Call Number
            </label>
            <div class="mt-2">
              <input
                id="twilio-on-call"
                v-model="twilioForm.onCallNumber"
                type="text"
                class="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="+1234567890"
              />
            </div>
            <p class="mt-1 text-xs text-content-muted">Number to call for emergency escalations</p>
          </div>

          <div
            v-if="twilioSubmitError"
            class="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {{ twilioSubmitError }}
          </div>
          <div
            v-if="twilioError && !twilioSubmitError"
            class="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {{ twilioError }}
          </div>

          <button
            type="submit"
            class="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
            :disabled="twilioStatus === 'connecting'"
          >
            <span v-if="twilioStatus !== 'connecting'">Connect Twilio</span>
            <span v-else class="flex items-center gap-2">
              <span
                class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
              />
              Connecting...
            </span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
