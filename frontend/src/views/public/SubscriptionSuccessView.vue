<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { CheckCircleIcon } from '@heroicons/vue/24/outline';
</script>

<template>
  <div class="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-md w-full space-y-8">
      <div class="text-center">
        <div class="flex justify-center mb-6">
          <img src="/favicon.png" alt="Jeeves" class="h-16 w-16 sm:h-20 sm:w-20" />
        </div>
        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
          <CheckCircleIcon class="h-6 w-6 text-green-600" aria-hidden="true" />
        </div>
        <h2 class="mt-6 text-3xl font-bold tracking-tight text-gray-900">Welcome to Jeeves!</h2>
        <p class="mt-2 text-sm text-gray-600">
          Your subscription has been successfully activated. You can now access all Pro Plan
          features.
        </p>
      </div>

      <div class="bg-gray-50 rounded-lg p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">What's next?</h3>
        <ul class="space-y-3 text-sm text-gray-600">
          <li class="flex items-start">
            <svg
              class="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clip-rule="evenodd"
              />
            </svg>
            <div>
              <span class="font-medium">Verify your email address</span>
              <p class="text-xs text-gray-500 mt-0.5">
                Check your inbox and click the verification link to activate your account
              </p>
            </div>
          </li>
          <li class="flex items-start">
            <svg
              class="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clip-rule="evenodd"
              />
            </svg>
            Connect your Hostaway account to start automating your property management
          </li>
          <li class="flex items-start">
            <svg
              class="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clip-rule="evenodd"
              />
            </svg>
            Set up Twilio for SMS and voice communications
          </li>
          <li class="flex items-start">
            <svg
              class="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fill-rule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clip-rule="evenodd"
              />
            </svg>
            Configure your first automation workflow
          </li>
        </ul>
      </div>

      <div class="text-center">
        <p class="text-xs text-gray-500">
          After verifying your email, you'll be redirected to your dashboard where you can set up
          integrations and configure your automation workflows.
        </p>
        <p class="mt-2 text-xs text-gray-500">
          Need help?
          <a href="mailto:support@meetjeeves.ai" class="text-indigo-600 hover:text-indigo-500">
            Contact our support team
          </a>
        </p>
      </div>
    </div>
  </div>
</template>
