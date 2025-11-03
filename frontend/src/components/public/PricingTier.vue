<script setup lang="ts">
interface Props {
  planName: string;
  price: string;
  frequency: string;
  features: string[];
  popular?: boolean;
}

defineProps<Props>();
</script>

<template>
  <div class="relative rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
    <!-- Popular badge -->
    <div v-if="popular" class="absolute -top-4 left-1/2 -translate-x-1/2">
      <span
        class="inline-flex rounded-full bg-indigo-600 px-4 py-1 text-sm font-semibold text-white"
      >
        Most Popular
      </span>
    </div>

    <div class="text-center">
      <h3 class="text-lg font-semibold text-gray-900">{{ planName }}</h3>
      <div class="mt-4 flex items-baseline justify-center">
        <span class="text-5xl font-bold tracking-tight text-gray-900">{{ price }}</span>
        <span class="ml-1 text-xl font-semibold text-gray-500">{{ frequency }}</span>
      </div>
    </div>

    <div class="mt-8">
      <ul class="space-y-3">
        <li v-for="feature in features" :key="feature" class="flex items-start">
          <svg
            class="h-5 w-5 flex-shrink-0 text-indigo-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fill-rule="evenodd"
              d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
              clip-rule="evenodd"
            />
          </svg>
          <span class="ml-3 text-sm text-gray-700">{{ feature }}</span>
        </li>
      </ul>
    </div>

    <div class="mt-8">
      <slot name="button">
        <button
          class="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Get Started
        </button>
      </slot>
    </div>
  </div>
</template>
