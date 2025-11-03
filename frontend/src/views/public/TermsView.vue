<script setup lang="ts">
// No setup needed for static content
</script>

<template>
  <div class="bg-white py-24 sm:py-32">
    <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      <div class="prose prose-lg max-w-none">
        <h1 class="text-4xl font-bold tracking-tight text-gray-900">Terms of Service</h1>
        <p class="mt-6 text-lg text-gray-600">
          Last updated:
          {{
            new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          }}
        </p>

        <div class="mt-8 space-y-8 text-gray-700">
          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
            <p class="mb-4">
              By accessing or using Jeeves ("the Service"), operated by meetjeeves.ai ("we," "us,"
              or "our"), you agree to be bound by these Terms of Service ("Terms"). If you disagree
              with any part of these terms, you may not access the Service.
            </p>
            <p>
              These Terms apply to all users of the Service, including without limitation users who
              are browsers, vendors, customers, merchants, and/or contributors of content.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              2. Description of Service
            </h2>
            <p class="mb-4">
              Jeeves is an AI-powered platform designed to automate guest communications for
              hospitality businesses. The Service integrates with third-party platforms including
              Hostaway and Twilio to provide automated messaging, conversation management, and
              intelligent response capabilities.
            </p>
            <p>
              We reserve the right to modify, suspend, or discontinue any part of the Service at any
              time, with or without notice, and without liability to you.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              3. User Accounts and Registration
            </h2>
            <p class="mb-4">
              To access certain features of the Service, you must register for an account. You agree
              to:
            </p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and promptly update your account information</li>
              <li>Maintain the security of your password and account credentials</li>
              <li>Accept responsibility for all activities that occur under your account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activities that occur under your account. We are not liable for any loss
              or damage arising from your failure to comply with this obligation.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Acceptable Use Policy</h2>
            <p class="mb-4">You agree not to use the Service to:</p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon the rights of others, including intellectual property rights</li>
              <li>Transmit any harmful, offensive, or illegal content</li>
              <li>Attempt to gain unauthorized access to the Service or related systems</li>
              <li>Interfere with or disrupt the integrity or performance of the Service</li>
              <li>Use the Service to send spam, unsolicited messages, or harass others</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>
                Use automated systems (bots, scrapers) to access the Service without permission
              </li>
            </ul>
            <p>
              We reserve the right to suspend or terminate your account if you violate this
              Acceptable Use Policy.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              5. Subscription and Payment Terms
            </h2>
            <p class="mb-4">
              The Service is provided on a subscription basis. By subscribing, you agree to:
            </p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Pay all fees associated with your subscription plan</li>
              <li>Provide accurate billing and payment information</li>
              <li>Authorize us to charge your payment method for subscription fees</li>
            </ul>
            <p class="mb-4">
              <strong>Billing:</strong> Subscription fees are billed in advance on a monthly or
              annual basis, depending on your selected plan. All fees are non-refundable except as
              required by applicable law or as explicitly stated in our refund policy.
            </p>
            <p class="mb-4">
              <strong>Price Changes:</strong> We reserve the right to modify our pricing with 30
              days' notice. Price changes will not affect your current billing period but will apply
              to subsequent renewal periods.
            </p>
            <p>
              <strong>Failed Payments:</strong> If payment fails, we may suspend or terminate your
              account. You remain responsible for all charges incurred prior to termination.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              6. Intellectual Property Rights
            </h2>
            <p class="mb-4">
              The Service, including its original content, features, functionality, design, and
              trademarks, is owned by meetjeeves.ai and is protected by international copyright,
              trademark, patent, trade secret, and other intellectual property laws.
            </p>
            <p class="mb-4">
              You retain ownership of any content you submit, post, or display through the Service
              ("User Content"). By submitting User Content, you grant us a worldwide, non-exclusive,
              royalty-free license to use, reproduce, modify, adapt, and distribute your User
              Content solely for the purpose of providing and improving the Service.
            </p>
            <p>
              You may not copy, modify, distribute, sell, or lease any part of the Service without
              our prior written consent.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              7. Third-Party Integrations
            </h2>
            <p class="mb-4">
              The Service integrates with third-party services, including but not limited to
              Hostaway and Twilio. Your use of these third-party services is subject to their
              respective terms of service and privacy policies.
            </p>
            <p>
              We are not responsible for the availability, accuracy, or practices of third-party
              services. Any issues or disputes with third-party services should be directed to the
              respective service provider.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Data and Privacy</h2>
            <p class="mb-4">
              Your use of the Service is also governed by our Privacy Policy, which is incorporated
              into these Terms by reference. Please review our Privacy Policy to understand how we
              collect, use, and protect your information.
            </p>
            <p>
              You are responsible for ensuring that any data you provide to the Service, including
              guest information, complies with applicable data protection laws, including GDPR, and
              that you have the necessary consents to process such data.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              9. Service Availability and Modifications
            </h2>
            <p class="mb-4">
              While we strive to maintain high service availability, we do not guarantee that the
              Service will be available 100% of the time. The Service may be unavailable due to:
            </p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Scheduled maintenance</li>
              <li>Unforeseen technical issues</li>
              <li>Third-party service outages</li>
              <li>Force majeure events</li>
            </ul>
            <p>
              We reserve the right to modify, suspend, or discontinue any part of the Service at any
              time, with or without notice. We will not be liable to you or any third party for any
              modification, suspension, or discontinuation of the Service.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              10. Limitation of Liability
            </h2>
            <p class="mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL meetjeeves.ai,
              ITS AFFILIATES, OR THEIR RESPECTIVE OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
              INCLUDING WITHOUT LIMITATION:
            </p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Loss of profits, revenue, or data</li>
              <li>Business interruption</li>
              <li>Cost of substitute services</li>
              <li>Damages arising from use or inability to use the Service</li>
            </ul>
            <p class="mb-4">
              Our total liability to you for all claims arising from or related to the Service shall
              not exceed the amount you paid to us in the 12 months preceding the claim, or $100,
              whichever is greater.
            </p>
            <p>
              Some jurisdictions do not allow the exclusion or limitation of liability for
              consequential or incidental damages, so the above limitations may not apply to you.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">11. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless meetjeeves.ai and its affiliates
              from and against any claims, damages, losses, liabilities, and expenses (including
              reasonable attorneys' fees) arising out of or related to: (a) your use of the Service;
              (b) your violation of these Terms; (c) your violation of any third-party rights; or
              (d) your User Content.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">12. Termination</h2>
            <p class="mb-4">Either party may terminate this agreement at any time:</p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>You may cancel your subscription at any time through your account settings</li>
              <li>
                We may suspend or terminate your account immediately if you violate these Terms
              </li>
            </ul>
            <p class="mb-4">Upon termination:</p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Your right to access and use the Service will immediately cease</li>
              <li>You remain responsible for all charges incurred prior to termination</li>
              <li>
                We may delete your account and data in accordance with our data retention policies
              </li>
            </ul>
            <p>
              Sections of these Terms that by their nature should survive termination will survive,
              including but not limited to intellectual property rights, limitations of liability,
              and indemnification.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              13. Governing Law and Dispute Resolution
            </h2>
            <p class="mb-4">
              These Terms shall be governed by and construed in accordance with the laws of England
              and Wales, without regard to its conflict of law provisions.
            </p>
            <p class="mb-4">
              Any disputes arising out of or relating to these Terms or the Service shall be
              resolved through binding arbitration in accordance with the rules of the London Court
              of International Arbitration (LCIA), except where prohibited by law. You waive your
              right to participate in a class-action lawsuit or class-wide arbitration.
            </p>
            <p>
              Notwithstanding the foregoing, we may seek injunctive relief in any court of competent
              jurisdiction in England and Wales to protect our intellectual property or confidential
              information.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">14. Changes to Terms</h2>
            <p class="mb-4">
              We reserve the right to modify these Terms at any time. We will notify you of material
              changes by:
            </p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Posting the updated Terms on our website</li>
              <li>Sending an email to the address associated with your account</li>
              <li>Displaying a notice within the Service</li>
            </ul>
            <p>
              Your continued use of the Service after the effective date of any changes constitutes
              acceptance of the modified Terms. If you do not agree to the changes, you must stop
              using the Service and cancel your subscription.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">15. Miscellaneous</h2>
            <p class="mb-4">
              <strong>Entire Agreement:</strong> These Terms, together with our Privacy Policy,
              constitute the entire agreement between you and meetjeeves.ai regarding the Service.
            </p>
            <p class="mb-4">
              <strong>Severability:</strong> If any provision of these Terms is found to be
              unenforceable, the remaining provisions will remain in full effect.
            </p>
            <p class="mb-4">
              <strong>Waiver:</strong> Our failure to enforce any right or provision of these Terms
              shall not constitute a waiver of such right or provision.
            </p>
            <p class="mb-4">
              <strong>Assignment:</strong> You may not assign or transfer these Terms or your
              account without our prior written consent. We may assign these Terms without
              restriction.
            </p>
            <p>
              <strong>Contact Information:</strong> If you have any questions about these Terms,
              please contact us at
              <a href="mailto:support@meetjeeves.ai" class="text-indigo-600 hover:text-indigo-500"
                >support@meetjeeves.ai</a
              >.
            </p>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
