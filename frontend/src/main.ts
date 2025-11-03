import './styles.css';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from '@/app/App.vue';
import router from '@/router';
import { useAuthStore } from '@/stores/auth.store';
import { UNAUTHORIZED_EVENT, authEvents } from '@/services/api.client';
import { supabase } from '@/services/supabase.client';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

const authStore = useAuthStore();

authEvents.addEventListener(UNAUTHORIZED_EVENT, () => {
  const currentRoute = router.currentRoute.value;
  if (currentRoute.name !== 'login') {
    void router.replace({
      name: 'login',
      query: { redirect: currentRoute.fullPath },
    });
  }
});

const bootstrap = async () => {
  await authStore.initialize();
  await router.isReady();

  // Handle Supabase auth callback from email verification
  // Supabase redirects to the configured redirect URL (e.g., localhost:3000)
  // with hash parameters containing the auth tokens
  if (typeof window !== 'undefined') {
    // Check if we have auth tokens in the URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');

    if (accessToken && (type === 'signup' || type === 'recovery')) {
      // Wait for Supabase to process the session
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check if session exists
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // Clean up the URL hash
        window.history.replaceState(null, '', window.location.pathname + window.location.search);

        // Navigate to auth callback handler which will create tenant and redirect
        await router.push({ name: 'auth-callback' });
      }
    }
  }

  app.mount('#root');
};

void bootstrap();
