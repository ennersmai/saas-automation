<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import { ArrowPathIcon, ArrowLeftIcon } from '@heroicons/vue/24/outline';

import { useConversationsStore } from '@/stores/conversations.store';
import { templatesApi, type TemplateResponse } from '@/services/api.client';

const conversationsStore = useConversationsStore();
const route = useRoute();
const router = useRouter();

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  thank_you_immediate: 'Booking Confirmation',
  pre_arrival_24h: '24h Pre-Arrival Instructions',
  door_code_3h: '3h Pre-Check-in Door Code',
  same_day_checkin: 'Same-Day Booking Instant Code',
  checkout_morning: 'Checkout Morning Reminder',
};

const {
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
} = storeToRefs(conversationsStore);

const conversationId = computed(() => (route.params.conversationId as string | undefined) ?? null);

const composerMessage = ref('');
const isAutomated = computed(() => detail.value?.status === 'automated');
const hasPendingMessages = computed(() => (detail.value?.pendingMessageCount ?? 0) > 0);
const sendDisabled = computed(
  () => sendingReply.value || composerMessage.value.trim().length === 0,
);

const loadConversation = async (id: string | null) => {
  if (!id) {
    detail.value = null;
    return;
  }

  await conversationsStore.selectConversation(id);
};

watch(
  conversationId,
  (id) => {
    void loadConversation(id);
    composerMessage.value = '';
    sendingReplyError.value = null;
    automationActionError.value = null;
    cancelMessageError.value = null;
    cancelAllError.value = null;
    cancelingMessageIds.value = new Set();
  },
  { immediate: true },
);

const formatDateTime = (value: string | null | undefined, timezone?: string | null) => {
  if (!value) {
    return '--';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone ?? undefined,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  } catch {
    return parsed.toLocaleString();
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Sending';
    case 'sent':
      return 'Sent';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
};

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    case 'processing':
      return 'bg-sky-100 text-sky-700';
    case 'sent':
      return 'bg-success/10 text-success';
    case 'failed':
      return 'bg-danger/10 text-danger';
    default:
      return 'bg-surface-muted text-content-subtle';
  }
};

const senderLabel = (senderType: string) => {
  switch (senderType) {
    case 'guest':
      return 'Guest';
    case 'human':
      return 'Team';
    case 'ai':
      return 'Assistant';
    case 'system':
      return 'System';
    default:
      return senderType;
  }
};

const messageAlignmentClass = (senderType: string) => {
  if (senderType === 'guest') {
    return 'items-start text-left';
  }

  return 'items-end text-right';
};

const messageBubbleClass = (senderType: string) => {
  if (senderType === 'guest') {
    return 'bg-surface px-4 py-3';
  }
  if (senderType === 'human') {
    return 'bg-indigo-50 text-primary px-4 py-3 text-left';
  }
  return 'bg-surface-muted px-4 py-3 text-left';
};

const resolveMessageLabel = (messageType: string | null | undefined) => {
  if (!messageType) {
    return null;
  }
  return MESSAGE_TYPE_LABELS[messageType] ?? messageType;
};

const extractMessageLabel = (metadata: Record<string, unknown> | undefined) => {
  const label =
    metadata && typeof metadata.messageLabel === 'string' ? metadata.messageLabel : null;
  if (label && label.trim().length > 0) {
    return label;
  }

  const type = metadata && typeof metadata.messageType === 'string' ? metadata.messageType : null;
  return resolveMessageLabel(type);
};

const extractScheduledLocal = (metadata: Record<string, unknown> | undefined) => {
  if (!metadata) {
    return null;
  }

  const timestamp =
    typeof metadata.scheduledLocalAt === 'string' ? metadata.scheduledLocalAt : null;
  const timezone =
    typeof metadata.scheduledTimezone === 'string' ? metadata.scheduledTimezone : null;

  if (!timestamp) {
    return null;
  }

  return { timestamp, timezone };
};

const describeScheduledLocal = (metadata: Record<string, unknown> | undefined): string | null => {
  const local = extractScheduledLocal(metadata);
  if (!local) {
    return null;
  }

  return local.timezone ? `${local.timestamp} (${local.timezone})` : local.timestamp;
};

const isMessageCancelable = (status: string) => status === 'pending' || status === 'processing';
const isCancellingMessage = (logId: string) => cancelingMessageIds.value.has(logId);

const handleSend = async () => {
  if (!conversationId.value) {
    return;
  }

  const message = composerMessage.value.trim();
  if (!message) {
    return;
  }

  try {
    await conversationsStore.sendHumanReply(conversationId.value, message);
    composerMessage.value = '';
  } catch (error) {
    // handled via store state
  }
};

const toggleAutomation = async () => {
  if (!conversationId.value || automationActionLoading.value) {
    return;
  }

  try {
    if (isAutomated.value) {
      await conversationsStore.pauseConversation(conversationId.value);
    } else {
      await conversationsStore.resumeConversation(conversationId.value);
    }
  } catch (error) {
    // handled via store state
  }
};

const cancelMessage = async (logId: string) => {
  if (!conversationId.value) {
    return;
  }

  try {
    await conversationsStore.cancelPendingMessage(conversationId.value, logId);
  } catch (error) {
    // handled via store state
  }
};

const cancelAllPending = async () => {
  if (!conversationId.value || cancelAllLoading.value) {
    return;
  }

  try {
    await conversationsStore.cancelAllPendingMessages(conversationId.value);
  } catch (error) {
    // handled via store state
  }
};

const pickerOpen = ref(false);
const pickerLoading = ref(false);
const pickerSearch = ref('');
const pickerFilter = ref<'all' | 'proactive' | 'reply' | 'keyword' | 'custom'>('all');
const pickerTemplates = ref<TemplateResponse[]>([]);

const openTemplatePicker = async () => {
  pickerOpen.value = true;
  pickerLoading.value = true;
  try {
    pickerTemplates.value = await templatesApi.getTemplates();
  } finally {
    pickerLoading.value = false;
  }
};

const visibleTemplates = computed(() => {
  const q = pickerSearch.value.trim().toLowerCase();
  const filter = pickerFilter.value;
  return pickerTemplates.value.filter((t) => {
    const matchQ =
      q.length === 0 ||
      t.name.toLowerCase().includes(q) ||
      t.template_body.toLowerCase().includes(q);
    if (!matchQ) return false;
    if (filter === 'all') return true;
    if (filter === 'proactive')
      return [
        'thank_you_immediate',
        'pre_arrival_24h',
        'door_code_3h',
        'same_day_checkin',
        'checkout_morning',
        'post_booking_followup',
        'pre_checkout_evening',
      ].includes(t.trigger_type);
    if (filter === 'reply') return t.trigger_type === 'host_message_reply';
    if (filter === 'keyword') return t.trigger_type === 'message_received_keyword';
    if (filter === 'custom') return t.trigger_type === 'custom_hostaway';
    return true;
  });
});

const handleSendPicked = async (tpl: TemplateResponse) => {
  if (!conversationId.value) return;
  try {
    await conversationsStore.sendTemplateReply(conversationId.value, tpl.id);
    pickerOpen.value = false;
  } catch {}
};

const handleSyncHistory = async () => {
  if (!conversationId.value || syncingHistory.value) {
    return;
  }

  try {
    await conversationsStore.syncConversationHistory(conversationId.value);
  } catch (error) {
    // Error is handled via store state
  }
};
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <!-- Back button for mobile -->
        <button
          type="button"
          @click="router.push({ name: 'inbox' })"
          class="lg:hidden flex-shrink-0 rounded-md p-1.5 text-content-muted hover:bg-surface-muted hover:text-content"
          aria-label="Back to inbox"
        >
          <ArrowLeftIcon class="h-5 w-5" />
        </button>
        <div class="min-w-0 flex-1">
          <h2 class="text-lg font-semibold text-content truncate">
            {{ detail?.guestName ?? 'Guest' }}
          </h2>
          <p v-if="detail" class="mt-0.5 text-xs text-content-subtle">
            Booking
            {{
              detail.bookingExternalId && detail.bookingExternalId.trim().length > 0
                ? detail.bookingExternalId
                : detail.bookingId
            }}
          </p>
          <p class="mt-1 text-xs text-content-subtle">
            {{
              detail?.status === 'automated'
                ? 'Automation is active for this conversation.'
                : 'Automation paused. Human responses required.'
            }}
          </p>
        </div>
      </div>
      <button
        v-if="detail"
        type="button"
        class="flex-shrink-0 rounded-md border border-border bg-surface px-3 py-1 text-xs font-medium text-content hover:border-primary/40 disabled:opacity-60"
        :disabled="automationActionLoading"
        @click="toggleAutomation"
      >
        {{
          automationActionLoading
            ? 'Updating…'
            : isAutomated
            ? 'Pause Automation'
            : 'Resume Automation'
        }}
      </button>
    </div>
    <p v-if="automationActionError" class="px-5 pt-2 text-xs text-danger">
      {{ automationActionError }}
    </p>
    <div class="flex-1 overflow-hidden">
      <div
        v-if="detailLoading"
        class="flex h-full items-center justify-center px-6 py-10 text-sm text-content-muted"
      >
        Loading conversation...
      </div>
      <div
        v-else-if="detailError"
        class="flex h-full items-center justify-center px-6 py-10 text-sm text-danger"
      >
        {{ detailError }}
      </div>
      <div v-else-if="detail" class="flex h-full flex-col gap-4 px-5 py-5">
        <div
          class="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-content-subtle"
        >
          <div class="flex flex-col sm:flex-row sm:flex-wrap items-start gap-3">
            <div class="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3">
              <span>
                Last update:
                <strong class="text-content">
                  {{ formatDateTime(detail.lastMessageAt ?? detail.updatedAt) }}
                </strong>
              </span>
              <span v-if="detail.nextPendingAt">
                Next send:
                <strong class="text-content">
                  {{ detail.nextPendingLabel ?? detail.nextPendingType ?? 'Scheduled message' }}
                </strong>
                at
                <strong class="text-content">
                  {{
                    formatDateTime(
                      detail.nextPendingLocalAt ?? detail.nextPendingAt,
                      detail.nextPendingTimezone ?? null,
                    )
                  }}
                </strong>
                <span v-if="detail.nextPendingTimezone" class="text-content">
                  ({{ detail.nextPendingTimezone }})
                </span>
              </span>
              <span v-else class="text-content-muted"> No pending automations </span>
              <span>
                Pending messages:
                <strong class="text-content">{{ detail.pendingMessageCount }}</strong>
              </span>
              <span>
                Conversation status:
                <strong class="text-content">
                  {{ detail.status === 'automated' ? 'Automated' : 'Paused by human' }}
                </strong>
              </span>
            </div>
            <div class="ml-auto flex items-center gap-2">
              <button
                v-if="detail.bookingExternalId"
                type="button"
                class="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1 text-xs font-medium text-content hover:border-primary/40 disabled:opacity-60"
                :disabled="syncingHistory"
                @click="handleSyncHistory"
              >
                <ArrowPathIcon :class="['h-3.5 w-3.5', { 'animate-spin': syncingHistory }]" />
                {{ syncingHistory ? 'Syncing…' : 'Sync History' }}
              </button>
              <button
                v-if="hasPendingMessages"
                type="button"
                class="rounded-md border border-border px-3 py-1 text-xs font-medium text-danger hover:border-danger/60 disabled:opacity-60"
                :disabled="cancelAllLoading"
                @click="cancelAllPending"
              >
                {{ cancelAllLoading ? 'Cancelling…' : 'Cancel Pending Messages' }}
              </button>
            </div>
          </div>
          <p v-if="detail.hostawayConversationId" class="mt-2 text-[11px] text-content-muted">
            Hostaway conversation: {{ detail.hostawayConversationId }}
          </p>
        </div>
        <p v-if="cancelAllError" class="text-xs text-danger">
          {{ cancelAllError }}
        </p>
        <p v-if="cancelMessageError" class="text-xs text-danger">
          {{ cancelMessageError }}
        </p>
        <p v-if="syncHistoryError" class="text-xs text-danger">
          {{ syncHistoryError }}
        </p>
        <div
          class="flex-1 overflow-y-auto rounded-xl border border-border bg-surface-muted p-4 overflow-x-hidden"
        >
          <ul class="flex flex-col gap-4">
            <li
              v-for="log in detail.logs"
              :key="log.id"
              class="flex flex-col"
              :class="messageAlignmentClass(log.senderType)"
            >
              <div class="flex items-center gap-3 text-xs text-content-subtle">
                <span class="font-semibold uppercase tracking-wide text-content-subtle">
                  {{ senderLabel(log.senderType) }}
                </span>
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                  :class="statusBadgeClass(log.status)"
                >
                  {{ statusLabel(log.status) }}
                </span>
                <span>{{ formatDateTime(log.actualSentAt ?? log.sentAt) }}</span>
              </div>
              <div
                class="mt-2 max-w-xl rounded-xl text-sm text-content shadow-sm break-words"
                :class="messageBubbleClass(log.senderType)"
              >
                <p class="whitespace-pre-wrap">{{ log.messageBody }}</p>
                <p
                  v-if="log.status !== 'sent' && log.scheduledSendAt"
                  class="mt-2 text-xs text-content-subtle"
                >
                  Scheduled {{ formatDateTime(log.scheduledSendAt) }}
                </p>
                <p
                  v-if="describeScheduledLocal(log.metadata)"
                  class="mt-2 text-xs text-content-muted"
                >
                  Local send time: {{ describeScheduledLocal(log.metadata) }}
                </p>
                <p
                  v-if="log.status === 'failed' && log.errorMessage"
                  class="mt-2 text-xs text-danger"
                >
                  {{ log.errorMessage }}
                </p>
                <p v-if="extractMessageLabel(log.metadata)" class="mt-2 text-xs text-content-muted">
                  Message type: {{ extractMessageLabel(log.metadata) }}
                </p>
              </div>
              <div v-if="isMessageCancelable(log.status)" class="mt-2 flex justify-end">
                <button
                  type="button"
                  class="text-xs font-medium text-danger underline-offset-2 hover:underline disabled:opacity-60"
                  :disabled="isCancellingMessage(log.id) || cancelAllLoading"
                  @click="cancelMessage(log.id)"
                >
                  {{ isCancellingMessage(log.id) ? 'Cancelling…' : 'Cancel message' }}
                </button>
              </div>
            </li>
          </ul>
        </div>
      </div>
      <div
        v-else
        class="flex h-full items-center justify-center px-6 py-10 text-sm text-content-muted"
      >
        Conversation not found.
      </div>
    </div>
    <form v-if="detail" class="border-t border-border px-5 py-4" @submit.prevent="handleSend">
      <label class="block text-xs font-semibold uppercase tracking-wide text-content-subtle">
        Send a manual message
      </label>
      <textarea
        v-model="composerMessage"
        class="mt-2 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content outline-none focus:border-primary"
        rows="3"
        placeholder="Type your reply…"
        :disabled="sendingReply"
      ></textarea>
      <div class="mt-3 flex items-center justify-between">
        <span v-if="sendingReplyError" class="text-xs text-danger">
          {{ sendingReplyError }}
        </span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-content hover:border-primary/40 disabled:opacity-60"
            :disabled="sendingReply"
            @click="openTemplatePicker"
          >
            Send template
          </button>
          <button
            type="submit"
            class="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            :disabled="sendDisabled"
          >
            {{ sendingReply ? 'Sending…' : 'Send Message' }}
          </button>
        </div>
      </div>
    </form>
    <!-- Template Picker Modal -->
    <div v-if="pickerOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="w-full max-w-2xl rounded-lg border border-border bg-white p-4 shadow-lg">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-content">Send a template</h3>
          <button class="text-content-muted" @click="pickerOpen = false">✕</button>
        </div>
        <div class="mt-3 flex items-center gap-2">
          <input
            v-model="pickerSearch"
            type="text"
            placeholder="Search templates…"
            class="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-content outline-none focus:border-primary"
          />
          <select
            v-model="pickerFilter"
            class="rounded-md border border-border bg-surface px-2 py-2 text-sm text-content"
          >
            <option value="all">All</option>
            <option value="proactive">Proactive</option>
            <option value="reply">Host reply</option>
            <option value="keyword">Keyword</option>
            <option value="custom">Imported</option>
          </select>
        </div>
        <div class="mt-3 max-h-80 overflow-y-auto rounded-md border border-border">
          <div v-if="pickerLoading" class="p-4 text-sm text-content-muted">Loading…</div>
          <ul v-else>
            <li
              v-for="tpl in visibleTemplates"
              :key="tpl.id"
              class="flex items-start justify-between gap-3 border-b border-border p-3 last:border-b-0"
            >
              <div>
                <div class="text-sm font-medium text-content">{{ tpl.name }}</div>
                <div class="mt-1 text-xs text-content-subtle">{{ tpl.trigger_type }}</div>
                <div class="mt-1 line-clamp-2 text-xs text-content-muted">
                  {{ tpl.template_body }}
                </div>
              </div>
              <button
                class="self-center rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white"
                @click="handleSendPicked(tpl)"
              >
                Send
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
