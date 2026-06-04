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

### Pages

#### Core Fields
- **Title** (required): Page name
- **Slug** (required): URL path
- **Content** (required): Rich text content
- **Template**: Layout template selection
- **Parent Page**: For hierarchical organization
- **Order**: Sort order within parent
- **Status**: Draft, Published
- **SEO Fields**: Meta title, meta description

#### Page Templates

- **Default**: Standard content page with header, footer, and content area
- **Home**: Homepage with customizable widget sections and featured content
- **Landing Page**: Full-screen marketing-focused layout with parallax scrolling and animated backgrounds (see detailed spec below)
- **Split Comparison**: Full-screen width 50/50 split, edge-to-edge, no gutter (for side-by-side comparisons)
- **Article List**: Display filtered articles in grid or list view
- **Custom**: User-defined templates (advanced)

#### Landing Page Template (Detailed Specification)

**Purpose**: Full-screen marketing landing page with modern parallax effects and animated backgrounds for high-impact first impressions.

**Key Features**:
- Full-screen sections (100vh height)
- Parallax scrolling with fixed backgrounds
- Optional background morphing/animation on scroll
- Overlay text with smooth scroll reveal
- Call-to-action buttons
- No header/footer by default (optional)

**Visual Layout**:

```
┌─────────────────────────────────────────┐
│                                         │ ← Section 1 (100vh)
│         Hero Text (scrolls)             │
│     ┌─────────────────────┐            │
│     │  [Call to Action]   │            │
│     └─────────────────────────┘         │
│                                         │
│  Background: Fixed (parallax effect)    │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│                                         │ ← Section 2 (100vh)
│      More Content (scrolls)             │
│                                         │
│  Background: Fixed (different image)    │
│  Optional: Morphs/animates with scroll  │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│                                         │ ← Section 3 (100vh)
│      Final CTA Section                  │
│                                         │
│  Background: Solid color or gradient    │
└─────────────────────────────────────────┘
```

**Parallax Effect**:
- **Fixed Background**: Background image/video remains stationary while content scrolls over it
- **Scroll Rate Control**: Adjust background scroll speed (0 = fixed, 1 = normal, 0.5 = half speed)
- **Multiple Layers**: Foreground, midground, background layers with different scroll rates

**Animated Background Options**:

1. **Static**: Fixed image, no animation
2. **Morphing**: Background smoothly transitions between images/colors as user scrolls
3. **Gradient Shift**: Gradient colors shift based on scroll position
4. **Particle Effects**: Animated particles (stars, dots, geometric shapes) overlay background
5. **Video Background**: Full-screen video loop with optional parallax

**Content Editor Interface**:

```
┌──────────────────────────────────────────────┐
│ Page: Landing Page (Landing Page Template)  │
├──────────────────────────────────────────────┤
│                                              │
│ ┌─ Section 1 Settings ──────────────────┐   │
│ │ Height: [100vh ▼] (Full-screen)       │   │
│ │                                        │   │
│ │ Background Type:                       │   │
│ │ ● Image  ○ Video  ○ Gradient          │   │
│ │                                        │   │
│ │ Background Image: [Upload/Select]     │   │
│ │ Parallax Effect: ☑ Enabled            │   │
│ │ Scroll Speed: [0.5] (0=fixed, 1=normal)│   │
│ │                                        │   │
│ │ Background Animation:                  │   │
│ │ [None ▼] Static, Morph, Gradient Shift│   │
│ │                                        │   │
│ │ Text Overlay Color: [#ffffff] [Picker]│   │
│ │ Overlay Opacity: [0.3] (darkens bg)   │   │
│ └────────────────────────────────────────┘   │
│                                              │
│ ┌─ Section 1 Content ───────────────────┐   │
│ │ [Rich text editor for hero text]      │   │
│ │                                        │   │
│ │ Vertical Alignment: [Center ▼]        │   │
│ │ Horizontal Alignment: [Center ▼]      │   │
│ │                                        │   │
│ │ Call-to-Action Button:                │   │
│ │ Text: [Get Started]                   │   │
│ │ Link: [/signup]                        │   │
│ │ Style: [Primary ▼]                    │   │
│ └────────────────────────────────────────┘   │
│                                              │
│ [+ Add Section]                              │
│                                              │
│ [Preview] [Save] [Publish]                   │
└──────────────────────────────────────────────┘
```

**Technical Implementation**:

```css
/* Parallax section */
.landing-section {
  height: 100vh;
  position: relative;
  overflow: hidden;
}

/* Fixed background with parallax */
.landing-section-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background-size: cover;
  background-position: center;
  z-index: -1;
  transform: translateY(calc(var(--scroll-position) * -0.5)); /* Parallax effect */
}

/* Scrolling content over fixed bg */
.landing-section-content {
  position: relative;
  z-index: 1;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  text-align: center;
}
```

```javascript
// Parallax scroll effect
window.addEventListener('scroll', () => {
  const scrollPosition = window.pageYOffset
  document.querySelectorAll('.landing-section-bg').forEach((bg, index) => {
    const scrollRate = bg.dataset.scrollRate || 0.5
    bg.style.transform = `translateY(${scrollPosition * scrollRate}px)`
  })
})

// Morphing background animation
function morphBackground(element, images, scrollPosition) {
  const progress = (scrollPosition % 1000) / 1000 // 0 to 1
  const imageIndex = Math.floor(progress * images.length)
  element.style.backgroundImage = `url(${images[imageIndex]})`
}
```

**Mobile Responsive**:
- Parallax disabled on mobile (performance)
- Sections stack vertically
- Backgrounds become static
- Full-width content maintained

#### Page Layout System
- **Pane/Widget Support**: Ability to add content blocks
- **Pane Types**:
  - Article List (filtered by category/tag)
  - Featured Articles
  - Media Gallery
  - Custom HTML
  - Product Showcase (for ecommerce)
  - Newsletter Signup
  - Social Media Feed
- **Drag-and-Drop**: Visual arrangement of panes
- **Responsive Controls**: Desktop/mobile visibility options

#### Split Comparison Template (Full-Screen)

**Use Case**: Landing pages with side-by-side content comparison, before/after displays, feature comparisons, or dual-content presentations.

**Layout Specification**:
- **Full-screen width**: Edge-to-edge, no container margins
- **50/50 split**: Exactly half the viewport width for each side
- **No gutter**: Zero spacing between left and right panels
- **No margins**: Content extends to screen edges (left at 0, right at 100vw)
- **Vertical scroll**: Each side scrolls independently (optional) or together (default)
- **Responsive behavior**: Stacks vertically on mobile (< 768px)

**Visual Layout**:

```
┌─────────────────────────────────────────────────────────┐
│ Left Content Box          │ Right Content Box           │
│                           │                             │
│ - Rich text editor        │ - Rich text editor          │
│ - Images/media            │ - Images/media              │
│ - Product embeds          │ - Product embeds            │
│ - Custom HTML             │ - Custom HTML               │
│ - Background color/image  │ - Background color/image    │
│ - Text alignment          │ - Text alignment            │
│ - Padding control         │ - Padding control           │
│                           │                             │
│                           │                             │
│                           │                             │
│                           │                             │
└─────────────────────────────────────────────────────────┘
←─────────── 50vw ─────────→←─────────── 50vw ─────────→
```

**Mobile Responsive Layout** (< 768px):

```
┌───────────────────────────┐
│                           │
│   Left Content Box        │
│   (Full width)            │
│                           │
└───────────────────────────┘
┌───────────────────────────┐
│                           │
│   Right Content Box       │
│   (Full width)            │
│                           │
└───────────────────────────┘
```

**Content Editor Interface**:

```
┌──────────────────────────────────────────────┐
│ Page: Landing Page (Split Comparison)       │
├──────────────────────────────────────────────┤
│ Template: Split Comparison ▼                 │
│                                              │
│ ┌─ Left Panel Settings ──────────────────┐  │
│ │ Background Color: [#ffffff] [Picker]   │  │
│ │ Background Image: [Upload] [Select]    │  │
│ │ Text Color: [#000000] [Picker]         │  │
│ │ Padding: Top [40] Right [40] ...       │  │
│ │ Vertical Alignment: [Top/Middle/Bottom]│  │
│ └────────────────────────────────────────┘  │
│                                              │
│ ┌─ Left Content ─────────────────────────┐  │
│ │ [Rich text editor with full content]   │  │
│ │                                         │  │
│ └─────────────────────────────────────────┘  │
│                                              │
│ ┌─ Right Panel Settings ─────────────────┐  │
│ │ Background Color: [#f3f4f6] [Picker]   │  │
│ │ Background Image: [Upload] [Select]    │  │
│ │ Text Color: [#000000] [Picker]         │  │
│ │ Padding: Top [40] Right [40] ...       │  │
│ │ Vertical Alignment: [Top/Middle/Bottom]│  │
│ └────────────────────────────────────────┘  │
│                                              │
│ ┌─ Right Content ────────────────────────┐  │
│ │ [Rich text editor with full content]   │  │
│ │                                         │  │
│ └─────────────────────────────────────────┘  │
│                                              │
│ ☐ Enable independent scrolling (advanced)   │
│                                              │
│ [Preview] [Save Draft] [Publish]            │
└──────────────────────────────────────────────┘
```

**Technical Implementation**:

```css
/* Desktop layout */
.split-comparison-template {
  display: flex;
  width: 100vw;
  min-height: 100vh;
  margin: 0;
  padding: 0;
}

.split-panel-left,
.split-panel-right {
  width: 50vw;
  min-height: 100vh;
  padding: 40px; /* Configurable */
  box-sizing: border-box;
}

/* Mobile responsive */
@media (max-width: 767px) {
  .split-comparison-template {
    flex-direction: column;
  }

  .split-panel-left,
  .split-panel-right {
    width: 100vw;
    min-height: 50vh;
  }
}
```

**Example Use Cases**:

1. **Landing Page**: Product features on left, sign-up form on right
2. **Before/After**: Before image/description left, after right
3. **Comparison**: Free plan features left, premium plan right
4. **Dual Content**: Text content left, video/media right
5. **Split Hero**: Headline/CTA left, hero image right

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

*Added 2026-06-04. Supersedes single-image `featured_image` handling described elsewhere in this document.*

### Design Intent

All three content types — Articles, Products, and (eventually) Pages — share a common widget library. A widget is a self-contained display module with a corresponding admin form component. The same widget code renders in the hero zone (above content) and, after Phase 10B, inline inside TipTap body content.

### Two-Zone Model

| Zone | Description | Mechanism |
|------|-------------|-----------|
| **Hero** | Prominent media display above the content body | `media[]` array on the content type; rendered by `MediaGallery` widget |
| **Body** | Content inline — paragraphs, headings, embedded widgets | TipTap editor; inline widget nodes (Phase 10B) |

### Media Normalization

**Rationale**: Article previously used a direct FK (`featured_image_id`) for a single featured image. Product used a junction table (`ProductMedia` with `is_primary`) designed for a gallery. These are now unified.

**After Phase 10A**, both Article and Product use the same data contract:

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

**Schema change (Phase 10A)**:
- `ArticleMedia` gains `is_primary Boolean @default(false)`
- `Article.featured_image_id` is dropped (migration backfills junction rows)
- Both models become topologically identical for media

### MediaGallery Widget

The first shipped widget. Display behavior:

| `media.length` | Renders |
|----------------|---------|
| 0 | Empty state / "Add images" prompt |
| 1 | Static image — identical to current design, no carousel chrome |
| N > 1 | Carousel with dot indicators, prev/next arrows, keyboard navigation |

Used in:
- Article detail page hero slot (`aspect-video` ratio)
- Product detail page hero slot (`aspect-square` ratio)
- Inline in TipTap body content (Phase 10B)

**Admin form counterpart**: `MediaGalleryField` — replaces the current single-image `ImageField` in both `ArticleForm` and `ProductForm`. Supports pick from library, upload, drag-to-reorder, set-primary, remove.

### Planned Future Widgets

| Widget | Phase | Description |
|--------|-------|-------------|
| `MediaGallery` | 10A | Hero carousel + inline carousel |
| `Callout` | 10B | Info / warning / success / danger callout box |
| `VideoEmbed` | 10B | YouTube or Vimeo embed by URL |
| Product Card | Future | Inline shop item embed within an article |
| Table of Contents | Future | Auto-generated from headings |

### Pages (Deferred)

Pages are architecturally distinct from Articles and Products. They are intended to be composed entirely from widgets, with no conventional content body. Their media handling and widget integration will be designed as part of the Page Builder phase. Pages are excluded from Phase 10.

## Success Metrics

- Article creation time < 5 minutes (for 500-word article)
- Media upload success rate > 99%
- Zero data loss on drafts (auto-save)
- Editor usability score > 8/10 in user testing
