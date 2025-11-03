<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <footer class="bg-gray-800">
    <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="flex flex-col items-center justify-between space-y-4 md:flex-row md:space-y-0">
        <div class="text-center md:text-left">
          <div class="flex items-center justify-center gap-3 md:justify-start md:-ml-2">
            <img src="/logo.png" alt="Jeeves" class="h-10 w-auto opacity-80" />
            <p class="text-sm text-gray-400">
              © {{ new Date().getFullYear() }}
              <a href="https://meetjeeves.ai" class="font-medium text-white hover:underline"
                >meetjeeves.ai</a
              >. All rights reserved.
            </p>
          </div>
        </div>
        <div class="flex space-x-6">
          <RouterLink to="/terms" class="text-sm text-gray-400 hover:text-white transition-colors">
            Terms of Service
          </RouterLink>
          <RouterLink
            to="/privacy"
            class="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Privacy Policy
          </RouterLink>
        </div>
      </div>
    </div>
  </footer>
</template>
