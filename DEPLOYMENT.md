# Deployment Guide

This guide covers deploying the Jeeves application to Fly.io (backend) and Vercel (frontend).

## Prerequisites

1. **Fly.io CLI** installed: https://fly.io/docs/getting-started/installing-flyctl/
2. **Vercel CLI** installed: `npm i -g vercel`
3. **Accounts**:
   - Fly.io account with access to your organization
   - Vercel account

## Backend Deployment (Fly.io)

### 1. Login to Fly.io

```bash
fly auth login
```

### 2. Create the Fly.io App

```bash
cd saas-automation
fly apps create jeeves-backend --org your-org-name
```

### 3. Set Environment Variables

Set all required environment variables in Fly.io:

```bash
# Database
fly secrets set DATABASE_URL="your-supabase-connection-string"
fly secrets set SUPABASE_URL="https://your-project.supabase.co"
fly secrets set SUPABASE_ANON_KEY="your-anon-key"
fly secrets set SUPABASE_JWT_SECRET="your-jwt-secret"

# OpenAI
fly secrets set OPENAI_API_KEY="sk-..."

# Dry Run Mode (for testing)
fly secrets set HOSTAWAY_DRY_RUN="true"
fly secrets set DRY_RUN="true"

# Optional: Automation settings
fly secrets set HOSTAWAY_AUTOMATION_TIMEZONE="Europe/London"

# Frontend URL (for CORS)
fly secrets set FRONTEND_URL="https://your-app.vercel.app"

# Port (if different from default)
fly secrets set PORT="8080"
```

### 4. Deploy

```bash
fly deploy
```

### 5. Get Your Backend URL

After deployment, get your backend URL:

```bash
fly status
```

The URL will be something like: `https://jeeves-backend.fly.dev`

## Frontend Deployment (Vercel)

### 1. Login to Vercel

```bash
vercel login
```

### 2. Link Your Project

```bash
cd saas-automation
vercel link
```

Follow the prompts to create a new project or link to an existing one.

### 3. Set Environment Variables

Set environment variables in Vercel dashboard or via CLI:

```bash
# Supabase
vercel env add VITE_SUPABASE_URL production
# Enter: https://your-project.supabase.co

vercel env add VITE_SUPABASE_ANON_KEY production
# Enter: your-anon-key

# Backend API URL
vercel env add VITE_API_BASE_URL production
# Enter: https://jeeves-backend.fly.dev/api
```

### 4. Deploy

```bash
vercel --prod
```

Or use the Vercel dashboard to deploy from Git.

### 5. Update Backend CORS

After getting your Vercel URL, update the backend CORS:

```bash
fly secrets set FRONTEND_URL="https://your-app.vercel.app"
fly deploy
```

## Environment Variables Reference

### Backend (Fly.io Secrets)

#### Required

- `DATABASE_URL` - Supabase PostgreSQL connection string
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_JWT_SECRET` - JWT secret for verifying tokens
- `OPENAI_API_KEY` - OpenAI API key for AI features

#### Optional (Testing/Dry Run Mode)

- `HOSTAWAY_DRY_RUN=true` - Enable dry run mode (logs messages, doesn't send)
- `DRY_RUN=true` - Enable Twilio dry run mode
- `FRONTEND_URL` - Frontend URL for CORS (auto-detects Vercel if not set)
- `PORT=8080` - Server port (default: 8080)

#### Optional (Production)

- `HOSTAWAY_AUTOMATION_TIMEZONE` - Timezone for automation (default: Europe/London)
- `HOSTAWAY_API_BASE_URL` - Hostaway API base URL (default: https://api.hostaway.com)

**Note**: Hostaway and Twilio credentials are stored per-tenant in the database, not as environment variables.

### Frontend (Vercel Environment Variables)

#### Required

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_API_BASE_URL` - Backend API URL (e.g., https://jeeves-backend.fly.dev/api)

## Testing Mode (Dry Run)

The application is configured to run in **testing/dry run mode** by default:

- **Hostaway**: Messages are logged but not sent to Hostaway
- **Twilio**: SMS/WhatsApp messages are logged but not sent
- **Conversations**: All guest questions and AI responses are logged to the database

### Viewing Logs

1. **Guest Questions**: Navigate to Inbox → Select a conversation → View conversation logs
2. **AI Responses**: Same location - all AI-generated responses are logged with `direction='ai'`
3. **Backend Logs**: Use `fly logs` to view backend logs

## Post-Deployment Checklist

- [ ] Backend deployed to Fly.io
- [ ] Frontend deployed to Vercel
- [ ] Environment variables set in both platforms
- [ ] CORS configured correctly
- [ ] Test registration flow
- [ ] Test Hostaway integration (dry run mode)
- [ ] Verify conversation logging works
- [ ] Check that guest questions and AI responses appear in inbox

## Troubleshooting

### CORS Issues

If you see CORS errors, ensure:

1. `FRONTEND_URL` is set in Fly.io secrets
2. Vercel URL is added to allowed origins (or uses wildcard `.vercel.app`)

### Database Connection Issues

Check that:

1. `DATABASE_URL` is correct and accessible from Fly.io
2. Supabase allows connections from Fly.io IPs (check firewall settings)

### Build Failures

For frontend:

- Ensure `npm ci` works locally
- Check that all dependencies are in `package.json`

For backend:

- Ensure `npm run build` works locally
- Check that `dist/backend/main.js` is generated

## Next Steps

Once testing is complete and you're ready for production:

1. **Disable Dry Run Mode**:

   ```bash
   fly secrets unset HOSTAWAY_DRY_RUN
   fly secrets unset DRY_RUN
   fly deploy
   ```

2. **Add Stripe Integration** (when ready):

   - Set Stripe environment variables in Fly.io
   - Update frontend with Stripe public key

3. **Configure Webhooks**:
   - Update Hostaway webhook URL to point to your Fly.io backend
   - Configure Stripe webhooks if using billing

## Support

For issues:

- Check Fly.io logs: `fly logs`
- Check Vercel logs: Vercel dashboard → Deployments → Logs
- Review backend logs in the application dashboard
