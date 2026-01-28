# PRD 12: Granular Permissions & Audit Trail

**Version:** 1.0
**Date:** 2026-01-28
**Status:** Draft - MVP Feature
**Parent:** [Master PRD](./00-master-prd.md)
**Related**: [PRD 09: User Management & Authentication](./09-user-management-auth.md)

## Overview

This document defines the granular permission system for content ownership, version control for legal documents, and legally robust audit trail logging.

## Part 1: Granular Content Permissions

### Overview

While the capability system (PRD 09) defines **role-level permissions**, this system defines **content-level permissions** that can override role capabilities on a per-item basis.

### Content Ownership Model

#### Default Permissions

**Articles created by a user**:
- ✅ **Author** (creator): Can edit and delete by default
- ✅ **Admin**: Can edit and delete (via role capability)
- ✅ **Owner**: Can edit and delete (always, cannot be removed)

**Pages, Products**:
- Same ownership model as articles

### Per-Content Permission Overrides

**Admin/Owner can toggle permissions on specific content items**:

#### Permission Flags (Database Schema)

```typescript
model Article {
  id                    String   @id @default(uuid())
  title                 String
  author_id             String
  author                User     @relation(fields: [author_id])

  // Granular permission flags
  author_can_edit       Boolean  @default(true)
  author_can_delete     Boolean  @default(true)
  admin_can_edit        Boolean  @default(true)
  admin_can_delete      Boolean  @default(true)

  // Note: Owner permissions are ALWAYS true, no flags needed

  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt
}

model Page {
  // Same permission flags as Article
  author_can_edit       Boolean  @default(true)
  author_can_delete     Boolean  @default(true)
  admin_can_edit        Boolean  @default(true)
  admin_can_delete      Boolean  @default(true)
}

model Product {
  // Same permission flags as Article
  author_can_edit       Boolean  @default(true)
  author_can_delete     Boolean  @default(true)
  admin_can_edit        Boolean  @default(true)
  admin_can_delete      Boolean  @default(true)
}
```

### Permission Evaluation Logic

**OR Logic**: If user has permission via ANY path, access is granted.

```typescript
function canEditArticle(user: User, article: Article): boolean {
  // Owner ALWAYS has permission (no check needed)
  if (user.role === 'owner') return true

  // Admin: Check role capability AND content flag (OR logic)
  if (user.role === 'admin') {
    const hasAdminCapability = user.hasCapability('article.edit')
    const contentAllowsAdmin = article.admin_can_edit
    return hasAdminCapability && contentAllowsAdmin
  }

  // Author: Check if user is author AND content flag
  if (user.id === article.author_id) {
    return article.author_can_edit
  }

  // No other roles can edit
  return false
}
```

**Examples**:

**Scenario 1**: Author loses edit permission, but author is also an Admin
- `author_can_edit = false`
- User role: Admin
- User is original author
- Result: **CAN EDIT** (via Admin role path, not author path)

**Scenario 2**: Author loses edit permission, author is Owner
- `author_can_edit = false`
- User role: Owner
- Result: **CAN EDIT** (Owner always has permission)

**Scenario 3**: Admin loses edit permission on specific article
- `admin_can_edit = false`
- User role: Admin (not author)
- Result: **CANNOT EDIT** (admin path blocked)

### Admin Interface for Permission Management

**Article Edit Page (Admin/Owner View)**:

```
┌─────────────────────────────────────────────┐
│ Edit Article: "Article Title"              │
├─────────────────────────────────────────────┤
│ Author: John Doe                            │
│                                             │
│ [Article Content Editor...]                 │
│                                             │
│ ┌─ Advanced Permissions ──────────────────┐│
│ │ (Only visible to Admin/Owner)           ││
│ │                                          ││
│ │ Author Permissions:                      ││
│ │ ☑ Author can edit this article          ││
│ │ ☑ Author can delete this article        ││
│ │                                          ││
│ │ Admin Permissions: (Owner only)          ││
│ │ ☑ Admins can edit this article          ││
│ │ ☑ Admins can delete this article        ││
│ │                                          ││
│ │ Note: Owner permissions cannot be        ││
│ │ removed (always has full access).        ││
│ └──────────────────────────────────────────┘│
│                                             │
│ [Save Changes]                              │
└─────────────────────────────────────────────┘
```

**Permission Management Rules**:

| User Managing | Can Toggle |
|---------------|------------|
| **Owner** | ✅ author_can_edit/delete<br>✅ admin_can_edit/delete |
| **Admin** | ✅ author_can_edit/delete<br>❌ admin_can_edit/delete (cannot modify own role's permissions) |
| **Author** | ❌ No access to permission toggles |

### Audit Logging for Permission Changes

**Every permission change is logged**:

```typescript
{
  action: 'content_permission_changed',
  userId: 'owner-uuid',
  targetUserId: 'author-uuid',
  resourceType: 'article',
  resourceId: 'article-uuid',
  changes: {
    author_can_edit: { from: true, to: false },
    author_can_delete: { from: true, to: false }
  },
  reason: 'Content locked for legal review',
  timestamp: '2026-01-28T12:00:00Z'
}
```

## Part 2: Version Control for Articles

### Overview

**Version control is OPTIONAL and OFF by default**. It can be enabled per-article for legal documents (EULA, Privacy Policy) or any content requiring change tracking.

### Version Control Requirements

**Use Cases**:
1. **EULA (End User License Agreement)**: Track versions, require user acceptance
2. **Privacy Policy**: Track versions, require user acceptance
3. **Terms of Service**: Track versions
4. **Important announcements**: Audit trail of changes
5. **Regulatory documents**: Compliance tracking

### Database Schema

```typescript
model Article {
  // ... existing fields

  version_control_enabled Boolean @default(false)
  current_version         Int     @default(1)

  versions                ArticleVersion[]
  userAcceptances         ArticleAcceptance[]
}

model ArticleVersion {
  id              String   @id @default(uuid())
  article_id      String
  article         Article  @relation(fields: [article_id])
  version_number  Int      // 1, 2, 3, ...
  title           String
  content         String
  change_summary  String?  // Brief description of changes
  created_by      String
  creator         User     @relation(fields: [created_by])
  created_at      DateTime @default(now())

  // Snapshot of article at this version
  metadata        Json?    // Store full article state

  @@unique([article_id, version_number])
  @@index([article_id, version_number])
}

model ArticleAcceptance {
  id              String   @id @default(uuid())
  article_id      String
  article         Article  @relation(fields: [article_id])
  version_number  Int      // Which version was accepted
  user_id         String
  user            User     @relation(fields: [user_id])
  accepted_at     DateTime @default(now())
  ip_address      String   // For legal audit trail
  user_agent      String   // Browser/device info

  @@unique([article_id, version_number, user_id])
  @@index([user_id, article_id])
}
```

### Version Control Workflow

**Enable Version Control (Admin/Owner)**:

1. Edit article
2. Toggle "Enable Version Control" checkbox
3. System creates Version 1 snapshot of current content
4. Future saves create new versions

**Editing Versioned Articles**:

```
Admin edits EULA article
       ↓
Admin clicks "Save"
       ↓
System prompts: "Describe changes"
       ↓
Admin enters: "Updated data retention policy"
       ↓
System creates new ArticleVersion
  - version_number: 2
  - content: [new content]
  - change_summary: "Updated data retention policy"
       ↓
Article.current_version = 2
       ↓
All users now see version 2
       ↓
Users who accepted version 1 must re-accept version 2
```

### User Acceptance Tracking

**EULA/Privacy Policy Display**:

```
┌──────────────────────────────────────────────┐
│ Privacy Policy (Version 2)                   │
│ Last updated: January 28, 2026               │
├──────────────────────────────────────────────┤
│                                              │
│ [Full privacy policy content...]            │
│                                              │
├──────────────────────────────────────────────┤
│ You must accept this policy to continue.    │
│                                              │
│ ☐ I have read and accept the Privacy Policy │
│                                              │
│ [Cancel]  [Accept and Continue]             │
└──────────────────────────────────────────────┘
```

**On user login**:

```typescript
async function checkUserAcceptance(user: User) {
  // Get current EULA and Privacy Policy versions
  const eula = await getEULA() // Article with special type
  const privacyPolicy = await getPrivacyPolicy()

  // Check if user has accepted current versions
  const eulaAccepted = await hasAcceptedVersion(user.id, eula.id, eula.current_version)
  const privacyAccepted = await hasAcceptedVersion(user.id, privacyPolicy.id, privacyPolicy.current_version)

  if (!eulaAccepted) {
    // Redirect to EULA acceptance page
    return { requiresAcceptance: 'eula', article: eula }
  }

  if (!privacyAccepted) {
    // Redirect to Privacy Policy acceptance page
    return { requiresAcceptance: 'privacy', article: privacyPolicy }
  }

  // All accepted, proceed
  return { requiresAcceptance: null }
}
```

**Record acceptance**:

```typescript
async function recordAcceptance(
  userId: string,
  articleId: string,
  versionNumber: number,
  ipAddress: string,
  userAgent: string
) {
  await prisma.articleAcceptance.create({
    data: {
      user_id: userId,
      article_id: articleId,
      version_number: versionNumber,
      accepted_at: new Date(),
      ip_address: ipAddress,
      user_agent: userAgent
    }
  })

  // Log in audit trail
  await auditLog.create({
    action: 'legal_document_accepted',
    userId,
    metadata: {
      articleId,
      versionNumber,
      ipAddress,
      userAgent
    }
  })
}
```

### Version History UI (Admin)

```
┌─────────────────────────────────────────────┐
│ Article: "Privacy Policy"                  │
│ Version Control: Enabled ✓                 │
├─────────────────────────────────────────────┤
│ Version History:                            │
│                                             │
│ v2 (Current) - Jan 28, 2026 by Admin       │
│ "Updated data retention policy"            │
│ ├─ Accepted by: 1,234 users                │
│ ├─ Pending: 56 users                       │
│ └─ [View Version] [Compare with v1]        │
│                                             │
│ v1 - Jan 1, 2026 by Owner                  │
│ "Initial privacy policy"                   │
│ ├─ Accepted by: 1,290 users (all time)     │
│ └─ [View Version]                           │
└─────────────────────────────────────────────┘
```

## Part 3: Audit Trail Log

### Overview

A **legally robust audit trail** that tracks all significant user actions, content changes, and system events for compliance, security, and dispute resolution.

### Audit Log Requirements

**Must be**:
- Immutable (append-only)
- Tamper-evident (checksums/hashing)
- Timestamped with timezone
- Searchable and filterable
- Exportable for legal purposes
- Retained for minimum 7 years (configurable)

### Events to Track

#### User Account Events
- `user_signup` - Member account creation
- `user_login` - Successful login (front door)
- `user_login_failed` - Failed login attempt
- `admin_login` - Admin/Owner login (back door)
- `admin_login_2fa` - 2FA verification completed
- `user_logout` - Explicit logout
- `user_profile_updated` - Profile changes (name, email, etc.)
- `user_password_changed` - Password update
- `user_password_reset_requested` - Password reset initiated
- `user_email_changed` - Email address change
- `user_role_changed` - Role escalation/demotion (by Admin/Owner)
- `user_deleted` - Account deletion
- `user_suspended` - Account suspended by Admin

#### Authentication & Authorization
- `oauth_login_google` - Google OAuth login
- `oauth_login_apple` - Apple OAuth login
- `2fa_enabled` - User enabled 2FA
- `2fa_disabled` - User disabled 2FA
- `2fa_recovery_code_used` - Recovery code utilized
- `capability_granted` - Capability assigned to user/role
- `capability_revoked` - Capability removed

#### Ecommerce Events
- `order_created` - Order initiated
- `order_payment_attempted` - Payment processing started
- `order_payment_succeeded` - Payment confirmed
- `order_payment_failed` - Payment failed
- `order_completed` - Order fulfilled
- `order_refunded` - Refund processed
- `order_cancelled` - Order cancelled
- `cart_abandoned` - Cart left without purchase (analytics)
- `product_purchased` - Specific product bought

#### Digital Products (eBook)
- `ebook_downloaded` - eBook download
- `ebook_sent_to_kindle` - Send to Kindle action
- `digital_product_access_revoked` - Download access removed

#### Content Events
- `article_created` - Article published
- `article_updated` - Article edited
- `article_deleted` - Article removed
- `article_version_created` - New version (if versioned)
- `page_created` - Page published
- `page_updated` - Page edited
- `page_deleted` - Page removed
- `product_created` - Product added
- `product_updated` - Product modified
- `product_deleted` - Product removed
- `media_uploaded` - File uploaded to media library
- `media_deleted` - File removed

#### Permission Events
- `content_permission_changed` - Per-content permission toggle
- `article_locked` - Edit/delete permissions removed
- `article_unlocked` - Permissions restored

#### Comment & Review Events
- `comment_created` - Comment posted
- `comment_updated` - Comment edited
- `comment_deleted` - Comment removed
- `comment_moderated` - Comment approved/rejected
- `review_created` - Product review posted
- `review_updated` - Review edited
- `review_deleted` - Review removed

#### Legal Document Events
- `legal_document_accepted` - EULA/Privacy Policy accepted
- `legal_document_version_created` - New version of legal doc
- `legal_document_published` - Legal doc made live

#### Admin Actions
- `user_modified_by_admin` - Admin edited user account
- `content_modified_by_admin` - Admin edited another user's content
- `permission_changed_by_owner` - Owner changed permissions
- `system_settings_changed` - System configuration updated
- `payment_settings_changed` - Stripe/PayPal keys updated

### Database Schema

```typescript
model AuditLog {
  id              String   @id @default(uuid())

  // What happened
  action          String   // Event type (e.g., "user_login", "order_completed")
  category        AuditCategory @default(OTHER)

  // Who did it
  user_id         String?  // Nullable for system actions
  user_email      String?  // Snapshot of email at time of action
  user_role       String?  // Snapshot of role at time

  // Who was affected (if different)
  target_user_id  String?  // For actions affecting other users

  // What was affected
  resource_type   String?  // "article", "order", "product", "user"
  resource_id     String?  // UUID of the resource

  // Context
  ip_address      String
  user_agent      String

  // Additional data (JSON)
  metadata        Json?    // Flexible field for action-specific data

  // Change tracking (for updates)
  changes         Json?    // { field: { from: old, to: new } }

  // Tamper detection
  checksum        String   // SHA-256 of serialized log entry
  previous_id     String?  // Previous log entry (blockchain-like)

  // Timestamp
  created_at      DateTime @default(now())

  @@index([user_id, created_at])
  @@index([action, created_at])
  @@index([resource_type, resource_id])
  @@index([created_at])
}

enum AuditCategory {
  USER_ACCOUNT
  AUTHENTICATION
  AUTHORIZATION
  CONTENT
  ECOMMERCE
  LEGAL
  ADMIN_ACTION
  SYSTEM
  OTHER
}
```

### Audit Log Service

```typescript
@Injectable()
export class AuditLogService {

  async log(params: {
    action: string
    category?: AuditCategory
    userId?: string
    targetUserId?: string
    resourceType?: string
    resourceId?: string
    ipAddress: string
    userAgent: string
    metadata?: any
    changes?: any
  }) {
    // Get previous log entry for chaining
    const previousLog = await this.getLatestLog()

    // Create log entry
    const logEntry = {
      id: uuid(),
      action: params.action,
      category: params.category || AuditCategory.OTHER,
      user_id: params.userId,
      target_user_id: params.targetUserId,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      metadata: params.metadata,
      changes: params.changes,
      previous_id: previousLog?.id,
      created_at: new Date()
    }

    // Compute checksum (tamper detection)
    logEntry.checksum = this.computeChecksum(logEntry)

    // Insert into database (append-only)
    await prisma.auditLog.create({ data: logEntry })

    // Optional: Send critical events to external logging
    if (this.isCriticalEvent(params.action)) {
      await this.sendToExternalLog(logEntry)
    }
  }

  private computeChecksum(entry: any): string {
    const data = JSON.stringify({
      ...entry,
      checksum: undefined // Exclude checksum field
    })
    return crypto.createHash('sha256').update(data).digest('hex')
  }
}
```

### Usage Examples

```typescript
// User signup
await auditLog.log({
  action: 'user_signup',
  category: AuditCategory.USER_ACCOUNT,
  userId: newUser.id,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  metadata: {
    email: newUser.email,
    signupMethod: 'email' // or 'google', 'apple'
  }
})

// Order completed
await auditLog.log({
  action: 'order_completed',
  category: AuditCategory.ECOMMERCE,
  userId: order.customerId,
  resourceType: 'order',
  resourceId: order.id,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  metadata: {
    orderNumber: order.orderNumber,
    total: order.total,
    items: order.items.map(i => i.product.name),
    paymentMethod: order.paymentMethod
  }
})

// EULA accepted
await auditLog.log({
  action: 'legal_document_accepted',
  category: AuditCategory.LEGAL,
  userId: user.id,
  resourceType: 'article',
  resourceId: eula.id,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  metadata: {
    documentType: 'eula',
    versionNumber: eula.current_version
  }
})

// Admin changed user role
await auditLog.log({
  action: 'user_role_changed',
  category: AuditCategory.AUTHORIZATION,
  userId: admin.id,
  targetUserId: targetUser.id,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  changes: {
    role: { from: 'member', to: 'admin' }
  },
  metadata: {
    reason: 'Promoted to admin for content management'
  }
})
```

### Audit Log Viewer (Admin Dashboard)

```
┌────────────────────────────────────────────────────────┐
│ Audit Trail Log                                        │
├────────────────────────────────────────────────────────┤
│ Filters: [All Events ▼] [All Users ▼] [Last 30 Days ▼]│
│ Search: [_____________________] [Search] [Export CSV] │
├────────────────────────────────────────────────────────┤
│                                                        │
│ 2026-01-28 12:34:56 | user_login                     │
│ User: john@example.com (Member)                       │
│ IP: 192.168.1.100 | Method: Email+Password           │
│                                                        │
│ 2026-01-28 12:30:15 | order_completed                │
│ User: jane@example.com (Member)                       │
│ Order: #12345 | Total: $39.99 | Payment: Stripe      │
│                                                        │
│ 2026-01-28 11:45:22 | legal_document_accepted        │
│ User: bob@example.com (Member)                        │
│ Document: Privacy Policy v2                           │
│ IP: 10.0.1.50                                         │
│                                                        │
│ 2026-01-28 10:12:03 | user_role_changed              │
│ Admin: owner@example.com (Owner)                      │
│ Target: alice@example.com                             │
│ Change: Member → Admin                                │
│                                                        │
│ [Load More...]                                         │
└────────────────────────────────────────────────────────┘
```

### Export for Legal Purposes

```typescript
async function exportAuditLog(filters: {
  userId?: string
  startDate?: Date
  endDate?: Date
  actions?: string[]
}): Promise<Buffer> {
  const logs = await prisma.auditLog.findMany({
    where: {
      user_id: filters.userId,
      created_at: {
        gte: filters.startDate,
        lte: filters.endDate
      },
      action: filters.actions ? { in: filters.actions } : undefined
    },
    orderBy: { created_at: 'asc' }
  })

  // Generate CSV
  const csv = stringify(logs, {
    header: true,
    columns: [
      'id', 'action', 'user_id', 'user_email',
      'resource_type', 'resource_id', 'ip_address',
      'created_at', 'metadata'
    ]
  })

  return Buffer.from(csv)
}
```

### Retention Policy

**Default**: 7 years (legal compliance)
**Archival**: After 7 years, move to cold storage or delete (depending on requirements)

```typescript
async function archiveOldLogs() {
  const sevenYearsAgo = new Date()
  sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7)

  const oldLogs = await prisma.auditLog.findMany({
    where: { created_at: { lt: sevenYearsAgo } }
  })

  // Export to S3 cold storage
  await exportToArchive(oldLogs)

  // Delete from primary database
  await prisma.auditLog.deleteMany({
    where: { created_at: { lt: sevenYearsAgo } }
  })
}
```

## MVP Scope

**Phase 1 (MVP)**:
- ✅ Granular content permissions (author/admin toggles)
- ✅ Version control for EULA and Privacy Policy
- ✅ User acceptance tracking
- ✅ Basic audit trail (all critical events)
- ✅ Audit log viewer (admin dashboard)

**Phase 2 (Post-MVP)**:
- Version control for all articles (optional toggle)
- Diff view for version comparison
- Advanced audit log filtering/search
- Automated compliance reports
- Webhook notifications for critical audit events
- External log shipping (Datadog, Splunk)

## Success Metrics

- ✅ 100% of critical actions logged (zero gaps)
- ✅ Audit log integrity verified (checksums match)
- ✅ Legal document acceptance rate > 99%
- ✅ Zero unauthorized content modifications
- ✅ Audit log query performance < 2 seconds
- ✅ Export compliance reports in < 30 seconds

---

**Last Updated**: 2026-01-28
**Status**: Draft - MVP Feature Specification
