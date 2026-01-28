# PRD 02: User Interface & Experience

**Version:** 1.1
**Date:** 2026-01-28
**Status:** Draft
**Parent:** [Master PRD](./00-master-prd.md)

## Overview

This document defines the user interface requirements for both the public-facing website and the administrative dashboard of AECMS.

## User Personas

### Content Editor
- Creates and manages articles, pages, and media
- Moderate technical proficiency
- Primary admin panel user
- Needs efficient workflows

### Administrator
- Manages users, settings, and system configuration
- Higher technical proficiency
- Oversees all aspects of the CMS
- Needs comprehensive control

### Site Visitor
- Browses articles and pages
- Varied technical proficiency
- Expects fast, mobile-friendly experience
- Needs clear navigation and search

### Customer
- Browses products and makes purchases
- Varied technical proficiency
- Expects secure, trustworthy checkout
- Needs order tracking and account management

## Public-Facing Website

### Navigation
- **Header**:
  - Logo/site title (linked to home)
  - Primary navigation menu (configurable)
  - Search bar
  - Shopping cart icon (with item count)
  - User account dropdown (when logged in)
- **Footer**:
  - Secondary navigation links
  - Social media links
  - Copyright and legal links
  - Newsletter signup

### Homepage
- Hero section (customizable)
- Featured articles/content panes
- Product showcases
- Call-to-action sections
- Recent articles feed
- Responsive grid layout

### Article Pages
- Article title and metadata (author, date, categories)
- Featured image
- Rich content with proper typography
- Related articles section
- Social sharing buttons
- Comments section (optional)
- Table of contents for long articles

### Article Listing Pages
- Grid or list view toggle
- Filtering by category/tag
- Sorting options (date, title, popularity)
- Pagination or infinite scroll
- Search functionality
- Sidebar with categories and tag cloud

### Static Pages (Robust Page Builder)

**Strategic Approach**: The owner's site will be **primarily composed of customized static pages** using these page builder capabilities. Auto-generated `/articles` and `/products` pages provide comprehensive listings and search functionality for visitors who want to browse beyond the curated static pages.

#### Static Page Building Blocks

Static pages support rich, customizable layouts with **block-based content embedding** in all columns.

**Available Content Blocks (All Page Templates)**:

1. **Article Embeds**:
   - Single article card with thumbnail, title, excerpt, date
   - Clickable to full article page
   - Similar to product embed cards

2. **Product Embeds**:
   - Same embeddable product tiles as used in articles (PRD 01)
   - Display modes: Card (default), Inline, Grid
   - Functional "Add to Cart" button
   - Real-time price and stock updates

3. **Article Carousels**:
   - Horizontal scrolling carousel of article cards
   - Auto-play option (configurable)
   - Navigation arrows and dots
   - Filter by category/tag

4. **Product Carousels**:
   - Horizontal scrolling carousel of product cards
   - Auto-play option
   - Navigation arrows
   - Filter by category/tag

5. **Media Items**:
   - Image embeds (from media library or external URL)
   - Video embeds (uploaded or external YouTube/Vimeo)
   - YouTube embeds (direct)
   - Social media embeds (X/Twitter posts)
   - Layout options: Block (full-width), Float (corner-anchored), Inline

6. **Callouts / Call-to-Action (CTA)**:
   - Styled content boxes with title, description, button
   - Color schemes: Primary, Secondary, Success, Warning, Info
   - Button with customizable text and link
   - Optional icon

7. **Rich Text Block**:
   - Full TipTap editor capabilities
   - Headings, paragraphs, lists, formatting
   - Embed products/images inline within text

8. **Custom HTML Block** (Admin/Owner only):
   - Raw HTML/CSS for advanced customization

#### Two-Column Layout (Content + Sidebar)

**Main Content Column**:
- All content blocks available (see list above)
- Blocks stack vertically in single column
- Full-width of content area
- Drag-and-drop reordering

**Sidebar Column** (Left or Right):
- All content blocks available (same as main column)
- Optimized sizing for narrower column:
  - Article previews: Compact cards (thumbnail + title + date)
  - Product previews: Same embeddable tiles (card mode, scaled to sidebar width)
  - Images: Scaled to sidebar width
  - Small callouts: Compact CTA boxes
- Blocks stack vertically
- Drag-and-drop reordering

**Block Layout Visual**:

```
┌─────────────────────────────────────────────────┐
│ Header / Navigation                              │
├──────────────────────────────┬──────────────────┤
│ Main Content Column          │ Sidebar          │
│                              │                  │
│ [Article Carousel Block]     │ [Article Preview]│
│ ┌─────┐ ┌─────┐ ┌─────┐    │ [Article Preview]│
│ │Art 1│ │Art 2│ │Art 3│    │ [Article Preview]│
│ └─────┘ └─────┘ └─────┘    │                  │
│                              │ [Product Preview]│
│ [Rich Text Block]            │ ┌──────┐        │
│ Lorem ipsum dolor sit...     │ │ Img  │        │
│                              │ │$39.99│        │
│ [Product Embed Grid]         │ └──────┘        │
│ ┌────┐ ┌────┐ ┌────┐       │                  │
│ │Pr 1│ │Pr 2│ │Pr 3│       │ [CTA Callout]    │
│ └────┘ └────┘ └────┘       │ ┌──────────────┐ │
│                              │ │ Sign Up Now! │ │
│ [Image Block - Full Width]   │ │ [Button]     │ │
│ ┌──────────────────────┐    │ └──────────────┘ │
│ │  Feature Image       │    │                  │
│ └──────────────────────┘    │                  │
│                              │                  │
│ [CTA Block]                  │                  │
│ ┌─────────────────────┐     │                  │
│ │ Get Started Today!  │     │                  │
│ │ [Sign Up Button]    │     │                  │
│ └─────────────────────┘     │                  │
└──────────────────────────────┴──────────────────┘
│ Footer                                           │
└─────────────────────────────────────────────────┘
```

#### Other Layout Options

All layout templates (Full-Width, Split Comparison, Grid, Landing Page) support the same content blocks:

- **Full-Width**: Single column with all blocks, full content width
- **Split Comparison**: Left and right panes each support all blocks
- **Grid Layout**: Multiple columns, each column supports all blocks
- **Landing Page**: Full-screen sections, each section supports all blocks

#### Page Builder Interface

```
┌──────────────────────────────────────────────┐
│ Page: Homepage (Two-Column Layout)          │
├──────────────────────────────────────────────┤
│ Template: [Two-Column - Sidebar Right ▼]    │
│                                              │
│ ┌─ Main Content Column ──────────────────┐  │
│ │                                         │  │
│ │ [+ Add Block ▼]                         │  │
│ │   Article Carousel                      │  │
│ │   Product Carousel                      │  │
│ │   Article Embed                         │  │
│ │   Product Embed                         │  │
│ │   Image                                 │  │
│ │   Video                                 │  │
│ │   YouTube Embed                         │  │
│ │   Social Media Embed                    │  │
│ │   Callout / CTA                         │  │
│ │   Rich Text                             │  │
│ │   Custom HTML                           │  │
│ │                                         │  │
│ │ ── Block 1: Article Carousel ──         │  │
│ │    Filter: [Technology ▼]              │  │
│ │    Items: [5]  Auto-play: ☑            │  │
│ │    [↑ Move Up] [↓ Move Down] [✕ Delete]│  │
│ │                                         │  │
│ │ ── Block 2: Rich Text ──                │  │
│ │    [TipTap Editor Content...]           │  │
│ │    [↑ Move Up] [↓ Move Down] [✕ Delete]│  │
│ │                                         │  │
│ │ [+ Add Block]                           │  │
│ └─────────────────────────────────────────┘  │
│                                              │
│ ┌─ Sidebar Column ────────────────────────┐  │
│ │                                         │  │
│ │ [+ Add Block ▼]                         │  │
│ │                                         │  │
│ │ ── Block 1: Article Preview ──          │  │
│ │    Article: [Select Article]           │  │
│ │    [↑ Move Up] [↓ Move Down] [✕ Delete]│  │
│ │                                         │  │
│ │ ── Block 2: Product Preview ──          │  │
│ │    Product: [Select Product]           │  │
│ │    Display: [Card ▼]                   │  │
│ │    [↑ Move Up] [↓ Move Down] [✕ Delete]│  │
│ │                                         │  │
│ │ [+ Add Block]                           │  │
│ └─────────────────────────────────────────┘  │
│                                              │
│ [Preview] [Save Draft] [Publish]            │
└──────────────────────────────────────────────┘
```

#### Auto-Generated Pages

Beyond the customized static pages, AECMS provides two auto-generated pages:

1. **`/articles`**: Comprehensive article listing
   - Grid or list view
   - Filter by category/tag
   - Sort by date, title, popularity
   - Pagination
   - Search

2. **`/products`**: Product catalog
   - Grid or list view
   - Filter by category, price, availability
   - Sort by price, popularity, newest
   - Pagination
   - Search

These provide visitors with browsing and search capabilities beyond the curated static page experience.

### Search
- Global search bar in header
- Search results page with filters
- Search for articles, pages, and products
- Auto-complete suggestions

### Responsive Design
- Mobile-first approach
- Breakpoints: Mobile (< 640px), Tablet (640-1024px), Desktop (> 1024px)
- Touch-friendly interactions on mobile
- Optimized images for different screen sizes

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader friendly
- Proper heading hierarchy
- Alt text for images
- Sufficient color contrast

## Administrative Dashboard

### Dashboard Home
- Welcome message with user name
- Quick stats:
  - Total articles, pages, products
  - Recent orders
  - Traffic overview
  - Pending tasks
- Quick actions:
  - New Article
  - New Page
  - New Product
- Recent activity feed

### Main Navigation
Left sidebar with collapsible sections:
- **Dashboard** (home icon)
- **Content**
  - Articles
  - Pages
  - Media Library
  - Categories
  - Tags
- **Ecommerce**
  - Products
  - Orders
  - Customers (filtered user view - see spec below)
  - Inventory
- **Users**
  - All Users
  - Add New
  - Roles & Permissions
- **Settings**
  - General
  - Site Identity
  - Navigation Menus
  - Payment Settings
  - Email Settings (SMTP configuration - see spec below)
- **User Profile** (bottom)
  - Account Settings
  - Logout

#### "Customers" Link Specification

**Purpose**: The "Customers" link in the admin sidebar navigates to the **same User Management interface** as "All Users", but **pre-filtered** to show only customers.

**Customer Definition** ✅ **CONFIRMED APPROACH**:

A "customer" is **any user with at least one completed order** (`payment_status = 'paid'`).

**Implementation**: Dynamic Filter (no database schema changes required)

**Key Characteristics**:
- ✅ **Accurate**: Only includes users who actually purchased
- ✅ **Self-maintaining**: Updates automatically as orders complete
- ✅ **No schema changes**: No `is_customer` flag needed
- ✅ **Includes guest purchases**: Links guest orders by email
- ✅ **Excludes abandoned carts**: Users who added items but never purchased are not counted
- ✅ **Performance**: Acceptable for low-traffic sites (query can be cached)

**Database Query**:
```sql
SELECT DISTINCT users.* FROM users
JOIN orders ON orders.customer_id = users.id OR orders.customer_email = users.email
WHERE orders.payment_status = 'paid'
```

**Implementation**:

```typescript
// Backend: Customer service
async function getCustomers() {
  return await prisma.user.findMany({
    where: {
      OR: [
        // Users with completed orders
        { orders: { some: { payment_status: 'paid' } } },
        // Guest purchases linked by email that later created account
        { email: { in: await getGuestPurchaseEmails() } }
      ]
    },
    include: {
      orders: {
        where: { payment_status: 'paid' },
        select: {
          id: true,
          order_number: true,
          total: true,
          created_at: true
        }
      }
    },
    orderBy: { created_at: 'desc' }
  })
}

// Frontend: Admin UI
// "Customers" link routes to /admin/users?filter=customers
// Same User Management interface, pre-filtered
```

**Customer View Enhancements**:

When viewing customers (vs all users), show ecommerce-specific info:
- Total order count
- Total lifetime value (sum of all order totals)
- First purchase date
- Last purchase date
- Average order value

**Alternatives Considered** (but not chosen):

1. **Permanent Boolean Flag** (`is_customer` column): Rejected due to schema changes, maintenance overhead, and inability to handle guest-to-member conversions seamlessly.

2. **Cart Activity Flag** (`has_cart_activity` column): Rejected because it includes window shoppers who never purchased, inflating customer count with non-customers.

The dynamic filter approach was chosen for its accuracy, zero maintenance, and self-updating behavior.

---

#### Email Settings (SMTP Configuration)

Email settings must support SMTP configuration for various system functions:

**Email Use Cases**:
1. **Content Moderation**: Notify Admin of flagged comments/reviews
2. **Shop Support**: Order confirmations, shipping notifications, refund notifications
3. **Send to Kindle**: eBook delivery origin address
4. **User Management**: Password resets, account verification, welcome emails
5. **System Notifications**: Low stock alerts, system errors (to Admin)

**SMTP Configuration Interface**:

```
┌──────────────────────────────────────────────┐
│ Email Settings                                │
├──────────────────────────────────────────────┤
│ SMTP Configuration                            │
│                                              │
│ SMTP Host: [smtp.example.com]               │
│ SMTP Port: [587] ▼ (25, 465, 587, 2525)    │
│ Security: [TLS ▼] (None, SSL, TLS, STARTTLS)│
│ Username: [user@example.com]                 │
│ Password: [••••••••••]                       │
│                                              │
│ From Address: [noreply@example.com]         │
│ From Name: [AECMS Store]                     │
│                                              │
│ [Test Email Configuration]                   │
│ Send test email to: [admin@example.com]     │
│                                              │
│ ── Email Templates ──                        │
│ ☑ Order Confirmation                         │
│ ☑ Shipping Notification                     │
│ ☑ Refund Notification                       │
│ ☑ Comment Flagged (Admin)                   │
│ ☑ Password Reset                            │
│ ☑ Account Verification                      │
│ ☑ Low Stock Alert (Admin)                   │
│                                              │
│ Send to Kindle Settings:                     │
│ Kindle From Address: [kindle@example.com]   │
│ (Must be approved in Amazon "Approved         │
│  Personal Document Email List")              │
│                                              │
│ [Save Settings]                              │
└──────────────────────────────────────────────┘
```

**SMTP Providers Supported**:
- Gmail SMTP
- AWS SES (recommended for Send to Kindle, ~$0.10/1,000 emails)
- SendGrid
- Mailgun
- Postmark
- Custom SMTP server

**Environment Variables**:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=user@example.com
SMTP_PASS=app-specific-password
SMTP_FROM_ADDRESS=noreply@example.com
SMTP_FROM_NAME=AECMS Store

# Send to Kindle (AWS SES recommended)
KINDLE_SMTP_HOST=email-smtp.us-east-1.amazonaws.com
KINDLE_SMTP_USER=AKIAIOSFODNN7EXAMPLE
KINDLE_SMTP_PASS=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
KINDLE_FROM_ADDRESS=kindle@example.com
```

**Note**: Email configuration is detailed in [PRD 05: Security & Compliance](./05-security.md) for security considerations and [PRD 11: Digital Products - eBooks](./11-digital-products-ebooks.md) for Send to Kindle implementation.

### Content Management Interface

#### Article List View
```
┌─────────────────────────────────────────────────────┐
│ Articles                              [+ New Article]│
├─────────────────────────────────────────────────────┤
│ [All (234)] [Published (198)] [Draft (36)]          │
│ [Search...] [Filter by Category ▼] [Filter by Tag ▼]│
├─────────────────────────────────────────────────────┤
│ □ Title              Author    Categories   Status  │
├─────────────────────────────────────────────────────┤
│ □ Getting Started... John Doe  Tech        Published│
│ □ New Features in... Jane Smith News       Draft    │
│ □ How to Build...    John Doe  Tutorial    Published│
│                                                      │
│                              [← 1 2 3 ... 10 →]     │
└─────────────────────────────────────────────────────┘
```

#### Article Editor
- Full-screen or side-by-side preview mode
- Floating toolbar for formatting
- Right sidebar for metadata:
  - Status and visibility
  - Publish/schedule controls
  - Categories and tags
  - Featured image
  - SEO settings
  - Custom fields (extensible)
- Auto-save indicator
- Revision history (if implemented)

#### Media Library
```
┌─────────────────────────────────────────────────────┐
│ Media Library                           [↑ Upload]  │
├─────────────────────────────────────────────────────┤
│ [All (1,234)] [Images] [Documents] [Videos]         │
│ [Search...] [Filter by Date ▼]                      │
├─────────────────────────────────────────────────────┤
│ [Grid ⊞] [List ☰]                 Sort: Date Desc ▼ │
├─────────────────────────────────────────────────────┤
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐           │
│ │ IMG │ │ IMG │ │ IMG │ │ IMG │ │ IMG │           │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘           │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐           │
│ │ IMG │ │ IMG │ │ IMG │ │ IMG │ │ IMG │           │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘           │
│                                                      │
│                              [← 1 2 3 ... 24 →]     │
└─────────────────────────────────────────────────────┘
```

On click: Modal with media details, edit options, and use/insert button

### Page Builder

#### Visual Page Editor
- Drag-and-drop interface for adding panes/widgets
- Live preview of changes
- Component library:
  - Text block
  - Image
  - Video embed
  - Article list
  - Product grid
  - Call-to-action
  - Custom HTML
- Responsive preview (desktop/tablet/mobile)
- Template selection
- Layout options:
  - **1 Column**: Full-width content
  - **2 Column**: Content with sidebar (left or right)
  - **Split Comparison**: Full-screen 50/50 split, edge-to-edge, no gutter
  - **Grid**: Multi-column grid layout
  - **Custom**: User-defined layout

### Settings Interface

#### General Settings
- Site title and tagline
- Timezone
- Date and time format
- Site language
- Homepage settings (static page or latest articles)

#### Site Identity
- Logo upload
- Favicon upload
- Brand colors
- Typography settings

#### Navigation Menus
- Create and manage multiple menus
- Drag-and-drop menu builder
- Add pages, articles, categories, custom links
- Nested menu support

## Design System

### Color Palette

**Admin Panel (Dark Mode Only):**
- **Theme**: Dark mode exclusively (no light mode option)
- **Primary**: Blue (#3b82f6)
- **Secondary**: Slate gray (#64748b)
- **Success**: Green (#10b981)
- **Warning**: Amber (#f59e0b)
- **Error**: Red (#ef4444)
- **Background**: Dark slate (#0f172a)
- **Surface**: Darker slate (#1e293b)
- **Text Primary**: White (#ffffff)
- **Text Secondary**: Slate gray (#94a3b8)
- **Border**: Slate gray (#334155)

**Public Site:**
- Single default theme in MVP
- Owner-selectable preset themes (post-MVP)
- No light/dark mode toggle for end users
- Theme determined by owner selection

### Typography
**Admin Panel:**
- Font: Inter or system font stack
- Headings: 600-700 weight
- Body: 400 weight
- Code: Monospace font

**Public Site:**
- Customizable via settings
- Default: System font stack for performance

### Spacing
- Base unit: 4px
- Scale: 4, 8, 12, 16, 24, 32, 48, 64px

### Components

#### Buttons
- Primary: Solid background, high contrast
- Secondary: Outline style
- Tertiary: Text only
- States: Default, hover, active, disabled
- Sizes: Small, medium, large

#### Forms
- Consistent input styling
- Clear labels and placeholders
- Inline validation
- Error messages
- Help text
- Required field indicators

#### Modals
- Centered overlay
- Close button (X in corner)
- Confirm/Cancel actions
- Keyboard support (ESC to close)

#### Toast Notifications
- Top-right positioning
- Auto-dismiss (5 seconds default)
- Success, error, warning, info variants
- Action buttons (optional)

#### Data Tables
- Sortable columns
- Filterable data
- Bulk actions
- Row actions (edit, delete, etc.)
- Pagination
- Responsive (scroll or cards on mobile)

## User Flows

### Creating an Article
1. Navigate to Content > Articles
2. Click "New Article"
3. Enter title (slug auto-generates)
4. Write content in rich text editor
5. **Add media items to content**:
   - **Block media items**: Insert images/videos between paragraphs (full-width)
   - **Corner-float media items**: Insert images inside paragraphs with corner anchor selection
     - Choose anchor position: top-left, top-right, bottom-left, bottom-right
     - Select size: Small (25%), Medium (40%), Large (60%)
     - Text wraps around image (magazine-style layout)
   - **Inline media items**: Insert icon-sized images within text lines
6. Add featured image from media library
7. Select categories and add tags
8. Configure SEO settings
9. Preview article
10. Save as draft or publish

### Managing Media
1. Navigate to Media Library
2. Upload images (drag-and-drop or file picker)
3. Edit metadata for uploaded images
4. Search for existing images
5. Insert images into articles

### Building a Custom Page
1. Navigate to Content > Pages
2. Click "New Page"
3. Select template or use page builder
4. Add content panes/widgets
5. Arrange layout with drag-and-drop
6. Configure page settings (slug, parent, etc.)
7. Preview page
8. Publish

## Non-Functional Requirements

### Performance
- Initial page load: < 2 seconds
- Time to interactive: < 3 seconds
- Dashboard navigation: < 200ms
- Smooth animations (60fps)

### Browser Support
- Chrome (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Edge (last 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

### Responsive Breakpoints
- Mobile: 320px - 639px
- Tablet: 640px - 1023px
- Desktop: 1024px+
- Large Desktop: 1440px+

### Loading States
- Skeleton screens for content loading
- Spinners for button actions
- Progress bars for uploads
- Optimistic updates where appropriate

## Dependencies

- UI component library (e.g., Radix UI, Headless UI, or custom)
- CSS framework/solution (Tailwind CSS recommended)
- Rich text editor (TipTap recommended)
- Drag-and-drop library (dnd-kit recommended)
- Form management (React Hook Form recommended)
- Icons (Heroicons or Lucide)

## Open Questions & Answers

### Answered Questions ✅

1. ~~Do we want a dark mode for the admin panel?~~ → **YES - Dark mode only!** Admin panel will use dark theme exclusively (no light mode toggle).

2. ~~Should we support custom themes for the public site?~~ → **YES - Owner-selectable preset themes (Post-MVP)**
   - **MVP**: Single pre-built theme (no selection)
   - **Post-MVP**: Owner can select from a set of preset themes via admin settings
   - **End users**: Cannot re-theme the site (theme selection is owner-only)
   - **No theme editor**: Themes are pre-designed, not customizable via UI
   - Styling within content is done via RTE or Markdown

3. ~~Do we need a mobile app for admin functions?~~ → **NO - No mobile app required.** Admin panel will be responsive web interface (works on mobile browsers, but optimized for desktop use).

4. ~~Should we implement a visual CSS editor for non-technical users?~~ → **NO - No visual CSS editor for now.**
   - Styling is handled by:
     - Selecting preset themes (owner only, post-MVP)
     - Formatting within articles/products through RTE
     - Markdown formatting for content
   - No custom CSS editing via UI

5. ~~Do we want widget/block library extensibility for developers?~~ → **NO - No extensibility for other developers.** This is a closed project. No plugin system, no third-party extensions, no developer API for custom blocks.

## Success Metrics

- Task completion rate > 95% for common workflows
- Average time to create article < 5 minutes
- User satisfaction score > 4.5/5
- Mobile usability score > 90/100
- Accessibility audit score: WCAG AA compliant
