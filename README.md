# AECMS

A lightweight, host-agnostic content management system with integrated ecommerce — built as a self-hosted alternative to WordPress for low-traffic sites.

## What it is

AECMS gives you a full publishing and selling platform in a single Docker Compose stack:

- **Content** — Articles, pages, a flexible widget/block editor (TipTap), categories, tags, media library
- **Ecommerce** — Physical, digital, and service products; cart; Stripe (cards, Apple Pay, Google Pay, Amazon Pay) and PayPal checkout; digital file delivery with personalisation and Send-to-Kindle
- **Backstage** — Role-based admin dashboard (Owner / Admin / Member), capability-level access control, audit log, content version history
- **Settings** — Internal Secrets Manager (AES-256-GCM), pluggable cloud storage (GCS, S3, local), SMTP email, theme and font picker, domain aliasing

## Tech stack

| Layer | Technology |
|---|---|
| Backend | NestJS · PostgreSQL 15 · Prisma · Redis · TypeScript |
| Frontend | Next.js 15 · React 19 · Tailwind CSS v4 · Radix UI · TipTap |
| Payments | Stripe Checkout · PayPal Orders API v2 |
| Auth | JWT · 2FA (TOTP) · OAuth-ready |
| Deploy | Docker Compose · Google Cloud Run (CI/CD via GitHub Actions) |

## Quick start

```bash
# Clone and start (Docker must be running)
git clone https://github.com/WCCollier/AECMS.git
cd AECMS
bash start-dev.sh
```

`start-dev.sh` handles Postgres + Redis containers, Prisma migrations, database seeding, and starts both the backend (port 4000) and frontend (port 3000). On a cold Codespace or fresh machine it runs in full; on a warm restart it skips the seed and just restarts the servers.

## Documentation

**[Owner's Manual](https://wccollier.github.io/AECMS/owners-manual/)** — deployment guide, platform setup, first launch, admin settings, and ongoing maintenance.

Developer phase plans and completion reports are in [`docs/`](docs/).

## Status

Active development. A live deployment runs at [fantasyvreality.com](https://fantasyvreality.com).

## Support

AECMS is open source. If it's useful to you, [donations are welcome](https://www.givesendgo.com/aecms-an-open-source-e-commerce-cms).
