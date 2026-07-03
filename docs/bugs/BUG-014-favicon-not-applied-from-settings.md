# BUG-014: Favicon set in Site Identity settings has no effect on browser tab

**Status:** `in-dev`
**Reported:** 2026-07-03
**Severity:** `medium`
**Area:** frontend, settings, identity

---

## Description

When an owner selects a PNG favicon in Settings → General → Site Identity and saves, the browser tab continues to show the old icon (or no icon). The selected favicon URL is saved to the ISM correctly, but the browser never picks it up because the dynamic `<link rel="icon">` tag injected by the layout conflicts with an auto-generated one from Next.js's special-file system.

---

## Reproduction Steps

1. Go to `/admin/settings` → General → Site Identity.
2. Select a PNG from the media library as the favicon and save.
3. Navigate to the customer-facing site.
4. Observed: browser tab still shows the old favicon (or the default Next.js scaffold icon).
5. Expected: browser tab shows the newly selected PNG.

---

## Root Cause

Three compounding issues in `frontend/app/layout.tsx`:

1. **`app/favicon.ico` is a Next.js special file.** When this file exists, the framework auto-generates and injects `<link rel="icon" type="image/x-icon" sizes="48x48" href="/favicon.ico">` into `<head>` at the framework level, before any layout-defined head content.

2. **Manual `<link>` conflicts with the auto-injected one.** The layout injects `{faviconUrl && <link rel="icon" href={faviconUrl} />}` as JSX. This produces a second `<link rel="icon">` tag. Browsers cache the first matching tag (the auto-injected `/favicon.ico`) and typically ignore duplicates.

3. **Static `metadata` export doesn't know about the dynamic favicon.** The layout uses `export const metadata` (a static object) which doesn't include `icons`, so Next.js's metadata deduplication logic never gets a chance to override the `app/favicon.ico` injection.

---

## Fix Plan

Convert the static `export const metadata` to `export async function generateMetadata()` in `frontend/app/layout.tsx`. The function already calls `getSiteTheme()` at render time; `generateMetadata()` can call the same helper and return `icons: { icon: faviconUrl }` when set, which Next.js metadata system uses to supersede the `app/favicon.ico` auto-injection.

- Remove the manual `{faviconUrl && <link rel="icon" href={faviconUrl} />}` from the JSX `<head>` (metadata handles it now).
- Remove the manual `<title>{siteTitle}</title>` from the JSX `<head>` too — the dynamic title can live in `generateMetadata()` instead, fixing the secondary bug where the hardcoded `'AECMS'` title in the static metadata export ignores the DB site title for SEO crawlers.
- Keep `app/favicon.ico` as the static fallback (reference it explicitly as `icons: { icon: '/favicon.ico' }` when `faviconUrl` is null).

```
frontend/app/layout.tsx  — static metadata → generateMetadata(); remove manual <link>/<title> from JSX
```

### Key considerations
- `getSiteTheme()` will be called by both `generateMetadata()` and `RootLayout()`. Next.js deduplicates `fetch()` calls within a render, so this is safe and incurs no extra HTTP requests.
- The `revalidate: 300` on the identity fetch means favicon changes take up to 5 minutes to appear — acceptable for this use case.
- The `template: '%s | AECMS'` in the static metadata controlled per-page title suffixes. `generateMetadata()` should use the dynamic `siteTitle` in the template instead.

---

## Completion Report

> _Fill in after fix is deployed._

**Fixed:** YYYY-MM-DD
**Commit(s):** ``

### What changed

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-07-03 | open | Reported: PNG favicon set in settings has no visible effect |
| 2026-07-03 | in-dev | Root cause identified: static metadata + manual link tag conflict with app/favicon.ico auto-injection |
