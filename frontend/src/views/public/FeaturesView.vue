<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <div class="bg-white">
    <!-- Hero Section -->
    <div
      class="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800"
    >
      <div
        class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"
      ></div>
      <div class="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div class="text-center">
          <div class="flex justify-center mb-6">
            <img src="/favicon.png" alt="Jeeves" class="h-20 w-20 sm:h-24 sm:w-24" />
          </div>
          <h1 class="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
            Powerful Features for
            <span class="block text-indigo-200">Modern Hospitality</span>
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-lg leading-8 text-indigo-100">
            Discover how Jeeves transforms guest communication with cutting-edge AI, intelligent
            automation, and seamless integrations.
          </p>
        </div>
      </div>
    </div>

    <!-- AI & RAG System Section -->
    <div class="py-24 sm:py-32">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-2xl lg:text-center">
          <h2 class="text-base font-semibold leading-7 text-indigo-600">Intelligent AI</h2>
          <p class="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Powered by Advanced AI & RAG Technology
          </p>
          <p class="mt-6 text-lg leading-8 text-gray-600">
            Jeeves uses state-of-the-art artificial intelligence combined with Retrieval Augmented
            Generation (RAG) to provide accurate, context-aware responses that learn from your
            unique communication style.
          </p>
        </div>

        <div class="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <dl class="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            <!-- RAG System -->
            <div class="flex flex-col">
              <dt class="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                <div class="h-10 w-10 flex items-center justify-center rounded-lg bg-indigo-600">
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
                      d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                    />
                  </svg>
                </div>
                RAG-Powered Knowledge Base
              </dt>
              <dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                <p class="flex-auto">
                  Our Retrieval Augmented Generation system creates a personalized knowledge base
                  from your past conversations. Every Q&A pair from your guest interactions is
                  analyzed, embedded, and stored for instant retrieval.
                </p>
                <p class="mt-4 text-sm text-gray-500">
                  When guests ask questions, Jeeves searches your knowledge base to find the most
                  relevant answers from your actual responses, ensuring consistency and accuracy.
                </p>
              </dd>
            </div>

            <!-- AI Learning -->
            <div class="flex flex-col">
              <dt class="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                <div class="h-10 w-10 flex items-center justify-center rounded-lg bg-indigo-600">
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
                Continuous Learning
              </dt>
              <dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                <p class="flex-auto">
                  Jeeves learns from every conversation. Through advanced machine learning
                  algorithms, it identifies patterns in your communication style, preferred
                  phrasing, and typical responses.
                </p>
                <p class="mt-4 text-sm text-gray-500">
                  The more conversations you sync, the smarter Jeeves becomes. It adapts to your
                  brand voice, tone, and even your unique way of handling guest requests.
                </p>
              </dd>
            </div>

            <!-- Context Awareness -->
            <div class="flex flex-col">
              <dt class="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900">
                <div class="h-10 w-10 flex items-center justify-center rounded-lg bg-indigo-600">
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
                      d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                Context-Aware Responses
              </dt>
              <dd class="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600">
                <p class="flex-auto">
                  Jeeves understands context beyond individual messages. It considers the full
                  conversation history, reservation details, property information, and guest
                  preferences to craft the perfect response.
                </p>
                <p class="mt-4 text-sm text-gray-500">
                  Whether a guest is asking about check-in times, late checkout, or property
                  amenities, Jeeves pulls from multiple data sources to provide comprehensive,
                  accurate answers.
                </p>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>

    <!-- Key Features Grid -->
    <div class="bg-gray-50 py-24 sm:py-32">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-2xl lg:text-center">
          <h2 class="text-base font-semibold leading-7 text-indigo-600">Everything You Need</h2>
          <p class="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Comprehensive Guest Communication Platform
          </p>
        </div>

        <div class="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
          <dl
            class="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16"
          >
            <!-- 24/7 Automation -->
            <div class="relative pl-16">
              <dt class="text-base font-semibold leading-7 text-gray-900">
                <div
                  class="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600"
                >
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
                      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                24/7 Automated Responses
              </dt>
              <dd class="mt-2 text-base leading-7 text-gray-600">
                Never miss a guest message again. Jeeves responds instantly to inquiries, even at 2
                AM on weekends. Your guests get immediate answers while you sleep.
              </dd>
            </div>

            <!-- Message Templates -->
            <div class="relative pl-16">
              <dt class="text-base font-semibold leading-7 text-gray-900">
                <div
                  class="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600"
                >
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
                Smart Message Templates
              </dt>
              <dd class="mt-2 text-base leading-7 text-gray-600">
                Create custom templates or import directly from Hostaway. Use variables like
                {{ guestName }} and {{ propertyName }} for personalized messages that feel
                authentic.
              </dd>
            </div>

            <!-- Conversation Management -->
            <div class="relative pl-16">
              <dt class="text-base font-semibold leading-7 text-gray-900">
                <div
                  class="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600"
                >
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
                      d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
                    />
                  </svg>
                </div>
                Centralized Inbox
              </dt>
              <dd class="mt-2 text-base leading-7 text-gray-600">
                View all conversations in one place. Monitor automation status, review scheduled
                messages, pause automation when needed, and take over conversations seamlessly.
              </dd>
            </div>

            <!-- Integrations -->
            <div class="relative pl-16">
              <dt class="text-base font-semibold leading-7 text-gray-900">
                <div
                  class="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600"
                >
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
                      d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                    />
                  </svg>
                </div>
                Seamless Integrations
              </dt>
              <dd class="mt-2 text-base leading-7 text-gray-600">
                Native integration with Hostaway for reservations and Twilio for SMS and WhatsApp
                messaging. Secure OAuth connections that take minutes to set up.
              </dd>
            </div>

            <!-- Knowledge Base -->
            <div class="relative pl-16">
              <dt class="text-base font-semibold leading-7 text-gray-900">
                <div
                  class="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600"
                >
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
                      d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                    />
                  </svg>
                </div>
                Self-Learning Knowledge Base
              </dt>
              <dd class="mt-2 text-base leading-7 text-gray-600">
                Automatically sync your conversation history to build a searchable knowledge base.
                Jeeves extracts Q&A pairs and learns from your actual responses to guests.
              </dd>
            </div>

            <!-- Confidence Scoring -->
            <div class="relative pl-16">
              <dt class="text-base font-semibold leading-7 text-gray-900">
                <div
                  class="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600"
                >
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
                      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                    />
                  </svg>
                </div>
                Intelligent Escalation
              </dt>
              <dd class="mt-2 text-base leading-7 text-gray-600">
                When Jeeves encounters questions it can't confidently answer, it automatically
                escalates to you or your on-call staff, ensuring nothing falls through the cracks.
              </dd>
            </div>

            <!-- Scheduled Messages -->
            <div class="relative pl-16">
              <dt class="text-base font-semibold leading-7 text-gray-900">
                <div
                  class="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600"
                >
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
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                    />
                  </svg>
                </div>
                Smart Scheduling
              </dt>
              <dd class="mt-2 text-base leading-7 text-gray-600">
                Schedule messages at the perfect time - check-in reminders, door codes, checkout
                reminders, and follow-ups. All timezone-aware and automatically triggered.
              </dd>
            </div>

            <!-- Analytics & Insights -->
            <div class="relative pl-16">
              <dt class="text-base font-semibold leading-7 text-gray-900">
                <div
                  class="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600"
                >
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
                      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                    />
                  </svg>
                </div>
                Dashboard & Analytics
              </dt>
              <dd class="mt-2 text-base leading-7 text-gray-600">
                Track your automation performance with real-time metrics. See message counts,
                automation status, and upcoming reservations at a glance.
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>

    <!-- How RAG Works Section -->
    <div class="py-24 sm:py-32">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-2xl lg:mx-0">
          <h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            How RAG Powers Jeeves
          </h2>
          <p class="mt-6 text-lg leading-8 text-gray-600">
            Retrieval Augmented Generation (RAG) is the technology that makes Jeeves so effective at
            understanding and responding to your guests.
          </p>
        </div>

        <div class="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <div class="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
            <!-- Step 1 -->
            <div class="flex flex-col items-start">
              <div class="rounded-2xl bg-indigo-50 p-8">
                <div class="text-base font-semibold leading-7 text-indigo-600">Step 1</div>
                <div class="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                  Sync Conversations
                </div>
                <p class="mt-6 text-base leading-7 text-gray-600">
                  Jeeves analyzes your past Hostaway conversations, extracting meaningful Q&A pairs
                  between guests and hosts. Each pair is stored with full context.
                </p>
              </div>
            </div>

            <!-- Step 2 -->
            <div class="flex flex-col items-start">
              <div class="rounded-2xl bg-indigo-50 p-8">
                <div class="text-base font-semibold leading-7 text-indigo-600">Step 2</div>
                <div class="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                  Create Embeddings
                </div>
                <p class="mt-6 text-base leading-7 text-gray-600">
                  Each Q&A pair is converted into high-dimensional vector embeddings using advanced
                  AI models. These embeddings capture semantic meaning, not just keywords.
                </p>
              </div>
            </div>

            <!-- Step 3 -->
            <div class="flex flex-col items-start">
              <div class="rounded-2xl bg-indigo-50 p-8">
                <div class="text-base font-semibold leading-7 text-indigo-600">Step 3</div>
                <div class="mt-2 text-2xl font-bold tracking-tight text-gray-900">
                  Retrieve & Generate
                </div>
                <p class="mt-6 text-base leading-7 text-gray-600">
                  When a guest asks a question, Jeeves searches the knowledge base for similar past
                  questions and retrieves your actual responses. The AI then generates a response
                  based on your style and the retrieved context.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- CTA Section -->
    <div class="bg-indigo-600">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div class="text-center">
          <h2 class="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to Experience These Features?
          </h2>
          <p class="mx-auto mt-6 max-w-2xl text-lg leading-8 text-indigo-200">
            Start your free trial and see how Jeeves transforms your guest communication with
            AI-powered automation.
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
