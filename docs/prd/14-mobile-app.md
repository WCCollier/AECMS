# PRD 14 — AECMS Mobile App (Phase 31)

**Status**: 💡 Concept / brainstorm  
**Phase**: 31 (far-future — Mul Converter and intermediate phases complete first)  
**Last updated**: 2026-06-21

---

## Concept

A mobile app that a user downloads once, points at any AECMS-hosted website, and receives a fully native mobile interface to that site's content, shop, and account — styled to match the site's active theme.

The analogy is Substack's or Ghost's mobile app: one app binary that serves many independent publishers, where each "instance" feels like it belongs to the site it's pointed at.

---

## Two distribution models

### Model A — Single-site (white-label)

The app is built from the AECMS app source with a hardcoded target URL and custom branding (name, icon, splash screen). The site owner publishes it to the App Store / Google Play under their own developer account. Visitors download "Fantasy V Reality" (not "AECMS").

**Best for**: Established sites with a loyal audience who'd install a dedicated app. Requires the owner to hold Apple/Google developer accounts and go through store review.

### Model B — Multi-site reader

A single "AECMS Reader" app on the stores. Users add sites by URL. The app fetches each site's manifest, theme, and content and presents them in a unified reader with per-site branding applied at the view level.

**Best for**: The open-source distribution play — one app that serves every AECMS deployment. Lowers the bar to zero for site owners (no store accounts needed). Comparable to how Flipboard or Feedly aggregate sources.

**Recommendation**: Build the engine as Model A first (single-site, simpler), then add the site-switcher layer of Model B in a follow-on version. Both share 95% of the same code.

---

## How it works

### 1. Discovery

The app resolves the target site URL and hits a new well-known endpoint:

```
GET /.well-known/aecms-app.json
```

```json
{
  "version": "1",
  "site_name": "Fantasy V Reality",
  "site_description": "Fantasy sports analysis and tools.",
  "api_base": "https://fantasyvreality.com",
  "theme": {
    "palette": "midnight",
    "fonts": "serif-modern",
    "accent": "#6366f1",
    "background": "#0f0f13",
    "surface": "#1a1a22",
    "foreground": "#e8e8f0"
  },
  "features": ["articles", "shop", "comments", "digital_products"],
  "logo_url": "https://fantasyvreality.com/logo.png",
  "favicon_url": "https://fantasyvreality.com/favicon.ico"
}
```

The backend serves this from a new `GET /.well-known/aecms-app.json` route that reads the active theme from SiteSettings and the site identity from ISM.

### 2. Native theme application

The theme block in the manifest maps directly to React Native StyleSheet tokens. The 8 AECMS palettes and 5 font pairings are small enough to hardcode as named presets in the app; the manifest's palette/fonts names select them. The `accent`, `background`, `surface`, and `foreground` hex values are the escape hatch for sites with custom overrides.

Fonts: use Expo Google Fonts (same fonts already used on the web) so the typographic identity is preserved exactly.

### 3. Content API

The app consumes the existing backend REST API with no additions for v1:

| Screen | Endpoint |
|--------|----------|
| Article list | `GET /articles?status=published` |
| Article detail | `GET /articles/:id` |
| Product list | `GET /products?status=published` |
| Product detail | `GET /products/:id` |
| Pages | `GET /pages/:slug` |
| Cart | `GET/POST/PATCH/DELETE /cart` |
| Orders | `GET /orders` |
| Auth | `POST /auth/login`, `/auth/register`, `/auth/refresh` |

Future additions: push-notification subscription endpoint, bookmarks.

### 4. Rich text rendering

TipTap stores content as a ProseMirror JSON document. Three options, in order of effort:

**Option A — react-native-render-html** (recommended for v1): The backend already serves TipTap JSON; add a thin backend endpoint (`GET /articles/:id/html`) that converts TipTap JSON to sanitised HTML. The app renders it with `react-native-render-html` inside a ScrollView. Not pixel-perfect native but fast to ship and fully functional.

**Option B — Native node renderer**: Build a TipTap JSON → React Native component tree renderer (paragraph, heading, bold, italic, image, lists, links). Fully native feel, no WebView, but significant build effort. Worth doing properly in v2.

**Option C — WebView**: Embed the full web article page in a WKWebView/WebView. Zero effort, but feels like a wrapper app. Acceptable only as a temporary shim.

### 5. Authentication

The app uses the existing customer-facing session (`POST /auth/login`, `session_type: 'customer'`). Tokens are stored in the device keychain (via `expo-secure-store`). Refresh is automatic on 401.

Guest checkout and guest cart (`x-session-id` header) work identically to the web — the session ID is stored in SecureStore instead of localStorage.

### 6. Checkout

Stripe's native mobile SDK (`@stripe/stripe-react-native`) renders a native payment sheet with cards, Apple Pay, and Google Pay. This is a meaningful UX upgrade over the web's Checkout redirect — no browser handoff.

PayPal: use a WebView pointed at the PayPal approval URL (same as web), then intercept the return URL. Not elegant but reliable for v1.

---

## App structure

```
App
├── (tabs)
│   ├── Home          — featured content, hero from _home_ page, latest articles
│   ├── Articles      — paginated list → detail (rich text)
│   ├── Shop          — product grid → detail → add to cart
│   └── Account       — login/register, order history, digital library
├── Cart              — modal/drawer, accessible from all tabs
└── Checkout          — Stripe payment sheet + address collection
```

### Home tab

Reads the `_home_` page content from the API and renders a simplified version: hero image/text from the first section, then a "Latest" feed of recent articles and featured products. Not a full section-layout render — a curated digest.

### Articles tab

List view with cover image, title, excerpt, date, category badge. Tapping opens the article detail. Comments rendered below the article body (logged-in users can post). Infinite scroll via cursor pagination.

### Shop tab

Grid of product cards (image, name, price, compare-at strike-through if set). Product detail shows description (rich text), image carousel, type-specific UI (add to cart for physical/digital, contact/service for service type). Cart icon in the nav bar shows item count badge.

### Account tab

Unauthenticated: login / register / guest browse options.  
Authenticated: name, email, order history list → detail, digital library (download / Kindle delivery), saved shipping address.

---

## Native-only features (v2 and beyond)

These are only possible in a native app, not the web:

- **Push notifications** — new article published, order shipped, download ready
- **Offline reading** — cache articles for offline access (SQLite via expo-sqlite)
- **Home screen widgets** — latest article title/image, current cart count
- **Deep links** — `aecms://fantasyvreality.com/articles/my-slug` → opens article in app
- **Haptic feedback** — cart add, checkout confirm
- **Biometric auth** — Face ID / fingerprint to unlock account tab

---

## Backend additions required

Minimal for v1:

1. `GET /.well-known/aecms-app.json` — manifest endpoint (new route, no auth)
2. `GET /articles/:id/html` — TipTap → HTML conversion endpoint (if using Option A rendering)
3. Push subscription: `POST /push/subscribe`, `DELETE /push/subscribe` — stores Expo push token against the user; backend calls Expo's push API on relevant events (article published, order status changed)

The existing REST API handles everything else without modification.

---

## Technology choices

| Decision | Choice | Rationale |
|---|---|---|
| Framework | React Native + Expo | Shares React knowledge with the Next.js frontend; Expo simplifies native build infra; OTA updates via Expo Updates. **Flutter holds ~46% cross-platform market share vs RN's ~35–42% in 2026** but Flutter's Dart requirement and pixel-perfection focus are overkill for a content/commerce reader app. JS/TS skills transfer directly with RN. |
| Navigation | Expo Router (file-based, mirrors Next.js App Router) | Familiar pattern; deep links work out of the box |
| State | Zustand + SWR (same as web) | Minimal new dependencies |
| Payments | None (reader app — no in-app purchasing) | Physical and digital goods purchased on website; app is consumption-only. No @stripe/stripe-react-native needed. |
| Secure storage | expo-secure-store | JWT tokens in device keychain |
| Fonts | @expo-google-fonts/* | Exact same fonts as web |
| Rich text | react-native-render-html (v1) | Fast to ship; upgrade to native renderer in v2 |
| Images | expo-image | Caching, blurhash placeholders |
| Build/OTA | Expo EAS | Free tier (30 builds/mo, 1K MAU OTA) sufficient for single-site white-label at launch |

---

## What makes this interesting

The theme system is the sleeper feature here. Because AECMS already encodes its entire visual identity into ~12 CSS variables (background, surface, foreground, accent, border, plus a font pairing), the mobile app can be a *genuinely* skinned native app — not a PWA wrapper. A midnight-palette AECMS site produces a dark-native app; a warm-linen site produces a warm-light app. The user downloads what feels like a custom app for that publisher, even though it's the same binary.

The single-site white-label path also means a motivated site owner could submit their own branded version to the stores, which is a meaningful differentiator from "just use the website."

---

## Platform store policy (confirmed, 2026)

### iOS — Apple App Store

**The IAP question is answered: use the reader app model, no IAP.**

Apple's rules distinguish between "reader apps" (apps that let users consume content purchased elsewhere) and apps that sell digital goods directly. The reader app model — used by Kindle, Netflix, and Spotify — is fully permitted and requires no IAP. The key rules:

- You may **not** include a "Buy" button, price, or checkout flow inside the app for digital goods
- You **may** include a "Buy on our website" link that opens a browser (post–Epic v. Apple ruling, US storefront)
- Users who have purchased on the web can access their content in the app
- No Apple commission on purchases made outside the app

For AECMS's product mix — articles (free or subscription via web), digital downloads, and physical goods — the reader app model works cleanly:
- **Articles**: display for free, reader app
- **Digital products**: purchased on the website, accessed in the app (download button, Kindle delivery)
- **Physical products**: the app shows the product, taps open the site in Safari for checkout — no IAP needed since physical goods are always exempt
- **No subscription flow in app**: if the owner adds paid subscriptions, they're managed on the website

External payment links in US apps are now permitted (Apple must allow them post-ruling), but Apple still charges **27%** on purchases made via external links in the US (down from 30% but still significant). The reader app model sidesteps this entirely.

**Bottom line**: Build AECMS's iOS app as a consumption-first reader app. No IAP, no 27% cut, no compliance complexity.

### Android — Google Play

Google Play is significantly more developer-friendly in 2026 following the Epic v. Google settlement:

- Standard commission dropped from **30% to 20%** for new installs (subscriptions from 15% to 10% after year 1)
- External billing program (link-out to website): fee drops to approximately **9%** on transactions within 24 hours of the link-out
- Regional rollout: US, EU, UK effective June 30, 2026; global by September 2027

For AECMS's Android app, the same reader app model applies and works well. Physical goods are exempt (always have been). Digital goods sold via the website within 24 hours of an in-app link carry ~9% — much more reasonable than Apple's 27%.

### Expo EAS pricing (2026)

- **Free plan**: 30 cloud builds/month, 1,000 MAUs for OTA updates, 100 GiB bandwidth — sufficient for a single-site white-label app at small publisher scale
- **Starter ($19/mo)**: 3,000 MAUs for OTA — needed once the app has a modest user base
- **OTA updates at scale**: 100K MAU costs ~$1,326/mo (plan + overage). Not a concern for Phase 31; worth noting when audience grows

For a single-site white-label app at low traffic, the **free Expo EAS tier is sufficient indefinitely**.

---

## Open questions (to resolve when active)

- **Store distribution strategy**: Maintain a single "AECMS Reader" app + publish instructions for white-label? Or only white-label and no shared reader app? (Leaning: white-label only — the reader app model is cleaner for a branded app.)
- **Expo managed vs bare workflow**: Managed workflow's CNG prebuild adds time and can push cloud builds past the free tier's 45-minute timeout. Bare workflow skips this. For a lean app without unusual native modules, managed workflow is probably fine for v1.
- **Section layout rendering**: The new SectionsPageContent schema (Phase 23) uses CSS grid per section. A native equivalent would need flexbox rows approximating the column widths. Simple 1-, 2-, and 3-column layouts are straightforward; the 4-column Feature Centre layout needs care.
- **Minimum AECMS version targeting**: The manifest should include an `api_version` field so older AECMS instances can gracefully tell the app which features are available.
- **Subscription support**: If the owner adds paid article subscriptions in a future phase, the reader app model requires those be purchased and managed entirely on the web. The app would check subscription status via the customer API and gate content accordingly.

---

## Phase reference

This is tracked as **Phase 31**. Phases 24–30 cover planned intermediate work (sales tax, and others TBD). Phase 31 is intentionally distant — the Mul Converter (Phase 23), sales tax (Phase 24), and other features should be stable in production before native app work begins.
