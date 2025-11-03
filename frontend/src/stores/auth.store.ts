import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { Session, User } from '@supabase/supabase-js';
import { isAxiosError } from 'axios';
import apiClient, {
  UNAUTHORIZED_EVENT,
  authEvents,
  clearSessionCache,
  type ApiError,
} from '@/services/api.client';
import { supabase } from '@/services/supabase.client';

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  companyName?: string;
  tenantName?: string;
  [key: string]: unknown;
}

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  email: string;
  password: string;
  companyName: string;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null);
  const supabaseUser = ref<User | null>(null);
  const session = ref<Session | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const initialized = ref(false);

  let unauthorizedListenerAttached = false;
  let unsubscribeAuthState: (() => void) | null = null;

  const isAuthenticated = computed(() => Boolean(session.value));

  const resetLocalState = () => {
    session.value = null;
    supabaseUser.value = null;
    user.value = null;
    error.value = null;
  };

  const handleUnauthorized = async () => {
    resetLocalState();
    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      console.error('Failed to sign out after unauthorized response', signOutError);
    }
  };

  const attachUnauthorizedListener = () => {
    if (unauthorizedListenerAttached || typeof window === 'undefined') {
      return;
    }

    const listener = () => {
      void handleUnauthorized();
    };

    authEvents.addEventListener(UNAUTHORIZED_EVENT, listener);
    unauthorizedListenerAttached = true;
  };

  const hydrateSession = async () => {
    try {
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Failed to fetch Supabase session', sessionError);
        return null;
      }

      session.value = currentSession ?? null;
      supabaseUser.value = currentSession?.user ?? null;

      return currentSession;
    } catch (err) {
      console.error('Unexpected error while hydrating session', err);
      return null;
    }
  };

  const fetchUser = async () => {
    if (!session.value) {
      user.value = null;
      return null;
    }

    try {
      const { data } = await apiClient.get<{ user: UserProfile }>('/auth/me');
      // Backend returns { user: { ... } }, so extract the user object
      user.value = data.user;
      return data.user;
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        user.value = null;
        return null;
      }

      console.error('Failed to fetch user profile', err);
      throw err;
    }
  };

  const initialize = async () => {
    if (initialized.value) {
      return;
    }

    initialized.value = true;
    attachUnauthorizedListener();

    const currentSession = await hydrateSession();
    if (currentSession) {
      try {
        await fetchUser();
      } catch (err) {
        console.warn('Unable to hydrate user profile on bootstrap', err);
      }
    }

    if (!unsubscribeAuthState) {
      const { data } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        // Only clear session cache on actual auth events, not on temporary failures
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') {
          clearSessionCache();
        }

        // Only update session if we got a real state change
        // Don't clear session on temporary fetch failures (newSession might be null temporarily)
        if (newSession || event === 'SIGNED_OUT') {
          session.value = newSession;
          supabaseUser.value = newSession?.user ?? null;
        }

        if (newSession) {
          try {
            // If user just verified their email, ensure tenant is created
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              const userMetadata = newSession.user.user_metadata;
              if (userMetadata?.companyName && !user.value?.tenantName) {
                // Try to create tenant if it doesn't exist
                try {
                  await apiClient.post('/tenants/create-on-signup', {
                    tenantName: userMetadata.companyName,
                    contactEmail: newSession.user.email,
                    displayName: userMetadata.companyName,
                  });
                } catch (tenantError) {
                  // Tenant might already exist, or there's an error - that's okay
                  console.warn('Tenant creation attempt:', tenantError);
                }
              }
            }
            await fetchUser();
          } catch (err) {
            console.error('Failed to refresh user profile after auth state change', err);
          }
        } else if (event === 'SIGNED_OUT') {
          // Only clear user data on explicit sign out, not on temporary session fetch failures
          user.value = null;
        }
      });

      unsubscribeAuthState = () => data.subscription.unsubscribe();
    }
  };

  const login = async (credentials: LoginPayload) => {
    loading.value = true;
    error.value = null;

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(credentials);

      if (authError) {
        throw authError;
      }

      try {
        await fetchUser();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (fetchError: any) {
        // If user fetch fails, might be missing tenant - try to create/link it
        const isTenantError =
          fetchError?.response?.status === 400 ||
          fetchError?.response?.data?.message?.includes('not associated with a tenant') ||
          fetchError?.message?.includes('not associated with a tenant');

        if (isTenantError) {
          const userMetadata = data.user?.user_metadata;
          if (userMetadata?.companyName || data.user?.email) {
            try {
              // Try to create/link tenant
              await apiClient.post('/tenants/create-on-signup', {
                tenantName: userMetadata?.companyName || 'My Company',
                contactEmail: data.user.email,
                displayName: userMetadata?.companyName || data.user.email,
              });
              // Retry fetching user after tenant creation
              await fetchUser();
              // Success! Return the data
              return data;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (tenantError: any) {
              console.error('Failed to create/link tenant on login:', tenantError);
              // Check if tenant was already linked (success case)
              try {
                await fetchUser();
                // If this succeeds, tenant was linked
                return data;
              } catch {
                // Still failed, show error but don't sign out
                error.value =
                  'Account exists but tenant setup is incomplete. Please contact support.';
                throw new Error('Tenant setup required');
              }
            }
          } else {
            error.value =
              'Account exists but company information is missing. Please contact support.';
            throw new Error('Missing company information');
          }
        } else {
          // Other error types - might be auth issue
          throw fetchError;
        }
      }

      return data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      error.value = extractErrorMessage(err);

      // Only sign out for actual auth errors, not tenant setup errors
      const isTenantSetupError =
        err?.message?.includes('Tenant setup required') ||
        err?.message?.includes('Missing company information') ||
        (err?.response?.status === 400 &&
          err?.response?.data?.message?.includes('not associated with a tenant'));

      if (!isTenantSetupError) {
        await handleUnauthorized();
      }

      throw err;
    } finally {
      loading.value = false;
    }
  };

  const register = async (payload: RegisterPayload) => {
    loading.value = true;
    error.value = null;

    try {
      console.log('🔍 Attempting to register user:', payload.email);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: {
            companyName: payload.companyName,
          },
        },
      });

      console.log('📊 Registration response:', { data, error: signUpError });

      if (signUpError) {
        console.error('❌ Registration error:', signUpError);
        throw signUpError;
      }

      session.value = data.session ?? null;
      supabaseUser.value = data.user ?? data.session?.user ?? null;

      if (!session.value) {
        // Check if we have user data but no session (email verification pending)
        if (data.user && !data.user.email_confirmed_at) {
          // Email verification is required - return a special flag instead of throwing
          // This allows the UI to show a success message instead of an error
          const verificationError = new Error(
            'Sign up succeeded, but verification is required. Check your email before continuing.',
          ) as Error & { requiresVerification: boolean };
          verificationError.requiresVerification = true;
          throw verificationError;
        } else {
          throw new Error('Sign up succeeded, but no active session was returned.');
        }
      }

      // Only create tenant if we have a session or are in development mode
      if (session.value || import.meta.env.DEV) {
        try {
          await apiClient.post('/tenants/create-on-signup', {
            tenantName: payload.companyName,
            contactEmail: payload.email,
            displayName: payload.companyName,
          });
        } catch (tenantError) {
          console.warn('Failed to create tenant, but continuing in development mode', tenantError);
        }
      }

      // Check if Stripe is configured in developer mode
      const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;

      if (!stripePublicKey || stripePublicKey.trim() === '') {
        // Developer mode: Skip Stripe checkout and redirect to success page
        console.log('Developer mode: Skipping Stripe checkout');
        window.location.href = '/subscribe-success';
        return data;
      }

      // Production mode: Create Stripe checkout session for subscription
      const checkoutResponse = await apiClient.post('/billing/create-checkout-session', {
        priceId: 'price_pro_plan', // This should match your Stripe price ID
        successUrl: `${window.location.origin}/subscribe-success`,
        cancelUrl: `${window.location.origin}/pricing`,
      });

      // Redirect to Stripe Checkout
      if (checkoutResponse.data?.checkoutUrl) {
        window.location.href = checkoutResponse.data.checkoutUrl;
        return data;
      }

      await fetchUser();

      return data;
    } catch (err) {
      error.value = extractErrorMessage(err);
      await handleUnauthorized();
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const logout = async () => {
    loading.value = true;
    error.value = null;

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error during logout', err);
    } finally {
      resetLocalState();
      loading.value = false;
    }
  };

  const fetchSession = async () => {
    await hydrateSession();
    if (session.value) {
      await fetchUser();
    }
  };

  return {
    user,
    supabaseUser,
    session,
    loading,
    error,
    initialized,
    isAuthenticated,
    initialize,
    login,
    register,
    logout,
    fetchUser,
    fetchSession,
  };
});

const extractErrorMessage = (err: unknown): string => {
  if (isAxiosError(err)) {
    const apiError = err as ApiError;
    const responseMessage = apiError.response?.data?.message;
    if (responseMessage) {
      return responseMessage;
    }
  }

  if (typeof err === 'object' && err && 'message' in err) {
    const message = (err as { message?: string | null }).message;
    if (message) {
      return message;
    }
  }

  if (err instanceof Error) {
    return err.message;
  }

  return 'Something went wrong. Please try again.';
};
