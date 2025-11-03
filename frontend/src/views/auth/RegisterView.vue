<script setup lang="ts">
import { reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/stores/auth.store';

const router = useRouter();
const authStore = useAuthStore();
const { loading, error } = storeToRefs(authStore);

const form = reactive({
  companyName: '',
  email: '',
  password: '',
});

const submitError = ref<string | null>(null);

const verificationPending = ref(false);

const handleSubmit = async () => {
  submitError.value = null;
  verificationPending.value = false;

  try {
    await authStore.register({ ...form });
    await router.replace({ name: 'dashboard' });
  } catch (err: any) {
    console.error('Registration failed', err);

    // Check if this is an email verification requirement (not a real error)
    if (err?.requiresVerification || err?.message?.includes('verification is required')) {
      verificationPending.value = true;
      submitError.value = null;
    } else {
      submitError.value =
        error.value ?? 'Registration failed. Please review the details and try again.';
    }
  }
};
</script>

<template>
  <div
    class="flex min-h-screen flex-col justify-center bg-surface-muted px-4 py-12 sm:px-6 lg:px-8"
  >
    <div class="mx-auto w-full max-w-2xl">
      <div class="mb-10 text-center">
        <div class="flex justify-center mb-6">
          <img src="/favicon.png" alt="Jeeves" class="h-16 w-16 sm:h-20 sm:w-20" />
        </div>
        <h1 class="text-2xl font-semibold text-content">Create your account</h1>
        <p class="mt-2 text-sm text-content-muted">
          Already have an account?
          <RouterLink
            class="font-semibold text-primary hover:text-primary/80"
            :to="{ name: 'login' }"
          >
            Sign in here.
          </RouterLink>
        </p>
      </div>

      <div class="rounded-2xl border border-border bg-surface p-10 shadow-soft">
        <form class="grid grid-cols-1 gap-6 md:grid-cols-2" @submit.prevent="handleSubmit">
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-content" for="companyName"
              >Company name</label
            >
            <div class="mt-2">
              <input
                id="companyName"
                v-model="form.companyName"
                type="text"
                autocomplete="organization"
                required
                class="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Acme Inc."
              />
            </div>
          </div>

          <div class="md:col-span-1">
            <label class="block text-sm font-medium text-content" for="email">Work email</label>
            <div class="mt-2">
              <input
                id="email"
                v-model="form.email"
                type="email"
                autocomplete="email"
                required
                class="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="you@acme.com"
              />
            </div>
          </div>

          <div class="md:col-span-1">
            <label class="block text-sm font-medium text-content" for="password">Password</label>
            <div class="mt-2">
              <input
                id="password"
                v-model="form.password"
                type="password"
                autocomplete="new-password"
                required
                minlength="8"
                class="block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="Minimum 8 characters"
              />
            </div>
            <p class="mt-2 text-xs text-content-subtle">
              Use at least 8 characters with a mix of letters and numbers.
            </p>
          </div>

          <div class="md:col-span-2">
            <div
              v-if="verificationPending"
              class="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400"
            >
              <p class="font-semibold">Account created successfully!</p>
              <p class="mt-1">
                Please check your email ({{ form.email }}) and click the verification link to
                activate your account. You'll be redirected to the dashboard after verification.
              </p>
            </div>
            <div
              v-else-if="submitError"
              class="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger"
            >
              {{ submitError }}
            </div>
          </div>

          <div class="md:col-span-2">
            <button
              type="submit"
              class="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-70"
              :disabled="loading"
            >
              <span v-if="!loading">Create account</span>
              <span v-else class="flex items-center gap-2">
                <span
                  class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
                />
                Creating account...
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
