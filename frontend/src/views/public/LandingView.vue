<script setup lang="ts">
import { RouterLink } from 'vue-router';
import HeroSection from '@/components/public/HeroSection.vue';
</script>

<template>
  <div>
    <HeroSection>
      <template #title> Meet Jeeves. Your AI Assistant for Hospitality. </template>
      <template #subtitle>
        Automate guest communications, manage reservations, and provide 24/7 intelligent support.
        Jeeves learns from your conversations to deliver personalized responses that match your
        brand's voice.
      </template>
      <template #cta>
        <div class="flex items-center justify-center gap-x-6">
          <RouterLink
            to="/register"
            class="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Get Started Free
          </RouterLink>
          <RouterLink
            to="/features"
            class="rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Learn more
          </RouterLink>
        </div>
      </template>
    </HeroSection>

    <!-- Features Section -->
    <div id="features" class="bg-gray-50 py-24 sm:py-32">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Why Property Managers Love Jeeves
          </h2>
          <p class="mt-6 text-lg leading-8 text-gray-600">
            Jeeves integrates seamlessly with Hostaway and Twilio to handle guest inquiries, send
            automated messages, and learn from your communication style.
          </p>
        </div>

        <div class="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div class="rounded-2xl bg-white p-8 shadow-sm">
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-600">
              <svg
                class="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                />
              </svg>
            </div>
            <h3 class="mt-6 text-lg font-semibold text-gray-900">24/7 Guest Support</h3>
            <p class="mt-2 text-sm text-gray-600">
              Jeeves responds to guest messages instantly, even at 2 AM. Never miss a booking
              inquiry or customer question again.
            </p>
          </div>

          <div class="rounded-2xl bg-white p-8 shadow-sm">
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-600">
              <svg
                class="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
                />
              </svg>
            </div>
            <h3 class="mt-6 text-lg font-semibold text-gray-900">Learns Your Style</h3>
            <p class="mt-2 text-sm text-gray-600">
              Jeeves analyzes your past conversations to match your communication style, tone, and
              preferred responses.
            </p>
          </div>

          <div class="rounded-2xl bg-white p-8 shadow-sm">
            <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-600">
              <svg
                class="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h16.5M4.5 3h15l-.75 18H5.25L4.5 3z"
                />
              </svg>
            </div>
            <h3 class="mt-6 text-lg font-semibold text-gray-900">Seamless Integration</h3>
            <p class="mt-2 text-sm text-gray-600">
              Connect with Hostaway for reservations and Twilio for messaging. Setup takes minutes,
              not days.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- How It Works Section -->
    <div class="bg-white py-24 sm:py-32">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            How Does It Work?
          </h2>
          <p class="mt-6 text-lg leading-8 text-gray-600">
            Get started in minutes with our simple three-step process
          </p>
        </div>

        <div class="mt-20">
          <div class="grid grid-cols-1 gap-12 lg:grid-cols-3">
            <!-- Step 1 -->
            <div class="relative">
              <div class="flex items-center">
                <div
                  class="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white text-lg font-semibold"
                >
                  1
                </div>
                <div class="ml-4">
                  <h3 class="text-lg font-semibold text-gray-900">Connect Your Accounts</h3>
                </div>
              </div>
              <p class="mt-4 text-base text-gray-600">
                Link your Hostaway account for reservations and Twilio for messaging. Our secure
                integration takes just a few clicks.
              </p>
            </div>

            <!-- Step 2 -->
            <div class="relative">
              <div class="flex items-center">
                <div
                  class="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white text-lg font-semibold"
                >
                  2
                </div>
                <div class="ml-4">
                  <h3 class="text-lg font-semibold text-gray-900">Configure Your Templates</h3>
                </div>
              </div>
              <p class="mt-4 text-base text-gray-600">
                Customize your message templates or import them from Hostaway. Set up automated
                responses for check-in, check-out, and more.
              </p>
            </div>

            <!-- Step 3 -->
            <div class="relative">
              <div class="flex items-center">
                <div
                  class="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white text-lg font-semibold"
                >
                  3
                </div>
                <div class="ml-4">
                  <h3 class="text-lg font-semibold text-gray-900">Let Jeeves Handle It</h3>
                </div>
              </div>
              <p class="mt-4 text-base text-gray-600">
                Jeeves automatically responds to guest messages, learns from your past
                conversations, and handles inquiries 24/7.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- FAQ Section -->
    <div class="bg-gray-50 py-24 sm:py-32">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p class="mt-6 text-lg leading-8 text-gray-600">
            Everything you need to know about Jeeves
          </p>
        </div>

        <div class="mt-20">
          <dl class="space-y-10 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-10 lg:space-y-0">
            <div>
              <dt class="text-lg font-semibold leading-7 text-gray-900">
                How does Jeeves learn my communication style?
              </dt>
              <dd class="mt-2 text-base leading-7 text-gray-600">
                Jeeves analyzes your past conversations with guests to understand your tone,
                preferred responses, and common answers. The more conversations you sync, the better
                Jeeves becomes at matching your style.
              </dd>
            </div>

            <div>
              <dt class="text-lg font-semibold leading-7 text-gray-900">
                Can I review messages before they're sent?
              </dt>
              <dd class="mt-2 text-base leading-7 text-gray-600">
                Yes! All automated messages appear in your inbox where you can review, edit, pause,
                or cancel them before they're sent. You have full control over every message.
              </dd>
            </div>

            <div>
              <dt class="text-lg font-semibold leading-7 text-gray-900">
                What integrations are required?
              </dt>
              <dd class="mt-2 text-base leading-7 text-gray-600">
                Jeeves requires Hostaway for reservation data and Twilio for SMS and WhatsApp
                messaging. Both integrations are secure and use industry-standard OAuth
                authentication.
              </dd>
            </div>

            <div>
              <dt class="text-lg font-semibold leading-7 text-gray-900">
                How quickly does Jeeves respond to guests?
              </dt>
              <dd class="mt-2 text-base leading-7 text-gray-600">
                Jeeves responds to guest messages instantly, 24/7. No more waiting hours or missing
                messages during off-hours or weekends.
              </dd>
            </div>

            <div>
              <dt class="text-lg font-semibold leading-7 text-gray-900">
                Can I pause automation for specific conversations?
              </dt>
              <dd class="mt-2 text-base leading-7 text-gray-600">
                Absolutely. You can pause automation for any conversation at any time. When you
                pause, Jeeves will stop sending automated messages, allowing you to handle the
                conversation manually.
              </dd>
            </div>

            <div>
              <dt class="text-lg font-semibold leading-7 text-gray-900">
                What happens if Jeeves isn't confident about an answer?
              </dt>
              <dd class="mt-2 text-base leading-7 text-gray-600">
                When Jeeves encounters a question it can't confidently answer, it will automatically
                escalate the conversation to you or your on-call staff, ensuring nothing falls
                through the cracks.
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>

    <!-- CTA Section -->
    <div class="bg-indigo-600">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div class="text-center">
          <h2 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to let Jeeves handle your guest communications?
          </h2>
          <p class="mt-6 text-lg leading-8 text-indigo-200">
            Join property managers who are saving hours every week while providing better guest
            experiences.
          </p>
          <div class="mt-10 flex items-center justify-center gap-x-6">
            <RouterLink
              to="/register"
              class="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Start Free Trial
            </RouterLink>
            <RouterLink to="/pricing" class="text-sm font-semibold leading-6 text-white">
              View pricing <span aria-hidden="true">→</span>
            </RouterLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
