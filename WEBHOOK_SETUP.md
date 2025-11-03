# Hostaway Webhook Setup Guide

This guide will help you set up and test the Hostaway webhook integration for your SaaS automation system.

## Prerequisites

1. **Backend running locally** on `http://localhost:3000`
2. **ngrok installed** and running
3. **Hostaway account** with API credentials
4. **Environment variables** properly configured

## Step 1: Start ngrok Tunnel

1. Open a new terminal window
2. Start ngrok to expose your local backend:
   ```bash
   ngrok http 3000
   ```
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

## Step 2: Configure Environment Variables

Update your `.env` file with the ngrok URL:

```env
# Hostaway Configuration
HOSTAWAY_WEBHOOK_URL=https://your-ngrok-id.ngrok-free.app/api/webhooks/hostaway
HOSTAWAY_DRY_RUN=false
HOSTAWAY_API_BASE_URL=https://api.hostaway.com

# Your Hostaway credentials (set via dashboard)
# HOSTAWAY_CLIENT_ID=your_client_id
# HOSTAWAY_CLIENT_SECRET=your_client_secret
```

## Step 3: Test Webhook Endpoint

Run the provided test script to verify your webhook setup:

```bash
# Set your ngrok URL
export NGROK_URL="https://your-ngrok-id.ngrok-free.app"

# Run the test
node test-webhook.js
```

The test will:

- ✅ Verify webhook URL format
- ✅ Test endpoint accessibility
- ✅ Send test webhook payloads

## Step 4: Configure Hostaway Integration

1. **Start your backend**:

   ```bash
   npm run start:dev
   ```

2. **Open the dashboard** at `http://localhost:4200`

3. **Navigate to Integrations** and configure Hostaway:

   - Enter your Hostaway Client ID
   - Enter your Hostaway Client Secret
   - Click "Connect to Hostaway"

4. **Check webhook status**:
   - The system will attempt to register the webhook automatically
   - Check the backend logs for webhook registration status
   - Use the webhook status endpoint to verify registration

## Step 5: Verify Webhook Registration

### Check Backend Logs

Look for these log messages:

```
Attempting Hostaway unified webhook registration for tenant {tenant-id} at URL {webhook-url}
Hostaway unified webhook registered for tenant {tenant-id}: {webhook-details}
```

### Check Hostaway Dashboard

1. Log into your Hostaway dashboard
2. Go to **Settings** → **Integrations** → **Webhooks**
3. Look for your webhook URL in the list
4. Verify it's enabled and shows "Active" status

### Use API Endpoint

You can also check webhook status via the API:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/integrations/hostaway/webhook-status
```

## Step 6: Test with Real Messages

1. **Create a test reservation** in Hostaway
2. **Send a message** from the guest side
3. **Check your dashboard** for the incoming message
4. **Verify AI response** is generated and sent back

## Troubleshooting

### Webhook Not Appearing in Hostaway Dashboard

**Possible causes:**

- Webhook URL format is incorrect
- Backend is not running
- ngrok tunnel is not active
- Hostaway API credentials are invalid

**Solutions:**

1. Verify webhook URL format: `https://domain.com/api/webhooks/hostaway`
2. Check backend logs for error messages
3. Ensure ngrok is running and accessible
4. Re-verify Hostaway credentials

### Webhook Registration Fails

**Check these:**

1. **URL Accessibility**: Test with `curl` or the test script
2. **HTTPS Required**: Hostaway requires HTTPS (ngrok provides this)
3. **Correct Endpoint**: Must end with `/api/webhooks/hostaway`
4. **Backend Running**: Ensure port 3000 is accessible

### Messages Not Triggering AI Responses

**Check these:**

1. **Webhook registered**: Verify in Hostaway dashboard
2. **Templates configured**: Check Message Templates page
3. **Backend logs**: Look for webhook processing errors
4. **Database**: Ensure templates are created for your tenant

## Environment Variables Reference

```env
# Required
HOSTAWAY_WEBHOOK_URL=https://your-ngrok-id.ngrok-free.app/api/webhooks/hostaway
DATABASE_URL=your_supabase_connection_string
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_JWT_SECRET=your_supabase_jwt_secret

# Optional
HOSTAWAY_DRY_RUN=false
HOSTAWAY_API_BASE_URL=https://api.hostaway.com
HOSTAWAY_AUTOMATION_TIMEZONE=Europe/London
HOSTAWAY_PAGINATION_LIMIT=10
```

## Testing Checklist

- [ ] Backend running on localhost:3000
- [ ] ngrok tunnel active and accessible
- [ ] HOSTAWAY_WEBHOOK_URL set correctly
- [ ] Hostaway credentials configured
- [ ] Webhook registered in Hostaway dashboard
- [ ] Test webhook script passes
- [ ] Message templates created
- [ ] Test message triggers AI response

## Support

If you encounter issues:

1. **Check logs**: Backend and ngrok logs for errors
2. **Test connectivity**: Use the test script
3. **Verify configuration**: All environment variables set
4. **Check Hostaway**: Ensure webhook appears in dashboard

The webhook integration should now be working! You can customize message templates in the dashboard and test the full automation flow.
