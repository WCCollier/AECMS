# Phase 19: First Deployment — MERGED INTO PHASE 21

**Status**: ♻️ MERGED  
**Decision date**: 2026-06-18

---

## Decision

Phase 19 (first deployment to Cloud Run) and Phase 21 (multi-owner deployability) have been merged into a single phase, now tracked as **Phase 21**.

**Rationale**: A standalone first deployment without the deployability infrastructure (setup wizard, seed profiles, CI/CD) is a throwaway exercise. The FvR deployment *is* the proof of deployability. Building both together produces a real, reusable thing rather than a one-off.

---

## See

→ **[PHASE_21_PLAN.md](./PHASE_21_PLAN.md)** — canonical merged plan, full implementation detail, and deployment checklist for `fantasyvreality.com`.

---

## What This Plan Contained (Preserved for Reference)

The original Phase 19 plan covered:

- Cloud Run architecture (two services: NestJS backend + Next.js frontend)
- Cloud SQL (PostgreSQL 15, db-f1-micro, Cloud SQL Auth Proxy)
- Memorystore / Upstash Redis
- GCS buckets (media + digital)
- Secret Manager for all credentials
- Artifact Registry for Docker images
- Custom domain + SSL via Cloud Run domain mappings
- Seed data migration and media upload to GCS
- CI/CD via GitHub Actions

All of these are addressed in Phase 21 with the addition of the setup wizard, seed profile system, and update strategy. The original cost estimates, architecture diagrams, and open questions are superseded by the Phase 21 plan.
