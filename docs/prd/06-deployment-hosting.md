# PRD 06: Deployment & Hosting Strategy

**Version:** 1.0
**Date:** 2026-01-27
**Status:** Draft
**Parent:** [Master PRD](./00-master-prd.md)

## Overview

This document defines the deployment and hosting strategy for AECMS, with emphasis on:
- **Host-agnostic design**: Can be deployed anywhere
- **Free-tier optimization**: Minimize hosting costs
- **Easy deployment**: Simple setup for non-technical users
- **Portability**: Friends can run their own instances

## Requirements

### User Requirements
- Very low traffic (few hits per month)
- Free or near-free hosting costs
- Ability to self-host or use various providers
- Easy for friends to deploy their own copies
- No vendor lock-in

### Technical Requirements
- Containerized application (Docker)
- Standard PostgreSQL (not vendor-specific features)
- Configurable storage (local or S3-compatible)
- Environment-based configuration
- Simple one-command deployment

## Deployment Architecture

### Container-Based Approach

All components run in Docker containers for maximum portability:

```
┌─────────────────────────────────────────┐
│         Frontend Container              │
│           (Next.js)                     │
│         Port: 3000                      │
└─────────────────────────────────────────┘
                  │
┌─────────────────────────────────────────┐
│         Backend Container               │
│           (NestJS)                      │
│         Port: 4000                      │
└─────────────────────────────────────────┘
                  │
      ┌───────────┴───────────┐
      │                       │
┌─────▼──────┐         ┌──────▼─────┐
│ PostgreSQL │         │   Redis    │
│ Container  │         │ Container  │
└────────────┘         └────────────┘
      │
┌─────▼──────┐
│   Media    │
│  Storage   │
│  (Volume)  │
└────────────┘
```

### Docker Compose Setup

Single `docker-compose.yml` for entire stack:

```yaml
version: '3.9'

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:4000
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/aecms
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
    depends_on:
      - db
      - redis
    volumes:
      - ./media:/app/media

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=aecms
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=aecms
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Hosting Options (Free Tier Focus)

### Option 1: Multiple Free Services (Recommended for Low Traffic)

**Approach**: Split components across free-tier services

**Frontend**: Vercel or Netlify or Cloudflare Pages
- Vercel Free Tier: 100GB bandwidth, unlimited sites, auto-deploy from Git
- Netlify Free Tier: 100GB bandwidth, 300 build minutes
- Cloudflare Pages Free Tier: Unlimited bandwidth, unlimited sites

**Backend + Database**: Railway, Render, or Fly.io
- Railway Free Trial: $5 credit/month (enough for small app)
- Render Free Tier: 750 hours/month (one always-on service)
- Fly.io Free Tier: 3 shared VMs, 3GB storage

**Database Options**:
- Supabase: 500MB database, 1GB file storage (free forever)
- Neon: 10GB storage, 100 compute hours (free tier)
- Railway: PostgreSQL included in free tier
- Render: PostgreSQL included in free tier

**Media Storage**:
- Cloudflare R2: 10GB free storage, free egress
- Backblaze B2: 10GB free storage
- Local filesystem (if backend has persistent storage)

**Pros**:
- Truly free for low traffic
- Good performance (CDN for frontend)
- Managed services (less maintenance)

**Cons**:
- Multiple services to manage
- Environment variables in multiple places
- May need to wake up (on free tiers)

### Option 2: Single VPS Self-Hosting (Host-Agnostic)

**Approach**: Run entire stack on one server with Docker Compose

**Free/Cheap VPS Options**:
- Oracle Cloud: Always Free tier (2 VMs, 1GB RAM each)
- AWS EC2: t2.micro free for 12 months
- Google Cloud: e2-micro free tier
- Azure: B1S free for 12 months
- Hetzner: €4.51/month (cheapest paid option, excellent value)

**Setup**:
```bash
# Clone repo
git clone https://github.com/yourusername/aecms
cd aecms

# Configure environment
cp .env.example .env
nano .env  # Edit secrets

# Start everything
docker-compose up -d

# Setup Caddy for HTTPS (automatic Let's Encrypt)
# Caddy runs as reverse proxy in front of containers
```

**Pros**:
- Complete control
- True host-agnostic (run anywhere)
- All data in one place
- Easy backup (just backup volumes)
- Can run fully offline if needed

**Cons**:
- Need to manage server security
- Need to setup HTTPS/SSL manually (or use Caddy)
- Single point of failure
- Need backup strategy

### Option 3: Hybrid Approach

**Approach**: Static frontend + self-hosted backend

**Frontend**:
- Next.js Static Export deployed to Vercel/Netlify (free)
- Or GitHub Pages (free, 1GB limit)

**Backend + DB**:
- Self-hosted on free VPS
- Or Railway/Render free tier

**Pros**:
- Best performance for frontend (CDN)
- Backend can be anywhere
- Easy to migrate backend later

**Cons**:
- Slightly more complex setup

## Recommended Setup for Your Use Case

**Phase 1 - MVP (Immediate)**:
```
Frontend: Vercel (free tier, auto-deploy from GitHub)
Backend: Railway (free trial, then $5/month if needed)
Database: Railway PostgreSQL (included)
Redis: Railway Redis (included)
Storage: Local filesystem on Railway (< 1GB)
```

**Cost**: Free for first month, then $5/month if usage is low

**Phase 2 - Production (When Ready)**:
```
Frontend: Vercel (free tier)
Backend: Oracle Cloud Always Free VM (with Docker Compose)
Database: PostgreSQL in Docker (on Oracle Cloud)
Redis: Redis in Docker (on Oracle Cloud)
Storage: Local filesystem or Cloudflare R2 (10GB free)
```

**Cost**: $0/month (truly free)

**Phase 3 - For Friends (Portable)**:
```
Option A: One-click Render/Railway deploy button
Option B: Docker Compose file + setup script
Option C: Pre-configured DigitalOcean/Hetzner droplet image
```

## Host-Agnostic Design Patterns

### 1. Twelve-Factor App Principles
- Configuration via environment variables
- Treat backing services as attached resources
- Port binding (not assuming specific ports)
- Stateless processes
- Disposable processes

### 2. Environment Configuration

`.env.example`:
```bash
# Application
NODE_ENV=production
APP_URL=https://yourdomain.com
API_URL=https://api.yourdomain.com

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/aecms

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-here
JWT_EXPIRATION=15m
REFRESH_TOKEN_EXPIRATION=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Apple OAuth
APPLE_CLIENT_ID=...
APPLE_CLIENT_SECRET=...

# Storage
STORAGE_TYPE=local  # or s3, r2, b2
S3_BUCKET=your-bucket
S3_REGION=us-east-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_ENDPOINT=...  # For S3-compatible services

# Email
EMAIL_PROVIDER=smtp  # or sendgrid, ses
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

### 3. Storage Abstraction

Backend implements storage interface that can use:
- Local filesystem (development, small deployments)
- AWS S3 (scalable cloud storage)
- Cloudflare R2 (S3-compatible, free egress)
- Backblaze B2 (S3-compatible, cheap)
- Any S3-compatible service

```typescript
// storage.service.ts
export class StorageService {
  constructor(private config: StorageConfig) {
    switch (config.type) {
      case 'local':
        this.provider = new LocalStorageProvider();
        break;
      case 's3':
        this.provider = new S3StorageProvider();
        break;
      case 'r2':
        this.provider = new R2StorageProvider();
        break;
    }
  }

  async upload(file: Buffer, path: string): Promise<string> {
    return this.provider.upload(file, path);
  }

  async delete(path: string): Promise<void> {
    return this.provider.delete(path);
  }

  async getUrl(path: string): Promise<string> {
    return this.provider.getUrl(path);
  }
}
```

## Deployment Methods

### Method 1: Git Push Deployment (Vercel/Netlify)

```bash
# Connect GitHub repo to Vercel
# Push to main branch → auto-deploy

git add .
git commit -m "Update content"
git push origin main
# Vercel automatically builds and deploys
```

### Method 2: Docker Compose (Self-Hosted)

```bash
# First time setup
./scripts/setup.sh

# Deploy updates
git pull
docker-compose build
docker-compose up -d

# Or one command
./scripts/deploy.sh
```

### Method 3: One-Click Deploy Button

For Railway/Render, add deploy button to README:

```markdown
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template/...)
```

Clicking provisions entire stack automatically.

## Backup Strategy

### Database Backups

**Automated Daily Backups**:
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
docker exec aecms-db pg_dump -U aecms aecms > "backups/db_${DATE}.sql"

# Keep only last 30 days
find backups -name "db_*.sql" -mtime +30 -delete
```

Add to crontab:
```
0 2 * * * /path/to/backup.sh
```

### Media Backups

**Local Storage**:
- Rsync to backup server
- Sync to cloud storage (Backblaze, S3)

**Cloud Storage**:
- Usually has versioning/redundancy built-in
- Configure lifecycle policies

### Full System Backup

For Docker Compose setup:
```bash
# Backup volumes
docker-compose down
tar -czf aecms-backup-$(date +%Y%m%d).tar.gz \
  docker-compose.yml \
  .env \
  postgres_data/ \
  redis_data/ \
  media/

docker-compose up -d
```

## SSL/HTTPS Setup

### Option 1: Automatic (Vercel/Netlify/Railway)
- HTTPS automatic with custom domains
- Auto-renewing certificates

### Option 2: Caddy Reverse Proxy (Self-Hosted)

Add to `docker-compose.yml`:
```yaml
caddy:
  image: caddy:2-alpine
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile
    - caddy_data:/data
    - caddy_config:/config
```

`Caddyfile`:
```
yourdomain.com {
  reverse_proxy frontend:3000
}

api.yourdomain.com {
  reverse_proxy backend:4000
}
```

Caddy automatically gets Let's Encrypt certificates.

### Option 3: Cloudflare (Free CDN + SSL)
- Point domain to Cloudflare
- Cloudflare provides free SSL
- Also provides DDoS protection and caching

## Performance Optimization for Free Tier

### Database
- Use indexes on frequently queried columns
- Connection pooling (max 10 connections on free tiers)
- Cache queries in Redis

### Frontend
- Static generation where possible (Next.js SSG)
- Image optimization (Next.js Image)
- Code splitting
- Lazy loading

### Backend
- Response caching
- Compress responses (gzip)
- Rate limiting to prevent abuse

### Storage
- Image compression before upload
- Lazy loading images
- Use CDN for media (Cloudflare R2 has free egress)

## Monitoring (Free Options)

- **Uptime**: UptimeRobot (50 monitors free)
- **Errors**: Sentry (5k errors/month free)
- **Analytics**: Umami (self-hosted, privacy-friendly)
- **Logs**: Built-in Docker logs + Logtail free tier

## Documentation for Friends

Create comprehensive setup docs:

1. **Quick Start Guide** (`docs/QUICK_START.md`)
2. **Self-Hosting Guide** (`docs/SELF_HOSTING.md`)
3. **Railway Deploy Guide** (`docs/RAILWAY_DEPLOY.md`)
4. **Environment Variables** (`docs/CONFIGURATION.md`)
5. **Troubleshooting** (`docs/TROUBLESHOOTING.md`)

## Migration Path

Easy to move between hosts:

1. **Export data**: `npm run export` (creates SQL dump + media archive)
2. **Setup new host**: Deploy containers
3. **Import data**: `npm run import backup.tar.gz`
4. **Update DNS**: Point domain to new host

## Estimated Costs

### Fully Free Setup
```
Frontend: Vercel Free Tier - $0
Backend: Oracle Cloud Always Free - $0
Database: Included - $0
Redis: Included - $0
Storage: Cloudflare R2 (10GB) - $0
Domain: Namecheap (~$10/year)
SSL: Let's Encrypt - $0

Total: ~$10/year (just domain)
```

### Low-Cost Setup (More Performance)
```
Frontend: Vercel Free Tier - $0
Backend: Hetzner VPS - €4.51/month
Database: Included - $0
Redis: Included - $0
Storage: Hetzner volume - Included
Domain: ~$10/year
SSL: Let's Encrypt - $0

Total: ~$60/year (~$5/month)
```

### For Friends
- Each person deploys their own instance
- Same free/low-cost options available
- Provide pre-configured setup scripts

## Success Metrics

- Deployment time < 30 minutes (for technical users)
- Total monthly cost: $0-5
- Can migrate to new host in < 1 hour
- Works on any platform supporting Docker
- Friends can deploy without assistance (with good docs)

## Open Questions

1. Do you want a one-click installer script?
2. Should we create pre-configured Droplet/VM images?
3. Do you need offline/air-gapped installation support?
4. Should we provide managed hosting service for friends (charge small fee)?
