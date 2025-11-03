#!/usr/bin/env node

/**
 * Test script to send a fake Hostaway webhook message
 *
 * Usage:
 * node test-webhook-message.js
 */

const http = require('http');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const WEBHOOK_ENDPOINT = `${API_URL}/api/webhooks/hostaway`;

// The webhook payload structure provided by the user
// Note: The payload field contains a JSON string that needs to be parsed
const webhookPayload = {
  event: 'message.received',
  object: 'conversationMessage',
  accountId: 151651,
  data: {
    id: 342823158,
    accountId: 151651,
    userId: null,
    listingMapId: 381634,
    reservationId: 45545341,
    conversationId: 32199786,
    communicationId: null,
    airbnbThreadMessageId: null,
    channelId: 2005,
    channelThreadMessageId: '6d2f2e60-b6e5-11f0-8696-d9e4859363fa',
    body: 'Good morning, is there any way we could pay for late checkout?',
    imagesUrls: null,
    bookingcomSubthreadId: '276c832d-343b-5904-9e0b-60896278b8c1',
    inReplyTo: null,
    bookingcomReplyOptions: null,
    bookingcomSelectedOptions: null,
    isIncoming: 1,
    isSeen: 1,
    sentUsingHostaway: 0,
    hash: 'e08397128742a168a85b609ec9c8a709',
    listingTimeZoneName: 'Europe/London',
    communicationEvent: null,
    communicationTimeDelta: null,
    communicationTimeDeltaSeconds: 0,
    communicationApplyListingTimeZone: null,
    communicationAlwaysTrigger: null,
    date: '2025-11-01 05:41:34',
    status: 'sent',
    sentChannelDate: null,
    listingName: null,
    attachments: [],
    insertedOn: '2025-11-01 05:42:16',
    updatedOn: '2025-11-01 05:42:16',
    communicationType: 'channel',
  },
};

async function sendWebhook() {
  console.log('🧪 Testing Hostaway Webhook Message');
  console.log('===================================');
  console.log(`Endpoint: ${WEBHOOK_ENDPOINT}`);
  console.log('');
  console.log('Payload:');
  console.log(JSON.stringify(webhookPayload, null, 2));
  console.log('');

  return new Promise((resolve, reject) => {
    const url = new URL(WEBHOOK_ENDPOINT);

    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Hostaway-Webhook/1.0',
      },
    };

    const req = http.request(options, (res) => {
      console.log(`📡 Response Status: ${res.statusCode}`);
      console.log(`📡 Response Headers:`, res.headers);
      console.log('');

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (data) {
          console.log('📥 Response Body:');
          try {
            const parsed = JSON.parse(data);
            console.log(JSON.stringify(parsed, null, 2));
          } catch {
            console.log(data);
          }
        } else {
          console.log('📥 (Empty response body)');
        }
        console.log('');

        if (res.statusCode === 200) {
          console.log('✅ Webhook processed successfully!');
          console.log('');
          console.log('💡 Next steps:');
          console.log('1. Check the backend logs to see if the message was processed');
          console.log('2. Check the inbox to see if the conversation was updated');
          console.log('3. Check if conversation history was synced');
          console.log('4. Check if AI generated a response (if enabled)');
          resolve({ success: true, statusCode: res.statusCode, response: data });
        } else {
          console.log(`❌ Webhook failed with status ${res.statusCode}`);
          resolve({ success: false, statusCode: res.statusCode, response: data });
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Request error:', err.message);
      console.log('');
      console.log('💡 Troubleshooting:');
      console.log(`1. Make sure the backend is running on ${API_URL}`);
      console.log('2. Check that the port is correct (default: 3000)');
      console.log('3. Verify the endpoint path is correct (/api/webhooks/hostaway)');
      reject(err);
    });

    const payloadString = JSON.stringify(webhookPayload);
    console.log(`📤 Sending ${payloadString.length} bytes...`);
    console.log('');

    req.write(payloadString);
    req.end();
  });
}

// Run the test
sendWebhook()
  .then((result) => {
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
