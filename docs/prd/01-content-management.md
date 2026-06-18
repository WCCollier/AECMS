# PRD 01: Content Management

**Version:** 1.1
**Date:** 2026-01-28
**Status:** Draft
**Parent:** [Master PRD](./00-master-prd.md)

## Overview

The Content Management module is the core of AECMS, enabling users to create, organize, and publish articles, pages, and media content.

## Roles & Capabilities Definition

**Note**: This section defines canonical role mappings for content management features. For comprehensive role and capability specifications, see [PRD 09: User Management & Authentication](./09-user-management-auth.md).

### Content Editor (Role Mapping)

In this document, **"content editor"** refers to any user with article/page editing capabilities:

- **Owner**: All content editing capabilities (always)
- **Admin**: Content editing capabilities (configurable by Owner)
- **Specific Author**: Can edit their own content (permission flags apply, see PRD 12)
- **Future Roles**: Custom roles with `article.create` or `article.edit` capabilities (e.g., Writer role)

### Content Creator (Role Mapping)

In this document, **"content creator"** refers to any user with article/page creation capabilities:

- **Owner**: Can create all content types (always)
- **Admin**: Can create articles, pages, products (configurable by Owner, MVP default: YES)
- **Future Roles**: Custom roles with `article.create` capability (e.g., Writer role - post-MVP)

**MVP Constraint**: In MVP, only **Owner** and **Admin** can create articles, pages, and products. These are trusted roles and do not require approval workflow. The approval workflow (Review status) is reserved for future roles like Writer.

### Administrator (Role Mapping)

In this document, **"administrator"** refers to:

- **Owner**: Super-admin with all capabilities
- **Admin**: Configurable capabilities set by Owner

### Member (Role Mapping)

In this document, **"Member"** refers to:

- Standard logged-in user
- Can view logged-in-only content
- Can post comments and reviews
- Limited Markdown in comments (no URLs, no external embeds)
- External images in comments flag for human review

## User Stories

### Content Creation
- As a content editor (Owner, Admin, or author), I want to create articles with a rich text editor so I can format my content professionally
- As a content editor, I want to save drafts so I can work on content over time
- As a content editor, I want to preview content before publishing so I can ensure it looks correct
- As an administrator (Owner, Admin), I want to schedule posts for future publication so I can plan content releases

### Content Organization
- As a content editor, I want to categorize articles so readers can find related content
- As a content editor, I want to add multiple tags to articles so content is discoverable
- As a content editor, I want to create custom pages with different layouts so I can create unique experiences
- As a content editor, I want to organize pages hierarchically so I can create site structure

### Media Management
- As a content editor, I want to upload images so I can illustrate my articles
- As a content editor, I want to organize media in folders so I can keep assets organized
- As a content editor, I want to edit image metadata (alt text, captions) so my content is accessible
- As a content editor, I want to reuse media across multiple articles so I don't duplicate uploads

## Functional Requirements

**Note on Products**: Product objects (detailed in [PRD 03: Ecommerce](./03-ecommerce.md)) inherit **all content management capabilities** described in this document. Products have:
- ✅ All article fields (title, slug, content, excerpt, featured image, etc.)
- ✅ All rich text editor features (formatting, media embedding, product embedding, Markdown)
- ✅ All publishing workflow statuses (Draft, Review, Scheduled, Published, Archived)
- ✅ All comment/review capabilities (products can receive both comments and reviews)
- ✅ All SEO fields and visibility controls
- **PLUS** commerce-specific features (price, SKU, stock, cart integration, purchase options)

This document describes content features for articles, but these apply equally to products unless otherwise noted.

### Articles/Posts

#### Core Fields
- **Title** (required): Article headline
- **Slug** (auto-generated, editable): URL-friendly identifier
- **Content** (required): Rich text content with HTML support
- **Excerpt**: Short summary for listings
- **Featured Image**: Main image for article
- **Author**: Content creator (user reference)
- **Status**: Draft, Scheduled, Published, Archived
- **Published Date**: Publication timestamp
- **Modified Date**: Last update timestamp
- **Categories**: One or more category assignments
- **Tags**: Flexible tagging for cross-categorization
- **SEO Fields**: Meta title, meta description, focus keyword

#### Rich Text Editor Features

**Content Format Support**:
- **Rich Text HTML** (primary): WYSIWYG editing with TipTap
- **Markdown** (alternative): Markdown syntax support with live preview
- **HTML Source** (Admin+): Direct HTML editing

**Formatting Options**:
- Text styling: Bold, italic, underline, strikethrough
- Headings: H1-H6
- Lists: Ordered and unordered, nested
- Links: Internal and external with title attributes
- Code blocks: Syntax-highlighted code snippets (with language selection)
- Tables: Basic table creation and editing
- Block quotes
- Horizontal rules

**Text Coloring — Design Constraint and Future Roadmap**:

> **Literal (hex/RGB) text colors are explicitly excluded from the editor.** The application uses a runtime theme system where all color values are CSS custom properties (`--color-foreground`, `--color-accent`, etc.) resolved at render time from the active palette. Inline `style="color: #xxxxxx"` attributes written by a color picker would bypass the theme system entirely, becoming permanently hardcoded to the palette that was active when the content was authored. After a theme change, such text can become illegible (e.g. near-white text on a light background).

- **MVP**: No text coloring tool in the editor. Authors use structural emphasis (bold, italic, headings, callout widgets) instead of color.
- **Future upgrade (post-MVP)**: Semantic text coloring — a color picker that stores Tailwind utility class names (`text-accent`, `text-muted`, `text-danger`) rather than hex values. The TipTap `TextStyle` + custom `Color` mark would store `class="text-accent"` on the span, which the theme system resolves correctly at render time regardless of which palette is active. This requires a custom mark extension and a palette-aware color picker UI that shows theme swatches, not a color wheel.

**Media Embedding**:

**Embedding Capabilities by Role**:
- **Admin/Owner**: All media types (internal, external videos, external images, social embeds)
- **Member (comments only)**: Internal images, external images (flagged for review)

**Media Types**:
- Internal images: From media library
- Internal videos: From media library
- **External images**: Direct image URLs (Members: flagged for human review)
- **External videos** (Admin/Owner only): YouTube embeds (via URL or embed code)
- **External social media** (Admin/Owner only): X (Twitter) post embeds (via URL or embed code)
- Other embeds (Admin/Owner only): Vimeo, SoundCloud, CodePen (via oEmbed or iframe)

**Image Layout Options**:

When embedding images (internal or external) in articles, pages, or product descriptions, the following layout options are available:

1. **Block (Full-Width)**:
   - Image spans full width of content container
   - Positioned between paragraphs
   - No text wrapping
   - Optimal for: Hero images, wide graphics, diagrams, charts
   - CSS: `display: block; width: 100%; margin: 1em 0;`

2. **Float (Corner-Anchored with Text Wrapping)**:
   - Image positioned within paragraph flow
   - Anchored to corner (top-left, top-right, bottom-left, bottom-right)
   - Text wraps around image (magazine-style)
   - Size: Small (25%), Medium (40%), Large (60%)
   - Optimal for: Portrait images, inline illustrations, callouts
   - CSS: `float: left|right; margin: 0.5em 1em; max-width: [size]%;`
   - Mobile behavior: Stacks vertically on screens < 640px

3. **Inline (Text-Level)**:
   - Image embedded within text line (icon-sized)
   - Flows with text
   - Optimal for: Icons, small graphics, emojis
   - CSS: `display: inline; vertical-align: middle; height: 1.2em;`

**Editor Interface for Image Insertion**:

```
┌──────────────────────────────────────────┐
│ Insert Image                              │
├──────────────────────────────────────────┤
│ Source:                                   │
│ ○ Media Library  ● External URL          │
│                                           │
│ Image URL: [https://example.com/img.jpg] │
│                                           │
│ Layout:                                   │
│ ● Block (Full-Width)                      │
│ ○ Float (Corner-Anchored)                │
│   ├─ Position: [Top-Left ▼]              │
│   └─ Size: [Medium ▼]                    │
│ ○ Inline (Icon-Sized)                    │
│                                           │
│ Alt Text: [Descriptive text]             │
│ Caption: [Optional caption]              │
│                                           │
│ [Cancel]  [Insert]                        │
└──────────────────────────────────────────┘
```

**Product Embedding** (All roles with article editing capability):
- **Product Cards**: Embed products as interactive widgets within articles/pages
- **Display Modes**:
  - **Card** (default): Featured image, title, price, rating, add-to-cart button
  - **Inline**: Compact single-line with icon, name, price, add-to-cart
  - **Grid**: Multiple products in responsive grid layout
- **Insertion Methods**:
  - TipTap visual picker: Insert → Product → Search/select
  - Shortcode: `[product id="uuid" display="card"]`
  - Markdown extension: `!product[Product Name](slug)`
- **Data Displayed**:
  - Featured image (thumbnail)
  - Product name (linked to product page)
  - Price (with sale price if applicable)
  - Star rating + review count
  - Stock status indicator
  - Add to Cart button (functional)
  - "View Details" link to full product page
- **Real-time Updates**: Stock status and price update dynamically
- **Visibility Respected**: Only shows products user has permission to view
- **See**: [PRD 03: Ecommerce](./03-ecommerce.md) for detailed product display modes

**Markdown Support**:
- **Admin/Owner**: Full Markdown with HTML, links, and external embeds (all capabilities)
- **Member** (comments/reviews): Limited Markdown with reactive moderation:
  - ✅ Formatting (bold, italic, lists, headings, code blocks)
  - ✅ **External image embeds** (triggers human review flag)
  - ❌ URL links (prevents spam/phishing)
  - ❌ External video/social embeds (security risk)
  - ❌ HTML tags (XSS prevention)
- Markdown renderer: CommonMark compliant with GFM (GitHub Flavored Markdown) extensions

**Security Restrictions by Role**:

**Admin/Owner**:
- ✅ Full HTML editing
- ✅ External embeds (YouTube, X, images, etc.)
- ✅ URL links in Markdown
- ✅ Inline scripts (sanitized)
- ✅ All image layout options (Block, Float, Inline)

**Member** (in comments/reviews):
- ✅ Markdown formatting (bold, italic, lists, headings)
- ✅ Code blocks (no script execution)
- ✅ **External image embeds** - Allowed with reactive moderation:
  - Image posts immediately
  - Comment flagged for human review (same as profanity detection)
  - Admin receives notification
  - Image displayed until reviewed
- ✅ Image layout options (Block, Float, Inline)
- ❌ URL links in Markdown (prevents spam/phishing)
- ❌ External video/social embeds (security risk)
- ❌ HTML tags (XSS prevention)

**Member External Image Flagging**:

When a Member embeds an external image in a comment/review:

```typescript
async function processCommentWithExternalImage(comment: Comment) {
  // Check if comment contains external image URL
  const hasExternalImage = detectExternalImageEmbed(comment.content)

  if (hasExternalImage) {
    // Flag for human review
    await prisma.comment.update({
      where: { id: comment.id },
      data: {
        flagged_for_review: true,
        flag_reason: 'external_image_embed'
      }
    })

    // Notify admin
    await notifyAdmin({
      type: 'comment_flagged',
      reason: 'External image embedded by Member',
      commentId: comment.id
    })

    // Log in audit trail
    await auditLog.create({
      action: 'comment_flagged_external_image',
      userId: comment.author_id,
      resourceType: 'comment',
      resourceId: comment.id
    })
  }

  // Comment still displays immediately (reactive moderation)
  return comment
}
```

#### Publishing Workflow

**Status Options**:

1. **Draft**: Work in progress, not visible to public
2. **Review**: Awaiting approval from Admin/Owner (reserved for future roles)
3. **Scheduled**: Set for future publication
4. **Published**: Live on site
5. **Archived**: Removed from active listings but accessible via URL

**Status Workflow by Role**:

**Owner/Admin (MVP)**:
- Create article → **Draft** → (optional: **Scheduled**) → **Published**
- **Review status not used** (Owner/Admin are trusted roles, no approval needed)
- Can transition directly from Draft to Published or Scheduled

**Future Roles (Post-MVP, e.g., Writer)**:
- Create article → **Draft** → Submit for **Review** → (Admin approves) → **Published**
- **Review status required** for untrusted roles
- Cannot publish without Admin/Owner approval
- Admin/Owner can send back to Draft with feedback

**Status Transition Rules (MVP)**:

```
Draft → Published        ✅ Owner, Admin
Draft → Scheduled        ✅ Owner, Admin
Draft → Review           ⏸️  Not used in MVP (for future roles)
Review → Published       ⏸️  Not used in MVP
Review → Draft           ⏸️  Not used in MVP
Published → Archived     ✅ Owner, Admin
Archived → Published     ✅ Owner, Admin
Scheduled → Published    🤖 Automatic (on scheduled datetime)
```

**Review Status Implementation Note**:

The **Review** status is implemented in the database schema and UI but **not actively used in MVP**. This allows for seamless addition of future roles (e.g., Writer) that require approval workflows without database migrations.

```typescript
// Database schema includes Review status
enum ArticleStatus {
  DRAFT
  REVIEW       // Reserved for future roles
  SCHEDULED
  PUBLISHED
  ARCHIVED
}

// MVP: Only Owner/Admin can create articles
// Owner/Admin skip Review status (trusted)
// Future: Writer role will use Review workflow
```

### Version History & Content Audit Trail

#### Scope

Version history applies to **Articles** and **Products** (description field). Pages are excluded until the page-builder phase. Phase 12 wires up both.

#### Article Version History

The `ArticleVersion` model is already in the database schema. It records a snapshot of the article content at each save:

| Field | Purpose |
|-------|---------|
| `version_number` | Auto-incrementing integer per article |
| `title`, `content`, `excerpt` | Full content snapshot |
| `change_summary` | Optional human-readable note (e.g. "Fixed typo in intro") |
| `created_by` | User who saved this version |
| `created_at` | Timestamp |

**Behavior**:
- A new version is created on every **publish** action. Drafts do not automatically version (avoids noise from in-progress editing).
- Admins and Owners can view the version list and diff any two versions in the backstage article editor.
- Restoring a prior version creates a new version entry (the restore itself is recorded); it does not overwrite history.
- Version history for articles is **on by default** for Phase 12.

#### Product Version History

The `ProductVersion` model does not yet exist in the schema (articles have it; products do not). Phase 12 adds a parallel model covering:

- `name`, `description`, `price`, `compare_at_price`, `stock_quantity`, `stock_status`, `sku`
- `change_summary`, `created_by`, `created_at`, `version_number`

A new product version is created when an admin saves a product in the backstage editor.

#### Content Audit Events (via AuditLog)

The following content management actions are written to `AuditLog` (see ecommerce PRD for schema):

| Event | `event_type` | Actor |
|-------|-------------|-------|
| Article published | `article.published` | Admin/Owner |
| Article unpublished / archived | `article.unpublished` | Admin/Owner |
| Article deleted (soft) | `article.deleted` | Admin/Owner |
| Product created | `product.created` | Admin/Owner |
| Product updated | `product.updated` | Admin/Owner |
| Product deleted (soft) | `product.deleted` | Admin/Owner |
| Comment approved / rejected | `comment.moderated` | Moderator |
| Media uploaded | `media.uploaded` | Admin/Owner |
| Media deleted | `media.deleted` | Admin/Owner |

These are complementary to version snapshots: the AuditLog records **who did what and when**; the version table records **what the content looked like**.

### Pages

*Phase 11. The `Page` DB model, backend service, and 7 API endpoints exist from Phase 3. Phase 11 wires up the frontend and page builder.*

#### Core Fields
- **Title** (required): Page name
- **Slug** (required): URL path off root domain — e.g. slug `about` → `/about`. Reserved slugs (`shop`, `latest`, `cart`, `checkout`, `account`, `admin`) are rejected.
- **Content**: Structured `PageContent` JSON envelope (see Zone Architecture below) — not a flat rich-text string
- **Layout**: Encoded inside the content envelope, not a separate DB column
- **Parent Page**: For hierarchical organization (schema exists; admin tree UI deferred)
- **Status**: Draft, Published
- **SEO Fields**: Meta title, meta description
- **Visibility**: Public, logged-in only, admin only (server-side gated)

#### Zone Architecture

Pages are composed of **layout zones**. Each zone is an independent TipTap JSON document — the same format used for article and product body content. Widgets (MediaCarousel, Callout, VideoEmbed, XEmbed, ArticleEmbed, ProductEmbed, RichTextBox) are embedded in zones as TipTap nodes, using the exact same mechanism as embedding widgets in articles.

The page editor in backstage is **N TipTap editor instances rendered side-by-side**, one per zone, laid out to match the published page structure. There is no separate block manager — each zone is one document, and the author edits it exactly as they edit an article body.

**Content storage:**
```typescript
interface PageContent {
  layout: 'no_sidebar' | 'sidebar_left' | 'sidebar_right' | 'split_comparison';
  zones: {
    main?:    TipTapDoc;  // no_sidebar, sidebar_left, sidebar_right
    sidebar?: TipTapDoc;  // sidebar_left, sidebar_right
    left?:    TipTapDoc;  // split_comparison
    right?:   TipTapDoc;  // split_comparison
  };
}
```

#### Page Layouts

| Layout | Zones | Desktop appearance |
|--------|-------|--------------------|
| `no_sidebar` | `main` only | Full-width single column |
| `sidebar_left` | `sidebar` + `main` | ~30% sidebar left, ~70% main right |
| `sidebar_right` | `main` + `sidebar` | ~70% main left, ~30% sidebar right |
| `split_comparison` | `left` + `right` | 50vw each, edge-to-edge, no gutter |

All layouts stack to a single column on mobile. `split_comparison` stacks left-then-right below 768px.

**Zone sizing and widgets:** The zone a widget lives in determines whether it renders in its large or small variant (see Widget System § Dual-Size Rendering). Sidebar zones always render small. Main zones always render large. Split-comparison zones render large on desktop (≥1024px) and small on mobile.

#### Split Comparison Layout

**Use cases**: before/after, feature comparison, dual-content presentations, free vs. premium plan, product A vs. product B.

```
Desktop (≥768px):
┌──────────────────────────┬──────────────────────────┐
│  Left Zone               │  Right Zone              │
│  (one TipTap editor)     │  (one TipTap editor)     │
│  Widgets: large @ lg:    │  Widgets: large @ lg:    │
│           small @ <lg    │           small @ <lg    │
└──────────────────────────┴──────────────────────────┘
←────────── 50vw ──────────→←────────── 50vw ──────────→

Mobile (<768px):
┌──────────────────────────┐
│  Left Zone  (full width) │
└──────────────────────────┘
┌──────────────────────────┐
│  Right Zone (full width) │
└──────────────────────────┘
```

**Cross-zone drag**: Moving a widget between zones (e.g. dragging from main into sidebar) requires extracting TipTap node JSON from one editor and inserting it into another — not a native drag operation. Phase 11 supports cut/paste between zones. Cross-zone drag is a future enhancement.

#### Conditional Widget Display

Any widget in any zone can carry a `show_when` condition set by the author:

| Value | Behavior |
|-------|----------|
| `always` (default) | Renders for all viewers |
| `logged_in` | Renders only when a user session exists |
| `logged_out` | Renders only when no session exists |

This enables dynamic page composition. Example: a "Sign in to order" Callout set to `logged_out` and an adjacent ProductEmbed set to `logged_in` — only the relevant widget renders for each viewer. The condition is set via a toggle in each widget's edit panel in the backstage editor. In the editor, all widgets render regardless of condition, but a **"Members only"** or **"Guests only"** badge is shown on the widget chrome.

**Note**: `show_when` is a client-side display convenience, not a server-side access control. The full page JSON (including hidden widgets) is delivered to the browser. Use `visibility: logged_in_only` on the Page itself for server-gated content.

#### Deferred: Landing Page Template

The Landing Page format — stacked full-viewport sections, per-section backgrounds, parallax scrolling, scroll-triggered animations — is a distinct editing paradigm from the zone/document model and is deferred to a future phase. Its full specification is preserved below for reference.

**Purpose**: Full-screen marketing landing page with parallax effects and animated backgrounds.

**Key Features**: Full-screen sections (100vh), parallax scrolling with fixed backgrounds, optional background morphing/animation on scroll, overlay text with scroll reveal, call-to-action buttons, optional no-header/footer mode.

**Animated Background Options**: Static image, morphing (transitions between images on scroll), gradient shift, particle effects, video background loop.

**Mobile**: Parallax disabled on mobile (performance), sections stack vertically, backgrounds become static.

**Deferred reason**: Requires a section-stack editor paradigm separate from the zone/TipTap model. Will be designed as a self-contained extension after the core zone infrastructure is stable, to avoid rework.

### Categories

#### Fields
- **Name** (required): Category display name
- **Slug** (auto-generated, editable): URL identifier
- **Description**: Category purpose/description
- **Parent Category**: For hierarchical categories
- **Featured Image**: Optional category image
- **Meta Fields**: For SEO

#### Functionality
- Hierarchical structure (parent/child)
- Display article count
- Category archive pages
- Per-category RSS feeds

### Tags

#### Fields
- **Name** (required): Tag display name
- **Slug** (auto-generated, editable): URL identifier
- **Description**: Tag description

#### Functionality
- Flat structure (no hierarchy)
- Tag archive pages
- Tag cloud widget
- Auto-suggestions when tagging

### Media Library

#### Supported Media Types
- **Images**: JPEG, PNG, GIF, WebP, SVG
- **Documents**: PDF
- **Video**: MP4, WebM (or embedded from YouTube/Vimeo)
- **Audio**: MP3, WAV

#### Media Management Features
- Upload: Single or bulk upload
- Organization: Folder/collection system
- Metadata: Title, alt text, caption, description
- Search: Find media by name or metadata
- Filtering: By type, date, author
- Image Editing: Basic crop, resize, compress
- CDN Integration: Automatic optimization and delivery

#### Storage Strategy
- Local filesystem for development
- S3-compatible storage for production
- Automatic thumbnail generation
- Multiple size variants (thumbnail, medium, large, original)
- Lazy loading for performance

### Comments & Reviews System

**Note**: For comprehensive details, see [PRD 09: User Management & Authentication](./09-user-management-auth.md)

#### Unified Comment System

**Reviews are a subtype of Comment**: A Comment becomes a Review when it has one or more associated `CommentRating` rows. The system uses two database tables:

- **`comments`**: One row per comment, regardless of type. Plain comments have no ratings; reviews have one or more.
- **`comment_ratings`**: One row per rating dimension, linked to a parent comment. The first and always-required dimension is `title: "Overall", value: 1–5`. Additional aspect-specific ratings (e.g. "Instruction Quality", "Value") can be added to the same comment in future.

This design allows the rating schema to extend without altering the Comment model.

#### Comment vs Review Distinction

| | Plain Comment | Review |
|---|---|---|
| `ratings` array | empty | one or more entries |
| `title` (headline) | null | optional string |
| `verified_purchase` | false | system-set true for product reviews |
| Nesting (replies) | ✅ | ❌ (reviews cannot be replies) |

#### Comments on Articles and Products

**Both articles and products can receive comments and reviews**:

- **Articles**: Any logged-in member can leave a plain comment or a review (no purchase required).
  - Default sort: Most Recent (newest first)

- **Products**: Any logged-in member can leave a plain comment. Only **verified purchasers** (members with a completed or processing order containing the product) can leave a review.
  - Default sort: Reviews First (by Overall rating descending), then plain comments by recency.

**One review per user per item** is enforced at the application layer. Members may leave multiple plain comments on the same item but only one rated comment (review). That review is fully editable.

#### Rating Scale

- **Scale**: 1–5 integer stored in `comment_ratings.value`
- **Default dimension**: `title: "Overall"` — always present as the first rating when a comment is a review
- **Future dimensions**: Additional aspect-specific ratings (same 1–5 scale) may be added to a review as extra `CommentRating` rows. The title is a free string set by the UI (e.g. "Instruction Quality", "Value for Money").
- **Average rating** (`average_rating` on Product): computed from approved "Overall" ratings on demand; rounded to one decimal place. `null` when no approved reviews exist.

#### Comment Capabilities by Role
- **Members**: Create, edit own, delete own comments/reviews. Can leave a review on any article; can leave a review on a product only if they have a verified purchase.
- **Admin/Owner**: Moderate (approve/reject/spam), edit any, delete any comments.
- **Guests**: Cannot comment or review. Can view comments/reviews if visibility allows.

#### Comment Visibility Controls

Each article and product can have comment visibility set to:
- **Disabled**: No comments allowed
- **Logged-in only**: Members and above can comment; only logged-in users can view
- **Public**: Members and above can comment; everyone (including Guests) can view

#### Comment Sorting

**Product comments** (applied in service after DB query):
1. Reviews (has ratings) before plain comments
2. Within reviews: by Overall rating descending
3. Within same rating tier: by recency descending

**Article comments**: Most Recent (newest first)

**User-Selectable Sort Options** (future UI):
- Most Recent (default for articles)
- Oldest First
- Highest Rated (reviews only, 5 stars first)
- Lowest Rated (reviews only, 1 star first)
- Reviews First (default for products)
- Most Helpful (based on upvotes — future feature)

#### Comment Moderation

**Reactive Moderation Strategy**: Comments are posted immediately, but AI flags problematic content for human review.

**Moderation Layers**:

1. **Profanity Filter (Client-Side Bleeping)**:
   - Uses `bad-words` npm package (free, local)
   - Profanity is **fully redacted on display** with complete character replacement (e.g., "****")
   - No hints given (no first letter visible)
   - Comment is still posted with original content
   - **Click-to-reveal**: Readers can click redacted words to see original text (self-uncensor)
   - Author sees their own comment unredacted
   - Admin/Owner always sees unredacted version

2. **AI Content Moderation (Background)**:
   - **OpenAI Moderation API** (completely free, no rate limits)
   - Runs asynchronously after comment is posted
   - Detects: hate speech, harassment, self-harm, sexual content, violence
   - Flags problematic comments for human review (does not auto-delete)
   - Admin receives notification of flagged comments

3. **Manual Moderation Queue**:
   - Optional approval queue (Admin/Owner configurable)
   - Status: Approved, Flagged, Rejected
   - Email notifications to authors/admins on new comments
   - Admin can approve, edit, or delete flagged comments

**Profanity Bleeping Implementation**:

```typescript
// Frontend display component
import Filter from 'bad-words'

function CommentDisplay({ comment, currentUser, isAdmin }) {
  const filter = new Filter()
  filter.replaceRegex = /\w/g // Replace ALL characters, not just after first

  // Determine if we should show unredacted
  const showUnredacted =
    isAdmin ||
    currentUser?.id === comment.author_id

  const displayContent = showUnredacted
    ? comment.content
    : filter.clean(comment.content) // Replaces ALL characters with asterisks

  // Make redacted words clickable (store original in data attribute)
  const interactiveContent = displayContent.replace(
    /\*+/g,
    (match, offset) => {
      const originalWord = getOriginalWord(comment.content, offset)
      return `<span class="profanity-redacted" data-original="${originalWord}" onclick="this.textContent = this.dataset.original">${match}</span>`
    }
  )

  return (
    <div className="comment">
      <div dangerouslySetInnerHTML={{ __html: interactiveContent }} />
      <span className="uncensor-hint">
        Click blurred words to reveal
      </span>
    </div>
  )
}
```

**AI Moderation Implementation**:

```typescript
// Backend: Async comment moderation job
async function moderateComment(commentId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId }
  })

  // Call OpenAI Moderation API (free)
  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({ input: comment.content })
  })

  const result = await response.json()
  const flagged = result.results[0].flagged

  if (flagged) {
    // Flag comment for review
    await prisma.comment.update({
      where: { id: commentId },
      data: {
        flagged_for_review: true,
        moderation_flags: result.results[0].categories,
        moderation_scores: result.results[0].category_scores
      }
    })

    // Notify admin
    await notifyAdmin({
      type: 'comment_flagged',
      commentId,
      flags: result.results[0].categories,
      severity: 'medium'
    })

    // Log in audit trail
    await auditLog.create({
      action: 'comment_flagged_by_ai',
      resourceType: 'comment',
      resourceId: commentId,
      metadata: {
        flags: result.results[0].categories,
        scores: result.results[0].category_scores
      }
    })
  }
}

// Trigger after comment creation
await queue.add('moderate-comment', { commentId: newComment.id })
```

**OpenAI Moderation Categories**:
- `hate`: Hateful content
- `hate/threatening`: Hateful with violence
- `harassment`: Harassment or bullying
- `harassment/threatening`: Harassment with violence
- `self-harm`: Self-harm content
- `sexual`: Sexual content
- `sexual/minors`: Sexual content involving minors
- `violence`: Violent content
- `violence/graphic`: Graphic violent content

**Cost**:
- **OpenAI Moderation API**: $0/month (completely free)
- **bad-words library**: Free (MIT licensed)
- **Total cost**: $0/month

**User Experience**:

**For readers**:
```
Comment: "This product is ******* amazing!"
         Click to reveal ↑
```

**After clicking**:
```
Comment: "This product is fucking amazing!"
         (Original text revealed)
```

**For admins** (always unredacted):
```
⚠️ Flagged by AI: harassment detected (confidence: 0.85)
Comment: "This product is fucking amazing!"
         (Admin always sees original text)
[Approve] [Edit] [Delete]
```

- Email notifications to authors on new comments
- Spam detection via AI moderation

### Content Visibility Controls

**Note**: For comprehensive details, see [PRD 09: User Management & Authentication](./09-user-management-auth.md)

#### Article Visibility Settings

Every article has a visibility setting:
- **Public** (Guest-visible): Default, visible to everyone
- **Logged-in only**: Requires login (Member role or above)
- **Admin only**: Only visible in admin interface

#### Page Visibility Settings

Pages have the same visibility options as articles:
- **Public**: Visible to all visitors
- **Logged-in only**: Requires authentication
- **Admin only**: Backend only

#### Use Cases
- **Public**: Blog posts, marketing pages, public content
- **Logged-in only**: Premium content, member-exclusive articles
- **Admin only**: Internal documentation, drafts, templates

## Non-Functional Requirements

### Performance
- Article list loading: < 500ms
- Rich text editor responsiveness: < 100ms keystroke latency
- Media upload: Support files up to 50MB
- Image optimization: Automatic compression and format conversion

### Scalability
- Support 10,000+ articles
- Support 50,000+ media items
- Efficient database queries with pagination
- Caching for published content

### Usability
- Auto-save drafts every 30 seconds
- Keyboard shortcuts for common actions
- Undo/redo functionality in editor
- Mobile-friendly admin interface

### SEO
- Clean, semantic URLs
- Automatic sitemap generation
- Canonical URLs
- Open Graph meta tags
- Schema.org markup
- RSS/Atom feeds

## Technical Specifications

### Database Schema (Conceptual)

```sql
-- Articles
articles {
  id: uuid PK
  title: varchar(255)
  slug: varchar(255) unique
  content: text
  excerpt: text
  featured_image_id: uuid FK
  author_id: uuid FK
  status: enum
  visibility: enum (public, logged_in_only, admin_only)
  comment_visibility: enum (disabled, logged_in_only, public)
  published_at: timestamp
  created_at: timestamp
  updated_at: timestamp
  seo_title: varchar(255)
  seo_description: varchar(500)
}

-- Pages
pages {
  id: uuid PK
  title: varchar(255)
  slug: varchar(255) unique
  content: text
  template: varchar(50)
  parent_id: uuid FK
  order: integer
  status: enum
  visibility: enum (public, logged_in_only, admin_only)
  comment_visibility: enum (disabled, logged_in_only, public)
  created_at: timestamp
  updated_at: timestamp
}

-- Comments (unified for articles and products)
comments {
  id: uuid PK
  type: enum (comment, review)
  content: text
  rating: integer (1-5, nullable, for reviews only)
  author_id: uuid FK
  article_id: uuid FK (nullable)
  product_id: uuid FK (nullable)
  status: enum (pending, approved, rejected)
  flagged_for_review: boolean @default(false)
  moderation_flags: jsonb (AI-detected issues)
  moderation_scores: jsonb (confidence scores)
  created_at: timestamp
  updated_at: timestamp
}

-- Categories
categories {
  id: uuid PK
  name: varchar(100)
  slug: varchar(100) unique
  description: text
  parent_id: uuid FK
  featured_image_id: uuid FK
  created_at: timestamp
}

-- Tags
tags {
  id: uuid PK
  name: varchar(100)
  slug: varchar(100) unique
  description: text
  created_at: timestamp
}

-- Media
media {
  id: uuid PK
  filename: varchar(255)
  original_filename: varchar(255)
  mime_type: varchar(100)
  size: bigint
  width: integer
  height: integer
  alt_text: varchar(255)
  caption: text
  uploaded_by: uuid FK
  created_at: timestamp
}

-- Junction tables
article_categories {
  article_id: uuid FK
  category_id: uuid FK
}

article_tags {
  article_id: uuid FK
  tag_id: uuid FK
}
```

### API Endpoints (RESTful)

```
# Articles
GET    /api/articles              # List articles (with filters)
GET    /api/articles/:id          # Get single article
POST   /api/articles              # Create article
PUT    /api/articles/:id          # Update article
DELETE /api/articles/:id          # Delete article

# Pages
GET    /api/pages                 # List pages
GET    /api/pages/:id             # Get single page
POST   /api/pages                 # Create page
PUT    /api/pages/:id             # Update page
DELETE /api/pages/:id             # Delete page

# Categories
GET    /api/categories            # List categories
POST   /api/categories            # Create category
PUT    /api/categories/:id        # Update category
DELETE /api/categories/:id        # Delete category

# Tags
GET    /api/tags                  # List tags
POST   /api/tags                  # Create tag
PUT    /api/tags/:id              # Update tag
DELETE /api/tags/:id              # Delete tag

# Media
GET    /api/media                 # List media
POST   /api/media                 # Upload media
GET    /api/media/:id             # Get media details
PUT    /api/media/:id             # Update media metadata
DELETE /api/media/:id             # Delete media

# Comments (on articles)
GET    /api/articles/:id/comments     # List comments for article
POST   /api/articles/:id/comments     # Create comment (Member+)
PUT    /api/comments/:id              # Update own comment
DELETE /api/comments/:id              # Delete own comment
PUT    /api/comments/:id/moderate     # Approve/reject (Admin+)
```

## User Interface Mockups

### Article Editor
```
┌─────────────────────────────────────────────────────┐
│ [Save Draft] [Preview] [Publish ▼]         [@Author]│
├─────────────────────────────────────────────────────┤
│ Title: [________________________________]           │
│                                                      │
│ ┌─────────────────────────────────────────────────┐│
│ │ B I U S | H1 H2 H3 | Link Image | ⋮            ││
│ ├─────────────────────────────────────────────────┤│
│ │                                                  ││
│ │  Article content here...                        ││
│ │                                                  ││
│ └─────────────────────────────────────────────────┘│
│                                                      │
│ Sidebar:                                            │
│ ├─ Categories: [x] Tech [ ] News                   │
│ ├─ Tags: [wordpress, cms, +Add]                    │
│ ├─ Featured Image: [Upload]                        │
│ └─ SEO: [Edit Meta]                                │
└─────────────────────────────────────────────────────┘
```

## Dependencies

- Rich text editor library (e.g., TipTap, Slate, or ProseMirror)
- Image processing library (Sharp for Node.js)
- Slug generation utility
- Markdown parser (if supporting Markdown)

## Open Questions

1. ~~Should we support Markdown in addition to rich text?~~ → **Answered**: YES - Full Markdown for Admin+, limited for Members in comments
2. ~~Should media library support external embeds (YouTube, X posts, etc.)?~~ → **Answered**: YES - Admin/Owner can embed YouTube videos and X posts
3. ~~Do we need revision history/version control for articles?~~ → **Answered**: YES - Optional, off by default, required for EULA/Privacy Policy (PRD 12)
4. ~~Should we implement a workflow with roles (editor/reviewer/publisher)?~~ → **Future**: Writer role documented for future implementation
5. ~~Do we want built-in commenting system for articles?~~ → **Answered**: YES - Implemented with review variants and AI moderation
6. ~~Should media library support external media sources (Unsplash, Pexels integration)?~~ → **Answered**: YES - Post-MVP feature, will be implemented eventually
7. ~~Should we implement automatic content suggestions or AI writing assistance?~~ → **Answered**: NO - Not planned for MVP or post-MVP

## Widget System (Phase 10+)

*Added 2026-06-04. Supersedes single-image `featured_image` handling described elsewhere in this document. Updated 2026-06-04 with dual-size system, conditional display, and nested embed protection (Phase 11).*

### Design Intent

All three content types — Articles, Products, and Pages — share a common widget library. A widget is a self-contained display module with a corresponding TipTap node extension. The same widget code renders in the hero zone (above content), inline inside TipTap body content in Articles and Products, and inside layout zones in Pages.

### Content Zones

| Zone type | Where | Widget size |
|-----------|-------|-------------|
| **Hero** | Above content body on Articles and Products | `media[]` array; rendered by `MediaGallery` |
| **Body** | Inside TipTap document on Articles and Products | Always **large** |
| **Page main** | Main zone of a sidebar or no-sidebar Page | Always **large** |
| **Page sidebar** | Sidebar zone of a sidebar Page | Always **small** |
| **Page split** | Left/right zone of a split-comparison Page | **large** on desktop (≥1024px), **small** on mobile |

### Dual-Size Rendering

Every widget renders in two sizes. The size is determined by context, not by a prop — a React `WidgetSizeContext` wraps each zone and all widget display components read from it via `useWidgetSize()`.

```
WidgetSize = 'large' | 'small'
```

| Widget | Large | Small |
|--------|-------|-------|
| `MediaGallery` | Full carousel, controls, dots, counter | Auto-rotating single image, no controls |
| `Callout` | Bordered card with background fill and full body text | Single-line pill: icon + first ~80 chars of text |
| `VideoEmbed` | `aspect-video` iframe, full container width | Static thumbnail with play overlay, opens URL in new tab |
| `XEmbed` | Full Twitter embed via `widgets.js` | Compact card: @handle, post text (via oEmbed), "View on X ↗" |
| `ArticleEmbed` | Featured image + category + title + first paragraph + "Read more" | 80×80 thumbnail + title + excerpt line |
| `ProductEmbed` | Image + name + price + rating + Add to Cart | 64×64 thumbnail + name + price + cart icon |
| `RichTextBox` | Prose content, full render | Same render; character-count warning if >300 chars |

**In the backstage editor**: widgets always render in large mode regardless of zone context, so the author can see full content while editing. A "Preview small widgets" toggle in the page builder switches all editors to render small mode.

### Conditional Display

Every widget node carries a `show_when` attribute controlling visibility for the current viewer:

| Value | Renders when |
|-------|-------------|
| `always` (default) | Always |
| `logged_in` | User has an active session |
| `logged_out` | No active session |

The check runs client-side via `useAuth()`. This is an experience design tool — not a security boundary. For access-controlled content, use `visibility: logged_in_only` on the Article or Page itself (server-side gated).

**Future values**: `verified_purchaser`, `role_admin`, capability-scoped conditions. The attribute and wrapper already support extension.

### Nested Embed Protection

When an `ArticleEmbed` or `ProductEmbed` widget renders a preview of an article or product, the embedded content's TipTap JSON is passed through `stripWidgetNodes()` before any text is extracted. This function recursively removes all widget-type nodes (`mediaCarousel`, `callout`, `videoEmbed`, `xEmbed`, `articleEmbed`, `productEmbed`, `image`) from the document tree, leaving only text blocks.

The display components then extract the first paragraph's plain text for the preview. Widget content inside an embedded article or product is **never rendered** — only text is shown. This prevents a MediaCarousel or XEmbed that appears early in an article from appearing inside the embed card.

### Media Normalization

**After Phase 10A**, Articles and Products share identical media data contract:

```typescript
interface MediaItem {
  id: string;
  url: string;
  order: number;
  is_primary: boolean;
  alt_text?: string | null;
}
```

Every content type API returns `media: MediaItem[]`. The `featured_image_url` convenience field (used by catalogue cards) is computed from `media[is_primary]`.

### Widget Inventory

| Widget | Phase | Status | Notes |
|--------|-------|--------|-------|
| `MediaGallery` | 10A | ✅ Live | Hero carousel + inline carousel node |
| `Callout` | 10B | ✅ Live | Info / warning / success / danger; non-atom node with `NodeViewContent` |
| `VideoEmbed` | 10B | ✅ Live | YouTube or Vimeo by URL; atom node |
| `XEmbed` | 10B | ✅ Live | Twitter `widgets.js` embed; atom node; small via oEmbed Route Handler |
| `MediaCarousel` | 10B | ✅ Live | Inline carousel separate from hero `MediaGallery` |
| `ArticleEmbed` | 11 | 📋 Planned | Article preview card; large + small; atom node with article picker |
| `ProductEmbed` | 11 | 📋 Planned | Product card with Add to Cart; large + small; atom node with product picker |
| `RichTextBox` | 11 | 📋 Planned | Styled text block; non-atom node with `NodeViewContent` |
| Article List | Future | ⏸ Deferred | Dynamic filtered feed; deferred until page infrastructure stable |
| Product Showcase | Future | ⏸ Deferred | Dynamic product grid; same reason |
| Table of Contents | Future | ⏸ Deferred | Auto-generated from headings |

## Success Metrics

- Article creation time < 5 minutes (for 500-word article)
- Media upload success rate > 99%
- Zero data loss on drafts (auto-save)
- Editor usability score > 8/10 in user testing
