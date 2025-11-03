<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import {
  DocumentTextIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/vue/24/outline';
import { useRagStore } from '@/stores/rag.store';

const ragStore = useRagStore();
const { documents, loading, error, uploading, syncing, syncProgress } = storeToRefs(ragStore);

const fileInput = ref<HTMLInputElement | null>(null);
const fileTitle = ref('');
const dragOver = ref(false);
const selectedFile = ref<File | null>(null);
const syncSuccess = ref<{ documentsCreated: number; message: string } | null>(null);
const syncError = ref<string | null>(null);
const syncLimit = ref<number | undefined>(undefined);
const expandedDocuments = ref<Set<string>>(new Set());
const showDeleteAllModal = ref(false);
const deletingAll = ref(false);

onMounted(() => {
  void ragStore.fetchDocuments();
});

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0];
    if (!fileTitle.value && selectedFile.value.name.endsWith('.txt')) {
      // Auto-populate title from filename without extension
      fileTitle.value = selectedFile.value.name.replace(/\.txt$/i, '');
    }
  }
};

const handleDragOver = (event: DragEvent) => {
  event.preventDefault();
  dragOver.value = true;
};

const handleDragLeave = () => {
  dragOver.value = false;
};

const handleDrop = (event: DragEvent) => {
  event.preventDefault();
  dragOver.value = false;

  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    const file = event.dataTransfer.files[0];
    if (file.type.includes('text') || file.name.endsWith('.txt')) {
      selectedFile.value = file;
      if (!fileTitle.value) {
        fileTitle.value = file.name.replace(/\.txt$/i, '');
      }
    } else {
      error.value = 'Only text files (.txt) are supported';
    }
  }
};

const handleUpload = async () => {
  if (!selectedFile.value) {
    error.value = 'Please select a file';
    return;
  }

  try {
    await ragStore.uploadDocument(selectedFile.value, fileTitle.value || undefined);
    selectedFile.value = null;
    fileTitle.value = '';
    if (fileInput.value) {
      fileInput.value.value = '';
    }
    error.value = null;
  } catch (err) {
    // Error is already set in the store
    console.error('Upload failed:', err);
  }
};

const handleDelete = async (documentId: string, title: string | null) => {
  if (!confirm(`Are you sure you want to delete "${title || 'this document'}"?`)) {
    return;
  }

  try {
    await ragStore.deleteDocument(documentId);
    error.value = null;
  } catch (err) {
    // Error is already set in the store
    console.error('Delete failed:', err);
  }
};

const handleSyncConversations = async () => {
  syncSuccess.value = null;
  syncError.value = null;
  try {
    const limit = syncLimit.value && syncLimit.value > 0 ? syncLimit.value : undefined;
    const result = await ragStore.syncConversations(limit);
    syncSuccess.value = result;
  } catch (err) {
    syncError.value = err instanceof Error ? err.message : 'Failed to sync conversations';
    console.error('Sync failed:', err);
  }
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString();
};

const truncateContent = (content: string, maxLength: number = 150) => {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '...';
};

const isExpanded = (documentId: string) => {
  return expandedDocuments.value.has(documentId);
};

const toggleExpand = (documentId: string) => {
  if (expandedDocuments.value.has(documentId)) {
    expandedDocuments.value.delete(documentId);
  } else {
    expandedDocuments.value.add(documentId);
  }
};

const shouldShowExpand = (content: string, maxLength: number = 150) => {
  return content.length > maxLength;
};

const getSourceLabel = (metadata: Record<string, unknown>) => {
  const source = metadata.source;
  if (source === 'hostaway_conversation') {
    return 'Hostaway Conversation';
  }
  if (source === 'manual_upload') {
    return 'Manual Upload';
  }
  return 'Unknown';
};

const handleDeleteAll = () => {
  showDeleteAllModal.value = true;
};

const cancelDeleteAll = () => {
  showDeleteAllModal.value = false;
};

const confirmDeleteAll = async () => {
  deletingAll.value = true;
  error.value = null;
  try {
    await ragStore.deleteAllDocuments();
    showDeleteAllModal.value = false;
    error.value = null;
  } catch (err) {
    // Error is already set in the store
    console.error('Delete all failed:', err);
  } finally {
    deletingAll.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold text-content">Knowledge Base</h1>
      <p class="mt-2 text-sm text-content-muted">
        Upload documents and sync conversations to build your AI knowledge base
      </p>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="rounded-lg border border-danger bg-danger/10 p-4">
      <div class="flex items-center gap-2">
        <XCircleIcon class="h-5 w-5 text-danger" />
        <p class="text-sm font-medium text-danger">{{ error }}</p>
      </div>
    </div>

    <!-- Sync Conversations Section -->
    <div class="rounded-lg border border-border bg-surface p-4 sm:p-6">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div class="flex-1 min-w-0">
          <h2 class="text-lg font-semibold text-content">Sync Conversations</h2>
          <p class="mt-1 text-sm text-content-muted">
            Automatically create knowledge base entries from your Hostaway conversations
          </p>
          <div class="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <label
              class="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-content-muted"
            >
              <span class="whitespace-nowrap">Limit:</span>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="syncLimit"
                  type="number"
                  min="1"
                  placeholder="All"
                  class="w-24 rounded-md border border-border bg-surface px-2 py-1 text-sm text-content focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <span class="text-xs whitespace-nowrap">(leave empty for all)</span>
              </div>
            </label>
          </div>
        </div>
        <button
          type="button"
          @click="handleSyncConversations"
          :disabled="syncing"
          class="w-full sm:w-auto sm:ml-4 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowPathIcon :class="['h-4 w-4', { 'animate-spin': syncing }]" />
          {{ syncing ? 'Syncing...' : 'Sync Conversations' }}
        </button>
      </div>

      <!-- Progress Bar -->
      <div v-if="syncing && syncProgress" class="mt-4 space-y-2">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
          <p class="text-content-muted">This could take a few minutes</p>
          <span class="font-medium text-content">{{ syncProgress.progress }}%</span>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
          <div
            class="h-full bg-primary transition-all duration-300 ease-out"
            :style="{ width: `${syncProgress.progress}%` }"
          ></div>
        </div>
        <div
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-content-muted"
        >
          <span class="break-words">{{ syncProgress.message || 'Processing...' }}</span>
          <span class="whitespace-nowrap"
            >{{ syncProgress.current }}/{{ syncProgress.total }} reservations</span
          >
        </div>
        <div v-if="syncProgress.documentsCreated > 0" class="text-xs text-content-muted">
          {{ syncProgress.documentsCreated }} documents created so far
        </div>
      </div>

      <!-- Sync Success -->
      <div
        v-if="syncSuccess && !syncing"
        class="mt-4 rounded-lg border border-success bg-success/10 p-4"
      >
        <div class="flex items-center gap-2">
          <CheckCircleIcon class="h-5 w-5 text-success" />
          <p class="text-sm font-medium text-success">{{ syncSuccess.message }}</p>
        </div>
      </div>

      <!-- Sync Error -->
      <div
        v-if="syncError && !syncing"
        class="mt-4 rounded-lg border border-danger bg-danger/10 p-4"
      >
        <div class="flex items-center gap-2">
          <XCircleIcon class="h-5 w-5 text-danger" />
          <p class="text-sm font-medium text-danger">{{ syncError }}</p>
        </div>
      </div>
    </div>

    <!-- Upload Section -->
    <div class="rounded-lg border border-border bg-surface p-6">
      <h2 class="text-lg font-semibold text-content">Upload Document</h2>
      <p class="mt-1 mb-4 text-sm text-content-muted">
        Upload a text file to add to your knowledge base. The file will be automatically processed
        and embedded.
      </p>

      <!-- File Input -->
      <div
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
        :class="[
          'relative border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
        ]"
      >
        <input
          ref="fileInput"
          type="file"
          accept=".txt,text/plain"
          @change="handleFileSelect"
          class="hidden"
        />
        <DocumentTextIcon class="mx-auto h-12 w-12 text-content-subtle" />
        <p class="mt-4 text-sm text-content">
          <button
            type="button"
            @click="fileInput?.click()"
            class="font-medium text-primary hover:underline"
          >
            Click to upload
          </button>
          or drag and drop
        </p>
        <p class="mt-1 text-xs text-content-muted">TXT files only</p>

        <div v-if="selectedFile" class="mt-4 rounded-lg border border-border bg-surface-muted p-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <DocumentTextIcon class="h-5 w-5 text-content-subtle" />
              <span class="text-sm font-medium text-content">{{ selectedFile.name }}</span>
              <span class="text-xs text-content-muted"
                >({{ (selectedFile.size / 1024).toFixed(1) }} KB)</span
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Title Input -->
      <div class="mt-4">
        <label for="document-title" class="block text-sm font-medium text-content"
          >Title (Optional)</label
        >
        <input
          id="document-title"
          v-model="fileTitle"
          type="text"
          placeholder="Enter document title"
          class="mt-1 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <!-- Upload Button -->
      <div class="mt-4">
        <button
          type="button"
          @click="handleUpload"
          :disabled="!selectedFile || uploading"
          class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowDownTrayIcon :class="['h-4 w-4', { 'animate-pulse': uploading }]" />
          {{ uploading ? 'Uploading...' : 'Upload Document' }}
        </button>
      </div>
    </div>

    <!-- Documents List -->
    <div class="rounded-lg border border-border bg-surface p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-content">Documents</h2>
        <div class="flex items-center gap-3">
          <button
            type="button"
            @click="handleDeleteAll"
            :disabled="loading || documents.length === 0"
            class="inline-flex items-center gap-2 rounded-lg border border-danger bg-surface px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TrashIcon class="h-4 w-4" />
            Delete All
          </button>
          <button
            type="button"
            @click="ragStore.fetchDocuments()"
            :disabled="loading"
            class="text-sm text-content-muted hover:text-content"
          >
            Refresh
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="py-8 text-center">
        <ArrowPathIcon class="mx-auto h-8 w-8 animate-spin text-content-subtle" />
        <p class="mt-2 text-sm text-content-muted">Loading documents...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="documents.length === 0" class="py-8 text-center">
        <DocumentTextIcon class="mx-auto h-12 w-12 text-content-subtle" />
        <p class="mt-4 text-sm text-content-muted">
          No documents yet. Upload a file or sync conversations to get started.
        </p>
      </div>

      <!-- Documents List -->
      <div v-else class="space-y-4">
        <div
          v-for="document in documents"
          :key="document.id"
          class="rounded-lg border border-border bg-surface-muted p-4"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <DocumentTextIcon class="h-5 w-5 text-content-subtle" />
                <h3 class="text-base font-semibold text-content">
                  {{ document.title || 'Untitled Document' }}
                </h3>
                <span
                  class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                >
                  {{ getSourceLabel(document.metadata) }}
                </span>
              </div>
              <div class="mt-2">
                <p class="text-sm text-content-muted whitespace-pre-wrap">
                  {{
                    isExpanded(document.id) ? document.content : truncateContent(document.content)
                  }}
                </p>
                <button
                  v-if="shouldShowExpand(document.content)"
                  type="button"
                  @click="toggleExpand(document.id)"
                  class="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                >
                  <ChevronDownIcon v-if="!isExpanded(document.id)" class="h-3.5 w-3.5" />
                  <ChevronUpIcon v-else class="h-3.5 w-3.5" />
                  {{ isExpanded(document.id) ? 'Show less' : 'Show more' }}
                </button>
              </div>
              <p class="mt-2 text-xs text-content-subtle">
                Created {{ formatDate(document.createdAt) }} • Updated
                {{ formatDate(document.updatedAt) }}
              </p>
            </div>
            <button
              type="button"
              @click="handleDelete(document.id, document.title)"
              class="ml-4 rounded-lg p-2 text-content-subtle hover:bg-danger/10 hover:text-danger"
              title="Delete document"
            >
              <TrashIcon class="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete All Confirmation Modal -->
    <div
      v-if="showDeleteAllModal"
      class="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full z-50 flex items-center justify-center"
      @click.self="cancelDeleteAll"
    >
      <div class="relative mx-auto p-6 border w-11/12 max-w-md shadow-lg rounded-lg bg-surface">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-content">Delete All Documents</h3>
          <button
            @click="cancelDeleteAll"
            class="text-content-subtle hover:text-content"
            :disabled="deletingAll"
          >
            <XCircleIcon class="h-5 w-5" />
          </button>
        </div>
        <p class="text-sm text-content-muted mb-6">
          This action will delete your entire knowledge base and cannot be undone, proceed?
        </p>
        <div class="flex justify-end gap-3">
          <button
            @click="cancelDeleteAll"
            :disabled="deletingAll"
            class="px-4 py-2 text-sm font-medium text-content-muted bg-surface-muted rounded-lg hover:bg-surface-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            @click="confirmDeleteAll"
            :disabled="deletingAll"
            class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-danger rounded-lg hover:bg-danger/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TrashIcon v-if="!deletingAll" class="h-4 w-4" />
            <ArrowPathIcon v-else class="h-4 w-4 animate-spin" />
            {{ deletingAll ? 'Deleting...' : 'Delete All' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
