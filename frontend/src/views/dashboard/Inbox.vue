<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute, useRouter } from 'vue-router';

import { useConversationsStore } from '@/stores/conversations.store';

const conversationsStore = useConversationsStore();
const router = useRouter();
const route = useRoute();

const { conversations, conversationsTotal, conversationsLoading, conversationsError } =
  storeToRefs(conversationsStore);

// Filters
const selectedDays = ref(30);
const selectedStatus = ref<string | undefined>(undefined);
const currentPage = ref(1);
const pageSize = 50;

const activeConversationId = computed(
  () => (route.params.conversationId as string | undefined) ?? null,
);

const hasConversations = computed(() => conversations.value.length > 0);

const formatTimestamp = (value: string | null | undefined, timezone?: string | null) => {
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

const conversationStatusLabel = (status: 'automated' | 'paused_by_human') =>
  status === 'automated' ? 'Automated' : 'Paused by human';

const conversationStatusClass = (status: 'automated' | 'paused_by_human') =>
  status === 'automated' ? 'text-emerald-600' : 'text-amber-600';

const selectConversation = (conversationId: string) => {
  if (!conversationId || conversationId === activeConversationId.value) {
    return;
  }

  router.push({ name: 'conversation-detail', params: { conversationId } }).catch(() => undefined);
};

const refresh = async () => {
  await conversationsStore.fetchConversations({
    limit: pageSize,
    offset: (currentPage.value - 1) * pageSize,
    status: selectedStatus.value,
    days: selectedDays.value,
  });
};

const onDaysChange = () => {
  currentPage.value = 1;
  refresh();
};

const onStatusChange = () => {
  currentPage.value = 1;
  refresh();
};

const goToPage = (page: number) => {
  currentPage.value = page;
  refresh();
};

const totalPages = computed(() => Math.ceil(conversationsTotal.value / pageSize));

onMounted(() => {
  if (!conversationsLoading.value && conversations.value.length === 0) {
    void refresh().then(() => {
      if (!route.params.conversationId && conversationsStore.conversations.length > 0) {
        const firstConversation = conversationsStore.conversations[0];
        router
          .replace({
            name: 'conversation-detail',
            params: { conversationId: firstConversation.id },
          })
          .catch(() => undefined);
      }
    });
  }
});
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[340px_1fr]">
    <!-- Conversation List - Hidden on mobile when viewing a conversation -->
    <div
      class="rounded-2xl border border-border bg-surface shadow-soft"
      :class="activeConversationId ? 'hidden lg:block' : 'block'"
    >
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p class="text-sm font-semibold text-content">Inbox</p>
          <p class="text-xs text-content-subtle">
            Monitor guest conversations and automation status.
          </p>
        </div>
        <button
          type="button"
          class="rounded-md border border-border bg-surface px-3 py-1 text-xs font-medium text-content hover:border-primary/40"
          @click="refresh"
        >
          Refresh
        </button>
      </div>

      <!-- Filters -->
      <div class="border-b border-border px-4 py-3 space-y-3">
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-content-muted whitespace-nowrap">Show next:</label>
          <select
            v-model="selectedDays"
            class="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-content focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            @change="onDaysChange"
          >
            <option :value="7">7 days</option>
            <option :value="14">14 days</option>
            <option :value="30">30 days</option>
            <option :value="60">60 days</option>
            <option :value="90">90 days</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-content-muted whitespace-nowrap">Status:</label>
          <select
            v-model="selectedStatus"
            class="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-content focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            @change="onStatusChange"
          >
            <option :value="undefined">All</option>
            <option value="automated">Automated</option>
            <option value="paused_by_human">Paused</option>
          </select>
        </div>
        <div v-if="conversationsTotal > 0" class="text-xs text-content-subtle">
          Showing {{ (currentPage - 1) * pageSize + 1 }}-{{
            Math.min(currentPage * pageSize, conversationsTotal)
          }}
          of {{ conversationsTotal }} conversations
        </div>
      </div>

      <div v-if="conversationsLoading" class="px-4 py-6 text-sm text-content-muted">
        Loading conversations...
      </div>
      <div v-else-if="conversationsError" class="px-4 py-6 text-sm text-danger">
        {{ conversationsError }}
      </div>
      <ul v-else-if="hasConversations" class="divide-y divide-border">
        <li v-for="conversation in conversations" :key="conversation.id">
          <button
            type="button"
            class="flex w-full flex-col gap-2 px-4 py-3 text-left transition"
            :class="
              conversation.id === activeConversationId
                ? 'bg-indigo-50 text-primary'
                : 'hover:bg-surface-muted'
            "
            @click="selectConversation(conversation.id)"
          >
            <div class="flex items-start justify-between gap-2 min-w-0">
              <div class="flex flex-col min-w-0 flex-1">
                <span class="text-sm font-semibold text-content truncate">
                  {{ conversation.guestName ?? 'Guest' }}
                </span>
                <span class="text-xs text-content-subtle truncate">
                  {{ conversation.propertyName ? conversation.propertyName + ' · ' : '' }}Booking
                  {{
                    conversation.bookingExternalId &&
                    conversation.bookingExternalId.trim().length > 0
                      ? conversation.bookingExternalId
                      : conversation.bookingId
                  }}
                </span>
                <span
                  v-if="conversation.checkInAt || conversation.checkOutAt"
                  class="text-xs text-content-muted mt-0.5 break-words"
                >
                  <template v-if="conversation.checkInAt">
                    Check-in: {{ formatTimestamp(conversation.checkInAt) }}
                  </template>
                  <template v-if="conversation.checkInAt && conversation.checkOutAt"> · </template>
                  <template v-if="conversation.checkOutAt">
                    Check-out: {{ formatTimestamp(conversation.checkOutAt) }}
                  </template>
                </span>
              </div>
              <span
                class="text-xs font-medium flex-shrink-0 ml-2"
                :class="conversationStatusClass(conversation.status)"
              >
                {{ conversationStatusLabel(conversation.status) }}
              </span>
            </div>
            <div
              class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-content-subtle"
            >
              <span class="break-words">
                <template v-if="conversation.nextPendingAt">
                  Next:
                  {{
                    conversation.nextPendingLabel ??
                    conversation.nextPendingType ??
                    'Scheduled message'
                  }}
                  at
                  {{
                    formatTimestamp(
                      conversation.nextPendingLocalAt ?? conversation.nextPendingAt,
                      conversation.nextPendingTimezone ?? undefined,
                    )
                  }}
                  <template v-if="conversation.nextPendingTimezone">
                    ({{ conversation.nextPendingTimezone }})
                  </template>
                </template>
                <template v-else> No pending automations </template>
              </span>
              <span
                v-if="conversation.pendingMessageCount > 0"
                class="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 self-start sm:self-auto"
              >
                {{ conversation.pendingMessageCount }} pending
              </span>
            </div>
          </button>
        </li>
      </ul>
      <div v-else class="px-4 py-6 text-sm text-content-muted">
        No conversations yet. Messages will appear once automations run.
      </div>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between border-t border-border px-4 py-3"
      >
        <button
          type="button"
          class="rounded-md border border-border bg-surface px-3 py-1 text-xs font-medium text-content hover:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
        >
          Previous
        </button>
        <span class="text-xs text-content-subtle">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <button
          type="button"
          class="rounded-md border border-border bg-surface px-3 py-1 text-xs font-medium text-content hover:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Conversation Detail - Full width on mobile when viewing, hidden when no conversation selected on mobile -->
    <div
      class="min-h-[420px] rounded-2xl border border-border bg-surface shadow-soft"
      :class="!activeConversationId ? 'hidden lg:block' : 'block'"
    >
      <RouterView v-slot="{ Component }">
        <component :is="Component" v-if="Component" />
        <div
          v-else
          class="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center"
        >
          <h2 class="text-lg font-semibold text-content">Select a conversation</h2>
          <p class="text-sm text-content-muted">
            Choose a conversation from the inbox to inspect the full message history and automation
            status.
          </p>
        </div>
      </RouterView>
    </div>
  </div>
</template>
