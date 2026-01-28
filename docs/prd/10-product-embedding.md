# PRD 10: Product Embedding Architecture

**Version:** 1.0
**Date:** 2026-01-28
**Status:** Draft
**Parent:** [Master PRD](./00-master-prd.md)
**Related**: [PRD 01: Content Management](./01-content-management.md), [PRD 03: Ecommerce](./03-ecommerce.md)

## Overview

This document defines the dual display modes for products in AECMS and how products embed within articles, pages, and other products. Products must function both as **standalone pages** (like articles) and as **embeddable widgets** (like images) within other content.

## Design Philosophy

### The Two Natures of Products

Products in AECMS have two distinct presentation modes:

1. **Full Product Page** (Destination)
   - Standalone page with dedicated URL
   - Complete product information and media
   - Full commerce functionality
   - SEO optimized
   - Similar to an article page

2. **Embedded Product Widget** (Inline)
   - Compact representation within other content
   - Summary information only
   - Quick add-to-cart functionality
   - Links to full product page
   - Similar to an image embed

**Analogy**: Think of a YouTube video:
- **Full page**: Watching on youtube.com with comments, related videos, full description
- **Embedded**: Video player embedded in a blog post with basic controls

## Display Mode 1: Full Product Page

### URL Pattern
```
/product/{slug}
/shop/product/{slug}
/products/{category}/{slug}
```

### Page Structure

```
┌──────────────────────────────────────────────────────┐
│ Site Header / Navigation                              │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Breadcrumb: Home > Shop > Category > Product Name   │
│                                                       │
│  ┌────────────────────┐                              │
│  │                    │  Product Name                │
│  │  Product Image     │  ★★★★☆ (24 reviews)         │
│  │  Gallery           │                              │
│  │  [Zoom] [360°]     │  $49.99  $39.99  (20% OFF)  │
│  │                    │  🏷️ SALE                    │
│  │  [Thumbnail Grid]  │                              │
│  └────────────────────┘  Stock: In Stock (45 left)  │
│                          Low stock alert!             │
│                                                       │
│  Quantity: [- 1 +]                                   │
│  [Add to Cart]  [Buy Now]  [♡ Wishlist]            │
│                                                       │
├──────────────────────────────────────────────────────┤
│                                                       │
│  ┌── Product Tabs ─────────────────────────────────┐│
│  │ [Description] [Specifications] [Shipping] [FAQ] ││
│  ├──────────────────────────────────────────────────┤│
│  │                                                  ││
│  │  Full product description with rich text,       ││
│  │  embedded images, videos, and detailed info.    ││
│  │                                                  ││
│  │  This product features...                       ││
│  │  [Image]                                         ││
│  │  Technical specifications...                     ││
│  │  [Embedded Video Tutorial]                      ││
│  │                                                  ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
│  ┌── Customer Reviews ──────────────────────────────┐│
│  │  ★★★★★ 4.5 out of 5 (24 reviews)                ││
│  │  [Write a Review]                                ││
│  │                                                  ││
│  │  ★★★★★ John Doe - Verified Purchase             ││
│  │  Great product! Highly recommend...             ││
│  │  [Helpful 12] [Report]                          ││
│  │                                                  ││
│  │  ★★★★☆ Jane Smith                               ││
│  │  Good quality but shipping took a while...      ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
│  ┌── Related Products ──────────────────────────────┐│
│  │  Customers also bought:                          ││
│  │  [Product Card] [Product Card] [Product Card]   ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
└──────────────────────────────────────────────────────┘
```

### Full Page Components

#### Hero Section (Above the Fold)
- **Image Gallery**:
  - Large primary image (800x800px+)
  - Zoom on hover/click
  - Thumbnail navigation
  - 360° view support (future)
  - Video thumbnails

- **Product Information**:
  - Product name (H1, SEO optimized)
  - Star rating (clickable to reviews)
  - Review count
  - SKU display

- **Pricing**:
  - Regular price (strikethrough if on sale)
  - Sale price (highlighted)
  - Savings amount/percentage
  - Sale badge/label

- **Availability**:
  - Stock status: In Stock / Low Stock / Out of Stock
  - Quantity remaining (if low stock)
  - Expected restock date (if out of stock)
  - Pre-order option (future)

- **Commerce Actions**:
  - Quantity selector (with min/max validation)
  - Add to Cart button (primary CTA)
  - Buy Now button (skip cart, direct to checkout)
  - Add to Wishlist (heart icon)
  - Share buttons (social media)

#### Content Tabs
- **Description Tab**:
  - Full rich text content (Markdown/HTML)
  - Embedded images and videos
  - Feature highlights (bullet points)
  - Use cases and benefits
  - Can embed other products (accessories, related items)

- **Specifications Tab**:
  - Technical specifications table
  - Dimensions, weight, materials
  - Compatibility information
  - What's included in the box

- **Shipping & Returns Tab**:
  - Available shipping methods
  - Estimated delivery times
  - Shipping costs calculation
  - Return policy
  - Warranty information

- **Reviews Tab**:
  - Review summary (average rating, count)
  - Star distribution histogram
  - Individual reviews with ratings
  - Review photos (if uploaded)
  - Verified purchase badges
  - Helpful votes
  - Write a review CTA

#### Additional Sections
- **Related Products**:
  - "Customers also bought"
  - "You might also like"
  - Same category products
  - Carousel or grid layout

- **Recently Viewed**:
  - User's browsing history
  - Persistent across sessions

- **FAQ Accordion** (optional):
  - Common questions about product
  - Expandable/collapsible

### SEO Optimization
- Canonical URL: `/product/{slug}`
- Meta title: `{Product Name} - {Site Name}`
- Meta description: `{Short Description}`
- Open Graph tags for social sharing
- Schema.org Product markup:
  ```json
  {
    "@type": "Product",
    "name": "Product Name",
    "image": "product-image.jpg",
    "description": "...",
    "sku": "SKU123",
    "offers": {
      "@type": "Offer",
      "price": "39.99",
      "priceCurrency": "USD",
      "availability": "InStock"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.5",
      "reviewCount": "24"
    }
  }
  ```

## Display Mode 2: Embedded Product Widget

### Context
Products embedded within:
- Articles (blog posts, guides, tutorials)
- Pages (landing pages, homepage)
- Other products (accessories, bundles, "use with")

### Display Variants

#### Variant A: Card Embed (Default, Recommended)

**Size**: ~300-400px wide, 200-250px tall

```
┌─────────────────────────────────────────┐
│ ┌───────────┐                           │
│ │           │  Product Name             │
│ │  Product  │  ★★★★☆ (24)              │
│ │  Image    │                           │
│ │           │  $49.99  $39.99           │
│ └───────────┘  Save 20%!                │
│                                          │
│  In Stock                                │
│  [Add to Cart]  [View Details →]       │
└─────────────────────────────────────────┘
```

**Components**:
- Featured image (square or 4:3, 150-200px)
- Product name (H3, linked to product page)
- Star rating + review count
- Price display (regular + sale)
- Savings badge (if on sale)
- Stock status indicator
- Add to Cart button (functional, adds to cart in-place)
- View Details link (navigates to product page)

**Behavior**:
- Hover: Image zoom or overlay effect
- Click image or name: Navigate to product page
- Click "Add to Cart": Add item to cart, show success message
- Click "View Details": Navigate to product page

**Use Cases**:
- Recommending products in blog posts
- Tutorial articles with required materials
- Product comparison articles

#### Variant B: Inline Embed (Compact)

**Size**: Single line, ~200-300px wide

```
[📦 Product Name - $39.99] [Cart]
```

**Components**:
- Small icon or 32x32px thumbnail
- Product name (linked, truncated if long)
- Price
- Add to Cart icon button

**Behavior**:
- Hover: Tooltip with full name, rating, stock status
- Click name: Navigate to product page
- Click cart icon: Add to cart

**Use Cases**:
- Inline mentions within paragraphs
- Lists of products in articles
- Minimalist references

#### Variant C: Grid Embed (Multiple Products)

**Size**: Responsive grid, 2-4 columns

```
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│┌───────┐│ │┌───────┐│ │┌───────┐│ │┌───────┐│
││ Image ││ ││ Image ││ ││ Image ││ ││ Image ││
│└───────┘│ │└───────┘│ │└───────┘│ │└───────┘│
│ Name    │ │ Name    │ │ Name    │ │ Name    │
│ ★★★★☆  │ │ ★★★★★  │ │ ★★★☆☆  │ │ ★★★★☆  │
│ $39.99  │ │ $29.99  │ │ $49.99  │ │ $19.99  │
│ [Cart]  │ │ [Cart]  │ │ [Cart]  │ │ [Cart]  │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
```

**Components**:
- Thumbnail grid (consistent sizes)
- Product names
- Star ratings
- Prices
- Add to Cart buttons

**Use Cases**:
- Product bundles ("Buy these together")
- Product collections in articles
- Comparison grids
- "Featured Products" sections

## Implementation

### Rich Text Editor Integration

#### TipTap Custom Node

**Node Definition**:
```typescript
import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

export const ProductEmbed = Node.create({
  name: 'productEmbed',

  group: 'block',

  atom: true,

  addAttributes() {
    return {
      productId: {
        default: null,
      },
      productSlug: {
        default: null,
      },
      displayMode: {
        default: 'card', // card, inline, grid
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'product-embed',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['product-embed', HTMLAttributes]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ProductEmbedComponent)
  },
})
```

**Editor UI**:
```typescript
// Toolbar button
<MenuButton
  icon={<ShoppingCartIcon />}
  onClick={() => setShowProductPicker(true)}
  tooltip="Insert Product"
/>

// Product picker modal
<ProductPickerModal
  isOpen={showProductPicker}
  onClose={() => setShowProductPicker(false)}
  onSelect={(product, displayMode) => {
    editor.commands.insertContent({
      type: 'productEmbed',
      attrs: {
        productId: product.id,
        productSlug: product.slug,
        displayMode: displayMode,
      },
    })
  }}
/>
```

#### Shortcode Syntax

**Basic Shortcode**:
```
[product id="uuid-here"]
[product slug="product-name"]
```

**With Options**:
```
[product id="uuid-here" display="card"]
[product id="uuid-here" display="inline"]
[product id="uuid-here" display="grid"]
```

**Multiple Products (Grid)**:
```
[products ids="uuid1,uuid2,uuid3" display="grid"]
[products category="electronics" limit="4" display="grid"]
```

**Shortcode Parser** (server-side):
```typescript
function parseProductShortcode(content: string) {
  const regex = /\[product\s+(?:id|slug)="([^"]+)"(?:\s+display="([^"]+)")?\]/g

  return content.replace(regex, (match, identifier, display = 'card') => {
    const product = fetchProduct(identifier)
    return renderProductEmbed(product, display)
  })
}
```

#### Markdown Extension

**Syntax**:
```markdown
!product[Product Name](product-slug)
!product[Product Name](product-uuid){display=card}
!product[Product Name](slug){display=inline}
```

**Markdown Parser**:
```typescript
import { Mark } from '@tiptap/core'

export const ProductMarkdownExtension = Mark.create({
  name: 'productMarkdown',

  parseHTML() {
    return [
      {
        tag: 'span[data-product]',
      },
    ]
  },

  addInputRules() {
    return [
      {
        find: /!product\[([^\]]+)\]\(([^)]+)\)(?:\{display=([^}]+)\})?/,
        handler: ({ match, chain }) => {
          const [, name, identifier, display = 'card'] = match
          chain().insertProductEmbed(identifier, display).run()
        },
      },
    ]
  },
})
```

### Frontend Rendering

#### React Component

```typescript
interface ProductCardProps {
  productId: string
  displayMode: 'card' | 'inline' | 'grid'
}

export function ProductCard({ productId, displayMode }: ProductCardProps) {
  const { data: product, isLoading } = useProduct(productId)
  const [addingToCart, setAddingToCart] = useState(false)

  if (isLoading) return <ProductCardSkeleton />
  if (!product) return <ProductNotFound />

  const handleAddToCart = async () => {
    setAddingToCart(true)
    await addToCart({ productId, quantity: 1 })
    setAddingToCart(false)
    toast.success('Added to cart!')
  }

  if (displayMode === 'inline') {
    return (
      <InlineProduct
        product={product}
        onAddToCart={handleAddToCart}
        isLoading={addingToCart}
      />
    )
  }

  return (
    <CardProduct
      product={product}
      onAddToCart={handleAddToCart}
      isLoading={addingToCart}
    />
  )
}
```

### Server-Side Rendering

```typescript
// Next.js Server Component
async function renderArticleWithProducts(articleContent: string) {
  // Parse product embeds
  const productIds = extractProductIds(articleContent)

  // Fetch all products in parallel
  const products = await Promise.all(
    productIds.map(id => fetchProduct(id))
  )

  // Replace shortcodes with React components
  const contentWithProducts = articleContent.replace(
    /\[product id="([^"]+)"\]/g,
    (match, id) => {
      const product = products.find(p => p.id === id)
      return `<ProductCard productId="${id}" />`
    }
  )

  return contentWithProducts
}
```

### Data Fetching Strategy

**Embedded Product Data Requirements**:
```typescript
interface EmbeddedProductData {
  id: string
  slug: string
  name: string
  featuredImage: {
    url: string
    alt: string
  }
  price: {
    regular: number
    sale: number | null
    currency: string
  }
  rating: {
    average: number
    count: number
  }
  stock: {
    status: 'in_stock' | 'low_stock' | 'out_of_stock'
    quantity: number | null
  }
  url: string // Link to full product page
}
```

**API Endpoint**:
```
GET /api/products/embed?ids=uuid1,uuid2,uuid3
```

**Response**:
```json
{
  "products": [
    {
      "id": "uuid1",
      "slug": "product-name",
      "name": "Product Name",
      "featuredImage": {
        "url": "/media/product.jpg",
        "alt": "Product Image"
      },
      "price": {
        "regular": 49.99,
        "sale": 39.99,
        "currency": "USD"
      },
      "rating": {
        "average": 4.5,
        "count": 24
      },
      "stock": {
        "status": "in_stock",
        "quantity": 45
      },
      "url": "/product/product-name"
    }
  ]
}
```

**Caching Strategy**:
- Cache embedded product data for 5 minutes
- Invalidate on product update
- Real-time stock updates via WebSocket (optional)

## Security & Visibility

### Visibility Rules

**Embedded products respect product visibility settings**:

1. **Public Products**:
   - Display to all users (Guests included)
   - Full functionality (add to cart, view details)

2. **Logged-in Only Products**:
   - Display only to Members and above
   - Show "Login to View" placeholder for Guests
   - Link to login modal

3. **Admin Only Products**:
   - Display only to Admins and Owners
   - Hidden from public articles
   - Show "Hidden Product" placeholder in editor preview

### Guest Purchasing

**guest_purchaseable Flag**:
- `true`: Guests can add to cart from embed
- `false`: Guests see "Login to Purchase" button instead of "Add to Cart"

### XSS Prevention

**Sanitization**:
- Product names: Escape HTML entities
- Prices: Numeric validation
- Images: URL validation, trusted sources only
- No user-generated content in embedded products (besides reviews, which are separately moderated)

## Analytics & Tracking

### Embedded Product Metrics

**Track**:
- Impressions: How many times product widget is viewed
- Clicks: Click-through rate to full product page
- Add to Cart: Conversions from embedded widget
- Article attribution: Which articles drive product sales

**Implementation**:
```typescript
// Track impression
useEffect(() => {
  trackProductImpression({
    productId,
    context: 'article_embed',
    articleId,
    displayMode,
  })
}, [productId])

// Track click
<a
  href={product.url}
  onClick={() => {
    trackProductClick({
      productId,
      context: 'article_embed',
      articleId,
      destination: 'product_page',
    })
  }}
>
```

**Analytics Dashboard**:
- Top performing embedded products
- Best converting articles (product sales attribution)
- Optimal embed display mode (card vs inline vs grid)

## Performance Optimization

### Lazy Loading

**Progressive enhancement**:
1. Server-side render skeleton/placeholder
2. Client-side hydrate with actual product data
3. Lazy load images (Intersection Observer)

```typescript
<LazyLoad height={200} offset={100}>
  <ProductCard productId={productId} />
</LazyLoad>
```

### Bundle Size

**Code splitting**:
- Dynamic import for ProductCard component
- Load only when needed

```typescript
const ProductCard = dynamic(() => import('@/components/ProductCard'), {
  loading: () => <ProductCardSkeleton />,
  ssr: true,
})
```

### Database Optimization

**Efficient queries**:
```sql
-- Fetch only required fields for embeds
SELECT
  id, slug, name, featured_image,
  regular_price, sale_price,
  average_rating, review_count,
  stock_status, stock_quantity
FROM products
WHERE id IN (uuid1, uuid2, uuid3)
  AND visibility IN ('public', 'logged_in_only')
  AND status = 'published'
```

## User Experience Considerations

### Add to Cart Feedback

**UX Flow**:
1. User clicks "Add to Cart" in embedded widget
2. Button shows loading state (spinner)
3. Item added to cart (API call)
4. Success animation (checkmark, fade)
5. Mini cart in header updates (badge count)
6. Toast notification: "Added to cart! [View Cart]"
7. Product card shows "Added ✓" for 2 seconds
8. Button returns to "Add to Cart" state

### Error Handling

**Error States**:
- Product not found: Show placeholder with "Product unavailable"
- Product deleted: Hide embed entirely
- Out of stock: Show "Out of Stock" badge, disable Add to Cart
- Permission denied: Show "Login to view" for logged-in-only products
- API error: Show fallback UI with retry button

### Accessibility

**ARIA Labels**:
```html
<div
  role="region"
  aria-label="Embedded product: {Product Name}"
  class="product-embed-card"
>
  <img
    src="..."
    alt="{Product Name} - Product Image"
  />
  <button
    aria-label="Add {Product Name} to cart"
    onClick={handleAddToCart}
  >
    Add to Cart
  </button>
</div>
```

**Keyboard Navigation**:
- Tab to product name link
- Tab to "Add to Cart" button
- Tab to "View Details" link
- Enter/Space to activate

## Open Questions

1. Should embedded products show quantity selector or default to 1?
2. Should we support product bundles (multiple products in one embed)?
3. Should embedded products support product variants (size, color) or only simple products?
4. Should we track which articles lead to purchases for commission/attribution?
5. Should embedded products show live inventory countdown ("Only 3 left!")?
6. Should we support A/B testing different embed styles automatically?

## Success Metrics

- ✅ Products can be embedded in articles/pages via 3 methods (visual, shortcode, markdown)
- ✅ Embedded products display correctly in all 3 modes (card, inline, grid)
- ✅ Add to cart works from embedded widgets without page reload
- ✅ Embedded products respect visibility and permission rules
- ✅ Product embeds load in < 500ms
- ✅ Click-through rate from embedded products > 5%
- ✅ Conversion rate from embedded add-to-cart > 2%
- ✅ Zero layout shift when products load

---

**Last Updated**: 2026-01-28
**Status**: Draft - Technical specification complete
