# PRD 11: Digital Products - eBooks

**Version:** 1.1
**Date:** 2026-01-29
**Status:** Draft - MVP Feature
**Parent:** [Master PRD](./00-master-prd.md)
**Related**: [PRD 03: Ecommerce](./03-ecommerce.md)

## Overview

This document defines the digital product functionality for AECMS, specifically focusing on eBook distribution with personalization, download delivery, and "Send to Kindle" functionality.

## Product Type: eBook (MVP)

### Requirements

**File Formats**: EPUB and/or PDF
**File Size**: Maximum 16 MB per file
**Multiple Formats**: A single eBook product can have master files in multiple formats (e.g., EPUB + PDF)
**Delivery Methods**:
1. Direct download (personalized) - customer selects format
2. Send to Kindle (via email delivery) - works with both EPUB and PDF

### eBook Product Fields

```typescript
model Product {
  // ... existing product fields

  // Digital product specific
  product_type         ProductType  @default(physical)
  digital_files        DigitalProductFile[]  // Multiple format support
  personalization_enabled Boolean   @default(false)
  kindle_delivery_enabled Boolean   @default(true)
  download_limit       Int          @default(5)  // Max downloads per purchase per format
  access_duration_days Int?         // Access expires after N days (null = lifetime, default 7)
}

model DigitalProductFile {
  id                  String   @id @default(uuid())
  product_id          String
  product             Product  @relation(fields: [product_id], references: [id], onDelete: Cascade)
  format              FileFormat
  file_id             String   // Reference to Media storage
  file                Media    @relation(fields: [file_id], references: [id])
  file_size_bytes     Int
  personalization_tested Boolean  @default(false)  // Tested during product creation
  created_at          DateTime @default(now())

  @@unique([product_id, format])  // One file per format per product
  @@index([product_id])
}

enum ProductType {
  physical      // Shipped product
  digital       // eBook, PDF, etc.
  subscription  // Future: recurring
}

enum FileFormat {
  epub
  pdf
  // Future: mobi, azw3, audiobook formats
}
```

## eBook Product Creation & Testing

### Product Creation Workflow

When creating a digital product (eBook), the admin follows this workflow:

**Step 1: Create Product (Basic Info)**
- Enter product details (title, description, price, etc.)
- Select product type: **Digital**
- Enable/disable personalization
- Enable/disable Kindle delivery
- Set download limits

**Step 2: Upload Master Files**

Admin uploads one or more master files in different formats:

```
┌─────────────────────────────────────────────┐
│ Digital Files                                │
├─────────────────────────────────────────────┤
│ Format: [EPUB ▼]                            │
│ [Choose File] master-book.epub              │
│ [Upload]                                    │
│                                             │
│ ✅ EPUB uploaded (2.4 MB)                   │
│    [Test Personalization] [Remove]          │
│                                             │
│ ─────────────────────────────────────────   │
│                                             │
│ Format: [PDF ▼]                             │
│ [Choose File] master-book.pdf               │
│ [Upload]                                    │
│                                             │
│ ✅ PDF uploaded (5.1 MB)                    │
│    [Test Personalization] [Remove]          │
│                                             │
│ [+ Add Another Format]                      │
└─────────────────────────────────────────────┘
```

**Step 3: Test Personalization (Per Format)**

For each uploaded file, admin clicks **Test Personalization**:

1. System generates test personalized version with sample data:
   ```
   Customer Name: Test Customer
   Purchase Date: 2026-01-29
   Order Number: TEST-00000
   ```

2. System processes file (personalizes EPUB or stamps PDF)

3. Admin downloads test file to review:
   - Check that personalization appears correctly
   - Verify file opens in reader/Kindle
   - Confirm formatting is preserved

4. If test successful → Mark as validated ✅
5. If test fails → Admin can re-upload corrected master file

**Step 4: Validation & Save**

- All formats must have successful personalization test
- Cannot publish product until all files tested
- System stores validation timestamp

### Personalization Testing Implementation

```typescript
async function testPersonalization(productId: string, format: FileFormat) {
  const file = await prisma.digitalProductFile.findUnique({
    where: { product_id_format: { product_id: productId, format } }
  })

  // Generate test personalized file
  const testData = {
    customerName: 'Test Customer',
    purchaseDate: new Date(),
    orderNumber: 'TEST-00000',
    customerEmail: 'test@example.com'
  }

  let personalizedBuffer: Buffer

  if (format === 'epub') {
    personalizedBuffer = await personalizeEpub(file.file.path, testData)
  } else if (format === 'pdf') {
    personalizedBuffer = await personalizePdf(file.file.path, testData)
  }

  // Store test file temporarily (1 hour expiry)
  const testToken = generateSecureToken()
  await storeTemporaryFile(testToken, personalizedBuffer, '1h')

  // Mark as tested
  await prisma.digitalProductFile.update({
    where: { id: file.id },
    data: { personalization_tested: true }
  })

  // Return download URL for admin
  return {
    testDownloadUrl: `/admin/test-downloads/${testToken}`,
    expiresIn: '1 hour'
  }
}
```

**Validation Rules:**
- Cannot publish product without at least one tested format file
- Re-uploading a file resets `personalization_tested` to false
- Admin dashboard shows warning if files not tested

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

### EPUB Personalization

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

### PDF Personalization

**PDF Stamp Implementation**:

```typescript
import { PDFDocument, rgb } from 'pdf-lib'

async function personalizePdf(
  originalPdfPath: string,
  customer: Customer,
  order: Order
): Promise<Buffer> {
  // 1. Load PDF
  const existingPdfBytes = await fs.readFile(originalPdfPath)
  const pdfDoc = await PDFDocument.load(existingPdfBytes)

  // 2. Create personalization page
  const page = pdfDoc.insertPage(0) // Insert as first page
  const { width, height } = page.getSize()

  // 3. Add personalization text
  page.drawText('This book belongs to:', {
    x: width / 2 - 100,
    y: height / 2 + 100,
    size: 18,
    color: rgb(0, 0, 0)
  })

  page.drawText(`${customer.firstName} ${customer.lastName}`, {
    x: width / 2 - 120,
    y: height / 2 + 60,
    size: 24,
    color: rgb(0, 0, 0)
  })

  page.drawText(`Purchased on ${formatDate(order.createdAt)}`, {
    x: width / 2 - 80,
    y: height / 2 + 20,
    size: 12,
    color: rgb(0.4, 0.4, 0.4)
  })

  page.drawText(`Order #${order.orderNumber}`, {
    x: width / 2 - 60,
    y: height / 2 - 10,
    size: 12,
    color: rgb(0.4, 0.4, 0.4)
  })

  page.drawText('This eBook is for personal use only.', {
    x: width / 2 - 90,
    y: height / 2 - 60,
    size: 10,
    color: rgb(0.6, 0.6, 0.6)
  })

  // 4. Save personalized PDF
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
```

**Libraries**:
- `pdf-lib`: PDF manipulation and text insertion
- Alternative: `pdftk` or `ghostscript` via child process

**Performance**:
- Process on-demand (not pre-generate)
- Cache personalized files for 24 hours
- Generate during checkout completion webhook
- Async job queue (Bull/BullMQ)
- Both EPUB and PDF processed in parallel for same order

## Download Delivery

### Download Flow

1. **Purchase Completed**:
   - Stripe/PayPal/Amazon Pay webhook confirms payment
   - Order status → "Completed"
   - Trigger eBook personalization job(s)

2. **Personalization Job(s)**:
   - Fetch original files from storage (EPUB, PDF, or both)
   - Personalize each format with customer info
   - Store personalized files temporarily (24h TTL)
   - Send download ready email with all available formats

3. **Download Links** (Multiple Formats):
   - Email contains secure download links for each format
   - Customer order page shows:
     ```
     [Download EPUB] (3/5 downloads remaining)
     [Download PDF]  (5/5 downloads remaining)
     ```
   - URL format: `/downloads/{secureToken}/{format}`
   - Token expires after 7 days (configurable)
   - Download limit: 5 downloads per purchase **per format** (configurable)
   - Each format has independent download counter

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
  id              String      @id @default(uuid())
  token           String      @unique // Secure random token (same for all formats of same order)
  order_id        String
  order           Order       @relation(fields: [order_id], references: [id])
  product_id      String
  product         Product     @relation(fields: [product_id], references: [id])
  format          FileFormat  // epub, pdf
  download_count  Int         @default(0)
  download_limit  Int         @default(5)
  expires_at      DateTime    // 7 days from creation
  created_at      DateTime    @default(now())

  @@unique([token, format])  // One download record per format
  @@index([order_id])
  @@index([token])
}
```

**Note**: Multiple Download records are created per order (one per available format), but they share the same token. The URL includes format parameter to specify which file to download.

## Kindle Device Management

### Storing Kindle Device Addresses

Users can save multiple Kindle device email addresses with friendly names:

```typescript
model KindleDevice {
  id              String   @id @default(uuid())
  user_id         String
  user            User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  friendly_name   String   // e.g., "My Kindle Paperwhite", "iPad Kindle App"
  kindle_email    String   // e.g., "johndoe_123@kindle.com"
  is_default      Boolean  @default(false)
  created_at      DateTime @default(now())
  last_used_at    DateTime?

  @@index([user_id])
}
```

### Device Management UI

**User Account Settings → Kindle Devices**:
```
┌─────────────────────────────────────────────┐
│ My Kindle Devices                            │
├─────────────────────────────────────────────┤
│ ✓ My Kindle Paperwhite (Default)           │
│   johndoe_123@kindle.com                    │
│   [Edit] [Remove] [Set as Default]         │
│                                             │
│ iPad Kindle App                             │
│   johndoe_456@kindle.com                    │
│   [Edit] [Remove] [Set as Default]         │
│                                             │
│ [+ Add New Kindle Device]                   │
└─────────────────────────────────────────────┘
```

### Add Device Flow

**When user clicks "Add New Kindle Device"**:
```
┌─────────────────────────────────────────────┐
│ Add Kindle Device                            │
├─────────────────────────────────────────────┤
│ Device Name (friendly):                     │
│ [_____________________________]             │
│ (e.g., "My Kindle", "iPad", "Phone")       │
│                                             │
│ Kindle Email Address:                       │
│ [__________________@kindle.com]             │
│                                             │
│ Find your Kindle email:                     │
│ 1. Go to amazon.com/mycd                    │
│ 2. Click "Devices"                          │
│ 3. Find email for your device               │
│                                             │
│ ☐ Set as default device                    │
│                                             │
│ [Cancel]  [Add Device]                      │
└─────────────────────────────────────────────┘
```

## Send to Kindle Feature

### Overview

Enhanced implementation with device management:
1. Customer requests "Send to Kindle"
2. Guide customer through Amazon account setup (first time only)
3. Customer selects from saved devices or adds new device
4. Customer selects format (EPUB or PDF)
5. System sends file to selected Kindle device via email

### Implementation Flow

#### Step 1: Customer Initiates

**UI (on order confirmation page)**:
```
┌────────────────────────────────────────────┐
│ Order #12345 - Completed                   │
├────────────────────────────────────────────┤
│ eBook: "Your Book Title"                   │
│                                            │
│ Available Formats:                         │
│ [Download EPUB] [📧 Send to Kindle]       │
│ [Download PDF]  [📧 Send to Kindle]       │
│                                            │
│ Downloads: 5 remaining per format          │
│ Link expires: Feb 5, 2026                  │
└────────────────────────────────────────────┘
```

**Click "Send to Kindle" triggers modal**:
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

#### Step 2: Select Device & Format

**After customer confirms approval (or skips if already approved)**:
```
┌────────────────────────────────────────────┐
│ Send to Kindle                             │
├────────────────────────────────────────────┤
│ Select Format:                             │
│ ◉ EPUB    ○ PDF                           │
│                                            │
│ Select Kindle Device:                      │
│ ◉ My Kindle Paperwhite (Default)          │
│   johndoe_123@kindle.com                   │
│                                            │
│ ○ iPad Kindle App                          │
│   johndoe_456@kindle.com                   │
│                                            │
│ [+ Add New Device]                         │
│                                            │
│ [Cancel]  [Send to Kindle]                │
└────────────────────────────────────────────┘
```

**If user clicks "Add New Device"**:
```
┌────────────────────────────────────────────┐
│ Add Kindle Device                          │
├────────────────────────────────────────────┤
│ Device Name:                               │
│ [_____________________________]            │
│                                            │
│ Kindle Email Address:                      │
│ [__________________@kindle.com]            │
│                                            │
│ Find your Kindle email at:                │
│ amazon.com/mycd → "Devices"               │
│                                            │
│ ☐ Save for future purchases               │
│ ☐ Set as default device                   │
│                                            │
│ [Back]  [Add & Send]                      │
└────────────────────────────────────────────┘
```

#### Step 3: Send Email

**Backend process**:
```typescript
async function sendToKindle(
  orderId: string,
  kindleDeviceId: string,
  format: FileFormat
) {
  // Get Kindle device
  const device = await prisma.kindleDevice.findUnique({
    where: { id: kindleDeviceId },
    include: { user: true }
  })

  if (!device) throw new NotFoundException('Kindle device not found')

  // Validate Kindle email format
  if (!device.kindle_email.endsWith('@kindle.com')) {
    throw new BadRequestException('Invalid Kindle email')
  }

  // Get order and personalized file
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { orderItems: { include: { product: true } } }
  })

  const product = order.orderItems[0].product

  // Get personalized file in requested format
  let fileBuffer: Buffer
  let filename: string
  let contentType: string

  if (format === 'epub') {
    fileBuffer = await getPersonalizedEpub(orderId, product.id)
    filename = `${product.slug}.epub`
    contentType = 'application/epub+zip'
  } else if (format === 'pdf') {
    fileBuffer = await getPersonalizedPdf(orderId, product.id)
    filename = `${product.slug}.pdf`
    contentType = 'application/pdf'
  }

  // Send via SMTP (AWS SES)
  await sendEmail({
    from: 'kindle@aecms.yourdomain.com',
    to: device.kindle_email,
    subject: product.name,
    text: `Your eBook "${product.name}" is attached.`,
    attachments: [
      {
        filename,
        content: fileBuffer,
        contentType
      }
    ]
  })

  // Update device last_used_at
  await prisma.kindleDevice.update({
    where: { id: kindleDeviceId },
    data: { last_used_at: new Date() }
  })

  // Log in audit trail
  await auditLog.create({
    action: 'ebook_sent_to_kindle',
    userId: order.customerId,
    metadata: {
      orderId,
      productId: product.id,
      kindleDeviceId,
      kindleEmail: device.kindle_email,
      format
    }
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

### File Processing Libraries

**EPUB Processing (Node.js)**:
- `adm-zip`: ZIP manipulation (EPUB is ZIP format)
- `jsdom`: HTML/XML parsing
- `epub-gen`: EPUB creation (if building from scratch)

**PDF Processing (Node.js)**:
- `pdf-lib`: PDF manipulation, text insertion, page creation
- Alternative: `pdfkit` for PDF generation from scratch
- Alternative: `pdftk` via child process (more powerful but requires external binary)

**Alternative Approaches**:
- Python + `ebooklib` (EPUB) + `PyPDF2` (PDF): Robust libraries
- Call from Node via child process or microservice
- Dedicated file processing service if needed

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
│ Available Formats:                         │
│                                            │
│ EPUB                                       │
│ [Download] [📧 Send to Kindle]            │
│ Downloads: 3/5 remaining                   │
│                                            │
│ PDF                                        │
│ [Download] [📧 Send to Kindle]            │
│ Downloads: 5/5 remaining                   │
│                                            │
│ Download links expire: Feb 4, 2026         │
└────────────────────────────────────────────┘
```

## MVP Scope

**Included in MVP**:
- ✅ EPUB product type
- ✅ PDF product type
- ✅ Multiple formats per product (EPUB + PDF)
- ✅ File upload (< 16 MB per file)
- ✅ Personalization/stamping (EPUB and PDF)
- ✅ Personalization testing during product creation
- ✅ Test download generation for creators
- ✅ Download delivery with secure links
- ✅ Format selection for downloads
- ✅ Send to Kindle via email (EPUB and PDF)
- ✅ Kindle device management (multiple devices with friendly names)
- ✅ Device selection on Send to Kindle
- ✅ Download limits (5x per format, default)
- ✅ Link expiration (7 days, configurable)
- ✅ Order history download access
- ✅ Audit trail logging

**Explicitly NOT in MVP**:
- ❌ MOBI format (Amazon converts EPUB automatically)
- ❌ Audio book support
- ❌ DRM encryption
- ❌ Subscription-based access to library
- ❌ Bulk purchases (eBook bundles)
- ❌ Gift purchases with recipient email
- ❌ eBook lending to other users

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

1. ~~Should we support MOBI format (Kindle native) in addition to EPUB?~~ → **YES, support PDF as well as EPUB. Each product can have master files in multiple formats. Customers select format to download/send. Each format has download + Send to Kindle buttons.**

2. ~~Should customers be able to update their Kindle email for past purchases?~~ → **YES, implement full Kindle device management. Users store multiple Kindle device addresses with friendly names. On Send to Kindle, users select from saved devices or add new.**

3. ~~Should we offer bundle pricing (buy multiple ebooks at discount)?~~ → **NO - Not in MVP**

4. ~~Should we support gift purchases (send eBook to friend's Kindle)?~~ → **NO - Not in MVP**

5. ~~What happens if personalization fails? Deliver un-personalized with notification?~~ → **Implement comprehensive product creation testing workflow. Master file uploaded → Test personalization → Generate test download for creator review → Validate before product can be published. Cannot publish untested files.**

6. ~~Should we support "lending" eBooks to other users temporarily?~~ → **NO - Not in MVP**

## Success Metrics

- ✅ eBook purchase flow completes in < 2 minutes
- ✅ Personalization completes in < 30 seconds
- ✅ Download links work 99.9% of the time
- ✅ Kindle delivery success rate > 95%
- ✅ Zero security incidents (unauthorized downloads)
- ✅ Customer satisfaction with Kindle delivery > 4.5/5

---

**Last Updated**: 2026-01-29
**Status**: Draft - MVP Feature Specification

**Version History:**
- v1.1 (2026-01-29): Added PDF support, multiple format handling, Kindle device management, product creation testing workflow
- v1.0 (2026-01-28): Initial EPUB-only specification
