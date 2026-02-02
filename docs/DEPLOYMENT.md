# AECMS Production Deployment Guide

This guide covers deploying AECMS to a production environment using Docker Compose.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [Environment Configuration](#environment-configuration)
4. [SSL/TLS Configuration](#ssltls-configuration)
5. [Database Migration](#database-migration)
6. [Deployment Steps](#deployment-steps)
7. [Post-Deployment](#post-deployment)
8. [Backup Strategy](#backup-strategy)
9. [Monitoring](#monitoring)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Server Requirements

- **OS**: Ubuntu 22.04 LTS (recommended) or any Linux distribution
- **CPU**: 2+ cores
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 20GB minimum (SSD recommended)
- **Docker**: 24.0+ with Docker Compose v2
- **Domain**: A registered domain with DNS access

### Software Requirements

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Verify installation
docker --version
docker compose version
```

### Required Accounts

1. **Stripe** (https://stripe.com) - Payment processing
2. **PayPal Developer** (https://developer.paypal.com) - Alternative payments
3. **OpenAI** (https://platform.openai.com) - AI moderation
4. **SMTP Provider** - Email delivery (SendGrid, Mailgun, or similar)

---

## Server Setup

### 1. Create Application User

```bash
# Create dedicated user for AECMS
sudo useradd -m -s /bin/bash aecms
sudo usermod -aG docker aecms

# Switch to aecms user
sudo su - aecms
```

### 2. Clone Repository

```bash
# Clone the repository
git clone https://github.com/your-org/AECMS.git
cd AECMS
```

### 3. Create Directory Structure

```bash
# Create directories for persistent data
mkdir -p data/uploads
mkdir -p data/backups
```

---

## Environment Configuration

### 1. Create Production Environment File

```bash
# Copy the example file
cp .env.production.example .env.production

# Edit with your values
nano .env.production
```

### 2. Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@postgres:5432/aecms` |
| `DB_PASSWORD` | Database password | Strong 32+ character password |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` |
| `JWT_SECRET` | JWT signing secret | Generate with `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | Refresh token secret | Generate with `openssl rand -base64 64` |
| `STRIPE_SECRET_KEY` | Stripe live secret key | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | `whsec_...` |
| `PAYPAL_CLIENT_ID` | PayPal live client ID | From PayPal dashboard |
| `PAYPAL_CLIENT_SECRET` | PayPal live secret | From PayPal dashboard |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |

### 3. Generate Secure Secrets

```bash
# Generate JWT secrets
echo "JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')"

# Generate database password
echo "DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')"
```

### 4. Configure URLs

```bash
# In .env.production
APP_URL=https://yourdomain.com
API_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
FRONTEND_ADMIN_URL=https://yourdomain.com/admin
```

---

## SSL/TLS Configuration

### Option 1: Nginx Reverse Proxy with Let's Encrypt (Recommended)

Create an Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/aecms
```

```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# API
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # File upload size limit
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Stripe webhook - no body size limit
    location /payments/stripe/webhook {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and install certificates:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/aecms /etc/nginx/sites-enabled/

# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificates
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

# Test renewal
sudo certbot renew --dry-run
```

### Option 2: Traefik (Docker-native)

Add Traefik to your docker-compose.prod.yml:

```yaml
services:
  traefik:
    image: traefik:v3.0
    container_name: aecms-traefik
    restart: unless-stopped
    command:
      - "--api.dashboard=false"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@yourdomain.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_letsencrypt:/letsencrypt
    networks:
      - aecms-network

  backend:
    # ... existing config ...
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`api.yourdomain.com`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=4000"

  frontend:
    # ... existing config ...
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`yourdomain.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=3000"

volumes:
  traefik_letsencrypt:
    driver: local
```

### Option 3: Cloudflare Proxy

If using Cloudflare:

1. Add your domain to Cloudflare
2. Enable "Full (strict)" SSL mode
3. Create Origin Certificates in Cloudflare dashboard
4. Configure Nginx to use Cloudflare origin certificates
5. Enable Cloudflare proxy (orange cloud) for your DNS records

---

## Database Migration

### Initial Setup

```bash
# Start only the database
docker compose -f docker-compose.prod.yml up -d postgres

# Wait for database to be ready
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U aecms

# Run migrations
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy

# Seed initial data (creates owner account)
docker compose -f docker-compose.prod.yml run --rm backend npx prisma db seed
```

### Change Default Passwords

After seeding, immediately change the default user passwords:

1. Log in as owner@aecms.local with Admin123!@#
2. Go to account settings
3. Change password to a strong, unique password
4. Enable 2FA for admin accounts

---

## Deployment Steps

### 1. Build Images

```bash
# Build production images
docker compose -f docker-compose.prod.yml build --no-cache
```

### 2. Start Services

```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### 3. Verify Deployment

```bash
# Check backend health
curl -f http://localhost:4000/ || echo "Backend not healthy"

# Check frontend
curl -f http://localhost:3000/ || echo "Frontend not healthy"

# Check all containers
docker compose -f docker-compose.prod.yml ps
```

### 4. Configure Stripe Webhooks

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://api.yourdomain.com/payments/stripe/webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`
5. Restart backend to apply changes

### 5. Configure PayPal Webhooks

1. Go to PayPal Developer Dashboard > My Apps & Credentials
2. Select your live app
3. Add webhook URL: `https://api.yourdomain.com/payments/paypal/webhook`
4. Subscribe to events:
   - `CHECKOUT.ORDER.APPROVED`
   - `PAYMENT.CAPTURE.COMPLETED`

---

## Post-Deployment

### DNS Configuration

Ensure these DNS records are configured:

| Type | Name | Value |
|------|------|-------|
| A | @ | Your server IP |
| A | api | Your server IP |
| CNAME | www | yourdomain.com |

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (for Let's Encrypt)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Security Hardening

1. **Disable root SSH login**
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Set: PermitRootLogin no
   sudo systemctl restart sshd
   ```

2. **Install fail2ban**
   ```bash
   sudo apt install fail2ban
   sudo systemctl enable fail2ban
   ```

3. **Enable automatic security updates**
   ```bash
   sudo apt install unattended-upgrades
   sudo dpkg-reconfigure unattended-upgrades
   ```

---

## Backup Strategy

### Automated Database Backups

Create a backup script:

```bash
#!/bin/bash
# /home/aecms/AECMS/scripts/backup.sh

BACKUP_DIR="/home/aecms/AECMS/data/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup
docker compose -f /home/aecms/AECMS/docker-compose.prod.yml exec -T postgres \
  pg_dump -U aecms aecms | gzip > "$BACKUP_DIR/aecms_$DATE.sql.gz"

# Delete backups older than retention period
find "$BACKUP_DIR" -name "aecms_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: aecms_$DATE.sql.gz"
```

Schedule with cron:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /home/aecms/AECMS/scripts/backup.sh >> /home/aecms/AECMS/data/backups/backup.log 2>&1
```

### Restore from Backup

```bash
# Stop the application
docker compose -f docker-compose.prod.yml stop backend frontend

# Restore database
gunzip -c data/backups/aecms_YYYYMMDD_HHMMSS.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U aecms aecms

# Restart services
docker compose -f docker-compose.prod.yml up -d
```

### Backup Uploads

```bash
# Backup uploads volume
docker run --rm -v aecms_backend_uploads:/data -v $(pwd)/data/backups:/backup \
  alpine tar czf /backup/uploads_$(date +%Y%m%d).tar.gz -C /data .
```

### Off-site Backups

Consider syncing backups to cloud storage:

```bash
# Using rclone to sync to S3/B2/GCS
rclone sync data/backups remote:aecms-backups
```

---

## Monitoring

### Basic Monitoring with Docker

```bash
# View container stats
docker stats

# View container logs
docker compose -f docker-compose.prod.yml logs -f --tail=100

# Check disk usage
docker system df
```

### Health Check Endpoints

- Backend: `GET /` - Returns "Hello World!" when healthy
- Frontend: `GET /` - Returns 200 when healthy

### Recommended Monitoring Stack

For production monitoring, consider:

1. **Uptime Monitoring**: UptimeRobot, Pingdom, or Better Uptime
   - Monitor: `https://yourdomain.com`
   - Monitor: `https://api.yourdomain.com`

2. **Log Aggregation**: Grafana Loki, ELK Stack, or Papertrail
   ```bash
   # Example: Forward logs to Papertrail
   docker compose -f docker-compose.prod.yml logs -f | \
     nc logs.papertrailapp.com PORT
   ```

3. **Metrics**: Prometheus + Grafana
   - Container metrics via cAdvisor
   - Node metrics via node_exporter

4. **Error Tracking**: Sentry
   - Add to backend: `@sentry/node`
   - Add to frontend: `@sentry/nextjs`

### Alert Configuration

Set up alerts for:
- Container restarts
- High CPU/memory usage (>80%)
- Disk space low (<20% free)
- Health check failures
- Error rate spikes

---

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs backend

# Check container status
docker compose -f docker-compose.prod.yml ps

# Inspect container
docker inspect aecms-backend-prod
```

#### Database Connection Failed

```bash
# Verify postgres is running
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U aecms

# Check database logs
docker compose -f docker-compose.prod.yml logs postgres

# Verify DATABASE_URL format
echo $DATABASE_URL
```

#### Frontend Can't Reach Backend

```bash
# Check network connectivity
docker compose -f docker-compose.prod.yml exec frontend wget -qO- http://backend:4000/

# Verify NEXT_PUBLIC_API_URL is set correctly
docker compose -f docker-compose.prod.yml exec frontend env | grep API
```

#### SSL Certificate Issues

```bash
# Test certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Renew Let's Encrypt
sudo certbot renew

# Check certificate expiry
sudo certbot certificates
```

### Maintenance Commands

```bash
# Restart all services
docker compose -f docker-compose.prod.yml restart

# Restart single service
docker compose -f docker-compose.prod.yml restart backend

# Update images and restart
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Clean up unused resources
docker system prune -af

# View resource usage
docker stats --no-stream
```

### Rolling Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart with zero downtime
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d --no-deps backend
docker compose -f docker-compose.prod.yml up -d --no-deps frontend
```

---

## Quick Reference

### Start Production

```bash
docker compose -f docker-compose.prod.yml up -d
```

### Stop Production

```bash
docker compose -f docker-compose.prod.yml down
```

### View Logs

```bash
docker compose -f docker-compose.prod.yml logs -f
```

### Run Database Migrations

```bash
docker compose -f docker-compose.prod.yml run --rm backend npx prisma migrate deploy
```

### Create Backup

```bash
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U aecms aecms > backup.sql
```

### Access Database Shell

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U aecms aecms
```

---

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-org/AECMS/issues
- Documentation: https://github.com/your-org/AECMS/docs
