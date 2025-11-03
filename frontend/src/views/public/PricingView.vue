<script setup lang="ts">
import { RouterLink } from 'vue-router';
import PricingTier from '@/components/public/PricingTier.vue';

const proPlanFeatures = [
  'Unlimited automations',
  'Hostaway integration',
  'Twilio SMS & Voice',
  'AI-powered responses',
  '24/7 customer support',
  'Advanced analytics',
  'Custom workflows',
  'API access',
];
</script>

<template>
  <div class="bg-white py-24 sm:py-32">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="text-center">
        <h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Simple, transparent pricing
        </h1>
        <p class="mt-6 text-lg leading-8 text-gray-600">
          Choose the plan that's right for your business. No hidden fees, no surprises.
        </p>
      </div>

      <div class="mt-20 flex justify-center">
        <PricingTier
          :plan-name="'Pro Plan'"
          :price="'$49'"
          :frequency="'/ month'"
          :features="proPlanFeatures"
          :popular="true"
        >
          <template #button>
            <RouterLink
              to="/register"
              class="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Start Free Trial
            </RouterLink>
          </template>
        </PricingTier>
      </div>

      <!-- FAQ Section -->
      <div class="mt-32">
        <div class="text-center">
          <h2 class="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Frequently asked questions
          </h2>
        </div>

        <div class="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">What's included in the free trial?</h3>
            <p class="mt-2 text-sm text-gray-600">
              You get full access to all features for 14 days. No credit card required to start.
            </p>
          </div>

          <div>
            <h3 class="text-lg font-semibold text-gray-900">Can I cancel anytime?</h3>
            <p class="mt-2 text-sm text-gray-600">
              Yes, you can cancel your subscription at any time. No long-term contracts or
              commitments.
            </p>
          </div>

          <div>
            <h3 class="text-lg font-semibold text-gray-900">Do you offer support?</h3>
            <p class="mt-2 text-sm text-gray-600">
              Yes, we provide 24/7 customer support via email and live chat for all Pro Plan
              subscribers.
            </p>
          </div>

          <div>
            <h3 class="text-lg font-semibold text-gray-900">How secure is my data?</h3>
            <p class="mt-2 text-sm text-gray-600">
              We use enterprise-grade security with end-to-end encryption and SOC 2 compliance.
            </p>
          </div>

          <div>
            <h3 class="text-lg font-semibold text-gray-900">
              Can I integrate with my existing tools?
            </h3>
            <p class="mt-2 text-sm text-gray-600">
              Absolutely! We support 100+ popular business tools including Hostaway, Twilio, and
              many more.
            </p>
          </div>

          <div>
            <h3 class="text-lg font-semibold text-gray-900">Is there a setup fee?</h3>
            <p class="mt-2 text-sm text-gray-600">
              No setup fees, no hidden costs. Just the monthly subscription fee for the Pro Plan.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
