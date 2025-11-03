import axios, { type AxiosError, type AxiosInstance } from 'axios';
import { supabase } from '@/services/supabase.client';

export const UNAUTHORIZED_EVENT = 'unauthorized';
export const authEvents = new EventTarget();

const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  withCredentials: true,
  timeout: 35000, // 35 seconds timeout (slightly longer than database 30s timeout)
});

apiClient.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined') {
    return config;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle 401 - unauthorized
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      authEvents.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
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
