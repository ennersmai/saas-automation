#!/usr/bin/env node

/**
 * Test script to verify Hostaway webhook registration and test webhook endpoint
 *
 * Usage:
 * 1. Set your ngrok URL: export NGROK_URL="https://your-ngrok-id.ngrok-free.app"
 * 2. Run: node test-webhook.js
 */

const https = require('https');
const http = require('http');

const NGROK_URL = process.env.NGROK_URL || 'https://e98acebf4994.ngrok-free.app';
const WEBHOOK_URL = `${NGROK_URL}/api/webhooks/hostaway`;

console.log('🧪 Testing Hostaway Webhook Integration');
console.log('=====================================');
console.log(`Webhook URL: ${WEBHOOK_URL}`);
console.log('');

// Test 1: Check if webhook endpoint is accessible
async function testWebhookEndpoint() {
  console.log('1. Testing webhook endpoint accessibility...');

  return new Promise((resolve) => {
    const url = new URL(WEBHOOK_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Hostaway-Webhook-Test/1.0',
      },
    };

    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(options, (res) => {
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Headers:`, res.headers);

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`   Response: ${data}`);
        resolve({
          success: res.statusCode === 200 || res.statusCode === 400, // 400 is expected for missing auth
          statusCode: res.statusCode,
          response: data,
        });
      });
    });

    req.on('error', (err) => {
      console.log(`   ❌ Error: ${err.message}`);
      resolve({ success: false, error: err.message });
    });

    // Send a test webhook payload
    const testPayload = {
      event: 'message.received',
      clientId: 'test-client-id',
      timestamp: new Date().toISOString(),
      data: {
        message: 'Test message from webhook test script',
        guestName: 'Test Guest',
        reservationId: 'test-reservation-123',
      },
    };

    req.write(JSON.stringify(testPayload));
    req.end();
  });
}

// Test 2: Check if the webhook URL format is correct
function testWebhookUrlFormat() {
  console.log('2. Testing webhook URL format...');

  try {
    const url = new URL(WEBHOOK_URL);
    const isValid = url.protocol === 'https:' && url.pathname.endsWith('/api/webhooks/hostaway');

    if (isValid) {
      console.log('   ✅ URL format is correct');
      return true;
    } else {
      console.log('   ❌ URL format is incorrect');
      console.log('   Expected: https://domain.com/api/webhooks/hostaway');
      console.log(`   Got: ${WEBHOOK_URL}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Invalid URL: ${error.message}`);
    return false;
  }
}

// Test 3: Simulate Hostaway webhook payload
async function testHostawayWebhookPayload() {
  console.log('3. Testing with Hostaway-style webhook payload...');

  const hostawayPayload = {
    event: 'message.received',
    clientId: 'test-tenant-client-id',
    accountId: 'test-tenant-client-id',
    timestamp: new Date().toISOString(),
    reservation: {
      id: 'test-reservation-123',
      guestName: 'John Smith',
      propertyName: 'Test Property',
      doorCode: '1234',
      checkIn: '2024-01-15',
      checkOut: '2024-01-17',
    },
    message: {
      id: 'test-message-456',
      body: 'Hello, I need help with check-in',
      direction: 'guest',
      timestamp: new Date().toISOString(),
    },
  };

  return new Promise((resolve) => {
    const url = new URL(WEBHOOK_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Hostaway-Webhook/1.0',
      },
    };

    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(options, (res) => {
      console.log(`   Status: ${res.statusCode}`);

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`   Response: ${data}`);
        resolve({
          success: res.statusCode === 200,
          statusCode: res.statusCode,
          response: data,
        });
      });
    });

    req.on('error', (err) => {
      console.log(`   ❌ Error: ${err.message}`);
      resolve({ success: false, error: err.message });
    });

    req.write(JSON.stringify(hostawayPayload));
    req.end();
  });
}

// Main test function
async function runTests() {
  console.log('Starting webhook tests...\n');

  const results = [];

  // Test URL format
  results.push({
    name: 'URL Format',
    success: testWebhookUrlFormat(),
  });

  // Test endpoint accessibility
  const endpointTest = await testWebhookEndpoint();
  results.push({
    name: 'Endpoint Accessibility',
    success: endpointTest.success,
  });

  // Test Hostaway payload
  const payloadTest = await testHostawayWebhookPayload();
  results.push({
    name: 'Hostaway Payload',
    success: payloadTest.success,
  });

  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('======================');

  results.forEach((result) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name}`);
  });

  const allPassed = results.every((r) => r.success);
  console.log(`\n${allPassed ? '🎉 All tests passed!' : '⚠️  Some tests failed'}`);

  if (!allPassed) {
    console.log('\n💡 Troubleshooting Tips:');
    console.log('1. Make sure your backend is running on localhost:3000');
    console.log('2. Verify your ngrok tunnel is active and pointing to localhost:3000');
    console.log('3. Check that HOSTAWAY_WEBHOOK_URL is set correctly in your .env file');
    console.log('4. Ensure the webhook endpoint is properly registered in Hostaway dashboard');
  }
}

// Run tests
runTests().catch(console.error);
