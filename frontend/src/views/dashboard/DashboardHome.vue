<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';

import { useAuthStore } from '@/stores/auth.store';
import { useDashboardStore } from '@/stores/dashboard.store';
import { useIntegrationsStore } from '@/stores/integrations.store';

const authStore = useAuthStore();
const dashboardStore = useDashboardStore();
const integrationsStore = useIntegrationsStore();

const { user } = storeToRefs(authStore);
const { summary, loading, error } = storeToRefs(dashboardStore);
const { syncStatus } = storeToRefs(integrationsStore);

const displayName = computed(() => {
  // Prefer tenant name (company name) over user full name or email
  if (user.value?.tenantName) {
    return user.value.tenantName;
  }
  return user.value?.fullName ?? user.value?.email ?? null;
});
const hasSummary = computed(() => Boolean(summary.value));

const hostawayStatusLabel = computed(() => {
  const info = summary.value?.integrations.hostaway;
  if (!info) {
    return 'Status unavailable';
  }

  if (info.status === 'connected') {
    return info.dryRun ? 'Connected (dry run)' : 'Connected';
  }

  return 'Not connected';
});

const hostawayBadgeClass = computed(() => {
  const info = summary.value?.integrations.hostaway;
  if (!info) {
    return 'bg-surface-muted text-content-subtle';
  }

  return info.status === 'connected' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger';
});

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return '--';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return '--';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
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

const bookingLabel = (bookingExternalId: string | null, bookingId: string | null | undefined) => {
  if (bookingExternalId && bookingExternalId.trim().length > 0) {
    return bookingExternalId;
  }
  if (bookingId && bookingId.trim().length > 0) {
    return bookingId;
  }
  return '--';
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

const messageTimestamp = (message: {
  actualSentAt: string | null;
  sentAt: string;
  scheduledSendAt: string | null;
}) => {
  return formatDateTime(message.actualSentAt ?? message.sentAt ?? message.scheduledSendAt);
};

const refresh = async () => {
  await dashboardStore.fetchSummary().catch(() => undefined);
};

// Watch for sync completion to refresh dashboard data
let previousSyncStatus = syncStatus.value;
watch(syncStatus, (newStatus) => {
  // If sync just completed (changed from 'syncing' to 'completed'), refresh dashboard
  if (previousSyncStatus === 'syncing' && newStatus === 'completed') {
    void refresh();
  }
  previousSyncStatus = newStatus;
});

onMounted(() => {
  if (!summary.value) {
    void refresh();
  }
});
</script>

<template>
  <div class="space-y-8">
    <div class="rounded-2xl border border-border bg-surface p-6 shadow-soft">
      <div class="flex flex-col gap-4 justify-between lg:flex-row lg:items-start">
        <div>
          <p class="text-sm uppercase tracking-wide text-content-subtle">Welcome back</p>
          <h2 class="mt-1 text-2xl font-semibold text-content">
            <span v-if="displayName">{{ displayName }}</span>
            <span v-else>Dashboard</span>
          </h2>
          <p class="mt-2 text-sm text-content-muted">
            Monitor reservations, guest conversations, and automation activity in one place.
          </p>
        </div>
        <div class="flex flex-col items-start gap-3 lg:items-end">
          <span
            class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
            :class="hostawayBadgeClass"
          >
            <span
              class="inline-block h-2 w-2 rounded-full"
              :class="
                summary?.integrations.hostaway.status === 'connected' ? 'bg-success' : 'bg-danger'
              "
            />
            {{ hostawayStatusLabel }}
          </span>
          <button
            type="button"
            class="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-content shadow-sm hover:border-primary/50"
            @click="refresh"
          >
            Refresh data
          </button>
        </div>
      </div>
      <div v-if="error" class="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
        {{ error }}
      </div>
    </div>

    <div v-if="hasSummary" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <p class="text-xs uppercase tracking-wide text-content-subtle">Upcoming stays (30 days)</p>
        <p class="mt-3 text-3xl font-semibold text-content">
          {{ summary?.metrics.reservations.upcoming30Days ?? 0 }}
        </p>
        <p class="mt-1 text-sm text-content-muted">
          Reservations scheduled to arrive in the next 30 days.
        </p>
      </div>
      <div class="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <p class="text-xs uppercase tracking-wide text-content-subtle">Arrivals today</p>
        <p class="mt-3 text-3xl font-semibold text-content">
          {{ summary?.metrics.reservations.arrivalsToday ?? 0 }}
        </p>
        <p class="mt-1 text-sm text-content-muted">Guests expected to check in today.</p>
      </div>
      <div class="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <p class="text-xs uppercase tracking-wide text-content-subtle">Automated conversations</p>
        <p class="mt-3 text-3xl font-semibold text-content">
          {{ summary?.metrics.conversations.automated ?? 0 }}
        </p>
        <p class="mt-1 text-sm text-content-muted">
          Conversations currently handled by the assistant.
        </p>
      </div>
      <div class="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <p class="text-xs uppercase tracking-wide text-content-subtle">Messages (24h)</p>
        <p class="mt-3 text-3xl font-semibold text-content">
          {{ summary?.metrics.conversations.messagesLast24h ?? 0 }}
        </p>
        <p class="mt-1 text-sm text-content-muted">
          Total inbound and outbound messages in the last 24 hours.
        </p>
      </div>
    </div>

    <div
      v-else-if="loading"
      class="rounded-2xl border border-border bg-surface p-6 text-sm text-content-muted shadow-soft"
    >
      Loading dashboard metrics...
    </div>

    <div v-if="hasSummary" class="grid gap-6 xl:grid-cols-2">
      <div class="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-content">Upcoming arrivals</h3>
            <p class="text-sm text-content-muted">
              Stays beginning soon, based on Hostaway reservations.
            </p>
          </div>
        </div>
        <div v-if="summary?.upcomingReservations.length" class="mt-4 space-y-3">
          <div
            v-for="reservation in summary?.upcomingReservations"
            :key="reservation.id"
            class="rounded-xl border border-border bg-surface-muted px-4 py-3"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-content">{{ reservation.guestName }}</p>
                <p class="text-xs text-content-subtle">
                  {{ reservation.propertyName }}
                </p>
              </div>
              <span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {{ reservation.status }}
              </span>
            </div>
            <div class="mt-2 flex items-center gap-3 text-xs text-content-muted">
              <span class="rounded-full bg-surface px-2 py-1 font-medium text-content">
                {{ formatDate(reservation.checkInAt) }}
              </span>
              <span>-></span>
              <span>{{ formatDate(reservation.checkOutAt) }}</span>
            </div>
          </div>
        </div>
        <p v-else class="mt-4 text-sm text-content-muted">No upcoming reservations on file yet.</p>
      </div>

      <div class="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-content">Recent activity</h3>
            <p class="text-sm text-content-muted">Latest guest messages and assistant replies.</p>
          </div>
        </div>
        <div v-if="summary?.recentMessages.length" class="mt-4 space-y-3">
          <div
            v-for="message in summary?.recentMessages"
            :key="message.id"
            class="rounded-xl border border-border bg-surface-muted px-4 py-3"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold uppercase tracking-wide text-content-subtle">
                  {{ senderLabel(message.senderType) }}
                </span>
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                  :class="statusBadgeClass(message.status)"
                >
                  {{ statusLabel(message.status) }}
                </span>
              </div>
              <span class="text-xs text-content-muted">
                {{ messageTimestamp(message) }}
              </span>
            </div>
            <p class="mt-2 text-sm text-content">
              {{ message.messageBody }}
            </p>
            <p v-if="message.status !== 'sent'" class="mt-1 text-xs text-content-muted">
              Scheduled {{ formatDateTime(message.scheduledSendAt) }}
            </p>
            <p class="mt-2 text-xs text-content-subtle">
              {{ message.guestName }} - Booking
              {{ bookingLabel(message.bookingExternalId ?? null, message.bookingId ?? null) }}
            </p>
          </div>
        </div>
        <p v-else class="mt-4 text-sm text-content-muted">
          No recent messages yet. Incoming and outgoing messages will appear here.
        </p>
      </div>
    </div>
  </div>
</template>
