# PRD 01: Content Management

**Version:** 1.0
**Date:** 2026-01-27
**Status:** Draft
**Parent:** [Master PRD](./00-master-prd.md)

## Overview

The Content Management module is the core of AECMS, enabling users to create, organize, and publish articles, pages, and media content.

## User Stories

### Content Creation
- As a content editor, I want to create articles with a rich text editor so I can format my content professionally
- As a content editor, I want to save drafts so I can work on content over time
- As a content editor, I want to preview content before publishing so I can ensure it looks correct
- As an administrator, I want to schedule posts for future publication so I can plan content releases

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

**Media Embedding** (Admin and Owner only):
- Internal images: From media library
- Internal videos: From media library
- **External videos**: YouTube embeds (via URL or embed code)
- **External social media**: X (Twitter) post embeds (via URL or embed code)
- Other embeds: Vimeo, SoundCloud, CodePen (via oEmbed or iframe)

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
- Admin/Owner: Full Markdown with HTML, links, and external embeds
- Member (comments/reviews): Limited Markdown - formatting only, NO URLs, NO external embeds
- Markdown renderer: CommonMark compliant with GFM (GitHub Flavored Markdown) extensions

**Security Restrictions by Role**:
- **Admin/Owner**:
  - ✅ Full HTML editing
  - ✅ External embeds (YouTube, X, etc.)
  - ✅ URL links in Markdown
  - ✅ Inline scripts (sanitized)

- **Member** (in comments/reviews):
  - ✅ Markdown formatting (bold, italic, lists, headings)
  - ✅ Code blocks (no script execution)
  - ❌ URLs in Markdown (prevents spam/phishing)
  - ❌ External embeds (security risk)
  - ❌ HTML tags (XSS prevention)
  - ❌ Image embeds (use text only)

#### Publishing Workflow
1. **Draft**: Work in progress, not visible to public
2. **Review** (optional): Awaiting approval
3. **Scheduled**: Set for future publication
4. **Published**: Live on site
5. **Archived**: Removed from active listings but accessible via URL

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
- **Default**: Standard content page
- **Home**: Homepage with customizable sections
- **Landing Page**: Marketing-focused layout
- **Split Comparison**: Full-screen width 50/50 split, edge-to-edge, no gutter
- **Article List**: Display filtered articles
- **Custom**: User-defined templates

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

#### Comment Types
- **Standard Comments**: General feedback on articles
- **Reviews**: Product reviews with optional star ratings (1-5 stars)

#### Comment Capabilities by Role
- **Members**: Create, edit, delete own comments/reviews
- **Admin/Owner**: Moderate (approve/reject), edit, delete any comments
- **Guests**: Cannot comment, can view (if visibility allows)

#### Comment Visibility Controls

Each article can have comment visibility set to:
- **Disabled**: No comments allowed
- **Logged-in only**: Members and above can comment, only logged-in users can view
- **Public**: Members and above can comment, everyone (including Guests) can view

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
7. Should we implement automatic content suggestions or AI writing assistance? → **Open** (Post-MVP consideration)

## Success Metrics

- Article creation time < 5 minutes (for 500-word article)
- Media upload success rate > 99%
- Zero data loss on drafts (auto-save)
- Editor usability score > 8/10 in user testing
