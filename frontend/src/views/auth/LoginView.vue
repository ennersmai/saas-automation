<script setup lang="ts">
import { reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/stores/auth.store';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { loading, error } = storeToRefs(authStore);

const form = reactive({
  email: '',
  password: '',
});

const submitError = ref<string | null>(null);

const handleSubmit = async () => {
  submitError.value = null;
  try {
    await authStore.login({ ...form });

    // Ensure user is loaded before redirecting
    if (!authStore.user?.tenantName) {
      // Wait a moment for user to be fetched
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const redirect = route.query.redirect;
    if (typeof redirect === 'string' && redirect && redirect !== '/login') {
      await router.replace(redirect);
    } else {
      await router.replace({ name: 'dashboard' });
    }
  } catch (err) {
    console.error('Login failed', err);
    submitError.value = error.value ?? 'Unable to sign in. Check your credentials.';
  }
};
</script>

<template>
  <div
    class="flex min-h-screen flex-col justify-center bg-surface-muted px-4 py-12 sm:px-6 lg:px-8"
  >
    <div class="mx-auto w-full max-w-md">
      <div class="mb-10 text-center">
        <div class="flex justify-center mb-6">
          <img src="/favicon.png" alt="Jeeves" class="h-16 w-16 sm:h-20 sm:w-20" />
        </div>
        <h1 class="text-2xl font-semibold text-content">Sign in to your account</h1>
        <p class="mt-2 text-sm text-content-muted">
          Don't have an account?
          <RouterLink
            class="font-semibold text-primary hover:text-primary/80"
            :to="{ name: 'register' }"
          >
            Create one now.
          </RouterLink>
        </p>
      </div>

      <div class="rounded-2xl border border-border bg-surface p-8 shadow-soft">
        <form class="space-y-6" @submit.prevent="handleSubmit">
          <div>
            <label class="block text-sm font-medium text-content" for="email">Email address</label>
            <div class="mt-2">
              <input
                id="email"
                v-model="form.email"
                type="email"
                autocomplete="email"
                required
                class="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="name@company.com"
              />
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between">
              <label class="block text-sm font-medium text-content" for="password">Password</label>
              <a class="text-sm font-medium text-primary hover:text-primary/80" href="#">
                Forgot password?
              </a>
            </div>
            <div class="mt-2">
              <input
                id="password"
                v-model="form.password"
                type="password"
                autocomplete="current-password"
                required
                class="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="********"
              />
            </div>
          </div>

          <div v-if="submitError" class="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
            {{ submitError }}
          </div>

          <button
            type="submit"
            class="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
            :disabled="loading"
          >
            <span v-if="!loading">Sign in</span>
            <span v-else class="flex items-center gap-2">
              <span
                class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
              />
              Signing in...
            </span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
