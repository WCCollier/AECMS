# PRD 11: Digital Products - eBooks

**Version:** 1.0
**Date:** 2026-01-28
**Status:** Draft - MVP Feature
**Parent:** [Master PRD](./00-master-prd.md)
**Related**: [PRD 03: Ecommerce](./03-ecommerce.md)

## Overview

This document defines the digital product functionality for AECMS, specifically focusing on eBook distribution with personalization, download delivery, and "Send to Kindle" functionality.

## Product Type: eBook (MVP)

### Requirements

**File Format**: EPUB
**File Size**: Maximum 16 MB per eBook
**Delivery Methods**:
1. Direct download (personalized)
2. Send to Kindle (via email delivery)

### eBook Product Fields

```typescript
model Product {
  // ... existing product fields

  // Digital product specific
  product_type         ProductType  @default(physical)
  digital_file_id      String?      // Reference to uploaded EPUB
  digital_file         Media?       @relation(fields: [digital_file_id])
  personalization_enabled Boolean   @default(false)
  kindle_delivery_enabled Boolean   @default(true)
  download_limit       Int?         // Max downloads per purchase (null = unlimited)
  access_duration_days Int?         // Access expires after N days (null = lifetime)
}

enum ProductType {
  physical      // Shipped product
  digital       // eBook, PDF, etc.
  subscription  // Future: recurring
}
```

## eBook Personalization (Stamping)

### Purpose
Personalize each eBook with customer information to:
- Discourage piracy/sharing
- Create sense of ownership
- Track distribution

### Personalization Process

**Customer Information to Stamp**:
- Customer name: `{customer.firstName} {customer.lastName}`
- Purchase date: `Purchased on {date}`
- Order number: `Order #{orderNumber}`
- Optional: Customer email (for contact if found on piracy sites)

**EPUB Front Page Modification**:

1. **Extract EPUB Structure**:
   - EPUB is a ZIP archive containing HTML/XHTML files
   - Locate first content file (usually `OEBPS/Text/titlepage.xhtml` or `OEBPS/Text/chapter01.xhtml`)

2. **Inject Personalization HTML**:
   ```html
   <div class="personalization-stamp" style="page-break-after: always; text-align: center; padding: 2em 0;">
     <h2>This book belongs to:</h2>
     <h3>{Customer Name}</h3>
     <p>Purchased on {Purchase Date}</p>
     <p>Order #{Order Number}</p>
     <p style="font-size: 0.8em; color: #666;">
       This eBook is for personal use only.
       Unauthorized distribution is prohibited.
     </p>
   </div>
   ```

3. **Repackage EPUB**:
   - Modify content file with personalization
   - Re-zip as valid EPUB
   - Store personalized copy temporarily

**Technical Implementation**:

```typescript
// Node.js EPUB processing
import AdmZip from 'adm-zip'
import { JSDOM } from 'jsdom'

async function personalizeEpub(
  originalEpubPath: string,
  customer: Customer,
  order: Order
): Promise<Buffer> {
  // 1. Extract EPUB
  const zip = new AdmZip(originalEpubPath)
  const zipEntries = zip.getEntries()

  // 2. Find content.opf to locate first content file
  const contentOpf = zipEntries.find(e => e.entryName.includes('content.opf'))
  const opfContent = contentOpf.getData().toString('utf8')

  // Parse OPF to find spine/first item
  const firstContentFile = parseFirstContentFile(opfContent)

  // 3. Extract and modify first content file
  const contentEntry = zipEntries.find(e => e.entryName.includes(firstContentFile))
  const contentHtml = contentEntry.getData().toString('utf8')

  // 4. Inject personalization
  const dom = new JSDOM(contentHtml)
  const body = dom.window.document.querySelector('body')

  const stamp = `
    <div class="aecms-personalization" style="page-break-after: always;">
      <h2>This book belongs to:</h2>
      <h3>${customer.firstName} ${customer.lastName}</h3>
      <p>Purchased on ${formatDate(order.createdAt)}</p>
      <p>Order #${order.orderNumber}</p>
      <p>This eBook is for personal use only.</p>
    </div>
  `

  body.innerHTML = stamp + body.innerHTML

  // 5. Update ZIP entry
  zip.updateFile(contentEntry.entryName, Buffer.from(dom.serialize()))

  // 6. Return personalized EPUB as buffer
  return zip.toBuffer()
}
```

**Libraries**:
- `adm-zip`: EPUB (ZIP) manipulation
- `jsdom`: HTML parsing/modification
- `epub-gen`: Alternative EPUB generation library

**Performance**:
- Process on-demand (not pre-generate)
- Cache personalized EPUB for 24 hours
- Generate during checkout completion webhook
- Async job queue (Bull/BullMQ)

## Download Delivery

### Download Flow

1. **Purchase Completed**:
   - Stripe/PayPal webhook confirms payment
   - Order status → "Completed"
   - Trigger eBook personalization job

2. **Personalization Job**:
   - Fetch original EPUB from storage
   - Personalize with customer info
   - Store personalized EPUB temporarily (24h TTL)
   - Send download ready email

3. **Download Link**:
   - Email contains secure download link
   - URL format: `/downloads/{secureToken}`
   - Token expires after 7 days (configurable)
   - Download limit: 5 downloads per purchase (configurable)

4. **Download Endpoint**:
   ```typescript
   GET /api/downloads/:token

   // Verify token, check download limit, stream file
   async function downloadDigitalProduct(token: string) {
     const download = await prisma.download.findUnique({
       where: { token },
       include: { order: true, product: true }
     })

     if (!download) throw new NotFoundException()
     if (download.expiresAt < new Date()) throw new ForbiddenException('Link expired')
     if (download.downloadCount >= download.downloadLimit) {
       throw new ForbiddenException('Download limit reached')
     }

     // Get personalized file
     const fileBuffer = await getPersonalizedEpub(download.order.id, download.product.id)

     // Increment download count
     await prisma.download.update({
       where: { id: download.id },
       data: { downloadCount: { increment: 1 } }
     })

     // Log download in audit trail
     await auditLog.create({
       action: 'digital_product_downloaded',
       userId: download.order.customerId,
       metadata: {
         orderId: download.order.id,
         productId: download.product.id,
         downloadCount: download.downloadCount + 1
       }
     })

     // Stream file
     return {
       buffer: fileBuffer,
       filename: `${download.product.slug}.epub`,
       contentType: 'application/epub+zip'
     }
   }
   ```

### Database Schema

```typescript
model Download {
  id              String    @id @default(uuid())
  token           String    @unique // Secure random token
  order_id        String
  order           Order     @relation(fields: [order_id])
  product_id      String
  product         Product   @relation(fields: [product_id])
  download_count  Int       @default(0)
  download_limit  Int       @default(5)
  expires_at      DateTime  // 7 days from creation
  created_at      DateTime  @default(now())
}
```

## Send to Kindle Feature

### Overview

Similar to Gumroad's implementation:
1. Customer requests "Send to Kindle"
2. Guide customer through Amazon account setup
3. Customer provides Kindle email address
4. System sends EPUB to Kindle via email

### Implementation Flow

#### Step 1: Customer Initiates

**UI (on order confirmation page)**:
```
┌────────────────────────────────────────────┐
│ Order #12345 - Completed                   │
├────────────────────────────────────────────┤
│ eBook: "Your Book Title"                   │
│                                            │
│ [Download EPUB]                            │
│                                            │
│ Send to Kindle:                            │
│ [📧 Send to My Kindle]                    │
└────────────────────────────────────────────┘
```

**Click triggers modal**:
```
┌────────────────────────────────────────────┐
│ Send to Kindle                             │
├────────────────────────────────────────────┤
│ Step 1: Add our email to your Amazon      │
│ account's approved list                    │
│                                            │
│ 1. Go to amazon.com/mycd                  │
│ 2. Under "Personal Document Settings"     │
│ 3. Add this email to "Approved Personal   │
│    Document E-mail List":                  │
│                                            │
│    kindle@aecms.yourdomain.com            │
│    [Copy Email]                            │
│                                            │
│ [I've Added the Email]                    │
└────────────────────────────────────────────┘
```

#### Step 2: Get Kindle Email

**After customer confirms approval**:
```
┌────────────────────────────────────────────┐
│ Send to Kindle                             │
├────────────────────────────────────────────┤
│ Step 2: Enter your Kindle email address   │
│                                            │
│ Find your Kindle email at:                │
│ amazon.com/mycd → "Devices"               │
│                                            │
│ Your Kindle email looks like:             │
│ yourname@kindle.com                       │
│                                            │
│ Kindle Email:                              │
│ [_____________________@kindle.com]        │
│                                            │
│ [Cancel]  [Send to Kindle]                │
└────────────────────────────────────────────┘
```

#### Step 3: Send Email

**Backend process**:
```typescript
async function sendToKindle(orderId: string, kindleEmail: string) {
  // Validate Kindle email format
  if (!kindleEmail.endsWith('@kindle.com')) {
    throw new BadRequestException('Invalid Kindle email')
  }

  // Get order and personalized EPUB
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { orderItems: { include: { product: true } } }
  })

  const product = order.orderItems[0].product
  const epubBuffer = await getPersonalizedEpub(orderId, product.id)

  // Send via SMTP
  await sendEmail({
    from: 'kindle@aecms.yourdomain.com',
    to: kindleEmail,
    subject: product.name,
    text: `Your eBook "${product.name}" is attached.`,
    attachments: [
      {
        filename: `${product.slug}.epub`,
        content: epubBuffer,
        contentType: 'application/epub+zip'
      }
    ]
  })

  // Log in audit trail
  await auditLog.create({
    action: 'ebook_sent_to_kindle',
    userId: order.customerId,
    metadata: {
      orderId,
      productId: product.id,
      kindleEmail
    }
  })

  // Store Kindle email for future use
  await prisma.customer.update({
    where: { id: order.customerId },
    data: { kindleEmail }
  })
}
```

### Amazon Kindle Delivery Constraints

**File Size Limits**:
- Amazon accepts personal documents up to **50 MB** via email
- Our 16 MB limit is well within this
- EPUB is converted to AZW3 automatically by Amazon

**Email Setup**:
- Requires dedicated sending email: `kindle@yourdomain.com`
- Must use authenticated SMTP (SPF, DKIM, DMARC)
- Recommendation: Use AWS SES (Simple Email Service) for deliverability

**Delivery Time**:
- Usually within 5-10 minutes
- Customer receives on all registered Kindle devices
- Also available in Kindle library on Amazon

### Save Kindle Email for Future

```typescript
model User {
  // ... existing fields
  kindleEmail  String?  // Customer's Kindle email address
}
```

**Benefit**: On future eBook purchases, pre-fill Kindle email, skip setup steps

## Technical Requirements

### Storage

**Original EPUB Storage**:
- S3-compatible storage (Cloudflare R2, AWS S3)
- Path: `/products/digital/{productId}/original.epub`
- Public: No (private, signed URLs only)

**Personalized EPUB Storage** (temporary):
- Cache layer: Redis or S3 with 24h TTL
- Path: `/products/digital/{productId}/personalized/{orderId}.epub`
- Garbage collection: Auto-delete after 24h

### Email Service (Kindle Delivery)

**Options**:

1. **AWS SES** (Recommended for deliverability):
   - Cost: $0.10 per 1,000 emails
   - For 1,000 ebook sales/month: ~$0.10/month
   - High deliverability, good reputation
   - Easy setup with Kindle

2. **SendGrid**:
   - Free tier: 100 emails/day
   - For low traffic: likely free
   - Good alternative

3. **SMTP via hosting**:
   - May work but lower deliverability
   - Risk of being blocked by Amazon

**Recommendation**: AWS SES (~$1-5/month for low volume)

### EPUB Processing Libraries

**Node.js**:
- `adm-zip`: ZIP manipulation (EPUB is ZIP format)
- `jsdom`: HTML/XML parsing
- `epub-gen`: EPUB creation (if building from scratch)

**Alternative Approach**:
- Python + `ebooklib`: Robust EPUB library
- Call from Node via child process or microservice

## Security Considerations

### Download Link Security

**Secure Token Generation**:
```typescript
import crypto from 'crypto'

function generateSecureDownloadToken(): string {
  return crypto.randomBytes(32).toString('hex')
}
```

**Token Properties**:
- 64-character hex string
- Cryptographically secure random
- One-time use or limited downloads
- Expires after 7 days

### Prevent Unauthorized Access

**Checks**:
1. ✅ Valid token
2. ✅ Token not expired
3. ✅ Download limit not exceeded
4. ✅ Order is paid and completed
5. ✅ Product is digital type
6. ✅ Log all download attempts

### Piracy Mitigation

**Stamping Benefits**:
- Discourages sharing (customer name on file)
- Traceable if found on piracy sites
- Psychological ownership

**Additional Measures** (future):
- DRM (Digital Rights Management) - complex, not MVP
- Watermarking with subtle customer ID
- DMCA takedown process

## User Experience

### Purchase Flow

```
Customer adds eBook to cart
       ↓
Customer completes checkout (Stripe/PayPal/Amazon Pay)
       ↓
Order completed (webhook received)
       ↓
Async job: Personalize EPUB
       ↓
Email: "Your eBook is ready!"
  - Download link (expires in 7 days)
  - "Send to Kindle" button
       ↓
Customer downloads or sends to Kindle
       ↓
Customer can re-download from order history (5x limit)
```

### Order History Integration

**Customer's orders page**:
```
┌────────────────────────────────────────────┐
│ Your Orders                                 │
├────────────────────────────────────────────┤
│ Order #12345 - Jan 28, 2026                │
│                                            │
│ 📚 "Your eBook Title"                     │
│ Status: Completed                          │
│                                            │
│ [Download EPUB] (3/5 downloads remaining) │
│ [Send to Kindle]                           │
│                                            │
│ Download link expires: Feb 4, 2026         │
└────────────────────────────────────────────┘
```

## MVP Scope

**Included in MVP**:
- ✅ EPUB product type
- ✅ File upload (< 16 MB)
- ✅ Personalization/stamping
- ✅ Download delivery with secure links
- ✅ Send to Kindle via email
- ✅ Download limits (5x default)
- ✅ Link expiration (7 days)
- ✅ Order history download access
- ✅ Audit trail logging

**Post-MVP** (Future enhancements):
- PDF support
- Audio book support
- DRM encryption
- Subscription-based access to library
- Bulk purchases (course bundles)
- Gift purchases with recipient email

## Cost Estimates

**For Low Traffic** (< 1,000 eBook sales/month):

| Service | Usage | Cost |
|---------|-------|------|
| Storage (R2) | 10 GB ebooks | $0 (under 10 GB free) |
| Email (AWS SES) | 1,000 Kindle deliveries | $0.10 |
| Processing (CPU) | Personalization jobs | Included in hosting |
| **Total** | | **~$0.10-1/month** |

Essentially free for MVP scale.

## Open Questions

1. Should we support MOBI format (Kindle native) in addition to EPUB?
2. Should customers be able to update their Kindle email for past purchases?
3. Should we offer bundle pricing (buy multiple ebooks at discount)?
4. Should we support gift purchases (send eBook to friend's Kindle)?
5. What happens if personalization fails? Deliver un-personalized with notification?
6. Should we support "lending" eBooks to other users temporarily?

## Success Metrics

- ✅ eBook purchase flow completes in < 2 minutes
- ✅ Personalization completes in < 30 seconds
- ✅ Download links work 99.9% of the time
- ✅ Kindle delivery success rate > 95%
- ✅ Zero security incidents (unauthorized downloads)
- ✅ Customer satisfaction with Kindle delivery > 4.5/5

---

**Last Updated**: 2026-01-28
**Status**: Draft - MVP Feature Specification
