<script setup lang="ts">
// No setup needed for static content
</script>

<template>
  <div class="bg-white py-24 sm:py-32">
    <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
      <div class="prose prose-lg max-w-none">
        <h1 class="text-4xl font-bold tracking-tight text-gray-900">Privacy Policy</h1>
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
        <p class="mt-4 text-sm text-gray-500">
          This Privacy Policy describes how meetjeeves.ai ("we," "us," or "our") collects, uses, and
          protects your personal information when you use Jeeves ("the Service"). This policy is
          designed to comply with the General Data Protection Regulation (GDPR) and other applicable
          data protection laws.
        </p>

        <div class="mt-8 space-y-8 text-gray-700">
          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              1. Information We Collect
            </h2>

            <h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">
              1.1 Information You Provide to Us
            </h3>
            <p class="mb-4">We collect information that you provide directly to us when you:</p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Register for an account (name, email address, company name)</li>
              <li>Configure integrations (API keys, credentials for Hostaway, Twilio, etc.)</li>
              <li>Upload content to the knowledge base</li>
              <li>Contact us for support or inquiries</li>
              <li>Subscribe to our newsletter or marketing communications</li>
            </ul>

            <h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">
              1.2 Information We Collect Automatically
            </h3>
            <p class="mb-4">When you use the Service, we automatically collect:</p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Usage data (pages visited, features used, time spent)</li>
              <li>Device information (IP address, browser type, operating system)</li>
              <li>Log data (access times, error logs, performance metrics)</li>
              <li>Cookies and similar tracking technologies (see Section 7)</li>
            </ul>

            <h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">
              1.3 Information from Third-Party Services
            </h3>
            <p class="mb-4">When you integrate third-party services, we may receive:</p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Reservation data from Hostaway</li>
              <li>Message data from Twilio</li>
              <li>Conversation history and guest information</li>
            </ul>
            <p>
              This data is processed in accordance with your instructions and our Data Processing
              Agreement.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              2. Legal Basis for Processing (GDPR)
            </h2>
            <p class="mb-4">We process your personal data based on the following legal bases:</p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Contract Performance:</strong> To provide the Service and fulfill our
                contractual obligations
              </li>
              <li>
                <strong>Legitimate Interests:</strong> To improve the Service, prevent fraud, and
                ensure security
              </li>
              <li>
                <strong>Consent:</strong> When you have given explicit consent (e.g., marketing
                communications)
              </li>
              <li>
                <strong>Legal Obligation:</strong> To comply with applicable laws and regulations
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              3. How We Use Your Information
            </h2>
            <p class="mb-4">We use the information we collect to:</p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process transactions and manage your subscription</li>
              <li>Authenticate your identity and manage your account</li>
              <li>Send you service-related communications (notifications, updates, support)</li>
              <li>Respond to your inquiries and provide customer support</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
              <li>Comply with legal obligations and enforce our Terms of Service</li>
              <li>Send you marketing communications (with your consent, where required)</li>
              <li>Analyze usage patterns to improve user experience</li>
            </ul>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              4. Data Sharing and Disclosure
            </h2>
            <p class="mb-4">
              We do not sell your personal information. We may share your information only in the
              following circumstances:
            </p>

            <h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">4.1 Service Providers</h3>
            <p class="mb-4">
              We share data with third-party service providers who perform services on our behalf:
            </p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Cloud hosting providers (Supabase, AWS, etc.)</li>
              <li>Payment processors (Stripe)</li>
              <li>Analytics services</li>
              <li>Email service providers</li>
            </ul>
            <p>
              These providers are bound by contractual obligations to protect your data and use it
              only for specified purposes.
            </p>

            <h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">4.2 Legal Requirements</h3>
            <p class="mb-4">
              We may disclose your information if required by law or in response to:
            </p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Legal processes (subpoenas, court orders)</li>
              <li>Government requests</li>
              <li>Enforcement of our Terms of Service</li>
              <li>Protection of our rights, property, or safety</li>
            </ul>

            <h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">4.3 Business Transfers</h3>
            <p>
              In the event of a merger, acquisition, or sale of assets, your information may be
              transferred to the acquiring entity, subject to the same privacy protections.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              5. International Data Transfers
            </h2>
            <p class="mb-4">
              Your information may be transferred to and processed in countries other than your
              country of residence. These countries may have different data protection laws than
              your country.
            </p>
            <p class="mb-4">
              When we transfer data outside the European Economic Area (EEA), we ensure appropriate
              safeguards are in place, including:
            </p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Standard Contractual Clauses approved by the European Commission</li>
              <li>Data Processing Agreements with service providers</li>
              <li>Adequacy decisions by the European Commission</li>
            </ul>
            <p>
              By using the Service, you consent to the transfer of your information to countries
              outside your jurisdiction.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Data Retention</h2>
            <p class="mb-4">We retain your personal information for as long as necessary to:</p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Provide the Service to you</li>
              <li>Comply with legal obligations</li>
              <li>Resolve disputes and enforce agreements</li>
              <li>Protect our legitimate business interests</li>
            </ul>
            <p class="mb-4">Specific retention periods:</p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Account Data:</strong> Retained while your account is active and for 30 days
                after account deletion
              </li>
              <li>
                <strong>Transaction Records:</strong> Retained for 7 years as required by tax and
                accounting laws
              </li>
              <li><strong>Log Data:</strong> Retained for 90 days</li>
              <li>
                <strong>Marketing Data:</strong> Retained until you unsubscribe or withdraw consent
              </li>
            </ul>
            <p>
              Upon expiration of the retention period, we will securely delete or anonymize your
              personal information.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              7. Cookies and Tracking Technologies
            </h2>
            <p class="mb-4">We use cookies and similar technologies to:</p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Authenticate your session</li>
              <li>Remember your preferences</li>
              <li>Analyze usage patterns</li>
              <li>Improve the Service</li>
            </ul>
            <p class="mb-4">Types of cookies we use:</p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Essential Cookies:</strong> Required for the Service to function (cannot be
                disabled)
              </li>
              <li>
                <strong>Analytics Cookies:</strong> Help us understand how users interact with the
                Service
              </li>
              <li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
            </ul>
            <p>
              You can control cookies through your browser settings. However, disabling certain
              cookies may limit your ability to use some features of the Service.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Your Rights (GDPR)</h2>
            <p class="mb-4">
              If you are located in the EEA or UK, you have the following rights regarding your
              personal data:
            </p>

            <h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">8.1 Right of Access</h3>
            <p class="mb-4">
              You have the right to request a copy of the personal information we hold about you.
            </p>

            <h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">
              8.2 Right to Rectification
            </h3>
            <p class="mb-4">
              You have the right to correct inaccurate or incomplete personal information.
            </p>

            <h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">
              8.3 Right to Erasure ("Right to be Forgotten")
            </h3>
            <p class="mb-4">
              You have the right to request deletion of your personal information in certain
              circumstances.
            </p>

            <h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">
              8.4 Right to Restrict Processing
            </h3>
            <p class="mb-4">
              You have the right to request that we limit how we process your personal information.
            </p>

            <h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">
              8.5 Right to Data Portability
            </h3>
            <p class="mb-4">
              You have the right to receive your personal information in a structured, commonly used
              format.
            </p>

            <h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">8.6 Right to Object</h3>
            <p class="mb-4">
              You have the right to object to processing of your personal information for direct
              marketing or legitimate interests.
            </p>

            <h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">
              8.7 Right to Withdraw Consent
            </h3>
            <p class="mb-4">
              Where processing is based on consent, you have the right to withdraw consent at any
              time.
            </p>

            <h3 class="text-xl font-semibold text-gray-900 mt-6 mb-3">
              8.8 Right to Lodge a Complaint
            </h3>
            <p>
              You have the right to lodge a complaint with your local data protection authority if
              you believe we have violated your rights.
            </p>

            <p class="mt-6 mb-4">
              To exercise any of these rights, please contact us at
              <a href="mailto:support@meetjeeves.ai" class="text-indigo-600 hover:text-indigo-500"
                >support@meetjeeves.ai</a
              >. We will respond to your request within 30 days.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. Data Security</h2>
            <p class="mb-4">
              We implement appropriate technical and organizational measures to protect your
              personal information, including:
            </p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Encryption of data in transit (TLS/SSL) and at rest</li>
              <li>Access controls and authentication mechanisms</li>
              <li>Regular security assessments and audits</li>
              <li>Employee training on data protection</li>
              <li>Incident response procedures</li>
            </ul>
            <p class="mb-4">
              However, no method of transmission over the internet or electronic storage is 100%
              secure. While we strive to protect your information, we cannot guarantee absolute
              security.
            </p>
            <p>
              In the event of a data breach that poses a risk to your rights and freedoms, we will
              notify you and the relevant supervisory authority within 72 hours, as required by
              GDPR.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. Children's Privacy</h2>
            <p>
              The Service is not intended for individuals under the age of 18. We do not knowingly
              collect personal information from children. If we become aware that we have collected
              information from a child without parental consent, we will take steps to delete such
              information promptly.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              11. Data Controller Information
            </h2>
            <p class="mb-4"><strong>Data Controller:</strong> meetjeeves.ai</p>
            <p class="mb-4">For questions or concerns about data protection, please contact:</p>
            <ul class="list-none mb-4 space-y-2">
              <li>
                <strong>Email:</strong>
                <a href="mailto:support@meetjeeves.ai" class="text-indigo-600 hover:text-indigo-500"
                  >support@meetjeeves.ai</a
                >
              </li>
              <li>
                <strong>Data Protection Officer:</strong>
                <a href="mailto:support@meetjeeves.ai" class="text-indigo-600 hover:text-indigo-500"
                  >support@meetjeeves.ai</a
                >
              </li>
            </ul>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">
              12. Changes to This Privacy Policy
            </h2>
            <p class="mb-4">
              We may update this Privacy Policy from time to time. We will notify you of material
              changes by:
            </p>
            <ul class="list-disc pl-6 mb-4 space-y-2">
              <li>Posting the updated policy on our website</li>
              <li>Sending an email to the address associated with your account</li>
              <li>Displaying a notice within the Service</li>
            </ul>
            <p>
              Your continued use of the Service after the effective date of any changes constitutes
              acceptance of the updated Privacy Policy. The "Last updated" date at the top of this
              page indicates when the policy was last revised.
            </p>
          </section>

          <section>
            <h2 class="text-2xl font-semibold text-gray-900 mt-8 mb-4">13. Contact Us</h2>
            <p class="mb-4">
              If you have any questions, concerns, or requests regarding this Privacy Policy or our
              data practices, please contact us:
            </p>
            <ul class="list-none mb-4 space-y-2">
              <li>
                <strong>Email:</strong>
                <a href="mailto:support@meetjeeves.ai" class="text-indigo-600 hover:text-indigo-500"
                  >support@meetjeeves.ai</a
                >
              </li>
              <li>
                <strong>Data Protection Officer:</strong>
                <a href="mailto:support@meetjeeves.ai" class="text-indigo-600 hover:text-indigo-500"
                  >support@meetjeeves.ai</a
                >
              </li>
            </ul>
            <p>We will respond to your inquiry within 30 days as required by GDPR.</p>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
