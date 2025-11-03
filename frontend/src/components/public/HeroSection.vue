<script setup lang="ts">
// No props needed - uses slots for content
</script>

<template>
  <div class="relative bg-white">
    <div class="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
      <div class="text-center">
        <div class="flex justify-center mb-6">
          <img src="/favicon.png" alt="Jeeves" class="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28" />
        </div>
        <h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          <slot name="title"> Default Hero Title </slot>
        </h1>
        <p class="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600">
          <slot name="subtitle"> Default hero subtitle text goes here. </slot>
        </p>
        <div class="mt-10 flex items-center justify-center gap-x-6">
          <slot name="cta">
            <button
              class="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Get Started
            </button>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>
