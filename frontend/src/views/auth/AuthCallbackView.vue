<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { supabase } from '@/services/supabase.client';
import apiClient from '@/services/api.client';

const router = useRouter();
const authStore = useAuthStore();

onMounted(async () => {
  try {
    // Handle the auth callback (email verification, password reset, etc.)
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Auth callback error:', error);
      router.push({ name: 'login', query: { error: 'verification_failed' } });
      return;
    }

    if (data.session) {
      // Session exists, user is authenticated
      // Refresh auth store
      await authStore.initialize();

      // Check if user has tenant, if not try to create one
      const user = authStore.user;
      const userMetadata = data.session.user.user_metadata;

      // Always try to ensure tenant exists (create or link)
      if (userMetadata?.companyName || data.session.user.email) {
        try {
          // Explicitly create/link tenant
          await apiClient.post('/tenants/create-on-signup', {
            tenantName: userMetadata?.companyName || 'My Company',
            contactEmail: data.session.user.email,
            displayName: userMetadata?.companyName || data.session.user.email,
          });
        } catch (tenantError: any) {
          // Tenant might already exist or be linked - that's okay
          // Check if it was a success (200) or conflict (409) - both mean tenant exists
          if (tenantError?.response?.status === 500) {
            console.error('Tenant creation failed:', tenantError);
            // Still continue - might have been linked
          }
        }
      }

      // Refresh user to get updated tenant info
      await authStore.initialize();

      // Wait a bit for everything to settle
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify user has tenant before redirecting
      const updatedUser = authStore.user;
      if (!updatedUser?.tenantName) {
        // Retry fetching one more time
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await authStore.initialize();
      }

      // Redirect to dashboard
      await router.push({ name: 'dashboard' });
    } else {
      // No session, redirect to login
      router.push({ name: 'login' });
    }
  } catch (err) {
    console.error('Unexpected error during auth callback:', err);
    router.push({ name: 'login', query: { error: 'unexpected_error' } });
  }
});
</script>

<template>
  <div class="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-md w-full text-center">
      <div
        class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"
      ></div>
      <p class="mt-4 text-sm text-gray-600">Verifying your account...</p>
    </div>
  </div>
</template>
