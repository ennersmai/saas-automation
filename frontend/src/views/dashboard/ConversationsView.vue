<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

onMounted(() => {
  router.replace({ name: 'inbox' }).catch(() => undefined);
});
</script>

<template>
  <div class="p-6 text-sm text-content-subtle">Redirecting to Inbox�</div>
</template>
