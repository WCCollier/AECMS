# PRD 08: WordPress Migration Strategy

**Version:** 1.1
**Date:** 2026-01-29
**Status:** Draft
**Parent:** [Master PRD](./00-master-prd.md)

## Overview

This document defines the strategy for migrating content from WordPress.org to AECMS. Since the WordPress site is currently broken, migration will be performed via direct database exports.

## Migration Scope

### Content to Migrate

**From WordPress**:
- ✅ Posts → Articles
- ✅ Pages → Pages
- ✅ Categories → Categories
- ✅ Tags → Tags
- ✅ Media (images, documents) → Media Library
- ✅ Post metadata (author, date, featured image)
- ✅ Comments → Comments (with AI moderation on import)

**Not Migrating**:
- ❌ WordPress users (recreate admin manually)
- ❌ Plugins and their data
- ❌ Theme customizations
- ❌ WordPress settings
- ❌ Widgets
- ❌ WooCommerce data (if any) - handle separately

## WordPress Database Structure

### Key WordPress Tables

```sql
-- Posts (includes both posts and pages)
wp_posts {
  ID
  post_author
  post_date
  post_content
  post_title
  post_excerpt
  post_status (publish, draft, trash)
  post_name (slug)
  post_type (post, page, attachment)
  post_parent
  guid (media URL)
}

-- Categories and Tags (unified taxonomy)
wp_terms {
  term_id
  name
  slug
}

wp_term_taxonomy {
  term_taxonomy_id
  term_id
  taxonomy (category, post_tag)
  description
  parent
}

-- Post-Term relationships
wp_term_relationships {
  object_id (post ID)
  term_taxonomy_id
}

-- Post metadata
wp_postmeta {
  meta_id
  post_id
  meta_key (_thumbnail_id, _wp_attached_file, etc.)
  meta_value
}

-- Comments
wp_comments {
  comment_ID
  comment_post_ID
  comment_author
  comment_author_email
  comment_author_url
  comment_date
  comment_content
  comment_approved (1, 0, spam)
  comment_parent
}
```

## Migration Strategy

### Option 1: Direct Database Export (Recommended)

**Process**:
1. Export WordPress database (mysqldump or phpMyAdmin)
2. Run migration script to parse WordPress tables
3. Transform data to AECMS schema
4. Import into AECMS database
5. Download media files from WordPress uploads directory
6. Upload media to AECMS storage

**Advantages**:
- Works even if WordPress is broken
- Complete control over data
- Can handle large datasets
- Preserves all data

**Disadvantages**:
- Requires database access
- More complex script

### Option 2: WordPress REST API (If Site Can Be Fixed)

**Process**:
1. Fix WordPress site enough to enable REST API
2. Use WordPress REST API to fetch content
3. Transform and import into AECMS

**Advantages**:
- Clean, structured data
- Easier to implement
- No direct database access needed

**Disadvantages**:
- Requires working WordPress installation
- May be slow for large datasets
- Rate limited

**Recommendation**: Use Option 1 (direct database export)

## Migration Script Design

### Architecture

```
┌─────────────────────────────────────────┐
│    WordPress Database Export (SQL)      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Parser & Transformer            │
│   (Node.js script or Python)            │
│                                         │
│  ┌────────────────────────────────┐   │
│  │ Parse SQL dump                 │   │
│  │ Extract posts, pages, media    │   │
│  │ Extract categories, tags       │   │
│  │ Transform to AECMS schema      │   │
│  │ Generate SQL for AECMS         │   │
│  │ Download media files           │   │
│  └────────────────────────────────┘   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         AECMS Database Import           │
│    (PostgreSQL with Prisma/raw SQL)     │
└─────────────────────────────────────────┘
```

### Migration Script Structure

```
scripts/
└── migrate-wordpress/
    ├── migrate.js              # Main migration script
    ├── parsers/
    │   ├── posts.js           # Parse wp_posts
    │   ├── terms.js           # Parse wp_terms
    │   ├── media.js           # Parse wp_postmeta for media
    │   ├── comments.js        # Parse wp_comments
    │   └── relationships.js   # Parse wp_term_relationships
    ├── transformers/
    │   ├── articles.js        # Transform posts → articles
    │   ├── pages.js           # Transform pages → pages
    │   ├── categories.js      # Transform categories
    │   ├── tags.js            # Transform tags
    │   ├── comments.js        # Transform comments (with AI moderation)
    │   └── media.js           # Transform media metadata
    ├── importers/
    │   ├── database.js        # Import to PostgreSQL
    │   └── media.js           # Download and upload media files
    ├── config.js              # Configuration
    └── README.md              # Migration instructions
```

### Migration Script Usage

```bash
# Install dependencies
cd scripts/migrate-wordpress
npm install

# Configure
cp config.example.js config.js
nano config.js  # Edit WordPress DB credentials and AECMS API URL

# Run migration
npm run migrate -- --wp-dump /path/to/wordpress-dump.sql

# Options
npm run migrate -- \
  --wp-dump /path/to/dump.sql \
  --media-path /path/to/wp-content/uploads \
  --dry-run  # Preview without importing

# Or interactive mode
npm run migrate:interactive
```

### Configuration File

```javascript
// config.js
module.exports = {
  wordpress: {
    // If using direct DB connection (not recommended)
    database: {
      host: 'localhost',
      port: 3306,
      user: 'wp_user',
      password: 'wp_pass',
      database: 'wordpress'
    },

    // Or provide SQL dump file
    dumpFile: './wordpress-dump.sql',

    // WordPress uploads directory
    uploadsPath: './wp-content/uploads',

    // WordPress site URL (for media URLs)
    siteUrl: 'https://old-site.com',

    // Table prefix
    tablePrefix: 'wp_'
  },

  aecms: {
    // AECMS database connection
    databaseUrl: process.env.DATABASE_URL,

    // AECMS API for media upload
    apiUrl: 'http://localhost:4000',
    apiKey: process.env.MIGRATION_API_KEY,

    // Media storage path
    mediaPath: './media'
  },

  options: {
    // Import drafts or only published content
    includeDrafts: false,

    // Import trash/deleted posts
    includeTrash: false,

    // Skip media download (for testing)
    skipMedia: false,

    // Author ID for imported content
    defaultAuthorId: '...',

    // Batch size for database operations
    batchSize: 100
  }
};
```

## Data Transformation

### Posts → Articles

```javascript
// WordPress post
{
  ID: 123,
  post_title: "My First Post",
  post_name: "my-first-post",
  post_content: "<p>HTML content...</p>",
  post_excerpt: "Short excerpt",
  post_status: "publish",
  post_date: "2024-01-15 10:30:00",
  post_modified: "2024-01-16 14:20:00"
}

// AECMS article
{
  id: uuid(),
  title: "My First Post",
  slug: "my-first-post",
  content: "<p>HTML content...</p>",
  excerpt: "Short excerpt",
  status: "published",  // or "draft"
  published_at: "2024-01-15T10:30:00Z",
  created_at: "2024-01-15T10:30:00Z",
  updated_at: "2024-01-16T14:20:00Z",
  author_id: defaultAuthorId,
  featured_image_id: null,  // Set if _thumbnail_id exists
  seo_title: "My First Post",  // Default to title
  seo_description: "Short excerpt"  // Default to excerpt
}
```

### Categories Transformation

```javascript
// WordPress category
{
  term_id: 5,
  name: "Technology",
  slug: "technology",
  description: "Tech articles",
  parent: 0
}

// AECMS category
{
  id: uuid(),
  name: "Technology",
  slug: "technology",
  description: "Tech articles",
  parent_id: null,  // Or parent UUID if hierarchical
  type: "article",  // Separate product categories
  created_at: now()
}
```

### Media Transformation

**WordPress**:
- Media stored in `wp-content/uploads/YYYY/MM/filename.jpg`
- Metadata in `wp_postmeta` with keys:
  - `_wp_attached_file`: relative path
  - `_wp_attachment_metadata`: image dimensions, sizes

**AECMS**:
```javascript
{
  id: uuid(),
  filename: "filename.jpg",
  original_filename: "My Image.jpg",
  path: "media/YYYY/MM/filename.jpg",
  mime_type: "image/jpeg",
  size: 1048576,  // bytes
  width: 1920,
  height: 1080,
  alt_text: "",  // Extract from wp_postmeta if available
  caption: "",
  uploaded_by: defaultAuthorId,
  created_at: "..."
}
```

### Comments Transformation

**WordPress**:
- Comments stored in `wp_comments` table
- Approved status: 1 (approved), 0 (pending), spam (spam)
- Threaded comments with `comment_parent`

**AECMS**:
```javascript
// WordPress comment
{
  comment_ID: 123,
  comment_post_ID: 45,
  comment_author: "John Doe",
  comment_author_email: "john@example.com",
  comment_date: "2024-01-15 10:30:00",
  comment_content: "Great article!",
  comment_approved: "1",
  comment_parent: 0
}

// AECMS comment (run through AI moderation on import)
{
  id: uuid(),
  entity_type: "article",
  entity_id: article_uuid,  // Mapped from comment_post_ID
  user_id: null,  // Anonymous (or create Guest user if needed)
  author_name: "John Doe",
  author_email: "john@example.com",
  content: "Great article!",
  is_review: false,
  rating: null,
  status: "approved",  // Or "flagged" if AI moderation catches issues
  flagged: false,  // Set to true if AI moderation flags content
  parent_id: null,  // Mapped from comment_parent if threaded
  created_at: "2024-01-15T10:30:00Z"
}
```

**Import Strategy**:
1. Only import approved comments (comment_approved = '1')
2. Skip spam comments
3. Run all imported comments through AI moderation
4. Flag potentially problematic comments for manual review
5. Map comment_post_ID to AECMS article_id
6. Preserve comment threading (parent_id)

### Content HTML Transformation

WordPress content may need transformation:

```javascript
function transformContent(wpContent) {
  let content = wpContent;

  // Transform WordPress shortcodes
  content = content.replace(/\[caption[^\]]*\](.*?)\[\/caption\]/g, '$1');
  content = content.replace(/\[gallery[^\]]*\]/g, '<!-- Gallery removed -->');

  // Update image URLs
  content = content.replace(
    /https?:\/\/old-site\.com\/wp-content\/uploads\//g,
    '/media/'
  );

  // Update internal links
  content = content.replace(
    /https?:\/\/old-site\.com\//g,
    '/'
  );

  // Remove WordPress-specific classes
  content = content.replace(/class="wp-[^"]*"/g, '');

  return content;
}
```

## Migration Process

### Step-by-Step Guide

#### Step 1: Export WordPress Database

**Using phpMyAdmin**:
1. Log into phpMyAdmin
2. Select WordPress database
3. Click "Export"
4. Choose "Quick" or "Custom"
5. Select SQL format
6. Download `wordpress.sql`

**Using command line**:
```bash
mysqldump -u username -p wordpress > wordpress-dump.sql
```

**Using cPanel**:
1. Go to cPanel → Databases → phpMyAdmin
2. Follow phpMyAdmin steps above

#### Step 2: Download Media Files

**Using FTP/SFTP**:
```bash
# Download wp-content/uploads
scp -r user@host:/path/to/wp-content/uploads ./wp-uploads
```

**Using cPanel File Manager**:
1. Navigate to `wp-content/uploads`
2. Select all files
3. Compress to zip
4. Download zip file
5. Extract locally

#### Step 3: Prepare AECMS

```bash
# Ensure AECMS is running
docker-compose up -d

# Or if using npm directly
npm run dev

# Create admin user if not exists
npm run create-admin
```

#### Step 4: Run Migration Script

```bash
cd scripts/migrate-wordpress

# Configure
cp config.example.js config.js
nano config.js  # Edit configuration

# Dry run (preview only, no changes)
npm run migrate -- \
  --wp-dump /path/to/wordpress-dump.sql \
  --media-path /path/to/wp-uploads \
  --dry-run

# Review output, then run for real
npm run migrate -- \
  --wp-dump /path/to/wordpress-dump.sql \
  --media-path /path/to/wp-uploads

# Monitor progress
# Script will show:
# - Articles imported: 45/50
# - Categories imported: 5/5
# - Media files downloaded: 120/150
# - Errors: 0
```

#### Step 5: Post-Migration Verification

```bash
# Check article count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM articles;"

# Check media count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM media;"

# Check for orphaned data
npm run migrate:verify

# Generate redirect map (for SEO)
npm run migrate:generate-redirects > redirects.txt
```

#### Step 6: Test Imported Content

Manual checks:
- [ ] Open admin dashboard
- [ ] View article list (check count matches)
- [ ] Open random articles (check content displays)
- [ ] Check images display correctly
- [ ] Verify categories and tags
- [ ] Check internal links work
- [ ] Test search functionality

#### Step 7: Setup Redirects (SEO)

WordPress URLs may differ from AECMS URLs. Create redirects:

**WordPress**:
```
/2024/01/my-first-post/
/category/technology/
```

**AECMS**:
```
/articles/my-first-post
/category/technology
```

**Redirect options**:

1. **Next.js redirects** (next.config.js):
```javascript
module.exports = {
  async redirects() {
    return [
      {
        source: '/:year/:month/:slug',
        destination: '/articles/:slug',
        permanent: true
      }
    ];
  }
};
```

2. **Nginx redirects**:
```nginx
rewrite ^/(\d{4})/(\d{2})/(.+)$ /articles/$3 permanent;
```

3. **Cloudflare Page Rules** (if using Cloudflare)

## Handling Special Cases

### WordPress Shortcodes

Common shortcodes to handle:

```javascript
const shortcodeTransforms = {
  // [caption] → figure with caption
  caption: (content, attrs) => {
    return `<figure>
      ${content}
      <figcaption>${attrs.caption}</figcaption>
    </figure>`;
  },

  // [gallery] → Note to manually add gallery
  gallery: () => '<!-- TODO: Add gallery here -->',

  // [embed] → iframe or link
  embed: (content) => content,  // Keep URL for now

  // WooCommerce shortcodes (if applicable)
  product: (content, attrs) => {
    // Could auto-create product or leave placeholder
    return `<!-- Product: ${attrs.id} -->`;
  }
};
```

### Custom Post Types

If WordPress has custom post types (beyond posts/pages):

```javascript
// In migration script
switch (post.post_type) {
  case 'post':
    return migrateToArticle(post);
  case 'page':
    return migrateToPage(post);
  case 'product':  // WooCommerce
    return migrateToProduct(post);
  case 'portfolio':  // Custom
    // Migrate as article with special category
    return migrateToArticle(post, { category: 'Portfolio' });
  default:
    console.warn(`Unknown post type: ${post.post_type}`);
    return null;
}
```

### Handling Missing Media

If media files are missing:

```javascript
async function downloadMedia(wpMediaUrl) {
  try {
    const response = await fetch(wpMediaUrl);
    if (response.ok) {
      return await response.arrayBuffer();
    }
  } catch (error) {
    console.error(`Failed to download: ${wpMediaUrl}`);
    // Log to missing-media.txt for manual review
    fs.appendFileSync('missing-media.txt', `${wpMediaUrl}\n`);
    return null;
  }
}
```

## Migration Script Output

### Success Output

```
WordPress to AECMS Migration
============================

Configuration:
- WordPress dump: /path/to/dump.sql
- Media path: /path/to/uploads
- AECMS API: http://localhost:4000
- Dry run: No

Parsing WordPress data...
✓ Found 145 posts
✓ Found 23 pages
✓ Found 8 categories
✓ Found 34 tags
✓ Found 256 media items

Transforming data...
✓ Transformed 145 posts → articles
✓ Transformed 23 pages → pages
✓ Transformed 8 categories
✓ Transformed 34 tags
✓ Transformed 256 media items

Importing to AECMS...
✓ Imported 8 categories
✓ Imported 34 tags
✓ Imported 145 articles
✓ Imported 23 pages
✓ Downloaded 256 media files (12.3 GB)

Summary:
========
Articles: 145 imported, 0 failed
Pages: 23 imported, 0 failed
Categories: 8 imported
Tags: 34 imported
Media: 256 imported, 0 failed

Warnings:
- 3 shortcodes could not be transformed (see shortcodes.log)
- 2 internal links may be broken (see links.log)

Migration completed successfully!

Next steps:
1. Review imported content in admin panel
2. Check and update broken links
3. Setup URL redirects for SEO
4. Update site settings (logo, theme, etc.)
```

## Post-Migration Checklist

- [ ] Verify article count matches WordPress
- [ ] Check random articles display correctly
- [ ] Verify all images display
- [ ] Test internal links
- [ ] Check categories and tags
- [ ] Review and fix shortcode placeholders
- [ ] Setup URL redirects
- [ ] Update sitemap
- [ ] Test search functionality
- [ ] Check SEO meta tags
- [ ] Submit new sitemap to Google
- [ ] Monitor for 404 errors (using Google Search Console)

## Rollback Plan

If migration fails or has issues:

1. **Database rollback**:
```bash
# Backup current state first
pg_dump $DATABASE_URL > pre-migration-backup.sql

# Rollback
psql $DATABASE_URL < pre-migration-backup.sql
```

2. **Media rollback**:
```bash
# Remove migrated media
rm -rf media/*
```

3. **Re-run migration**:
```bash
# Fix issues in migration script
# Run again (script should be idempotent)
npm run migrate:clean  # Clean partial import
npm run migrate -- --wp-dump dump.sql
```

## Testing Strategy

### Test Migration on Staging

Before production migration:

1. Create staging environment
2. Run migration on staging
3. Thoroughly test
4. Fix any issues
5. Document process
6. Run on production

### Test Data

For testing migration script:

1. Export small subset of WordPress data (10 posts)
2. Test migration with subset
3. Verify correctness
4. Scale to full dataset

## Documentation Deliverables

1. **Migration Guide** (for users): Step-by-step instructions
2. **Script README**: Technical documentation for script
3. **Troubleshooting Guide**: Common issues and solutions
4. **Redirect Map**: WordPress URLs → AECMS URLs

## Open Questions

1. ~~Should we preserve WordPress post IDs (for external links)?~~ - **No, use UUID. Generate redirect map for SEO.**
2. ~~How to handle WordPress comments (export only, import later, or discard)?~~ - **Import approved comments with AI moderation.**
3. ~~Should we migrate WordPress users or start fresh?~~ - **Start fresh. Create Owner manually, users re-register.**
4. ~~What to do with WooCommerce data (if present)?~~ - **Handle separately if needed, not in scope for general migration.**
5. ~~Should we maintain WordPress URL structure or use AECMS structure?~~ - **Use AECMS structure, create redirects for SEO (Next.js or Nginx).**

## Success Criteria

- ✅ All published posts migrated successfully
- ✅ All media files downloaded and accessible
- ✅ Categories and tags preserved
- ✅ Internal links working (or redirect map created)
- ✅ SEO metadata preserved
- ✅ Published dates preserved
- ✅ Featured images correctly assigned
- ✅ No data loss
- ✅ Migration completes in < 1 hour for typical blog
