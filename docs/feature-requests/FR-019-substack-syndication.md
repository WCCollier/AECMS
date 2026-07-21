# FR-019: Substack Syndication

**Status:** `in-dev`
**Requested:** 2026-07-21
**Deployed:** —
**Size:** `medium` (schema migration, standalone operator script, unofficial third-party API integration)

---

## Synopsis

A weekly-cadence operator script that catalogues all published articles tagged `Articles`, skips any already sent to Substack, and creates a Substack **draft** (never publishes) for the next batch (default: 5, oldest → newest). The owner still clicks Publish in Substack's own UI — the script only eliminates the copy/paste of title and body. This lets the owner publish once (on the AECMS site) and syndicate to Substack with a single weekly review-and-click instead of a full manual re-write.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-07-21 | in-dev | Script, schema, and docs built; awaiting real Substack credentials and a live (non-dry-run) verification pass before moving to `in-testing` |

---

## Discussion

### Request context

The owner has ~70 articles on fantasyvreality.com and wants to syndicate roughly one per week to their Substack, without maintaining content in two places by hand. The ask, verbatim: catalogue everything tagged `Articles`, track what's already gone to Substack, grab the next 5 oldest-to-newest each run, draft them on Substack, and mark them transferred. Four articles were already manually republished on Substack before this tool existed and need to be marked as done without being re-sent.

### Why drafts, not publishes

Substack has **no official API**. Every available client (`python-substack`, `substack-cli`, various MCP servers) works by replaying a logged-in browser session cookie against Substack's own internal, undocumented endpoints — there is no key, no versioning, no changelog, and no guarantee it keeps working. Given that, auto-*publishing* was rejected: if the unofficial endpoint's request/response shape drifts and the script doesn't notice, a live post could go out garbled or empty. Auto-*drafting* keeps the labor savings (title + body already there) while keeping a human as the last check before anything goes public.

### Options considered

| Option | Trade-off |
|--------|-----------|
| Full auto-publish via unofficial API | Fastest, but a silent breakage would post broken content live with no review step — rejected |
| **Auto-draft, human publishes (chosen)** | One weekly click by the owner; safe against API drift and lossy content conversion |
| Wait for/rely on an official Substack API | Doesn't exist as of 2026-07; no indication one is coming |
| RSS-only (point Substack's "Import via RSS" at `/feed.xml`) | Substack's RSS import is one-time, not a recurring sync — doesn't fit "weekly, ongoing" |

### Decisions

- **Draft-only, never publish.** See above.
- **Cookie-based auth via a small hand-rolled TypeScript client**, not the Python `python-substack` library. AECMS's backend is entirely TypeScript/NestJS; shelling out to Python for one HTTP POST would add a second runtime dependency for no real benefit. The client (`scripts/substack/client.ts`) implements just the one endpoint needed (`POST /api/v1/drafts`).
- **`draft_body` is sent as an HTML string**, not a hand-built ProseMirror JSON doc. Public reverse-engineering write-ups of the endpoint show `draft_body` accepting an HTML string directly (e.g. `"draft_body":"<p>Hi.</p>"`) — this is far simpler than replicating Substack's internal ProseMirror node schema, and AECMS articles are themselves ProseMirror (TipTap) JSON, so "TipTap JSON → clean HTML" is a well-understood conversion problem instead of a speculative one.
- **A new `SubstackSyncRecord` table**, one row per article that's been sent (or manually marked done), rather than columns on `Article`. Keeps this optional/orthogonal feature out of the core content schema, and leaves room for `substack_draft_id` to be null for manually-marked entries (see below).
- **Credentials live in the ISM** (`syndication.*` keys, cookie encrypted), consistent with every other external integration (Stripe, PayPal, Resend) — not a `.env` var.
- **`--dry-run` flag on the sync script.** Runs the full catalogue → batch-select → HTML-convert pipeline and prints exactly what would be sent, with no network call and no DB write. Given the endpoint's exact field names are reconstructed from public reverse-engineering (not verified against this account), dry-run is how the owner verifies the conversion looks right *before* the first live run risks creating malformed drafts.
- **A separate `mark-synced.ts` helper** for the four already-published-by-hand articles (and any future ones the owner publishes to Substack outside the script) — inserts a `SubstackSyncRecord` with `substack_draft_id: null` so `sync.ts` skips them without ever calling Substack for them.

### Out of scope (this iteration)

- **No admin UI.** Configuration is via a one-time script (`set-credentials.ts`) that writes directly to the ISM; there's no `/admin/settings` tab for this. If this becomes a heavier-use feature, a Settings tab is a natural follow-on.
- **No recurring trigger wired up.** The script is built to be invoked manually (or by whatever the owner chooses — host cron, GitHub Actions scheduled workflow, Cloud Scheduler hitting a small protected endpoint). Deciding *how* it runs weekly in production is a separate, smaller follow-up once the owner has confirmed the draft output looks right.
- **No re-sync on article edits.** Once an article is marked synced, it's synced forever — editing the AECMS article afterward does not update or recreate the Substack draft. Acceptable for a one-way "syndicate once" flow.
- **No cookie auto-refresh.** When the Substack session cookie expires, the script fails clearly (401/redirect from Substack) and the owner re-runs `set-credentials.ts` with a fresh cookie. No auto-relogin was built — email/password auth-and-cookie-capture flows exist in some community tools but add complexity (2FA handling, CAPTCHA risk) not worth it for a once-a-week job.

---

## Design & Implementation Guide

### Overview

A standalone script suite under `backend/scripts/substack/`, following the existing pattern of `resend-backfill.ts` / `migrate-env-to-ism.ts` (direct `PrismaClient` + `pg` Pool, no NestJS DI, run via `ts-node`). Not part of the deployed Nest server bundle — nothing under `backend/src/` imports it.

```
backend/scripts/substack/
  converter.ts          — TipTap JSON (or legacy HTML) → Substack-bound HTML
  client.ts             — POST /api/v1/drafts against Substack's unofficial internal API
  sync.ts               — main entry point: catalogue → filter → batch → draft → record
  mark-synced.ts        — mark article(s) as already-synced without calling Substack
  set-credentials.ts    — one-time ISM setup (publication URL + session cookie)
```

### Data model

```prisma
model Article {
  // ...existing fields...
  substack_sync   SubstackSyncRecord?
}

// One row per article already sent (or manually marked done).
model SubstackSyncRecord {
  id                String   @id @default(uuid())
  article_id        String   @unique
  substack_draft_id String?  // null when marked done manually
  synced_at         DateTime @default(now())
  created_at        DateTime @default(now())

  article Article @relation(fields: [article_id], references: [id], onDelete: Cascade)

  @@map("substack_sync_records")
}
```

Migration: `20260721060000_add_substack_sync_records` — a single new table, no changes to existing tables. Purely additive; safe to deploy without a maintenance window per the Live Deployment Policy.

### New ISM keys (namespace `syndication.*`, no env-var fallback — set only via `set-credentials.ts`)

| Key | Encrypted | Description |
|-----|-----------|-------------|
| `syndication.substack_publication_url` | no | e.g. `https://fantasyvreality.substack.com` |
| `syndication.substack_cookie_enc` | yes | Full `Cookie` header value from a logged-in browser session (must include `substack.sid`) |
| `syndication.substack_tag_name` | no | Defaults to `"Articles"` if unset |
| `syndication.substack_batch_size` | no | Defaults to `5` if unset |

### Sync logic (`sync.ts`)

1. Look up the `Articles` tag (or configured `syndication.substack_tag_name`) by exact name — case-sensitive, so `Articles` ≠ `articles`.
2. Query all `published`, non-deleted articles carrying that tag, `orderBy: published_at asc`, including their `substack_sync` relation.
3. Split into already-synced vs. pending; take the first `batch_size` pending articles.
4. For each: convert `content` to HTML (`converter.ts`), POST a draft (`client.ts`), then write a `SubstackSyncRecord` on success. Failures are logged and skipped — they don't block the rest of the batch, and don't create a sync record (so they're retried on the next run).
5. Prints a summary: how many catalogued, how many already synced, how many drafted/failed this run.

`--dry-run` runs steps 1–4's conversion but skips the network call and the DB write, printing the title/subtitle/HTML that *would* be sent instead.

### Content conversion (`converter.ts`)

Walks the TipTap/ProseMirror JSON tree (or passes through legacy raw-HTML articles as-is, matching the same JSON-first/HTML-fallback logic `RichTextContent.tsx` already uses on the frontend). Standard nodes (paragraph, heading, lists, blockquote, code block, image, bold/italic/strike/code/link marks) map directly to HTML tags.

AECMS's custom widget nodes have no Substack equivalent, so each gets a best-effort static fallback rather than being silently dropped:

| Widget | Fallback in the Substack draft |
|--------|--------------------------------|
| `callout` | `<blockquote>` with an emoji + summary line, keeping its paragraph content |
| `videoEmbed` | A line linking to the video URL |
| `xEmbed` | A line linking to the post URL |
| `mediaCarousel` | First (or primary) image only, plus a "(+N more — view on site)" note if there were others |
| `articleEmbed`, `productEmbed`, `rssEmbed`, `searchResultsEmbed` | Replaced with a `[Embedded content omitted from syndication — view the full article on the site]` placeholder — these are dynamic/data-driven and have no static content worth syndicating |

This is deliberately visible rather than silent — a human reviewing the draft before publishing can see exactly where something was simplified.

### Substack client (`client.ts`)

`POST {publicationUrl}/api/v1/drafts` with header `Cookie: <session cookie>` and body:
```json
{ "draft_title": "...", "draft_subtitle": "...", "draft_body": "<p>...</p>", "type": "newsletter" }
```

**This exact shape is unverified against a live account** — it's reconstructed from public reverse-engineering write-ups (see Sources below), since Substack publishes no documentation for it. The client throws with the raw response body on any non-2xx or on a 2xx with no recognizable draft ID, so a shape mismatch surfaces as a loud, specific error rather than a silent bad draft.

### Key implementation notes

- Tag match is exact-string and case-sensitive (Postgres default collation) — `Articles` will not match a hypothetical lowercase `articles` tag, matching the request precisely.
- `SubstackSyncRecord.article_id` is `@unique`, so an article can only ever have one sync record — re-running `sync.ts` or `mark-synced.ts` against an already-synced article is a no-op, not a duplicate.
- If the script crashes *between* a successful Substack draft creation and the local `SubstackSyncRecord` write, a subsequent run could create a duplicate draft for that one article. At once-a-week volume this is an acceptable, manually-fixable edge case (delete the duplicate in Substack) rather than something worth adding transactional/idempotency-key machinery for.
- Cookie expiry shows up as a failed draft creation for every article in the batch (typically a 401 or an HTML login-page response instead of JSON) — re-run `set-credentials.ts` with a fresh cookie when that happens.

### Sources (reverse-engineered Substack API references used)

- [ma2za/python-substack](https://github.com/ma2za/python-substack)
- [AnthonyDavidAdams/substack-api-reference](https://github.com/AnthonyDavidAdams/substack-api-reference) — 129 endpoints incl. `POST /api/v1/drafts` body shape
- [No official API⁉️ No problem‼️ — reverse-engineering write-up](https://iam.slys.dev/p/no-official-api-no-problem-how-i)

---

## Completion Report

> _Partial — code and docs are done; live verification against a real Substack account is not yet complete (see Known Limitations)._

**Implemented:** 2026-07-21
**Commit(s):** _pending — built on `main`, not yet merged to `deploy`_

### What was built

- Prisma model `SubstackSyncRecord` + migration (additive-only, new table).
- `backend/scripts/substack/converter.ts` — TipTap JSON / legacy HTML → HTML, with widget fallbacks. Verified locally with a synthetic TipTap doc covering headings, marks, lists, callout, videoEmbed, and searchResultsEmbed — output was correct HTML for every case tested.
- `backend/scripts/substack/client.ts` — minimal unofficial-API client for draft creation.
- `backend/scripts/substack/sync.ts` — main entry, with `--dry-run`.
- `backend/scripts/substack/mark-synced.ts` — manual mark-as-done helper.
- `backend/scripts/substack/set-credentials.ts` — ISM credential seeding.
- `npm run substack:sync`, `substack:sync:dry-run`, `substack:mark-synced`, `substack:set-credentials` in `backend/package.json`.

### Deviations from design

- None — matches the Design & Implementation Guide above.

### Known limitations

- **The `POST /api/v1/drafts` field names (`draft_title`/`draft_subtitle`/`draft_body`/`type`) have not been verified against a live Substack account.** No official docs exist for this endpoint; the shape used here is the best current public reverse-engineering knowledge. The first real (non-dry-run) invocation is the actual verification step — if it fails, the error will include Substack's raw response body, which should make it possible to correct the field names in `client.ts`.
- This environment's Docker daemon was unavailable during development (unrelated pre-existing issue), so the full pipeline could not be run end-to-end against a live database in this session — only typechecked and unit-verified (converter logic) plus a partial run confirming the script correctly reaches the DB layer before failing on the (down) connection. A dry run against the real dev/prod database, once reachable, is the next step.
- No recurring scheduler is wired up (see Out of Scope) — running this weekly requires the owner to either run it by hand or choose a trigger mechanism.

---

## Testing Guide

### Prerequisites

- A running AECMS instance with a reachable Postgres database and `SETTINGS_ENCRYPTION_KEY` set.
- At least one article tagged `Articles` with `status: published`.
- For the live (non-dry-run) path: a Substack publication the owner administers, and a copy of the `Cookie` header from a logged-in browser session (see `set-credentials.ts` header comment for exact steps).

### Test scenarios

**A. Dry run, no credentials needed**
1. `npm run substack:sync:dry-run`
2. Expect: a printed catalogue count, and up to 5 articles (oldest → newest, tagged `Articles`, not yet synced) with their title, subtitle, and generated HTML body printed. No network call, no DB write.
3. Re-run — output should be identical (nothing was marked synced by a dry run).

**B. Marking the four already-manually-published articles as done**
1. `npx ts-node -r tsconfig-paths/register scripts/substack/mark-synced.ts <slug-1> <slug-2> <slug-3> <slug-4>`
2. Expect: four "✓ ... marked as already synced" lines.
3. Re-run `substack:sync:dry-run` — those four should no longer appear in the pending batch.

**C. First live run**
1. `npm run substack:set-credentials` with real `SUBSTACK_PUBLICATION_URL` / `SUBSTACK_COOKIE` env vars.
2. `npm run substack:sync`
3. Expect either: drafts appear in the Substack dashboard, and matching `SubstackSyncRecord` rows exist in the DB — **or** a clear error containing Substack's raw response body, which is the signal to adjust `client.ts` field names.

**D. Idempotency**
1. Run `substack:sync` twice in a row.
2. Expect: the second run either drafts the *next* batch (if more pending articles exist) or reports "Nothing new to sync" — never re-drafts an article from the first run.

### Acceptance criteria

- [ ] Dry run correctly catalogues and previews without any network/DB side effects.
- [ ] The four manually-published articles are marked synced and excluded from future batches.
- [ ] A live run either produces correct Substack drafts, or fails loudly with enough detail (raw response body) to fix the client.
- [ ] Re-running never re-drafts an already-synced article.

---

## Outstanding Issues

| # | Severity | Description | Status |
|---|----------|--------------|--------|
| 1 | medium | `client.ts` request/response field names unverified against live Substack — first live run is the real test | open |
| 2 | low | No recurring trigger wired up yet — owner needs to decide cron/scheduler mechanism | open |
