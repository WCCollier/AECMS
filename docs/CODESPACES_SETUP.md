# GitHub Codespaces Setup Guide for AECMS

**Date:** 2026-01-29
**Purpose:** Configure GitHub Codespaces Secrets for secure, persistent environment configuration

---

## Overview

This guide shows you how to configure AECMS for development in GitHub Codespaces using **GitHub Codespaces Secrets** instead of `.env` files.

### Why Codespaces Secrets?

✅ **Encrypted storage** - Secrets stored securely by GitHub
✅ **Automatically injected** - Available as environment variables in your codespace
✅ **Persistent** - Survive codespace rebuilds and deletions
✅ **Web-based** - No files to manage, never committed to git
✅ **Cloud-native** - Perfect for web-based development workflow

---

## Step 1: Generate Secrets (2 minutes)

### In Your Codespace Terminal

Run these commands to generate secure random secrets:

```bash
# Generate database password
echo "DB_PASSWORD=$(openssl rand -base64 32)"

# Generate JWT secret
echo "JWT_SECRET=$(openssl rand -base64 32)"
```

**Copy both output values** - you'll need them in Step 2.

### Example Output:
```
DB_PASSWORD=xK9mP2vL8nQ4rT6wE1sA3dF5gH7jK0lZ2mN4b
JWT_SECRET=7Hj9K2mP4nQ8rT1wE5sA6dF3gL0jK9xC2vB8n=
```

---

## Step 2: Add Secrets to GitHub (10 minutes)

### Navigate to Repository Settings

1. Go to: https://github.com/WCCollier/AECMS
2. Click **"Settings"** tab (top navigation)
3. Click **"Codespaces"** in left sidebar
4. Scroll to **"Secrets"** section

### Add Each Secret

Click **"New secret"** and add the following secrets one by one:

#### Required for Phase 0-1 (Initial Setup)

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `DB_PASSWORD` | [paste generated value] | PostgreSQL database password |
| `JWT_SECRET` | [paste generated value] | JWT token signing secret |
| `NODE_ENV` | `development` | Environment mode |
| `JWT_EXPIRATION` | `15m` | Access token expiration |
| `REFRESH_TOKEN_EXPIRATION` | `7d` | Refresh token expiration (back-door max) |
| `APP_URL` | `http://localhost:3000` | Frontend URL |
| `API_URL` | `http://localhost:4000` | Backend API URL |
| `FRONTEND_URL` | `http://localhost:3000` | Frontend base URL (OAuth) |
| `FRONTEND_ADMIN_URL` | `http://localhost:3000/admin` | Admin dashboard URL (OAuth) |
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |

#### For Each Secret:
1. Click **"New secret"**
2. Enter **Name** (exactly as shown above)
3. Paste **Value**
4. Click **"Add secret"**
5. Repeat for all 10 secrets

---

## Step 3: Add Placeholder Secrets for Later Phases

These won't be used immediately but will be needed in future phases. Add them now with empty/placeholder values to avoid disrupting development later:

### Phase 1 - OAuth (Leave empty for now)

| Secret Name | Placeholder Value | When You'll Need It |
|-------------|-------------------|---------------------|
| `GOOGLE_CLIENT_ID` | `PLACEHOLDER` | Phase 1 - After creating Google OAuth app |
| `GOOGLE_CLIENT_SECRET` | `PLACEHOLDER` | Phase 1 - After creating Google OAuth app |
| `APPLE_CLIENT_ID` | `PLACEHOLDER` | Phase 1 - Optional, Apple OAuth |
| `APPLE_CLIENT_SECRET` | `PLACEHOLDER` | Phase 1 - Optional, Apple OAuth |

### Phase 5 - Payments (Leave empty for now)

| Secret Name | Placeholder Value | When You'll Need It |
|-------------|-------------------|---------------------|
| `STRIPE_PUBLISHABLE_KEY` | `PLACEHOLDER` | Phase 5 - After creating Stripe account |
| `STRIPE_SECRET_KEY` | `PLACEHOLDER` | Phase 5 - After creating Stripe account |
| `STRIPE_WEBHOOK_SECRET` | `PLACEHOLDER` | Phase 5 - After configuring Stripe webhooks |
| `PAYPAL_CLIENT_ID` | `PLACEHOLDER` | Phase 5 - After creating PayPal app |
| `PAYPAL_CLIENT_SECRET` | `PLACEHOLDER` | Phase 5 - After creating PayPal app |
| `PAYPAL_MODE` | `sandbox` | Phase 5 - Use 'sandbox' for testing |

### Phase 6 - AI Moderation (Leave empty for now)

| Secret Name | Placeholder Value | When You'll Need It |
|-------------|-------------------|---------------------|
| `OPENAI_API_KEY` | `PLACEHOLDER` | Phase 6 - After creating OpenAI account |

### Phase 7 - Email/Kindle (Leave empty for now)

| Secret Name | Placeholder Value | When You'll Need It |
|-------------|-------------------|---------------------|
| `AWS_SES_REGION` | `us-east-1` | Phase 7 - After setting up AWS SES |
| `AWS_SES_ACCESS_KEY_ID` | `PLACEHOLDER` | Phase 7 - After setting up AWS SES |
| `AWS_SES_SECRET_ACCESS_KEY` | `PLACEHOLDER` | Phase 7 - After setting up AWS SES |
| `AWS_SES_FROM_EMAIL` | `noreply@yourdomain.com` | Phase 7 - Your verified email |

**Why add placeholders now?**
- Prevents environment variable errors during development
- Our application will check for non-placeholder values before using them
- Easy to update later without rebuilding

---

## Step 4: Rebuild Your Codespace (1 minute)

After adding all secrets, you must rebuild your codespace for them to load:

### Option A: Rebuild via VS Code Menu
1. Press **F1** (or Cmd+Shift+P on Mac)
2. Type: `Codespaces: Rebuild Container`
3. Press Enter
4. Wait for rebuild (2-3 minutes)

### Option B: Rebuild via Terminal
```bash
# This will restart your codespace
sudo supervisorctl restart all
```

### Option C: Stop and Restart Codespace
1. Go to: https://github.com/codespaces
2. Click **"..."** next to your AECMS codespace
3. Click **"Stop codespace"**
4. Wait 30 seconds
5. Click **"Open in VS Code"** to restart

---

## Step 5: Verify Secrets Are Loaded (1 minute)

After rebuild, open a new terminal in your codespace and run:

```bash
# Check if required secrets are loaded (won't show values)
env | grep -E '(DB_PASSWORD|JWT_SECRET|NODE_ENV|API_URL)' | cut -d= -f1 | sort
```

### Expected Output:
```
API_URL
APP_URL
DB_PASSWORD
FRONTEND_ADMIN_URL
FRONTEND_URL
JWT_EXPIRATION
JWT_SECRET
NODE_ENV
REDIS_URL
REFRESH_TOKEN_EXPIRATION
```

### If you see all 10 variables listed above: ✅ SUCCESS!

### If some are missing:
1. Double-check you added all secrets in GitHub UI
2. Verify secret names match exactly (case-sensitive)
3. Try rebuilding again
4. Check for typos in secret names

---

## Step 6: Create .env.example (Optional)

This step is for documentation purposes - so others know what secrets are needed:

```bash
cd /workspaces/AECMS

cat > .env.example << 'EOF'
# ============================================================================
# AECMS Environment Variables - Template for GitHub Codespaces Secrets
# ============================================================================
# DO NOT put real values here! This file is committed to git.
# Set actual values in GitHub Codespaces Secrets:
# https://github.com/WCCollier/AECMS/settings/secrets/codespaces

# ----------------------------------------------------------------------------
# Phase 0-1: Foundation & Authentication
# ----------------------------------------------------------------------------
DB_PASSWORD=REPLACE_WITH_CODESPACES_SECRET
JWT_SECRET=REPLACE_WITH_CODESPACES_SECRET
JWT_EXPIRATION=15m
REFRESH_TOKEN_EXPIRATION=7d
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000
FRONTEND_ADMIN_URL=http://localhost:3000/admin
REDIS_URL=redis://redis:6379

# ----------------------------------------------------------------------------
# Phase 1: OAuth Authentication
# ----------------------------------------------------------------------------
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=

# ----------------------------------------------------------------------------
# Phase 5: Payment Processing
# ----------------------------------------------------------------------------
STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox

# ----------------------------------------------------------------------------
# Phase 6: AI Moderation
# ----------------------------------------------------------------------------
OPENAI_API_KEY=

# ----------------------------------------------------------------------------
# Phase 7: Email & Kindle Delivery
# ----------------------------------------------------------------------------
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=
AWS_SES_SECRET_ACCESS_KEY=
AWS_SES_FROM_EMAIL=noreply@yourdomain.com

# ----------------------------------------------------------------------------
# Storage (MVP uses local filesystem)
# ----------------------------------------------------------------------------
STORAGE_TYPE=local
STORAGE_PATH=/app/uploads
EOF
```

---

## Step 7: Optional - Create Minimal .env for Non-Secrets

If you want local overrides for non-sensitive config:

```bash
cat > .env << 'EOF'
# Local development overrides (non-sensitive)
# Secrets come from GitHub Codespaces Secrets

STORAGE_TYPE=local
STORAGE_PATH=/app/uploads

# Uncomment to override Codespaces Secrets locally (for testing)
# NODE_ENV=development
# APP_URL=http://localhost:3000
# API_URL=http://localhost:4000
EOF
```

**Note:** This file should remain in `.gitignore` even though it has no secrets.

---

## Updating Secrets Later

### When You Need to Update a Secret (e.g., adding Google OAuth keys in Phase 1):

1. Go to: https://github.com/WCCollier/AECMS/settings/secrets/codespaces
2. Find the secret (e.g., `GOOGLE_CLIENT_ID`)
3. Click **"Update"**
4. Paste new value
5. Click **"Save"**
6. **Restart your terminal** (or rebuild codespace if it doesn't take effect)

### Quick Terminal Restart:
```bash
# Exit and reopen terminal, OR:
exec bash
```

Most secrets updates take effect immediately in new terminal sessions. Only rebuild if the change doesn't appear after restarting terminal.

---

## Troubleshooting

### Problem: Secrets not appearing after rebuild

**Solution:**
```bash
# Check if codespace can see secrets
env | grep JWT_SECRET

# If empty, try:
# 1. Check secret name in GitHub (case-sensitive!)
# 2. Ensure you're in the correct repository's secrets
# 3. Rebuild container again
# 4. As last resort, delete and create new codespace
```

### Problem: Docker Compose can't find secrets

**Solution:**
Docker Compose automatically inherits environment variables from the codespace. Verify:

```bash
# Test environment variable passthrough
docker-compose config | grep JWT_SECRET
# Should show: JWT_SECRET: [your secret value]

# If empty, the secret isn't loaded in the codespace environment
```

### Problem: "PLACEHOLDER" values causing errors

**Explanation:** Some secrets are set to `PLACEHOLDER` for future phases. The application should check for this:

```typescript
// Example: Application should check before using
if (process.env.GOOGLE_CLIENT_ID === 'PLACEHOLDER' || !process.env.GOOGLE_CLIENT_ID) {
  console.log('Google OAuth not configured yet - skipping')
  return
}
```

If you see errors about placeholders, it means:
- You're trying to use a feature before its phase
- Or you forgot to update the secret when you reached that phase

---

## Security Best Practices

### ✅ DO:
- Use GitHub Codespaces Secrets for all sensitive values
- Generate strong random secrets with `openssl rand -base64 32`
- Use different secrets for development vs production
- Update secrets immediately if compromised
- Delete old codespaces when done (secrets remain in GitHub)

### ❌ DON'T:
- Commit `.env` files with real values to git
- Share secrets via email, Slack, or messaging
- Use weak or guessable secrets
- Reuse secrets across different projects
- Store production secrets in development codespaces

---

## Quick Reference: Secret Generation Commands

Keep these handy for generating various secrets:

```bash
# 32-byte base64 (most common - JWT, passwords, API keys)
openssl rand -base64 32

# 64-byte hex (for encryption keys)
openssl rand -hex 32

# UUID (for unique identifiers)
uuidgen

# Generate multiple secrets at once
echo "DB_PASSWORD=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "API_KEY_ENCRYPTION_KEY=$(openssl rand -base64 32)"
```

---

## What Happens Next

After completing this setup:

1. ✅ All secrets are securely stored in GitHub
2. ✅ Your codespace has access to them as environment variables
3. ✅ Docker Compose will pass them to containers
4. ✅ Application will use them automatically
5. ✅ You can proceed with Phase 0 development

### Ready to Continue?

Once you've completed all steps and verified secrets are loaded, return to the chat and say:

**"Secrets are configured and verified"**

Claude will then begin Phase 0 autonomous setup:
- Create project structure (backend, frontend, docker-compose.yml)
- Initialize NestJS and Next.js applications
- Set up Docker containers
- Create validation scripts
- Verify everything builds

---

## Appendix: Environment Variable Priority

Understanding how environment variables are loaded:

### Priority (highest to lowest):
1. **Command-line overrides** - `NODE_ENV=production npm start`
2. **Local .env file** - `/workspaces/AECMS/.env`
3. **GitHub Codespaces Secrets** - Injected by Codespaces
4. **System environment** - OS-level variables

### Recommendation:
- Use **Codespaces Secrets** for all sensitive values (priority 3)
- Use **local .env** only for non-sensitive overrides (priority 2)
- Never use command-line overrides for secrets (visible in process list)

---

## Summary Checklist

Before proceeding to Phase 0 development:

- [ ] Generated `DB_PASSWORD` and `JWT_SECRET` with OpenSSL
- [ ] Added all 10 required secrets to GitHub Codespaces Secrets
- [ ] Added placeholder secrets for future phases
- [ ] Rebuilt codespace (or restarted terminal)
- [ ] Verified secrets loaded with `env | grep` command
- [ ] Created `.env.example` (optional, for documentation)
- [ ] Created minimal `.env` (optional, for local overrides)
- [ ] Understand how to update secrets later

**Total Time:** ~15 minutes

---

**Last Updated:** 2026-01-29
**Questions?** Return to Claude chat for assistance

