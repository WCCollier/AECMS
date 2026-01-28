# PRD 03: Ecommerce & Payments

**Version:** 1.1
**Date:** 2026-01-28
**Status:** Draft
**Parent:** [Master PRD](./00-master-prd.md)

## Overview

This document defines the ecommerce functionality for AECMS, including product management, shopping cart, checkout process, payment integration, and order management.

## Strategic Approach

**Recommended Strategy: Integrate with Stripe (Primary) + PayPal (Secondary) + Amazon Pay (Tertiary)**

**Rationale:**
- Building payment processing from scratch is costly, risky, and requires PCI DSS Level 1 compliance
- Stripe provides comprehensive payment APIs with built-in security and compliance
- PayPal integration captures users who prefer PayPal's buyer protection
- Amazon Pay leverages 300M+ Amazon accounts for trusted checkout experience
- This approach allows focus on CMS features while ensuring enterprise-grade payment security
- Lower maintenance burden and better fraud protection
- Faster time to market

**Payment Priority:**
1. **Stripe** (Primary): Most flexible, best API, comprehensive features
2. **PayPal** (Secondary): Popular alternative, buyer protection
3. **Amazon Pay** (Tertiary): Amazon ecosystem users, trusted brand

## User Stories

### Customer Stories
- As a customer, I want to browse products by category so I can find what I need
- As a customer, I want to add items to a cart so I can purchase multiple items at once
- As a customer, I want to see my cart total in real-time so I know what I'm spending
- As a customer, I want to checkout securely so my payment information is protected
- As a customer, I want to receive order confirmation so I know my order was successful
- As a customer, I want to track my orders so I know when to expect delivery
- As a customer, I want to save my address so I don't have to re-enter it

### Administrator Stories
- As a store admin, I want to add products with details so customers can make informed purchases
- As a store admin, I want to manage inventory so I don't oversell products
- As a store admin, I want to view and manage orders so I can fulfill them
- As a store admin, I want to process refunds so I can handle returns
- As a store admin, I want to see sales analytics so I can make business decisions

## Functional Requirements

### Product Management

#### Product Fields
- **Basic Information**:
  - Title (required)
  - Slug (auto-generated, editable)
  - Description (rich text)
  - Short description (for listings)
  - SKU (stock keeping unit)
  - Barcode (UPC/EAN/ISBN)

- **Pricing**:
  - Regular price (required)
  - Sale price (optional)
  - Sale start/end dates
  - Tax class

- **Inventory**:
  - Stock quantity
  - Stock status (in stock, out of stock, on backorder)
  - Low stock threshold
  - Allow backorders (yes/no)

- **Media**:
  - Product images (multiple)
  - Featured image
  - Image gallery
  - Product videos (optional)

- **Categorization**:
  - Product categories
  - Product tags
  - Brands (optional)

- **Shipping**:
  - Weight
  - Dimensions (length, width, height)
  - Shipping class

- **SEO**:
  - Meta title
  - Meta description
  - Schema.org product markup

#### Product Types
- **Simple Product**: Single SKU, no variations
- **Variable Product** (future): Multiple variations (e.g., size, color)
- **Digital Product** (future): Downloadable products
- **Subscription** (future): Recurring billing products

#### Product Visibility & Access Control

**Note**: For comprehensive details, see [PRD 09: User Management & Authentication](./09-user-management-auth.md)

**Visibility Settings**:
- **Public** (Guest-visible): Visible to everyone in catalog and search
- **Logged-in only**: Visible only to Members and above
- **Admin only**: Only visible in admin interface (for draft products, etc.)

**Guest Purchasing**:
- Boolean flag: `guest_purchaseable`
- If `true`: Guests can add to cart and checkout without creating account
- If `false`: Must be logged in as Member to purchase
- Allows selective gating of premium products

**Comment/Review Visibility**:
- **Disabled**: No reviews allowed on this product
- **Logged-in only**: Members+ can review, only logged-in users can view reviews
- **Public**: Members+ can review, everyone (including Guests) can view reviews

### Shopping Cart

#### Cart Functionality
- Add product to cart (with quantity)
- Update product quantity
- Remove product from cart
- Apply coupon/discount code (future)
- Calculate subtotal, tax, shipping, and total
- Persistent cart (saved for logged-in users)
- Session cart (guest users, cookie-based)
- Cart abandonment tracking (future)

#### Cart Display
- Mini cart in header (dropdown)
- Full cart page
- Item thumbnails and details
- Quantity adjustment controls
- Remove item button
- Continue shopping link
- Proceed to checkout button

### Checkout Process

#### Checkout Flow
```
Cart → Shipping Info → Payment Method → Order Review → Confirmation
```

#### Checkout Steps

**1. Shipping Information**
- Full name
- Email address
- Shipping address (address, city, state/province, postal code, country)
- Phone number
- Option to use different billing address
- Save address to account (for logged-in users)

**2. Shipping Method** (if applicable)
- Standard shipping
- Express shipping
- In-store pickup (future)
- Shipping cost calculation based on weight/location

**3. Payment Method**
- Stripe card payment (credit/debit)
- PayPal
- Amazon Pay
- Save payment method for future use (Stripe tokenization)
- Guest checkout option

**4. Order Review**
- Summary of cart items
- Shipping address confirmation
- Billing address confirmation
- Shipping method
- Payment method
- Order total breakdown
- Terms and conditions checkbox
- Place order button

**5. Order Confirmation**
- Order number
- Order summary
- Estimated delivery date
- Email confirmation sent
- Thank you message
- Account creation prompt (for guest checkouts)

### Guest Checkout

**Note**: For comprehensive details, see [PRD 09: User Management & Authentication](./09-user-management-auth.md)

#### Guest Checkout Flow

Guests (unauthenticated users) can purchase products marked as `guest_purchaseable`:

1. **Add to Cart**: Guest adds guest-purchaseable products to cart
2. **Checkout**: Guest proceeds to checkout
3. **Shipping Info**: Guest enters email, name, shipping address (no account required)
4. **Payment**: Guest enters payment information
5. **Order Placement**: Order is created with email as identifier
6. **Confirmation Email**: Guest receives order confirmation with order number
7. **Order Tracking**: Guest can track order via email + order number (no login required)
8. **Optional Account Creation**: Post-purchase, guest is offered to create Member account to:
   - View order history
   - Save addresses and payment methods
   - Leave reviews on purchased products
   - Access member-only content

#### Guest Order Management

- Guest orders stored with email as primary identifier
- Order lookup via: Email + Order Number
- Guest order history not saved (unless converted to Member)
- Guest can convert order to Member account post-purchase

#### Business Rules

- Only products with `guest_purchaseable = true` can be purchased by guests
- Products with `guest_purchaseable = false` require login to add to cart
- Cart shows "Login required to purchase" for non-guest-purchaseable items
- Guest cart persists via session cookie (7 days)

### Payment Integration

#### Stripe Integration

**Primary Features:**
- Stripe Checkout (hosted payment page)
- Stripe Elements (embedded card form)
- Payment Intents API for secure payments
- 3D Secure (SCA compliance for Europe)
- Multiple currency support
- Multiple payment methods (cards, digital wallets)
- Automatic tax calculation (Stripe Tax)
- Saved payment methods
- Refund processing via API
- Webhook integration for payment status updates

**Security Features:**
- PCI DSS compliant (Stripe handles compliance)
- Tokenization (no card data stored on server)
- Fraud detection (Stripe Radar)
- Strong Customer Authentication (SCA)

**Implementation Approach:**
```javascript
// Backend: Create payment intent
POST /api/checkout/payment-intent
{
  items: [{productId, quantity}],
  shippingAddress: {...}
}
// Returns client_secret

// Frontend: Stripe Elements confirm payment
stripe.confirmCardPayment(client_secret, {
  payment_method: {card: cardElement}
})
```

#### PayPal Integration

**Features:**
- PayPal Checkout button
- PayPal payment capture
- Refund processing
- IPN (Instant Payment Notification) or webhooks

**Implementation:**
- PayPal JavaScript SDK
- Server-side order creation
- Payment capture on order completion

#### Amazon Pay Integration

**Features:**
- Amazon Pay button
- 300M+ Amazon accounts worldwide
- Address autofill from Amazon account
- Buyer protection included
- PCI DSS Level 1 compliant

**Pricing:**
- **2.9% + $0.30** per transaction (identical to Stripe)
- No monthly fees
- No setup fees
- Free sandbox for testing

**Security Features:**
- PCI DSS compliant (Amazon handles compliance)
- No card data stored on server
- Fraud protection included
- Strong Customer Authentication (SCA)

**Implementation:**
- Amazon Pay JavaScript SDK
- Server-side charge creation
- Payment capture on order completion
- Webhook integration for payment status

**Benefits:**
- Reduces checkout friction for Amazon customers
- Trusted brand recognition
- Address and payment method sync from Amazon account
- Same pricing as Stripe (no cost disadvantage)

**Implementation Approach:**
```javascript
// Frontend: Amazon Pay button
<div id="AmazonPayButton"></div>

amazon.Pay.renderButton('#AmazonPayButton', {
  merchantId: 'YOUR_MERCHANT_ID',
  ledgerCurrency: 'USD',
  checkoutLanguage: 'en_US',
  productType: 'PayAndShip',
  placement: 'Checkout',
  buttonColor: 'Gold'
})

// Backend: Process charge
POST /api/checkout/amazon-pay
{
  amazonCheckoutSessionId: 'session-id',
  items: [{productId, quantity}]
}
```

#### Payment Workflow
1. Customer enters shipping information
2. Backend calculates order total (items + shipping + tax)
3. Backend creates Stripe Payment Intent, PayPal Order, or Amazon Pay Checkout Session
4. Customer enters payment information or selects Amazon Pay
5. Frontend confirms payment with provider
6. Backend receives webhook confirmation
7. Order status updated to "Processing"
8. Confirmation email sent

### Order Management

#### Order Fields
- Order number (auto-generated, unique)
- Customer information (name, email, phone)
- Shipping address
- Billing address
- Order items (product, quantity, price)
- Subtotal
- Shipping cost
- Tax
- Total
- Payment method
- Payment status (pending, paid, failed, refunded)
- Order status (pending, processing, shipped, delivered, cancelled)
- Order notes (private, customer-facing)
- Created date
- Updated date
- Tracking number (optional)

#### Order Statuses
- **Pending Payment**: Awaiting payment confirmation
- **Processing**: Payment received, preparing order
- **On Hold**: Payment requires manual review
- **Shipped**: Order sent to customer
- **Delivered**: Order received by customer
- **Completed**: Order fulfilled and closed
- **Cancelled**: Order cancelled (before shipping)
- **Refunded**: Payment returned to customer
- **Failed**: Payment failed

#### Admin Order Management
- View all orders (filterable by status, date, customer)
- Search orders by order number, customer name, email
- View order details
- Update order status
- Add order notes
- Process refunds
- Print packing slips / invoices (future)
- Export orders and other reports (CSV) - see [Reporting & Data Export](#reporting--data-export) section

#### Customer Order Management
- View order history in account dashboard
- View order details
- Download invoice (future)
- Track shipment
- Request return/refund (future)

### Customer Accounts

#### Account Features
- Registration and login
- Profile management (name, email, password)
- Saved addresses (billing and shipping)
- Saved payment methods (tokenized via Stripe)
- Order history
- Password reset
- Email preferences

#### Guest Checkout
- Allow purchase without account
- Email for order confirmation
- Option to create account post-purchase

### Product Discovery

#### Product Listing Page
- Grid or list view
- Filtering:
  - By category
  - By price range
  - By attributes (future: size, color, etc.)
  - By availability (in stock / on sale)
- Sorting:
  - Default (popularity)
  - Price: Low to High
  - Price: High to Low
  - Newest
  - Name: A-Z
- Pagination or infinite scroll

### Product Display Modes

Products have **two distinct display modes** depending on context:

#### 1. Full Product Page (Standalone Display)

**URL Pattern**: `/product/{slug}` or `/shop/product/{slug}`

**Full page display** when product is accessed directly via its URL:

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ Header / Navigation                              │
├─────────────────────────────────────────────────┤
│                                                  │
│ ┌─────────────────┐  Product Name              │
│ │                 │  ★★★★☆ (24 reviews)        │
│ │  Product        │  $49.99  $39.99 (Save 20%) │
│ │  Image          │                             │
│ │  Gallery        │  Stock: In Stock (45 left) │
│ │                 │                             │
│ │  [< >]          │  [- 1 +]  [Add to Cart]    │
│ └─────────────────┘                             │
│                                                  │
│ ┌─ Product Tabs ─────────────────────────────┐ │
│ │ Description | Specs | Shipping | Reviews   │ │
│ ├─────────────────────────────────────────────┤ │
│ │ Full product description with rich text,   │ │
│ │ images, videos, and detailed information.  │ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ ┌─ Reviews ────────────────────────────────┐   │
│ │ ★★★★★ John Doe - Verified Purchase       │   │
│ │ Great product! Highly recommend...        │   │
│ └───────────────────────────────────────────┘   │
│                                                  │
│ ┌─ Related Products ──────────────────────┐    │
│ │ [Product] [Product] [Product] [Product] │    │
│ └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

**Full Page Components**:
- **Hero Section**:
  - Product image gallery (with zoom, thumbnails, 360° view)
  - Product name (H1)
  - Star rating and review count (clickable to reviews)
  - Price display (regular, sale, savings)
  - Stock status (in stock, low stock, out of stock)
  - Quantity selector
  - Add to cart button (prominent, primary CTA)
  - Add to wishlist button (secondary)
  - Share buttons (social media)

- **Product Details Tabs**:
  - **Description**: Full rich text content (Markdown/HTML), images, videos, embeds
  - **Specifications**: Table of product attributes (size, weight, materials, etc.)
  - **Shipping**: Shipping options, estimated delivery, returns policy
  - **Reviews**: Customer reviews with ratings, photos, verified purchase badges

- **Related Content**:
  - Related products carousel (same category, frequently bought together)
  - Recently viewed products
  - "You might also like" recommendations

- **Commerce Actions**:
  - Prominent "Add to Cart" button
  - Buy Now button (direct to checkout)
  - Quantity controls
  - Variant selectors (future: size, color)

#### 2. Embedded Product Widget (Inline Display)

**Context**: When product is embedded within an article, page, or another product

**Compact card display** for inline embedding in rich text content:

**Display Variants**:

**A. Card Embed (Default)**:
```
┌───────────────────────────────────────────┐
│ ┌─────┐                                   │
│ │ Img │ Product Name                      │
│ │     │ ★★★★☆ (24)                       │
│ └─────┘ $49.99 $39.99                     │
│         [Add to Cart]  [View Details →]  │
└───────────────────────────────────────────┘
```

**Components**:
- Featured image (small, square or 4:3)
- Product name (linked to product page)
- Star rating + review count
- Price (with sale price if applicable)
- Add to Cart button
- View Details link (to full product page)

**B. Inline Embed (Minimal)**:
```
[📦 Product Name - $39.99] [Add to Cart]
```

**Components**:
- Product icon or tiny thumbnail
- Product name (linked)
- Price
- Add to Cart button

**C. Grid Embed (Multiple Products)**:
```
┌──────┐ ┌──────┐ ┌──────┐
│ Img  │ │ Img  │ │ Img  │
│ Name │ │ Name │ │ Name │
│ $39  │ │ $29  │ │ $49  │
│[Cart]│ │[Cart]│ │[Cart]│
└──────┘ └──────┘ └──────┘
```

**Components**:
- Thumbnail grid (2-4 columns, responsive)
- Product name
- Price
- Add to Cart button

### Product Embedding Syntax

**In Rich Text Editor (for articles/pages)**:

**Option 1: Shortcode** (WordPress-style):
```
[product id="uuid-here" display="card"]
[product id="uuid-here" display="inline"]
[product slug="product-name" display="card"]
```

**Option 2: TipTap Custom Node** (visual in editor):
- Insert → Product
- Search/select product from modal
- Choose display style (card, inline, grid)
- Product renders as interactive component in editor

**Option 3: Markdown Extension**:
```markdown
!product[Product Name](product-slug)
!product[Product Name](product-uuid){display=card}
```

### Product Embedding Implementation

**Technical Approach**:

1. **Rich Text Editor Integration**:
   - TipTap custom node: `ProductEmbed`
   - Visual product picker modal
   - Live preview in editor
   - Drag-and-drop positioning

2. **Rendering**:
   - Server-side: Parse shortcodes/nodes, fetch product data
   - Client-side: React component `<ProductCard />` or `<ProductInline />`
   - Hydrate with real-time stock status

3. **Data Requirements**:
   - Product ID/slug
   - Display mode (card, inline, grid)
   - Fetch: name, slug, price, image, rating, stock status

4. **Security**:
   - Only render products with appropriate visibility
   - Respect guest_purchaseable flag
   - Cache product embed data (5 min TTL)

### Comparison: Product Page vs Embedded

| Feature | Full Product Page | Embedded Widget |
|---------|------------------|-----------------|
| **URL** | `/product/{slug}` | N/A (inline) |
| **Context** | Standalone page | Within article/page/product |
| **Size** | Full page | Compact card (200-400px) |
| **Images** | Gallery with zoom | Single thumbnail |
| **Description** | Full rich text | Short description only |
| **Reviews** | Full review list | Rating summary only |
| **Tabs** | Yes (Description, Specs, Shipping) | No |
| **Add to Cart** | Prominent CTA | Compact button |
| **Related Products** | Yes | No |
| **SEO** | Full meta tags, schema | N/A |
| **Purpose** | Detailed product exploration | Quick inline purchase option |

### Use Cases

**Full Product Page**:
- Customer clicks product from catalog
- Direct link from external site
- Dedicated product landing pages
- SEO/marketing campaigns

**Embedded Product Widget**:
- Blog post recommending product ("Check out this camera!")
- Tutorial article with required tools/materials
- Comparison articles (embed multiple products side-by-side)
- Product bundles (embed related products in product description)
- Landing page hero sections (featured product card)

### Product Reviews

**Note**: For comprehensive details, see [PRD 09: User Management & Authentication](./09-user-management-auth.md)

#### Review System

Reviews are a special type of comment with star ratings (1-5 stars):

**Review Components**:
- **Rating**: 1-5 stars (required)
- **Review Text**: Written feedback (optional, but encouraged)
- **Author**: Display name of reviewer
- **Date**: Review timestamp
- **Verified Purchase Badge**: Indicates reviewer purchased the product

**Review Capabilities**:
- **Members**: Can leave reviews on products
- **Admin/Owner**: Can moderate, edit, delete any reviews
- **Guests**: Can view reviews (if visibility allows), cannot leave reviews

**Review Visibility** (per product):
- **Disabled**: No reviews allowed
- **Logged-in only**: Members can review, only logged-in users can view
- **Public**: Members can review, everyone (including Guests) can view

**Review Display**:
- Average star rating displayed on product card and detail page
- Total review count
- Star distribution histogram (5★: 45, 4★: 20, etc.)
- Reviews sorted by: Most Recent, Highest Rating, Lowest Rating, Most Helpful
- Review pagination (10 per page)

**Verified Purchase**:
- Reviews from users who purchased the product are badged "Verified Purchase"
- Verified reviews may be weighted higher in average calculation (future)

**Review Moderation**:
- Optional approval queue (Owner-configurable)
- Status: Pending, Approved, Rejected
- Email notification to product owners on new review
- Report review feature (future)

#### Search
- Product search in global search
- Autocomplete suggestions
- Search results page with filters

### Inventory Management

#### Stock Tracking
- Automatic stock reduction on order
- Manual stock adjustment
- Low stock alerts
- Out of stock notifications
- Backorder management

#### Stock Reports
- Current stock levels
- Stock value
- Low stock products
- Out of stock products

### Reporting & Data Export

**Strategic Approach**: No direct accounting software integration. Instead, provide comprehensive CSV export capabilities for manual import into QuickBooks, Xero, Excel, or other tools.

#### CSV Export Capability

**Capability Name**: `reports.export` or `ecommerce.reports.export`

**Default Assignment**:
- ✅ **Owner**: Has capability by default (all capabilities enabled)
- ⏸️ **Admin**: Not assigned by default, can be granted by Owner
- ❌ **Member/Guest**: Not available

**Future Role Consideration**: "Store Admin" role could be created with this capability for dedicated ecommerce management without full system access.

**Implementation Note**: This follows the capability-based RBAC system defined in [PRD 09: User Management & Authentication](./09-user-management-auth.md). Owner can assign this capability to specific Admins via the Roles & Permissions interface.

#### Available Reports (CSV Export)

**1. Orders Report**
- Date range filter (start date, end date)
- Status filter (all, completed, pending, cancelled, refunded)
- Customer filter (specific customer or all)

**Columns**:
- Order Number
- Order Date
- Customer Name
- Customer Email
- Order Status
- Payment Status
- Payment Method
- Subtotal
- Tax
- Shipping Cost
- Total
- Number of Items
- Product SKUs (comma-separated)

**Use Case**: Import into accounting software for revenue tracking, tax reporting, financial reconciliation.

**2. Products Report**
- Category filter
- Stock status filter (all, in stock, low stock, out of stock)

**Columns**:
- Product ID
- SKU
- Product Name
- Category
- Regular Price
- Sale Price
- Stock Quantity
- Stock Status
- Total Units Sold (lifetime)
- Total Revenue (lifetime)
- Created Date
- Last Modified Date

**Use Case**: Inventory management, pricing analysis, product performance.

**3. Customers Report**
- Date range filter (customer since date)
- Purchase activity filter (has purchases, no purchases)

**Columns**:
- Customer ID
- Name
- Email
- Total Orders
- Total Lifetime Value
- Average Order Value
- First Purchase Date
- Last Purchase Date
- Account Created Date

**Use Case**: Customer analysis, marketing campaigns, loyalty program planning.

**4. Transactions Report** (Detailed)
- Date range filter
- Payment method filter

**Columns**:
- Transaction ID
- Order Number
- Transaction Date
- Customer Name
- Customer Email
- Payment Method
- Payment Gateway Transaction ID (Stripe/PayPal/Amazon Pay)
- Amount
- Fee (if available from payment gateway)
- Net Amount
- Status (succeeded, failed, refunded)
- Refund Date (if applicable)
- Refund Amount (if applicable)

**Use Case**: Financial reconciliation, payment gateway fee tracking, refund tracking.

**5. Product Sales Report** (Aggregated)
- Date range filter
- Top N products (e.g., top 20)

**Columns**:
- Product ID
- SKU
- Product Name
- Category
- Units Sold (period)
- Total Revenue (period)
- Average Sale Price
- Number of Orders

**Use Case**: Sales analysis, identifying best sellers, inventory planning.

**6. Tax Report**
- Date range filter
- Tax jurisdiction filter (if applicable)

**Columns**:
- Order Number
- Order Date
- Customer Name
- Customer Location (State/Province)
- Subtotal
- Tax Rate
- Tax Amount
- Total Order Value

**Use Case**: Tax filing, sales tax remittance, compliance.

#### Admin Interface (Reports Page)

```
┌──────────────────────────────────────────────┐
│ Reports & Exports                             │
├──────────────────────────────────────────────┤
│                                              │
│ Select Report Type:                          │
│ [Orders Report ▼]                            │
│   - Orders Report                            │
│   - Products Report                          │
│   - Customers Report                         │
│   - Transactions Report                      │
│   - Product Sales Report                     │
│   - Tax Report                               │
│                                              │
│ ┌─ Filters ──────────────────────────────┐  │
│ │ Date Range:                             │  │
│ │ From: [2026-01-01] To: [2026-01-31]    │  │
│ │                                         │  │
│ │ Order Status: [All ▼]                   │  │
│ │ Payment Method: [All ▼]                 │  │
│ └─────────────────────────────────────────┘  │
│                                              │
│ Format: ● CSV  ○ Excel (future)             │
│                                              │
│ [Generate Report]                            │
│                                              │
│ ── Recent Exports ──                         │
│ Orders_2026-01-28.csv (234 KB) [Download]   │
│ Customers_2026-01-25.csv (45 KB) [Download] │
│ Products_2026-01-20.csv (12 KB) [Download]  │
└──────────────────────────────────────────────┘
```

#### API Endpoints

```
# Reports
GET    /api/reports/orders         # Export orders CSV (Owner/Admin with capability)
GET    /api/reports/products       # Export products CSV
GET    /api/reports/customers      # Export customers CSV
GET    /api/reports/transactions   # Export transactions CSV
GET    /api/reports/sales          # Export product sales CSV
GET    /api/reports/tax            # Export tax report CSV

# Query parameters for filtering
?start_date=2026-01-01&end_date=2026-01-31
?status=completed
?payment_method=stripe
?category=electronics
```

#### Permission Check Example

```typescript
// Backend: Check capability before allowing export
@UseGuards(JwtAuthGuard, CapabilityGuard)
@RequireCapability('reports.export')
@Get('/api/reports/orders')
async exportOrders(@Query() filters: ReportFilters) {
  const orders = await this.ordersService.getOrdersForExport(filters)
  const csv = await this.csvService.generateOrdersCsv(orders)

  // Log in audit trail
  await this.auditLog.create({
    action: 'report_exported',
    category: AuditCategory.ECOMMERCE,
    userId: req.user.id,
    metadata: {
      reportType: 'orders',
      filters: filters,
      recordCount: orders.length
    }
  })

  return {
    filename: `orders_${new Date().toISOString().split('T')[0]}.csv`,
    data: csv
  }
}
```

#### CSV Generation Library

**Recommended**: `csv-writer` or `fast-csv` npm packages

```typescript
import { createObjectCsvWriter } from 'csv-writer'

async function generateOrdersCsv(orders: Order[]): Promise<string> {
  const csvWriter = createObjectCsvWriter({
    path: 'temp/orders.csv',
    header: [
      { id: 'orderNumber', title: 'Order Number' },
      { id: 'orderDate', title: 'Order Date' },
      { id: 'customerName', title: 'Customer Name' },
      { id: 'customerEmail', title: 'Customer Email' },
      { id: 'status', title: 'Status' },
      { id: 'paymentMethod', title: 'Payment Method' },
      { id: 'total', title: 'Total' }
    ]
  })

  await csvWriter.writeRecords(orders)
  return fs.readFileSync('temp/orders.csv', 'utf-8')
}
```

### Tax Calculation

**Options:**
1. **Stripe Tax Integration** (recommended): Automatic tax calculation based on customer location
2. **Manual Tax Rates**: Define tax rates per state/region
3. **Third-party Tax Service**: TaxJar, Avalara (future)

### Shipping

#### Shipping Zones
- Define shipping zones by country/region
- Assign shipping methods to zones
- Set shipping rates per method

#### Shipping Methods
- Flat rate
- Free shipping (with minimum order amount)
- Calculated rates (future: UPS, FedEx, USPS integration)

#### Shipping Labels
- Manual entry of tracking numbers
- Shipping label generation (future: ShipStation, EasyPost)

## Non-Functional Requirements

### Security
- PCI DSS compliance via Stripe/PayPal
- SSL/TLS for all transactions (HTTPS required)
- No storage of raw credit card data
- Secure session management
- CSRF protection
- SQL injection prevention
- XSS protection

### Performance
- Product page load: < 2 seconds
- Add to cart action: < 500ms
- Checkout page load: < 2 seconds
- Payment processing: < 3 seconds (user feedback)

### Reliability
- Payment gateway uptime: 99.9% (Stripe/PayPal SLA)
- Order data integrity: 100% (database transactions)
- Webhook retry logic for failed events

### Scalability
- Support 100,000+ products
- Handle 1,000+ concurrent users
- Process 10,000+ orders per day

## Technical Specifications

### Database Schema (Conceptual)

```sql
-- Products
products {
  id: uuid PK
  title: varchar(255)
  slug: varchar(255) unique
  description: text
  short_description: varchar(500)
  sku: varchar(100) unique
  regular_price: decimal(10,2)
  sale_price: decimal(10,2)
  stock_quantity: integer
  stock_status: enum
  visibility: enum (public, logged_in_only, admin_only)
  guest_purchaseable: boolean
  comment_visibility: enum (disabled, logged_in_only, public)
  average_rating: decimal(2,1)  // Cached average of reviews
  review_count: integer          // Cached count of approved reviews
  weight: decimal(10,2)
  image_id: uuid FK
  created_at: timestamp
  updated_at: timestamp
}

-- Orders
orders {
  id: uuid PK
  order_number: varchar(20) unique
  customer_id: uuid FK (nullable for guest)
  customer_email: varchar(255)
  customer_name: varchar(255)
  shipping_address: jsonb
  billing_address: jsonb
  subtotal: decimal(10,2)
  shipping_cost: decimal(10,2)
  tax: decimal(10,2)
  total: decimal(10,2)
  payment_method: varchar(50)
  payment_status: enum
  order_status: enum
  stripe_payment_intent_id: varchar(255)
  created_at: timestamp
  updated_at: timestamp
}

-- Order Items
order_items {
  id: uuid PK
  order_id: uuid FK
  product_id: uuid FK
  product_name: varchar(255)
  product_sku: varchar(100)
  quantity: integer
  price: decimal(10,2)
  total: decimal(10,2)
}

-- Carts (persistent)
carts {
  id: uuid PK
  user_id: uuid FK (nullable)
  session_id: varchar(255)
  items: jsonb
  created_at: timestamp
  updated_at: timestamp
}

-- Product Categories
product_categories {
  id: uuid PK
  name: varchar(100)
  slug: varchar(100) unique
  description: text
  parent_id: uuid FK
  image_id: uuid FK
}
```

### API Endpoints

```
# Products
GET    /api/products              # List products (public)
GET    /api/products/:id          # Get product details (public)
POST   /api/products              # Create product (admin)
PUT    /api/products/:id          # Update product (admin)
DELETE /api/products/:id          # Delete product (admin)

# Cart
GET    /api/cart                  # Get current cart
POST   /api/cart/items            # Add item to cart
PUT    /api/cart/items/:id        # Update cart item quantity
DELETE /api/cart/items/:id        # Remove item from cart
DELETE /api/cart                  # Clear cart

# Checkout
POST   /api/checkout/calculate    # Calculate totals with shipping
POST   /api/checkout/payment-intent # Create Stripe payment intent
POST   /api/checkout/complete     # Complete order after payment

# Orders
GET    /api/orders                # List orders (user: own, admin: all)
GET    /api/orders/:id            # Get order details
PUT    /api/orders/:id            # Update order status (admin)
POST   /api/orders/:id/refund     # Process refund (admin)

# Product Reviews
GET    /api/products/:id/reviews      # List reviews for product
POST   /api/products/:id/reviews      # Create review (Member+)
PUT    /api/reviews/:id               # Update own review
DELETE /api/reviews/:id               # Delete own review
PUT    /api/reviews/:id/moderate      # Approve/reject review (Admin+)

# Webhooks
POST   /api/webhooks/stripe       # Stripe webhook endpoint
POST   /api/webhooks/paypal       # PayPal webhook endpoint
POST   /api/webhooks/amazon-pay   # Amazon Pay webhook endpoint
```

## Integration Architecture

```
┌──────────────┐
│   Frontend   │
│   (Next.js)  │
└──────┬───────┘
       │
       │ API Calls
       │
┌──────▼─────────────────────────────────────────┐
│          Backend (NestJS)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐│
│  │ Product  │  │   Cart   │  │   Order      ││
│  │ Service  │  │ Service  │  │   Service    ││
│  └──────────┘  └──────────┘  └──────┬───────┘│
│                                      │        │
│  ┌───────────────────────────────────▼──────┐ │
│  │       Payment Service                    │ │
│  │  ┌──────────┐  ┌──────────┐  ┌────────┐ │ │
│  │  │  Stripe  │  │  PayPal  │  │ Amazon │ │ │
│  │  │  Client  │  │  Client  │  │  Pay   │ │ │
│  │  └────┬─────┘  └────┬─────┘  └───┬────┘ │ │
│  └───────┼─────────────┼────────────┼──────┘ │
└──────────┼─────────────┼────────────┼────────┘
           │             │            │
   ┌───────▼────┐  ┌─────▼────┐  ┌───▼──────┐
   │   Stripe   │  │  PayPal  │  │  Amazon  │
   │    API     │  │    API   │  │ Pay API  │
   └────────────┘  └──────────┘  └──────────┘
           │             │            │
       Webhooks      Webhooks     Webhooks
```

## Dependencies

- Stripe Node.js SDK
- Stripe React SDK (for Stripe Elements)
- PayPal JavaScript SDK
- Amazon Pay SDK for JavaScript
- Tax calculation service (Stripe Tax or TaxJar)
- Email service for order confirmations

## Open Questions & Answers

### Answered Questions ✅

1. ~~Do we need multi-currency support initially?~~ → **NO** - USD only for MVP
2. ~~Should we support subscription/recurring products in MVP?~~ → **NO** - Post-MVP consideration
3. ~~Do we need gift card functionality?~~ → **NO** - Not needed
4. ~~Do we need wholesale/bulk pricing tiers?~~ → **NO** - Not needed
5. ~~Should we support product reviews and ratings?~~ → **YES** - Implemented as review-type comments with star ratings (see PRD 09)

6. ~~Should we implement a loyalty/rewards program?~~ → **NO** - Not planned for MVP or post-MVP
7. ~~Should we support multiple payment methods per order (e.g., gift card + credit card)?~~ → **NO** - Single payment method per order
8. ~~Do we need integration with accounting software (QuickBooks, Xero)?~~ → **NO direct integration** - Instead, implement **CSV report export capability** for manual import into accounting software

## Success Metrics

- Cart abandonment rate < 70%
- Checkout completion rate > 60%
- Payment success rate > 98%
- Average checkout time < 3 minutes
- Zero payment security incidents
- Customer satisfaction with checkout process > 4.5/5
