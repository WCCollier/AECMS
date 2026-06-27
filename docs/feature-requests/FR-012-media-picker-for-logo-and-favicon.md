# FR-012: Media Picker Integration for Logo and Favicon

**Status:** `deployed`
**Size:** `small`
**Area:** settings, media

---

## Synopsis

The Site Identity tab in Admin Settings has two image fields — Logo URL and Favicon — that currently bypass the media library entirely. Logo URL is a raw text input; Favicon is a one-off file upload that stores the file directly to the local `uploads/` directory (bypassing `StorageProvider`, meaning it is broken on cloud deployments for the same reason as BUG-003). Both should be replaced with the existing `ImageField` component, which gives the owner a media picker modal with inline upload, search, and grid selection — the same UX already used in article and product forms.

---

## Current Behaviour

**Logo URL** (`identity.logo_url`):
- `SettingsClient.tsx` ~line 596: plain `TextInput`; owner pastes a URL manually
- Saved via `PATCH /settings/general`

**Favicon** (`identity.favicon_url`):
- `SettingsClient.tsx` ~lines 606–626: custom file input + `POST /settings/favicon` endpoint
- Backend (`settings.controller.ts` ~line 136): accepts ICO/PNG/JPG/SVG, writes to local `uploads/` via `fs.writeFile` — **not routed through `StorageProvider`**, so it lands on local disk only; broken on GCS/S3
- Saved as `identity.favicon_url` in `SiteSettings`

---

## Desired Behaviour

Both fields become `ImageField` pickers (modal MediaPicker with drag-drop upload + library grid):

- **Logo**: `ImageField` with no MIME filter (any image type is valid)
- **Favicon**: `ImageField` with `mimeFilter="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"` — browser-native favicon formats; file lands in the media library and is served from cloud storage correctly
- Selecting or uploading a file writes the resulting URL to the same ISM keys (`identity.logo_url`, `identity.favicon_url`) via `PATCH /settings/general` — no new backend keys or endpoints
- The current preview `<img>` elements remain (they are already driven by the saved URL, so they work unchanged once the URL is set by the picker)
- The `POST /settings/favicon` backend endpoint can be removed in this same change since it will no longer be called

---

## Design Guide

### Frontend — `SettingsClient.tsx`

Replace the Logo section (~lines 596–604):

```tsx
// Before
<TextInput label="Logo URL" value={...} onChange={...} />
<img src={logoUrl} ... />

// After
<ImageField
  label="Logo"
  value={settings['identity.logo_url'] ?? ''}
  onChange={(url) => handleChange('identity.logo_url', url ?? '')}
/>
```

Replace the Favicon section (~lines 606–626):

```tsx
// Before
<img src={faviconUrl} ... />
<input type="file" ... onChange={handleFaviconUpload} />

// After
<ImageField
  label="Favicon"
  value={settings['identity.favicon_url'] ?? ''}
  onChange={(url) => handleChange('identity.favicon_url', url ?? '')}
  mimeFilter="image/png,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
/>
```

`ImageField` already accepts `value`, `onChange(url | null)`, and `mimeFilter` props. The `handleChange` helper already triggers a debounced `PATCH /settings/general` save — no new save logic needed.

Remove: the `handleFaviconUpload` function and the `adminApi.post('/settings/favicon', ...)` call.

### Backend — `settings.controller.ts`

Remove the `uploadFavicon()` handler (~lines 136–160) and its route decorator `@Post('favicon')`. Remove associated `@UseInterceptors(FileInterceptor(...))` import if no longer needed elsewhere.

### No schema or ISM changes

`identity.logo_url` and `identity.favicon_url` already exist as ISM keys with env-var fallbacks. They accept any string URL. No migration, no new keys.

---

## Key Considerations

- `ImageField` is already used in article and product forms — no new component to build
- The favicon `mimeFilter` string should permit both `image/x-icon` and `image/vnd.microsoft.icon` since browsers report ICO files under either MIME type depending on OS
- After this change, favicons uploaded via the media library will appear in the media library grid like any other image — that is intentional and desirable (owner can reuse or delete them)
- The existing favicon preview `<img>` tag and the `<link rel="icon">` tag in the site `<head>` are both driven by the saved `identity.favicon_url` value, so they continue to work unchanged
- If the owner has an existing favicon stored via the old `POST /settings/favicon` endpoint (local disk only), it will stop being served after deploy because local disk is ephemeral on Cloud Run. They should re-upload via the new picker immediately after deploying. Add a note about this in the testing guide.

---

## Completion Report

**Deployed:** 2026-06-27
**Commit(s):** pending

### What changed
Implemented as planned with one minor deviation: no `mimeFilter` is applied to either field (per owner intent — the same JPG logo image is used for both logo and favicon, and modern browsers handle scaling). Both fields use `ImageField` with `emptyLabel` customised per field. `ImageField` itself was updated to make `label` optional and accept an `emptyLabel` prop (defaulting to `'Add image'`), making it more reusable outside article/product forms. The `POST /settings/favicon` backend endpoint and its exclusive imports (`FileInterceptor`, `UploadedFile`, `UseInterceptors`, `fs`, `path`, `BadRequestException`) were removed entirely.

---

## Testing Guide

1. Go to `/admin/settings` → Site Identity tab
2. **Logo:**
   - Click the Logo picker — media modal opens
   - Upload a new image via drag-drop; confirm it appears in the library and is selected
   - Select an existing image from the library; confirm the URL is saved and the preview updates
   - Remove the logo (clear); confirm `identity.logo_url` is cleared
3. **Favicon:**
   - Click the Favicon picker — media modal opens with file type filter applied (non-image files absent)
   - Upload a PNG; confirm it uploads to cloud storage (URL is `https://storage.googleapis.com/...` or CDN equivalent, not `/uploads/...`)
   - Confirm the saved favicon URL is served correctly in the browser tab icon after a page reload
4. Confirm `POST /settings/favicon` no longer exists (returns 404)
5. **Re-upload note:** If the live site had a favicon previously set via the old endpoint, it will need to be re-uploaded via the new picker after deploy.

---

## Status History

| Date | Status | Note |
|------|--------|------|
| 2026-06-27 | accepted | Initial write-up |
| 2026-06-27 | deployed | Implemented — ImageField for both fields, favicon endpoint removed |
