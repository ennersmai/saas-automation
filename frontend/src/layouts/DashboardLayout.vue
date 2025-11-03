<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  Dialog,
  DialogPanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Transition,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import {
  Bars3Icon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  LinkIcon,
  Squares2X2Icon,
  XMarkIcon,
  DocumentTextIcon,
  ArrowRightOnRectangleIcon,
  HomeIcon,
  BookOpenIcon,
} from '@heroicons/vue/24/outline';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/stores/auth.store';
import { useDashboardStore } from '@/stores/dashboard.store';

const sidebarOpen = ref(false);
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const dashboardStore = useDashboardStore();
const { user } = storeToRefs(authStore);
const { summary } = storeToRefs(dashboardStore);

// Fetch dashboard summary on mount to get integration status
onMounted(() => {
  void dashboardStore.fetchSummary();
});

// Check if all systems are nominal (Hostaway connected)
const isAllSystemsNominal = computed(() => {
  return summary.value?.integrations.hostaway.status === 'connected';
});

const navigation = computed(() => [
  {
    name: 'Dashboard',
    to: { name: 'dashboard' as const },
    icon: Squares2X2Icon,
  },
  {
    name: 'Inbox',
    to: { name: 'inbox' as const },
    icon: ChatBubbleLeftRightIcon,
  },
  {
    name: 'Templates',
    to: { name: 'templates' as const },
    icon: DocumentTextIcon,
  },
  {
    name: 'Knowledge Base',
    to: { name: 'knowledge-base' as const },
    icon: BookOpenIcon,
  },
  {
    name: 'Integrations',
    to: { name: 'integrations' as const },
    icon: LinkIcon,
  },
]);

const currentTitle = computed(() => (route.meta?.title as string | undefined) ?? 'Dashboard');

const displayName = computed(
  () => (user.value?.fullName as string | undefined) ?? user.value?.email ?? 'Account',
);

const tenantName = computed(() => {
  // Get tenant name from user profile (set by /auth/me endpoint)
  // The backend returns user.tenantName from the tenants table
  return user.value?.tenantName || null;
});

const initials = computed(() => {
  // Prefer tenant name initials (first letter of each word)
  if (tenantName.value) {
    // Extract initials from tenant name like "Voyage Collections (test)" -> "VC"
    // Remove parentheses and extra whitespace, then split into words
    const cleaned = tenantName.value.replace(/[()]/g, '').trim();
    const words = cleaned.split(/\s+/).filter((word) => word.length > 0 && /[a-zA-Z]/.test(word));

    if (words.length >= 2) {
      // Use first letter of first two words: "Voyage" + "Collections" = "VC"
      const first = words[0].match(/[a-zA-Z]/)?.[0] || '';
      const second = words[1].match(/[a-zA-Z]/)?.[0] || '';
      return (first + second).toUpperCase().padEnd(2, first.toUpperCase() || 'T');
    } else if (words.length === 1) {
      // Single word - use first two letters: "Voyage" = "VO"
      const letters = words[0].match(/[a-zA-Z]/g) || [];
      return (letters[0] + (letters[1] || letters[0])).toUpperCase();
    }
  }

  // Fall back to user name/email initials
  if (!user.value) {
    return 'UU';
  }

  const source = user.value.fullName ?? user.value.email ?? 'U';
  return source
    .split('@')[0]
    .split(/[^\w]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join('')
    .slice(0, 2)
    .padEnd(2, 'U');
});

const handleSignOut = () => {
  authStore.logout();
  router.push({ name: 'login' });
};
</script>

<template>
  <div class="min-h-screen bg-surface-muted">
    <TransitionRoot as="template" :show="sidebarOpen">
      <Dialog class="relative z-40 lg:hidden" @close="sidebarOpen = false">
        <TransitionChild
          as="template"
          enter="transition-opacity ease-linear duration-200"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="transition-opacity ease-linear duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-slate-900/50" />
        </TransitionChild>

        <div class="fixed inset-0 flex">
          <TransitionChild
            as="template"
            enter="transition ease-in-out duration-200 transform"
            enter-from="-translate-x-full"
            enter-to="translate-x-0"
            leave="transition ease-in-out duration-200 transform"
            leave-from="translate-x-0"
            leave-to="-translate-x-full"
          >
            <DialogPanel class="relative flex w-full max-w-xs flex-1 flex-col bg-surface shadow-xl">
              <div class="flex items-center justify-between px-4 py-4">
                <div class="flex-1 flex justify-center">
                  <img src="/logo.png" alt="Jeeves" class="h-12 w-auto" />
                </div>
                <button
                  type="button"
                  class="rounded-md p-2 text-content-muted hover:bg-surface-muted hover:text-content"
                  @click="sidebarOpen = false"
                >
                  <span class="sr-only">Close sidebar</span>
                  <XMarkIcon class="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              <nav class="px-4">
                <RouterLink
                  v-for="item in navigation"
                  :key="item.name"
                  :to="item.to"
                  class="group flex items-center gap-3 rounded-lg px-3 py-2 text-base font-medium"
                  :class="
                    route.name === item.to.name
                      ? 'bg-indigo-50 text-primary'
                      : 'text-content-muted hover:bg-surface-muted hover:text-content'
                  "
                  @click="sidebarOpen = false"
                >
                  <component
                    :is="item.icon"
                    class="h-5 w-5"
                    :class="route.name === item.to.name ? 'text-primary' : 'text-content-subtle'"
                    aria-hidden="true"
                  />
                  {{ item.name }}
                </RouterLink>
              </nav>
              <div class="mt-auto px-4 py-6">
                <button
                  class="text-sm font-medium text-danger hover:underline"
                  type="button"
                  @click="handleSignOut"
                >
                  Sign out
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </TransitionRoot>

    <div class="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div class="flex grow flex-col gap-y-8 border-r border-border bg-surface px-6 py-6">
        <div class="flex h-24 items-center justify-center">
          <img src="/logo.png" alt="Jeeves" class="h-12 w-auto" />
        </div>
        <nav class="flex flex-1 flex-col gap-y-2">
          <RouterLink
            v-for="item in navigation"
            :key="item.name"
            :to="item.to"
            class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium"
            :class="
              route.name === item.to.name
                ? 'bg-indigo-50 text-primary'
                : 'text-content-muted hover:bg-surface-muted hover:text-content'
            "
          >
            <component
              :is="item.icon"
              class="h-5 w-5"
              :class="route.name === item.to.name ? 'text-primary' : 'text-content-subtle'"
              aria-hidden="true"
            />
            {{ item.name }}
          </RouterLink>
        </nav>

        <!-- System Status Indicator -->
        <div v-if="isAllSystemsNominal" class="mt-auto pt-4 border-t border-border">
          <div class="flex items-center gap-2 text-xs text-content-muted">
            <span class="inline-block h-2 w-2 rounded-full bg-success"></span>
            <span class="font-medium">All systems nominal</span>
          </div>
        </div>
      </div>
    </div>

    <div class="lg:pl-64">
      <div
        class="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-surface/90 px-4 backdrop-blur lg:px-8"
      >
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-md p-2 text-content-muted focus:outline-none focus:ring-2 focus:ring-primary lg:hidden"
          @click="sidebarOpen = true"
        >
          <span class="sr-only">Open sidebar</span>
          <Bars3Icon class="h-6 w-6" aria-hidden="true" />
        </button>
        <div class="flex flex-1 flex-col">
          <p class="text-xs uppercase tracking-wide text-content-subtle">Overview</p>
          <h1 class="text-lg font-semibold text-content">{{ currentTitle }}</h1>
        </div>
        <Menu as="div" class="relative inline-block text-left">
          <div>
            <MenuButton
              class="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content shadow-sm hover:border-primary/40"
            >
              <span
                class="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
              >
                {{ initials }}
              </span>
              <span class="hidden text-left leading-5 sm:block">
                <span class="block text-sm font-semibold text-content">{{ displayName }}</span>
                <span class="block text-xs text-content-subtle">{{ user?.email }}</span>
              </span>
              <Cog6ToothIcon class="h-5 w-5 text-content-subtle" aria-hidden="true" />
            </MenuButton>
          </div>

          <Transition
            enter="transition ease-out duration-100"
            enter-from="transform opacity-0 scale-95"
            enter-to="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leave-from="transform opacity-100 scale-100"
            leave-to="transform opacity-0 scale-95"
          >
            <MenuItems
              class="absolute right-0 z-40 mt-2 w-48 origin-top-right rounded-lg border border-border bg-surface py-2 shadow-lg focus:outline-none"
            >
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-content"
                  :class="active ? 'bg-surface-muted' : ''"
                  @click="router.push({ name: 'landing' })"
                >
                  <HomeIcon class="h-4 w-4 text-content-subtle" aria-hidden="true" />
                  Homepage
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-content"
                  :class="active ? 'bg-surface-muted' : ''"
                  @click="router.push({ name: 'dashboard' })"
                >
                  <Squares2X2Icon class="h-4 w-4 text-content-subtle" aria-hidden="true" />
                  Dashboard
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger"
                  :class="active ? 'bg-surface-muted' : ''"
                  @click="handleSignOut"
                >
                  <ArrowRightOnRectangleIcon class="h-4 w-4 text-danger" aria-hidden="true" />
                  Sign out
                </button>
              </MenuItem>
            </MenuItems>
          </Transition>
        </Menu>
      </div>

      <main class="px-4 py-8 lg:px-8">
        <div class="mx-auto max-w-7xl">
          <RouterView />
        </div>
      </main>

      <!-- Footer -->
      <footer class="border-t border-border bg-surface px-4 py-6 lg:px-8">
        <div class="mx-auto max-w-7xl">
          <div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p class="text-sm text-content-muted">
              © {{ new Date().getFullYear() }}
              <a href="https://meetjeeves.ai" class="font-medium text-primary hover:underline"
                >meetjeeves.ai</a
              >. All rights reserved.
            </p>
            <div class="flex gap-6 text-sm text-content-muted">
              <a href="/terms" class="hover:text-content">Terms</a>
              <a href="/privacy" class="hover:text-content">Privacy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>
