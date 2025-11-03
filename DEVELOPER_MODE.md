# Developer Mode Setup

This application supports a "Developer Mode" that allows you to test and develop the application's core features without requiring live Stripe or Twilio credentials.

## How to Enable Developer Mode

### Backend Configuration

1. **Comment out or remove Stripe environment variables** in your `.env` file:

   ```env
   # STRIPE_SECRET_KEY=sk_test_...
   # STRIPE_PUBLIC_KEY=pk_test_...
   # STRIPE_PRICE_ID=price_...
   # STRIPE_WEBHOOK_SECRET=whsec_...
   ```

2. **Comment out or remove Twilio environment variables** in your `.env` file:

   ```env
   # TWILIO_ACCOUNT_SID=AC...
   # TWILIO_AUTH_TOKEN=...
   # TWILIO_MESSAGING_SERVICE_SID=MG...
   # TWILIO_WHATSAPP_FROM=whatsapp:+1234567890
   # TWILIO_VOICE_FROM=+1234567890
   ```

3. **Set DRY_RUN to true** (optional, for Twilio dry run mode):

   ```env
   DRY_RUN=true
   ```

4. **Enable Hostaway dry run mode** so messages are logged but not sent:

   ```env
   HOSTAWAY_DRY_RUN=true
   ```

5. **Provide Hostaway API credentials** if you want to fetch real reservation data:
   ```env
   HOSTAWAY_ACCOUNT_ID=your_account_id
   HOSTAWAY_WEBHOOK_URL=https://your-public-url/api/webhooks/hostaway
   ```
   - `HOSTAWAY_CLIENT_ID` and `HOSTAWAY_CLIENT_SECRET` are configured via the dashboard Integrations page.
   - When `HOSTAWAY_DRY_RUN=true`, automated and human replies are written to conversation logs instead of being pushed to Hostaway.
   - With `HOSTAWAY_DRY_RUN=true`, webhook registration is skipped, so the integration works even without a public webhook URL.

### Frontend Configuration

1. **Comment out or remove Stripe public key** in your `.env` file:
   ```env
   # VITE_STRIPE_PUBLIC_KEY=pk_test_...
   ```

## What Happens in Developer Mode

### Backend Behavior

- **SubscriptionGuard**: Automatically allows access to all protected routes (treats every user as having an active subscription)
- **BillingService**: Skips Stripe checkout session creation and marks subscriptions as active
- **TwilioClient**: Logs messages to console instead of sending real SMS/WhatsApp/voice calls
- **HostawayClient**: Logs outgoing Hostaway messages while still using real API data when credentials are supplied
- **All API endpoints**: Work normally without requiring live payment processing

### Frontend Behavior

- **Registration Flow**: Skips Stripe checkout and redirects directly to success page
- **User Journey**: Complete onboarding flow works without payment
- **Dashboard Access**: Full access to all features immediately after registration

## Testing the Complete Flow

1. Start the application with Stripe/Twilio keys commented out
2. Navigate to the landing page
3. Click "Get Started" or "Sign Up"
4. Fill out the registration form
5. Submit the form
6. You'll be redirected directly to the success page (no Stripe checkout)
7. Click "Go to Dashboard" to access the full application
8. Navigate to "Integrations" to test the Hostaway connection flow
9. Open "Conversation Logs" in the dashboard to inspect every outbound or inbound message captured during dry run mode

- Messages show the direction (Assistant, Guest, Staff) and timestamps so you can validate copy before enabling live delivery.

## Console Output

In developer mode, you'll see helpful console messages:

- `Developer mode: Skipping Stripe checkout session creation`
- `(dry-run) SMS message to +1234567890: Your message here`
- `(dry-run) WhatsApp message to +1234567890: Your message here`
- `(dry-run) Voice call to +1234567890: Your message here`

## Production Deployment

To deploy to production, simply uncomment all the environment variables and ensure they contain valid API keys. The application will automatically switch to production mode.

## Environment Variables Reference

### Required for Production

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLIC_KEY` (frontend)
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

### Optional

- `DRY_RUN=true` (for Twilio dry run mode even with credentials)
- `HOSTAWAY_DRY_RUN=true` (mirror Hostaway dry run behaviour)
- `TWILIO_MESSAGING_SERVICE_SID`
- `TWILIO_WHATSAPP_FROM`
- `TWILIO_VOICE_FROM`

### Always Required

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT_SECRET`
- `OPENAI_API_KEY`
