import axios, { type AxiosError, type AxiosInstance } from 'axios';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/services/supabase.client';

export const UNAUTHORIZED_EVENT = 'unauthorized';
export const authEvents = new EventTarget();

// Cache session to avoid calling getSession() on every request
let sessionCache: { session: Session | null; timestamp: number; expiresAt: number } | null = null;

// Helper to get token expiration time (JWT tokens have exp claim in seconds)
const getTokenExpiration = (session: Session | null): number => {
  if (!session?.access_token) return 0;

  try {
    // JWT tokens are base64 encoded JSON - decode the payload
    const payload = JSON.parse(atob(session.access_token.split('.')[1]));
    // exp is in seconds, convert to milliseconds
    return (payload.exp || 0) * 1000;
  } catch {
    // If we can't decode, assume it expires in 1 hour (Supabase default)
    return Date.now() + 3600000;
  }
};

// Export function to update session cache (called when auth state changes)
export const updateSessionCache = (session: Session | null) => {
  if (session) {
    const expiresAt = getTokenExpiration(session);
    sessionCache = {
      session,
      timestamp: Date.now(),
      expiresAt: expiresAt || Date.now() + 300000,
    };
  } else {
    sessionCache = null;
  }
};

// Export function to clear session cache (legacy, use updateSessionCache instead)
export const clearSessionCache = () => {
  sessionCache = null;
};

const getCachedSession = async () => {
  // Use cached session if available - it's kept in sync by the auth store
  // Only fetch from Supabase if we don't have a cache at all
  if (sessionCache) {
    const now = Date.now();
    const isCacheValid = now < sessionCache.expiresAt;
    const isRecent = now - sessionCache.timestamp < 300000; // 5 minutes max cache age

    if (isCacheValid && isRecent) {
      return sessionCache.session;
    }
    // Cache might be expired, but return it anyway as fallback
    // The auth store will update it when Supabase refreshes
    return sessionCache.session;
  }

  // No cache at all - try to fetch once (but don't do this on every request)
  // This should rarely happen since the auth store should have initialized the cache
  try {
    const sessionPromise = supabase.auth.getSession();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Session fetch timeout'));
      }, 3000); // Shorter timeout - only use as last resort
    });

    const { data } = await Promise.race([sessionPromise, timeoutPromise]);
    const session = data?.session ?? null;

    if (session) {
      updateSessionCache(session);
      return session;
    }

    return null;
  } catch {
    // If fetch fails, return null - don't fallback to stale cache
    // The auth store will handle session refresh
    return null;
  }
};

const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  withCredentials: true,
  timeout: 35000, // 35 seconds timeout (slightly longer than database 30s timeout)
});

apiClient.interceptors.request.use(
  async (config) => {
    if (typeof window === 'undefined') {
      return config;
    }

    try {
      const session = await getCachedSession();
      const token = session?.access_token;
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // If session fetch fails or times out, log but don't block the request
      console.warn('Failed to get session for request:', error);
      // Continue without auth header - the backend will return 401 if needed
    }

    return config;
  },
  (error) => {
    // Handle request configuration errors
    return Promise.reject(error);
  },
);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle 401 - unauthorized, but only if we actually sent a token
    // Don't sign out if the request failed due to session fetch timeout
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const hadToken = error.config?.headers?.Authorization;

      // Only trigger unauthorized if we had a token (meaning auth was attempted)
      // If no token, it might be a session fetch issue, not actual auth failure
      if (hadToken) {
        sessionCache = null; // Clear cache on unauthorized
        authEvents.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      } else {
        // No token sent - might be a session fetch issue, try to get fresh session
        console.warn('401 received without auth token, might be session fetch issue');
        sessionCache = null; // Clear cache to force refresh on next request
      }
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.error('Request timeout:', error.config?.url);
      // Return a more user-friendly error
      error.message = 'Request timed out. Please try again.';
    }

    // Handle network errors
    if (!error.response && error.request) {
      console.error('Network error - backend may be unavailable:', error.message);
      error.message = 'Unable to connect to server. Please check your connection and try again.';
    }

    return Promise.reject(error);
  },
);

export default apiClient;

export type ApiError<T = unknown> = AxiosError<
  {
    message?: string;
    errors?: Record<string, string[] | string>;
  } & T
>;

// Template types
export interface TemplateResponse {
  id: string;
  tenant_id: string;
  trigger_type: string;
  name: string;
  template_body: string;
  enabled: boolean;
  variables: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariable {
  name: string;
  description: string;
  example: string;
}

export interface UpdateTemplateRequest {
  template_body: string;
  enabled?: boolean;
  trigger_type?: string;
  variables?: Record<string, unknown>;
}

// Template API methods
export const templatesApi = {
  async getTemplates(): Promise<TemplateResponse[]> {
    const response = await apiClient.get('/templates');
    return response.data;
  },

  async getTemplate(id: string): Promise<TemplateResponse> {
    const response = await apiClient.get(`/templates/${id}`);
    return response.data;
  },

  async updateTemplate(id: string, data: UpdateTemplateRequest): Promise<TemplateResponse> {
    const response = await apiClient.put(`/templates/${id}`, data);
    return response.data;
  },

  async deleteTemplate(id: string): Promise<{ deleted: boolean }> {
    const response = await apiClient.delete(`/templates/${id}`);
    return response.data;
  },

  async getAvailableVariables(): Promise<TemplateVariable[]> {
    const response = await apiClient.get('/templates/variables');
    return response.data;
  },

  async importHostawayTemplates(
    templates: Array<{ name?: string; description?: string; message?: string; id?: number }>,
  ) {
    const response = await apiClient.post('/templates/import/hostaway', { templates });
    return response.data as { imported: number };
  },
};

// Integration API methods
export const integrationsApi = {
  async getHostawayStatus() {
    const response = await apiClient.get('/integrations/hostaway');
    return response.data;
  },

  async getWebhookStatus() {
    const response = await apiClient.get('/integrations/hostaway/webhook-status');
    return response.data;
  },

  async listHostawayMessageTemplates(params?: {
    listingMapId?: string;
    channelId?: string;
    messageTemplateGroupId?: string;
    reservationId?: string;
  }) {
    const response = await apiClient.get('/integrations/hostaway/message-templates', { params });
    return response.data as Array<{
      id?: number;
      accountId?: number;
      listingMapId?: string | number;
      channelId?: string | number;
      name?: string;
      description?: string;
      message?: string;
      color?: number;
    }>;
  },
};
