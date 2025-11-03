<template>
  <div class="max-w-6xl mx-auto p-6">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Message Templates</h1>
      <p class="mt-2 text-gray-600">
        Customize your automated messages for guests. Use variables to personalize each message.
      </p>
      <div class="mt-4">
        <button
          @click="openImportModal"
          class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          Import from Hostaway
        </button>
      </div>
    </div>

    <!-- Webhook Status Alert -->
    <div
      v-if="webhookStatus && !webhookStatus.webhookRegistered"
      class="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
    >
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fill-rule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-yellow-800">Webhook Not Registered</h3>
          <div class="mt-2 text-sm text-yellow-700">
            <p>
              Your webhook URL is not registered with Hostaway. Automated messages won't be
              triggered until this is fixed.
            </p>
            <p class="mt-1 font-mono text-xs">{{ webhookStatus.webhookUrl }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- Templates List -->
    <div v-else class="space-y-6">
      <div
        v-for="template in templates"
        :key="template.id"
        class="bg-white border border-gray-200 rounded-lg shadow-sm"
      >
        <div class="p-4 sm:p-6">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div class="flex items-center space-x-3 min-w-0 flex-1">
              <div class="flex-shrink-0">
                <div class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg
                    class="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-lg font-medium text-gray-900 truncate">{{ template.name }}</h3>
                <p class="text-sm text-gray-500 truncate">
                  {{ getTriggerDescription(template.trigger_type) }}
                </p>
              </div>
            </div>
            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  :checked="template.enabled"
                  @change="toggleTemplate(template)"
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
                ></div>
                <span class="ml-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                  {{ template.enabled ? 'Enabled' : 'Disabled' }}
                </span>
              </label>
              <select
                class="border rounded px-2 py-1 text-sm w-full sm:w-auto min-w-[160px]"
                :value="template.trigger_type"
                @change="bindTrigger(template, ($event.target as HTMLSelectElement).value)"
              >
                <option value="thank_you_immediate">Thank you - immediate</option>
                <option value="pre_arrival_24h">Pre-arrival 24h</option>
                <option value="door_code_3h">Door code 3h</option>
                <option value="same_day_checkin">Same-day check-in</option>
                <option value="checkout_morning">Checkout morning</option>
                <option value="post_booking_followup">Post booking follow-up</option>
                <option value="pre_checkout_evening">Pre-checkout evening</option>
                <option value="message_received_keyword">Message received: keyword</option>
                <option value="host_message_reply">Host message reply</option>
              </select>
              <div class="flex gap-2 w-full sm:w-auto">
                <button
                  @click="confirmDelete(template)"
                  class="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                >
                  Delete
                </button>
                <button
                  @click="editTemplate(template)"
                  class="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>

          <!-- Template Preview -->
          <div class="mt-4 p-4 bg-gray-50 rounded-lg">
            <p class="text-sm text-gray-600 mb-2">Preview:</p>
            <p class="text-sm text-gray-800 font-mono break-words whitespace-pre-wrap">
              {{ template.template_body }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Template Modal -->
    <div
      v-if="editingTemplate"
      class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
    >
      <div
        class="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white"
      >
        <div class="mt-3">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-gray-900">Edit {{ editingTemplate.name }}</h3>
            <button @click="closeEditModal" class="text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Template Editor -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"> Template Body </label>
              <textarea
                v-model="editForm.template_body"
                rows="8"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                placeholder="Enter your message template..."
              ></textarea>
              <p class="mt-1 text-xs text-gray-500">
                Use variables like {{ guestName }}, {{ propertyName }}, etc.
              </p>
            </div>

            <!-- Variables Reference -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Available Variables
              </label>
              <div class="space-y-2 max-h-64 overflow-y-auto">
                <div
                  v-for="variable in availableVariables"
                  :key="variable.name"
                  class="p-3 bg-gray-50 rounded-lg border"
                >
                  <div class="flex items-center justify-between">
                    <code class="text-sm font-mono text-blue-600">{{
                      getVariablePlaceholder(variable.name)
                    }}</code>
                    <button
                      @click="insertVariable(variable.name)"
                      class="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                    >
                      Insert
                    </button>
                  </div>
                  <p class="text-xs text-gray-600 mt-1">{{ variable.description }}</p>
                  <p class="text-xs text-gray-500">Example: {{ variable.example }}</p>
                </div>
              </div>
              <!-- Keyword UI for message_received_keyword -->
              <div v-if="editingTemplate?.trigger_type === 'message_received_keyword'" class="mt-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Trigger keywords</label>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="(kw, idx) in keywordList"
                    :key="kw + idx"
                    class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-800"
                  >
                    {{ kw }}
                    <button class="text-gray-500 hover:text-gray-700" @click="removeKeyword(idx)">
                      ✕
                    </button>
                  </span>
                </div>
                <div class="mt-2 flex items-center gap-2">
                  <input
                    v-model="keywordInput"
                    type="text"
                    class="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                    placeholder="Add keyword and press Enter"
                    @keyup.enter.prevent="addKeyword"
                  />
                  <button
                    class="rounded-md bg-gray-800 px-3 py-1 text-xs font-semibold text-white"
                    @click="addKeyword"
                  >
                    Add
                  </button>
                </div>
                <p class="mt-1 text-xs text-gray-500">
                  Keywords are case-insensitive. Any match will send this template.
                </p>
              </div>
            </div>
          </div>

          <!-- Preview Section -->
          <div class="mt-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Preview with Sample Data
            </label>
            <div class="p-4 bg-gray-50 rounded-lg border">
              <p class="text-sm text-gray-600 mb-2">Sample output:</p>
              <p class="text-sm text-gray-800 font-mono whitespace-pre-wrap">{{ previewText }}</p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end space-x-3 mt-6">
            <button
              @click="closeEditModal"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              @click="saveTemplate"
              :disabled="saving"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Import Modal -->
  <div
    v-if="importOpen"
    class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
  >
    <div class="relative top-20 mx-auto p-5 border w-11/12 max-w-3xl shadow-lg rounded-md bg-white">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900">Import from Hostaway</h3>
        <button @click="cancelImport" class="text-gray-400 hover:text-gray-600">✕</button>
      </div>
      <div class="border rounded-md max-h-80 overflow-y-auto">
        <div v-if="importLoading" class="p-4 text-sm text-gray-600">Loading templates…</div>
        <ul v-else>
          <li v-for="t in importRemote" :key="t.id" class="border-b p-3 last:border-b-0">
            <div class="text-sm font-medium text-gray-900">{{ t.name || `Template ${t.id}` }}</div>
            <div class="text-xs text-gray-500 line-clamp-2">{{ t.message }}</div>
          </li>
        </ul>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button
          @click="cancelImport"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          @click="confirmImport"
          :disabled="saving || importLoading"
          class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {{ saving ? 'Importing…' : 'Import All' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Delete Confirm Modal -->
  <div
    v-if="deleteOpen"
    class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
  >
    <div class="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900">Delete template</h3>
        <button @click="cancelDelete" class="text-gray-400 hover:text-gray-600">✕</button>
      </div>
      <p class="text-sm text-gray-700">
        Are you sure you want to delete <strong>{{ deleteTarget?.name }}</strong
        >? This action cannot be undone.
      </p>
      <div class="mt-4 flex justify-end gap-2">
        <button
          @click="cancelDelete"
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          @click="performDelete"
          :disabled="saving"
          class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          {{ saving ? 'Deleting…' : 'Delete' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  templatesApi,
  integrationsApi,
  type TemplateResponse,
  type TemplateVariable,
} from '@/services/api.client';

// Reactive data
const templates = ref<TemplateResponse[]>([]);
const availableVariables = ref<TemplateVariable[]>([]);
const webhookStatus = ref<any>(null);
const loading = ref(true);
const saving = ref(false);
const editingTemplate = ref<TemplateResponse | null>(null);
const editForm = ref({
  template_body: '',
  enabled: true,
});
const keywordList = ref<string[]>([]);
const keywordInput = ref('');
const importOpen = ref(false);
const importLoading = ref(false);
const importRemote = ref<any[]>([]);
const deleteOpen = ref(false);
const deleteTarget = ref<TemplateResponse | null>(null);

// Sample data for preview
const sampleData = {
  guestName: 'John Smith',
  propertyName: 'Cozy Downtown Apartment',
  doorCode: '1234',
  wifiName: 'Guest_WiFi',
  wifiPassword: 'welcome123',
  checkInDate: 'January 15, 2024',
  checkOutDate: 'January 17, 2024',
};

// Computed
const previewText = computed(() => {
  if (!editingTemplate.value) return '';

  let text = editForm.value.template_body;
  for (const [key, value] of Object.entries(sampleData)) {
    text = text.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return text;
});

// Methods
const loadTemplates = async () => {
  try {
    loading.value = true;
    const [templatesData, variablesData, webhookData] = await Promise.all([
      templatesApi.getTemplates(),
      templatesApi.getAvailableVariables(),
      integrationsApi.getWebhookStatus().catch(() => null),
    ]);

    templates.value = templatesData;
    availableVariables.value = variablesData;
    webhookStatus.value = webhookData;
  } catch (error) {
    console.error('Failed to load templates:', error);
  } finally {
    loading.value = false;
  }
};

const getTriggerDescription = (triggerType: string): string => {
  const descriptions: Record<string, string> = {
    thank_you_immediate: 'Sent immediately after booking confirmation',
    pre_arrival_24h: 'Sent 24 hours before check-in',
    door_code_3h: 'Sent 3 hours before check-in with access code',
    same_day_checkin: 'Sent for same-day bookings with instant access',
    checkout_morning: 'Sent on checkout day as a reminder',
  };
  return descriptions[triggerType] || 'Automated message';
};

const toggleTemplate = async (template: TemplateResponse) => {
  try {
    const updated = await templatesApi.updateTemplate(template.id, {
      template_body: template.template_body,
      enabled: !template.enabled,
    });

    // Update local state
    const index = templates.value.findIndex((t) => t.id === template.id);
    if (index !== -1) {
      templates.value[index] = updated;
    }
  } catch (error) {
    console.error('Failed to toggle template:', error);
  }
};

const editTemplate = (template: TemplateResponse) => {
  editingTemplate.value = template;
  editForm.value = {
    template_body: template.template_body,
    enabled: template.enabled,
  };
  const existing =
    template.variables && Array.isArray((template.variables as any).keywords)
      ? ((template.variables as any).keywords as string[])
      : [];
  keywordList.value = [...existing];
};

const closeEditModal = () => {
  editingTemplate.value = null;
  editForm.value = {
    template_body: '',
    enabled: true,
  };
  keywordList.value = [];
  keywordInput.value = '';
};

const getVariablePlaceholder = (variableName: string): string => {
  return `{{${variableName}}}`;
};

const insertVariable = (variableName: string) => {
  const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
  if (textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editForm.value.template_body;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const variable = `{{${variableName}}}`;

    editForm.value.template_body = before + variable + after;

    // Set cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  }
};

const saveTemplate = async () => {
  if (!editingTemplate.value) return;

  try {
    saving.value = true;
    const variables: Record<string, unknown> = { ...(editingTemplate.value.variables || {}) };
    if (editingTemplate.value.trigger_type === 'message_received_keyword') {
      variables.keywords = keywordList.value;
    }
    const updated = await templatesApi.updateTemplate(editingTemplate.value.id, {
      ...editForm.value,
      variables,
    });

    // Update local state
    const index = templates.value.findIndex((t) => t.id === editingTemplate.value!.id);
    if (index !== -1) {
      templates.value[index] = updated;
    }

    closeEditModal();
  } catch (error) {
    console.error('Failed to save template:', error);
  } finally {
    saving.value = false;
  }
};

// Lifecycle
onMounted(() => {
  loadTemplates();
});

// Import from Hostaway
const importFromHostaway = async () => {
  openImportModal();
};

const openImportModal = async () => {
  importOpen.value = true;
  importLoading.value = true;
  try {
    importRemote.value = await integrationsApi.listHostawayMessageTemplates();
  } catch (e) {
    console.error(e);
    importRemote.value = [];
  } finally {
    importLoading.value = false;
  }
};

const confirmImport = async () => {
  if (!importRemote.value || importRemote.value.length === 0) {
    importOpen.value = false;
    return;
  }
  saving.value = true;
  try {
    await templatesApi.importHostawayTemplates(importRemote.value as any);
    await loadTemplates();
    importOpen.value = false;
  } finally {
    saving.value = false;
  }
};

const cancelImport = () => {
  importOpen.value = false;
};

const confirmDelete = (template: TemplateResponse) => {
  deleteTarget.value = template;
  deleteOpen.value = true;
};

const performDelete = async () => {
  if (!deleteTarget.value) return;
  saving.value = true;
  try {
    await templatesApi.deleteTemplate(deleteTarget.value.id);
    await loadTemplates();
    deleteOpen.value = false;
    deleteTarget.value = null;
  } finally {
    saving.value = false;
  }
};

const cancelDelete = () => {
  deleteOpen.value = false;
  deleteTarget.value = null;
};

const addKeyword = () => {
  const v = keywordInput.value.trim();
  if (!v) return;
  if (!keywordList.value.includes(v)) keywordList.value.push(v);
  keywordInput.value = '';
};

const removeKeyword = (idx: number) => {
  keywordList.value.splice(idx, 1);
};

const bindTrigger = async (template: TemplateResponse, value: string) => {
  try {
    const updated = await templatesApi.updateTemplate(template.id, {
      template_body: template.template_body,
      enabled: template.enabled,
      // @ts-expect-error backend accepts trigger_type
      trigger_type: value,
    } as any);
    const index = templates.value.findIndex((t) => t.id === template.id);
    if (index !== -1) templates.value[index] = updated;
  } catch (e) {
    console.error('Failed to bind trigger', e);
    window.alert('Failed to bind trigger');
  }
};
</script>
