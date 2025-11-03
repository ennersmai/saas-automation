#!/usr/bin/env node

/**
 * Test script to fetch and log Hostaway conversations list endpoint response
 *
 * Usage:
 * 1. Set your Hostaway credentials:
 *    - HOSTAWAY_ID: your Hostaway account ID
 *    - HOSTAWAY_ACCESS_TOKEN: your client secret (API token)
 * 2. Optionally set query parameters:
 *    - HOSTAWAY_RESERVATION_ID: reservation id to filter
 *    - HOSTAWAY_LIMIT: max number of items (default: 10)
 *    - HOSTAWAY_OFFSET: number of items to skip (default: 0)
 *    - HOSTAWAY_INCLUDE_RESOURCES: include resources flag (0 or 1, default: 1)
 * 3. Run: node test-hostaway-conversations.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const HOSTAWAY_API_BASE = process.env.HOSTAWAY_API_BASE_URL || 'https://api.hostaway.com';
const CLIENT_ID = process.env.HOSTAWAY_ID;
const CLIENT_SECRET = process.env.HOSTAWAY_ACCESS_TOKEN; // This is actually the client_secret
const RESERVATION_ID = process.env.HOSTAWAY_RESERVATION_ID || '';
const LIMIT = process.env.HOSTAWAY_LIMIT || '10';
const OFFSET = process.env.HOSTAWAY_OFFSET || '0';
const INCLUDE_RESOURCES = process.env.HOSTAWAY_INCLUDE_RESOURCES || '1';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    '❌ Error: HOSTAWAY_ID and HOSTAWAY_ACCESS_TOKEN environment variables are required',
  );
  console.error('   HOSTAWAY_ID: your Hostaway account ID');
  console.error('   HOSTAWAY_ACCESS_TOKEN: your client secret (API token)');
  process.exit(1);
}

console.log('🧪 Testing Hostaway Conversations Endpoint');
console.log('=========================================');
console.log(`API Base: ${HOSTAWAY_API_BASE}`);
console.log(`Limit: ${LIMIT}`);
console.log(`Offset: ${OFFSET}`);
console.log(`Reservation ID: ${RESERVATION_ID || '(not set)'}`);
console.log(`Include Resources: ${INCLUDE_RESOURCES}`);
console.log('');

// Generate access token using client credentials
async function generateAccessToken() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${HOSTAWAY_API_BASE}/v1/accessTokens`);

    const data = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'general',
    }).toString();

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-control': 'no-cache',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);

          if (res.statusCode === 200 && jsonData.access_token) {
            console.log('✅ Access token generated successfully');
            console.log(
              `   Token expires in: ${jsonData.expires_in} seconds (${Math.round(
                jsonData.expires_in / 86400,
              )} days)`,
            );
            console.log('');
            resolve(jsonData.access_token);
          } else {
            console.error('❌ Failed to generate access token');
            console.error(`   Status: ${res.statusCode}`);
            console.error(`   Response: ${responseData}`);
            reject(new Error(`Failed to generate access token: ${responseData}`));
          }
        } catch (parseError) {
          console.error('❌ Failed to parse access token response:', parseError.message);
          console.error('Raw response:', responseData);
          reject(parseError);
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Request error:', err.message);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

// Build query string
function buildQueryString() {
  const params = new URLSearchParams();
  if (LIMIT) params.append('limit', LIMIT);
  if (OFFSET) params.append('offset', OFFSET);
  if (RESERVATION_ID) params.append('reservationId', RESERVATION_ID);
  if (INCLUDE_RESOURCES) params.append('includeResources', INCLUDE_RESOURCES);

  const query = params.toString();
  return query ? `?${query}` : '';
}

// Make API request
async function fetchConversations(accessToken) {
  const queryString = buildQueryString();
  const apiPath = `/v1/conversations${queryString}`;

  console.log(`📡 Making request to: ${apiPath}`);
  console.log('');

  return new Promise((resolve, reject) => {
    const url = new URL(HOSTAWAY_API_BASE);

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: apiPath,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Cache-control': 'no-cache',
        Accept: 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      console.log(`📊 Response Status: ${res.statusCode} ${res.statusMessage}`);
      console.log(`📋 Response Headers:`, JSON.stringify(res.headers, null, 2));
      console.log('');

      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);

          console.log('✅ Response received successfully');
          console.log('');
          console.log('📄 Response Structure:');
          console.log(JSON.stringify(jsonData, null, 2));

          // Analyze response structure
          console.log('');
          console.log('📊 Response Analysis:');
          console.log('====================');

          if (Array.isArray(jsonData)) {
            console.log(`   Type: Array with ${jsonData.length} items`);
            if (jsonData.length > 0) {
              console.log(`   First item structure:`, JSON.stringify(jsonData[0], null, 2));
              console.log(`   Keys in first item:`, Object.keys(jsonData[0]).join(', '));
            }
          } else if (typeof jsonData === 'object') {
            console.log(`   Type: Object`);
            console.log(`   Top-level keys:`, Object.keys(jsonData).join(', '));

            // Check for common response patterns
            if (jsonData.result) {
              console.log(`   Found 'result' key`);
              if (Array.isArray(jsonData.result)) {
                console.log(`   'result' is an array with ${jsonData.result.length} items`);
              }
            }
            if (jsonData.results) {
              console.log(`   Found 'results' key`);
              if (Array.isArray(jsonData.results)) {
                console.log(`   'results' is an array with ${jsonData.results.length} items`);
              }
            }
            if (jsonData.data) {
              console.log(`   Found 'data' key`);
              if (Array.isArray(jsonData.data)) {
                console.log(`   'data' is an array with ${jsonData.data.length} items`);
              }
            }
            if (jsonData.items) {
              console.log(`   Found 'items' key`);
              if (Array.isArray(jsonData.items)) {
                console.log(`   'items' is an array with ${jsonData.items.length} items`);
              }
            }
            if (jsonData.conversations) {
              console.log(`   Found 'conversations' key`);
              if (Array.isArray(jsonData.conversations)) {
                console.log(
                  `   'conversations' is an array with ${jsonData.conversations.length} items`,
                );
              }
            }
          }

          // Save to file
          const outputDir = path.join(__dirname, 'logs');
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `hostaway-conversations-${timestamp}.json`;
          const filepath = path.join(outputDir, filename);

          fs.writeFileSync(filepath, JSON.stringify(jsonData, null, 2));
          console.log('');
          console.log(`💾 Full response saved to: ${filepath}`);

          resolve({
            success: res.statusCode === 200,
            statusCode: res.statusCode,
            data: jsonData,
          });
        } catch (parseError) {
          console.error('❌ Failed to parse JSON response:', parseError.message);
          console.log('Raw response:');
          console.log(data);

          // Save raw response
          const outputDir = path.join(__dirname, 'logs');
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `hostaway-conversations-raw-${timestamp}.txt`;
          const filepath = path.join(outputDir, filename);

          fs.writeFileSync(filepath, data);
          console.log(`💾 Raw response saved to: ${filepath}`);

          reject(parseError);
        }
      });
    });

    req.on('error', (err) => {
      console.error('❌ Request error:', err.message);
      reject(err);
    });

    req.end();
  });
}

// Test with different parameter combinations
async function runTests() {
  const results = [];

  try {
    // First, generate an access token
    console.log('🔑 Step 1: Generating access token');
    console.log('===================================');
    const accessToken = await generateAccessToken();

    console.log('🔍 Test 1: Basic request with default parameters');
    console.log('================================================');
    const result1 = await fetchConversations(accessToken);
    results.push({
      name: 'Basic request',
      success: result1.success,
      statusCode: result1.statusCode,
    });

    // Test variations if first test succeeded
    if (result1.success) {
      console.log('');
      console.log('🔍 Test 2: Request with limit=5');
      console.log('================================');
      const result2 = await fetchConversations(accessToken);
      results.push({
        name: 'With limit=5',
        success: result2.success,
        statusCode: result2.statusCode,
      });

      if (RESERVATION_ID) {
        console.log('');
        console.log('🔍 Test 3: Request filtered by reservationId');
        console.log('============================================');
        // Already using reservationId in first test
        results.push({ name: 'Filtered by reservation', success: true, statusCode: 200 });
      }
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
    results.push({ name: 'Test execution', success: false, error: error.message });
  }

  // Summary
  console.log('');
  console.log('📊 Test Results Summary');
  console.log('======================');

  results.forEach((result) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name} ${result.statusCode ? `(${result.statusCode})` : ''}`);
  });

  const allPassed = results.every((r) => r.success);
  console.log(
    `\n${allPassed ? '🎉 All tests completed!' : '⚠️  Some tests failed or returned errors'}`,
  );
  console.log('');
  console.log('💡 Next steps:');
  console.log('   1. Review the saved JSON file to understand the response structure');
  console.log('   2. Identify useful fields for knowledge base creation');
  console.log('   3. Check if conversation messages are included or need separate API call');
  console.log('   4. Determine pagination strategy if many conversations exist');
}

// Run tests
runTests().catch(console.error);
