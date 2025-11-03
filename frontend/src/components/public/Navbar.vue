<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/auth.store';
import { supabase } from '@/services/supabase.client';

const router = useRouter();
const authStore = useAuthStore();
const { user } = storeToRefs(authStore);
const isAuthenticated = ref(false);

const mobileMenuOpen = ref(false);

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value;
};

const checkAuth = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  isAuthenticated.value = Boolean(session);
};

const handleLogout = async () => {
  await authStore.logout();
  await router.push({ name: 'landing' });
  mobileMenuOpen.value = false;
};

const displayName = computed(() => {
  if (user.value?.tenantName) {
    return user.value.tenantName;
  }
  return user.value?.fullName ?? user.value?.email ?? 'Account';
});

onMounted(async () => {
  await authStore.initialize();
  await checkAuth();

  // Listen for auth changes
  supabase.auth.onAuthStateChange(() => {
    checkAuth();
  });
});
</script>

<template>
  <nav class="bg-gray-900">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="flex h-16 items-center justify-between">
        <!-- Logo slot -->
        <div class="flex-shrink-0 -ml-2">
          <slot name="logo">
            <RouterLink to="/" class="flex items-center">
              <img
                src="/logo.png"
                alt="Jeeves"
                class="h-12 w-auto rounded-full border-[6px] border-indigo-600"
              />
            </RouterLink>
          </slot>
        </div>

        <!-- Desktop navigation -->
        <div class="hidden md:block">
          <div class="ml-10 flex items-baseline space-x-4">
            <RouterLink
              to="/"
              class="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Home
            </RouterLink>
            <RouterLink
              to="/features"
              class="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Features
            </RouterLink>
            <RouterLink
              to="/pricing"
              class="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Pricing
            </RouterLink>
          </div>
        </div>

        <!-- Desktop auth buttons -->
        <div class="hidden md:block">
          <div class="ml-4 flex items-center space-x-4">
            <template v-if="isAuthenticated">
              <RouterLink
                to="/dashboard"
                class="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                Dashboard
              </RouterLink>
              <button
                @click="handleLogout"
                class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                Sign Out
              </button>
            </template>
            <template v-else>
              <RouterLink
                to="/login"
                class="rounded-md px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                Login
              </RouterLink>
              <RouterLink
                to="/register"
                class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                Sign Up
              </RouterLink>
            </template>
          </div>
        </div>

        <!-- Mobile menu button -->
        <div class="md:hidden">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
            @click="toggleMobileMenu"
          >
            <span class="sr-only">Open main menu</span>
            <Bars3Icon v-if="!mobileMenuOpen" class="h-6 w-6" aria-hidden="true" />
            <XMarkIcon v-else class="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile menu -->
    <div v-if="mobileMenuOpen" class="md:hidden">
      <div class="space-y-1 px-2 pb-3 pt-2 sm:px-3">
        <RouterLink
          to="/"
          class="block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
          @click="mobileMenuOpen = false"
        >
          Home
        </RouterLink>
        <RouterLink
          to="/features"
          class="block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
          @click="mobileMenuOpen = false"
        >
          Features
        </RouterLink>
        <RouterLink
          to="/pricing"
          class="block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
          @click="mobileMenuOpen = false"
        >
          Pricing
        </RouterLink>
        <div class="border-t border-gray-700 pt-4">
          <template v-if="isAuthenticated">
            <RouterLink
              to="/dashboard"
              class="block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
              @click="mobileMenuOpen = false"
            >
              Dashboard
            </RouterLink>
            <button
              @click="handleLogout"
              class="w-full text-left block rounded-md bg-indigo-600 px-3 py-2 text-base font-medium text-white hover:bg-indigo-700"
            >
              Sign Out
            </button>
          </template>
          <template v-else>
            <RouterLink
              to="/login"
              class="block rounded-md px-3 py-2 text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
              @click="mobileMenuOpen = false"
            >
              Login
            </RouterLink>
            <RouterLink
              to="/register"
              class="block rounded-md bg-indigo-600 px-3 py-2 text-base font-medium text-white hover:bg-indigo-700"
              @click="mobileMenuOpen = false"
            >
              Sign Up
            </RouterLink>
          </template>
        </div>
      </div>
    </div>
  </nav>
</template>
