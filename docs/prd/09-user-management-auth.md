# PRD 09: User Management & Authentication

**Version:** 1.0
**Date:** 2026-01-28
**Status:** Draft
**Parent:** [Master PRD](./00-master-prd.md)

## Overview

This document defines the comprehensive user management, role-based access control (RBAC), and authentication strategy for AECMS, including a capability-based permission system and dual authentication pathways ("front door" and "back door").

## User Roles & Hierarchy

### Role Categories

Users fall into two broad categories:
1. **Logged-in users**: Owner, Admin, Member
2. **Not logged-in**: Guest (anonymous sessions)

### Role Definitions

#### Owner (Super-Administrator)
**Description**: Highest privilege level with unrestricted access to all system capabilities.

**Core Capabilities**:
- ✅ **All capabilities** - Always has access to every capability in the system
- ✅ **Capability Management** - Can assign/remove capabilities to/from other roles
- ✅ **Role Management** - Can create, modify, delete roles (except Owner role)
- ✅ **Owner Management** - Only Owners can create/delete other Owners
- ✅ **Full Content Control** - Create, edit, delete articles, pages, media
- ✅ **Full Product Control** - Create, edit, delete products, categories
- ✅ **Full User Control** - Create, edit, delete all users (Owners, Admins, Members)
- ✅ **System Configuration** - Site settings, theme, layout, structure, integrations
- ✅ **Payment Settings** - Configure Stripe/PayPal keys, webhook secrets
- ✅ **Security Settings** - OAuth configuration, 2FA settings

**Restrictions**:
- First Owner must be seeded manually during initial setup
- Owners cannot delete themselves (prevents lockout)
- Must have at least one Owner account at all times

#### Admin
**Description**: Administrative user with elevated privileges, managed by Owners.

**Default Capabilities** (Owner-configurable):
- ✅ Create, edit, delete **articles** (not pages)
- ✅ Create, edit, delete **products**
- ✅ Create, edit, delete **Members** (not Admins or Owners)
- ✅ Manage **media library**
- ✅ Manage **categories and tags**
- ✅ Manage **orders** (view, update status, process refunds)
- ✅ View **analytics and reports**
- ✅ Moderate **comments and reviews** (approve, delete)

**Cannot do** (by default):
- ❌ Create, edit, delete **pages**
- ❌ Manage **site configuration**
- ❌ Manage **payment settings**
- ❌ Create or manage **Admins or Owners**
- ❌ Assign capabilities to roles

**Note**: Owners can adjust Admin capabilities via the capability management interface.

#### Member
**Description**: Standard logged-in user with customer and community privileges.

**Capabilities**:
- ✅ **View content** - Read all public and logged-in-only articles/products
- ✅ **Purchase products** - Full checkout flow, all products
- ✅ **Manage account** - Update profile, addresses, payment methods
- ✅ **View order history** - Access own orders
- ✅ **Comment on articles** - Leave comments (if enabled)
- ✅ **Review products** - Leave reviews (if enabled)
- ✅ **Edit own comments** - Modify/delete own comments and reviews
- ✅ **Save favorites** - Wishlist functionality (future)

**Cannot do**:
- ❌ Access admin interfaces
- ❌ Create or edit articles, pages, products
- ❌ View other users' order history
- ❌ Moderate other users' comments

#### Writer (Future Role - Not in MVP) 📝
**Description**: Content contributor role for future implementation.

**Note**: This role is **not implemented in MVP** but documented as an example of future extensibility of the capability system. Implementation pending explicit approval.

**Proposed Capabilities**:
- ✅ All Member capabilities
- ✅ **Create articles** - Draft and publish articles
- ✅ **Edit own articles** - Modify articles authored by self
- ✅ **Delete own articles** - Remove articles authored by self
- ✅ **Upload media** - Add images/videos to media library for own articles

**Cannot do**:
- ❌ Edit or delete articles by other authors
- ❌ Create or edit pages
- ❌ Create or edit products
- ❌ Access admin dashboard (uses front-door only)
- ❌ Manage users or moderate comments (beyond own articles)

**Use Cases**:
- Blog contributors who write but don't need full admin access
- Guest authors who publish occasional content
- Community contributors in a multi-author setup

**Implementation Notes**:
- This role demonstrates the extensibility of the capability system
- Owner can create this role by assigning appropriate capabilities to a new role tier
- Provides example for future custom roles (Editor, Moderator, etc.)

#### Guest (Unauthenticated)
**Description**: Anonymous session, not logged in.

**Capabilities**:
- ✅ **View public content** - Articles and products marked as Guest-visible
- ✅ **Browse catalog** - Search, filter, view product details
- ✅ **Guest checkout** - Purchase products marked as Guest-purchaseable
- ✅ **Read public comments** - View comments/reviews (if visibility allows)
- ✅ **Create account** - Sign up as Member

**Cannot do**:
- ❌ View logged-in-only content
- ❌ Leave comments or reviews
- ❌ Access order history (unless saved as Member post-purchase)
- ❌ Save items to favorites or wishlist

## Capability-Based Permission System

### Overview

AECMS implements a **capability-based RBAC system** where permissions are defined as granular capabilities that can be assigned to roles. This allows Owners to customize role permissions as new features are added.

### Capability Framework

#### Capability Definition

Each capability is defined with:
- **Capability ID**: Unique identifier (e.g., `article.create`, `product.delete`)
- **Capability Name**: Human-readable name (e.g., "Create Articles")
- **Category**: Grouped by feature (Content, Commerce, Users, System)
- **Description**: What this capability allows
- **Default Roles**: Which roles have this capability by default

#### Example Capabilities

**Content Management**:
```
article.create       - Create new articles
article.edit.own     - Edit own articles
article.edit.any     - Edit any articles
article.delete       - Delete articles
article.publish      - Publish articles
page.create          - Create pages
page.edit            - Edit pages
page.delete          - Delete pages
media.upload         - Upload media files
media.delete         - Delete media files
category.manage      - Create/edit/delete categories
tag.manage           - Create/edit/delete tags
```

**Ecommerce**:
```
product.create       - Create products
product.edit         - Edit products
product.delete       - Delete products
order.view.own       - View own orders
order.view.any       - View all orders
order.manage         - Update order status, process refunds
cart.manage          - Add/remove cart items
checkout.guest       - Checkout without account
```

**Users & Comments**:
```
user.create          - Create user accounts
user.edit.own        - Edit own profile
user.edit.any        - Edit any user profile
user.delete          - Delete users
comment.create       - Leave comments
comment.edit.own     - Edit own comments
comment.edit.any     - Edit any comments
comment.delete.own   - Delete own comments
comment.delete.any   - Delete any comments
review.create        - Leave product reviews
```

**System & Configuration**:
```
system.configure     - Edit site settings
theme.manage         - Edit theme and layouts
payment.configure    - Configure payment settings
capability.assign    - Assign capabilities to roles
role.manage          - Create/edit roles
analytics.view       - View analytics dashboard
```

### Capability-to-Role Mapping

#### Default Mapping (Owner-configurable)

| Capability | Owner | Admin | Member | Guest |
|------------|-------|-------|--------|-------|
| article.create | ✅ | ✅ | ❌ | ❌ |
| article.edit.any | ✅ | ✅ | ❌ | ❌ |
| article.delete | ✅ | ✅ | ❌ | ❌ |
| page.create | ✅ | ❌ | ❌ | ❌ |
| page.edit | ✅ | ❌ | ❌ | ❌ |
| product.create | ✅ | ✅ | ❌ | ❌ |
| product.edit | ✅ | ✅ | ❌ | ❌ |
| order.view.own | ✅ | ✅ | ✅ | ❌ |
| order.view.any | ✅ | ✅ | ❌ | ❌ |
| order.manage | ✅ | ✅ | ❌ | ❌ |
| user.create | ✅ | ✅* | ❌ | ❌ |
| user.delete | ✅ | ✅* | ❌ | ❌ |
| comment.create | ✅ | ✅ | ✅ | ❌ |
| comment.delete.any | ✅ | ✅ | ❌ | ❌ |
| review.create | ✅ | ✅ | ✅ | ❌ |
| system.configure | ✅ | ❌ | ❌ | ❌ |
| payment.configure | ✅ | ❌ | ❌ | ❌ |
| capability.assign | ✅ | ❌ | ❌ | ❌ |
| checkout.guest | ✅ | ✅ | ✅ | ✅** |

\* Admin can only manage Members, not other Admins or Owners
\*\* Only for products marked as Guest-purchaseable

### Owner Capability Management Interface

Owners can adjust role capabilities via admin interface:

```
┌─────────────────────────────────────────────────┐
│  Role & Capability Management                   │
├─────────────────────────────────────────────────┤
│  Role: Admin                         [Save]     │
│                                                  │
│  ✅ Content Management                          │
│     ☑ Create Articles                           │
│     ☑ Edit Articles                             │
│     ☑ Delete Articles                           │
│     ☐ Create Pages                              │
│     ☐ Edit Pages                                │
│                                                  │
│  ✅ Ecommerce                                   │
│     ☑ Create Products                           │
│     ☑ Edit Products                             │
│     ☑ Manage Orders                             │
│                                                  │
│  ✅ User Management                             │
│     ☑ Create Members                            │
│     ☑ Edit Members                              │
│     ☐ Create Admins                             │
│                                                  │
│  ⚠️  System (Owner Only)                        │
│     ☐ Configure System                          │
│     ☐ Assign Capabilities (Owner Only)          │
└─────────────────────────────────────────────────┘
```

### Future Extensibility

When new features are added:
1. **Define new capabilities** in code (e.g., `newsletter.send`)
2. **Assign default roles** in migration/seed
3. **Owners can adjust** via capability management UI
4. **Capabilities persist** across updates, customizations preserved

## Content & Product Visibility Controls

### Article Visibility

Every article has a **visibility setting**:

**Options**:
- `public` (Guest-visible) - Default, visible to everyone
- `logged_in_only` (Members and above) - Requires login
- `admin_only` (Admin and Owner) - Only visible in admin interface

**Implementation**:
```typescript
// Prisma schema
model Article {
  id         String   @id @default(uuid())
  title      String
  content    String
  visibility Visibility @default(public)
  // ...
}

enum Visibility {
  public
  logged_in_only
  admin_only
}
```

### Product Visibility

Every product has **visibility** and **guest purchasing** settings:

**Visibility Options**:
- `public` - Visible to everyone
- `logged_in_only` - Visible to Members and above
- `admin_only` - Only visible in admin interface

**Guest Purchaseable**:
- Boolean flag: `guest_purchaseable`
- If `true`: Guests can purchase via guest checkout
- If `false`: Must be logged in as Member to purchase

**Implementation**:
```typescript
model Product {
  id                 String   @id @default(uuid())
  name               String
  visibility         Visibility @default(public)
  guest_purchaseable Boolean  @default(true)
  // ...
}
```

### Comment & Review Visibility

Comments and reviews on articles/products have a **three-way visibility toggle**:

**Per-Article/Product Settings**:
- `disabled` - No comments/reviews allowed
- `logged_in_only` - Members and above can comment, only logged-in users can view
- `public` - Members and above can comment, everyone (including Guests) can view

**Implementation**:
```typescript
model Article {
  id                   String   @id @default(uuid())
  comment_visibility   CommentVisibility @default(public)
  // ...
}

model Product {
  id                   String   @id @default(uuid())
  comment_visibility   CommentVisibility @default(public)
  // ...
}

enum CommentVisibility {
  disabled
  logged_in_only
  public
}
```

## Comments & Reviews System

### Unified Comment System

Comments and reviews share the same data model with a **type discriminator**.

**Comment Types**:
- `comment` - Standard comment on article or product
- `review` - Product review with optional rating

**Implementation**:
```typescript
model Comment {
  id           String      @id @default(uuid())
  type         CommentType @default(comment)
  content      String
  rating       Int?        // 1-5 stars, only for reviews
  author_id    String
  author       User        @relation(fields: [author_id], references: [id])
  article_id   String?
  article      Article?    @relation(fields: [article_id], references: [id])
  product_id   String?
  product      Product?    @relation(fields: [product_id], references: [id])
  status       CommentStatus @default(pending)
  created_at   DateTime    @default(now())
  updated_at   DateTime    @updatedAt
}

enum CommentType {
  comment
  review
}

enum CommentStatus {
  pending    // Awaiting moderation (if enabled)
  approved   // Visible on site
  rejected   // Hidden by moderator
}
```

### Comment/Review Capabilities

- **Members**: Can create, edit, delete own comments/reviews
- **Admin/Owner**: Can moderate (approve/reject), edit, delete any comments/reviews
- **Guests**: Cannot comment, can view (if visibility allows)

## Authentication System: Front Door vs Back Door

### Overview

AECMS implements **dual authentication pathways** to separate end-user access from administrative access:

1. **Front Door**: User-facing login for Members (and Admins/Owners when browsing as users)
2. **Back Door**: Administrative login at `/admin` for Admins and Owners

### Front Door Authentication

**Location**: Mounted in frontend header bar

**UI Behavior**:

**For Guests (not logged in)**:
```
┌─────────────────────────────────────────────┐
│ [Logo]  Home  Shop  Articles    [Log In] 🛒│
└─────────────────────────────────────────────┘
```

Clicking "Log In" opens a **modal** with login options:
```
┌───────────────────────────────────┐
│        Log In to Your Account     │
├───────────────────────────────────┤
│  [Continue with Google]           │
│  [Continue with Apple]            │
│                                   │
│  ──────── or ────────              │
│                                   │
│  Email: [________________]        │
│  Password: [________________]     │
│                                   │
│  [Forgot Password?]               │
│                                   │
│  [Log In]                         │
│                                   │
│  Don't have an account? [Sign Up]│
└───────────────────────────────────┘
```

**For logged-in Members**:
```
┌─────────────────────────────────────────────────┐
│ [Logo]  Home  Shop  Articles  👤 John Doe [v] 🛒│
└─────────────────────────────────────────────────┘
```

Dropdown menu:
```
[My Account]
[Order History]
[Log Out]
```

**For logged-in Admins/Owners** (via front door):
```
┌──────────────────────────────────────────────────┐
│ [Logo]  Home  Shop  Articles  👤⚡ Jane Smith [v] 🛒│
└──────────────────────────────────────────────────┘
```

The **⚡ icon** indicates super-user logged in via front door.

Dropdown menu:
```
[My Account]
[Order History]
[Go to Admin Panel] → /admin
[Log Out]
```

**Front Door Access**:
- All roles (Member, Admin, Owner) can log in via front door
- Provides full end-user experience:
  - Browse articles (including logged-in-only content)
  - Browse and purchase products
  - Leave comments and reviews
  - Access own account and orders
- Admins/Owners logged in via front door can:
  - Quick-edit articles inline (if capability enabled)
  - Access admin panel via dropdown link

**Login Methods** (Front Door):
- Google OAuth
- Apple OAuth
- Email + Password

**Security**:
- JWT access tokens (15 minutes, auto-refresh)
- Refresh tokens (persistent per device, NO EXPIRY, httpOnly cookie)
- Session persists until explicit logout
- No 2FA required for front door (optional future feature)
- Users can "Log Out All Devices" to revoke all refresh tokens

**Rationale for Persistent Login**:
- User-facing experience prioritizes convenience
- Similar to consumer apps (social media, shopping sites)
- Users expect "stay logged in" behavior on trusted devices
- Explicit logout required to clear session
- Compromised tokens can be revoked via "Log Out All Devices"

### Back Door Authentication

**Location**: Discrete URL at `[domain]/admin`

**UI Behavior**:

**Login Page** (`/admin/login`):
```
┌─────────────────────────────────────────┐
│          AECMS Admin Portal             │
├─────────────────────────────────────────┤
│  Email: [________________________]      │
│  Password: [________________________]   │
│                                         │
│  [Log In]                               │
│                                         │
│  [Forgot Password?]                     │
│                                         │
│  ──────────────────────────────────────  │
│                                         │
│  OAuth Login (optional):                │
│  [Continue with Google]                 │
│  [Continue with Apple]                  │
└─────────────────────────────────────────┘
```

**After successful login**:
- If 2FA enabled → **2FA Challenge Page**
- If 2FA disabled → **Admin Dashboard**

**2FA Challenge Page**:
```
┌─────────────────────────────────────────┐
│        Two-Factor Authentication        │
├─────────────────────────────────────────┤
│  Enter the 6-digit code from your      │
│  authenticator app:                     │
│                                         │
│  [___] [___] [___] [___] [___] [___]   │
│                                         │
│  [Verify]                               │
│                                         │
│  [Use Recovery Code]                    │
│  [Resend Code] (if SMS)                 │
└─────────────────────────────────────────┘
```

**Admin Dashboard** (after successful auth + 2FA):
```
┌─────────────────────────────────────────────────┐
│ [AECMS Admin] Dashboard Articles Products Users │
│                      👤 Jane Smith (Owner) [v]  │
├─────────────────────────────────────────────────┤
│  [Content Management]                           │
│  [Product Management]                           │
│  [Order Management]                             │
│  [User Management]                              │
│  [Site Settings]                                │
│  [Analytics]                                    │
│                                                  │
│  [View Live Site] → Front door                  │
│  [Log Out]                                      │
└─────────────────────────────────────────────────┘
```

**Back Door Access**:
- Only Admin and Owner roles can log in via `/admin`
- Members attempting to access `/admin` → 403 Forbidden
- Guests attempting to access `/admin` → Redirect to `/admin/login`
- Provides administrative capabilities:
  - Content management (articles, pages, media)
  - Product management (products, categories, orders)
  - User management
  - System configuration
  - Analytics and reports
  - Capability management (Owner only)

**Login Methods** (Back Door):
- Email + Password (primary)
- Google OAuth (optional, see below)
- Apple OAuth (optional, see below)

**Security**:
- JWT access tokens (15 minutes, auto-refresh)
- Refresh tokens (7 days maximum, httpOnly cookie, sliding window)
- Session expires after 7 days or explicit logout (whichever comes first)
- **2FA Required** (TOTP or SMS)
- Rate limiting on login attempts (3 per 15 minutes per IP)
- IP allowlisting (optional, Owner-configurable)
- Audit logging of all admin actions
- Automatic logout on inactivity (30 minutes)

**Rationale for 7-Day Expiry**:
- Administrative access requires higher security
- 7-day rolling expiry balances security with usability
- Forces periodic re-authentication with 2FA
- Limits window for compromised admin tokens
- More restrictive than front-door (persistent) login

### OAuth for Back Door + 2FA

**Question**: Should OAuth be allowed for back-door logins? Can it be used with 2FA?

**Answer**: Yes, OAuth can be used with 2FA for back-door logins.

**Implementation Strategy**:

1. **OAuth Login** → User authenticates via Google/Apple
2. **Role Check** → System checks if user has Admin/Owner role
3. **2FA Challenge** → If 2FA enabled for user, prompt for TOTP/SMS code
4. **Admin Access Granted** → Upon successful 2FA verification

**Benefits**:
- Convenience for Admins/Owners who prefer OAuth
- OAuth providers (Google/Apple) provide additional security layer
- 2FA adds extra protection even if OAuth account compromised

**Security Considerations**:
- OAuth tokens are not 2FA - they prove identity but not possession of device
- 2FA (TOTP/SMS) proves possession of second factor (phone/authenticator)
- Layering OAuth + 2FA provides defense in depth

**Recommendation**: **Yes, allow OAuth for back-door with mandatory 2FA**

**Flow**:
```
1. Admin visits /admin
2. Chooses OAuth login (Google/Apple)
3. OAuth provider authenticates
4. System checks role (Admin/Owner required)
5. System prompts for 2FA code
6. Admin enters TOTP/SMS code
7. Access granted to admin dashboard
```

## Two-Factor Authentication (2FA)

### Overview

2FA is **mandatory for back-door (admin) logins** to protect administrative access.

### Free and Cheap 2FA Options

#### Option 1: TOTP (Time-Based One-Time Password) - FREE ✅
**Recommended**

**How it works**:
- Uses authenticator apps: Google Authenticator, Authy, Microsoft Authenticator
- Generates 6-digit codes based on shared secret + current time
- Works offline, no SMS costs

**Implementation**:
- Library: `speakeasy` (Node.js) or `otplib`
- QR code generation: `qrcode` library
- Costs: **$0** (open-source libraries)

**User Setup Flow**:
1. Admin/Owner enables 2FA in account settings
2. System generates secret key
3. Display QR code
4. User scans with authenticator app
5. User enters verification code to confirm
6. System saves encrypted secret
7. User downloads recovery codes

**Pros**:
- Free, no ongoing costs
- Offline, works anywhere
- Industry standard
- Most secure option

**Cons**:
- Requires smartphone with authenticator app
- Can be lost if phone lost (recovery codes needed)

#### Option 2: SMS-Based 2FA - LOW COST
**Backup option**

**How it works**:
- System sends 6-digit code via SMS
- User enters code to verify

**Implementation**:
- Service: Twilio, AWS SNS, Vonage
- Library: Twilio Node SDK

**Costs**:
- Twilio: $0.0079 per SMS (US)
- AWS SNS: $0.00645 per SMS (US)
- For low traffic: ~$1-5/month

**User Setup Flow**:
1. Admin/Owner enables SMS 2FA
2. Enters phone number
3. System sends verification SMS
4. User enters code to confirm
5. Phone number saved

**Pros**:
- Works on any phone (no app required)
- Familiar to users
- Good backup to TOTP

**Cons**:
- Ongoing SMS costs (small)
- Requires phone signal
- Vulnerable to SIM swapping (less secure than TOTP)
- SMS delivery delays

#### Option 3: Email-Based 2FA - FREE
**Least secure, not recommended for admin**

**How it works**:
- System sends 6-digit code via email
- User enters code to verify

**Pros**:
- Free
- No phone required

**Cons**:
- Less secure (email can be compromised)
- Not recommended for admin access
- Slower than TOTP

#### Option 4: Hardware Security Keys - USER COST
**Most secure, optional**

**How it works**:
- Physical USB/NFC key (YubiKey, Titan Key)
- User inserts key and taps button

**Implementation**:
- WebAuthn API
- Library: `@simplewebauthn/server`

**Costs**:
- YubiKey: $25-70 per key (user purchases)
- Implementation: Free (open standard)

**Pros**:
- Most secure option
- Phishing-resistant
- No ongoing costs

**Cons**:
- User must purchase hardware key
- Can be lost (backup key recommended)
- More complex setup

### Recommended 2FA Strategy for AECMS

**MVP (Phase 1)**:
- ✅ **TOTP (Primary)** - Free, secure, offline
- ✅ **SMS (Backup)** - Low cost, works without app
- ✅ **Recovery Codes** - 10 single-use codes for emergency access

**Future (Post-MVP)**:
- 🔄 **Hardware Keys** - For high-security environments
- 🔄 **Backup Email** - For users without phones

**Implementation Priority**:
1. TOTP with QR code setup (Week 2-3 of Phase 1)
2. Recovery codes generation and storage (Week 2-3)
3. SMS backup (Week 10-11, with payment integration)

### 2FA Enforcement Policy

**Back Door (/admin)**:
- **Owner**: 2FA mandatory, cannot be disabled
- **Admin**: 2FA mandatory by default, Owner can override per-user
- **Member**: N/A (no admin access)

**Front Door**:
- **All roles**: 2FA optional (future feature, user can enable)

### 2FA Recovery

**Recovery Codes**:
- Generate 10 single-use recovery codes on 2FA setup
- User must download and save securely
- Each code can be used once to bypass 2FA
- Notify user when recovery code used

**If 2FA Device Lost**:
1. User enters email + password
2. User enters recovery code
3. User gains access
4. User re-sets up 2FA with new device
5. New recovery codes generated

**If Recovery Codes Lost**:
- Owner can reset 2FA for Admin users
- No one can reset Owner 2FA (security by design)
- Owner must use recovery codes or contact support (manual intervention)

## Database Schema

### Users Table

```typescript
model User {
  id                  String    @id @default(uuid())
  email               String    @unique
  password_hash       String?   // Null for OAuth-only users
  display_name        String
  role                UserRole  @default(member)

  // OAuth
  google_id           String?   @unique
  apple_id            String?   @unique

  // 2FA
  two_factor_enabled  Boolean   @default(false)
  two_factor_secret   String?   // TOTP secret, encrypted
  two_factor_phone    String?   // SMS backup, encrypted
  recovery_codes      String[]  // Hashed recovery codes

  // Metadata
  created_at          DateTime  @default(now())
  updated_at          DateTime  @updatedAt
  last_login          DateTime?
  login_count         Int       @default(0)

  // Relationships
  articles            Article[]
  comments            Comment[]
  orders              Order[]
}

enum UserRole {
  owner
  admin
  member
  // guest is implicit (no user record)
}
```

### Capabilities Table

```typescript
model Capability {
  id          String   @id @default(uuid())
  key         String   @unique  // e.g., "article.create"
  name        String              // e.g., "Create Articles"
  category    String              // e.g., "Content Management"
  description String
  created_at  DateTime @default(now())

  // Relationships
  roles       RoleCapability[]
}

model RoleCapability {
  id            String     @id @default(uuid())
  role          UserRole
  capability_id String
  capability    Capability @relation(fields: [capability_id], references: [id])
  granted_at    DateTime   @default(now())
  granted_by    String     // Owner user ID

  @@unique([role, capability_id])
}
```

## API Endpoints

### Authentication

```
# Front Door
POST   /api/auth/login                  # Email + password login
POST   /api/auth/oauth/google           # Google OAuth
POST   /api/auth/oauth/apple            # Apple OAuth
POST   /api/auth/logout                 # Logout
POST   /api/auth/refresh                # Refresh access token
POST   /api/auth/register               # Sign up as Member
POST   /api/auth/forgot-password        # Request password reset
POST   /api/auth/reset-password         # Reset password with token

# Back Door
POST   /api/admin/auth/login            # Admin login (email + password)
POST   /api/admin/auth/oauth/google     # Admin OAuth login
POST   /api/admin/auth/oauth/apple      # Admin OAuth login
POST   /api/admin/auth/2fa/verify       # Verify 2FA code
POST   /api/admin/auth/2fa/setup        # Setup 2FA (TOTP)
POST   /api/admin/auth/2fa/disable      # Disable 2FA
POST   /api/admin/auth/recovery-code    # Use recovery code
POST   /api/admin/auth/logout           # Admin logout

# User Management
GET    /api/users                       # List users (Admin+)
GET    /api/users/:id                   # Get user details
POST   /api/users                       # Create user (Admin+)
PUT    /api/users/:id                   # Update user
DELETE /api/users/:id                   # Delete user (Admin+)
GET    /api/users/me                    # Get current user profile
PUT    /api/users/me                    # Update own profile

# Capability Management
GET    /api/capabilities                # List all capabilities (Owner)
GET    /api/roles/:role/capabilities    # Get role capabilities (Owner)
PUT    /api/roles/:role/capabilities    # Update role capabilities (Owner)
```

## Security Considerations

### Front Door Security
- JWT access tokens (15 minutes)
- Refresh tokens (7 days, httpOnly cookie)
- Rate limiting: 5 login attempts per 15 minutes per IP
- No 2FA required (optional future)
- OAuth with verified email only

### Back Door Security
- JWT access tokens (15 minutes)
- Refresh tokens (7 days, httpOnly cookie)
- **2FA mandatory** (TOTP or SMS)
- Rate limiting: 3 login attempts per 15 minutes per IP
- IP allowlisting (optional, Owner-configurable)
- Audit logging of all admin actions
- Session timeout: 30 minutes of inactivity
- OAuth with 2FA verification

### Capability Security
- Only Owners can assign capabilities
- Capability changes logged in audit trail
- Cannot remove own Owner role
- Cannot delete last Owner account

### Guest Session Security
- Anonymous cart stored in session (httpOnly cookie)
- Guest orders tracked by email + order number
- Option to convert guest order to Member account post-purchase

## Open Questions

1. Should we implement "Remember Me" functionality for front door login?
2. Should we allow Admins to reset their own 2FA, or require Owner intervention?
3. Should we implement session concurrency limits (max N active sessions per user)?
4. Should we implement automatic logout on role downgrade (e.g., Owner → Member)?
5. Should we support federated identity (SAML, OpenID Connect) for enterprise deployments?
6. Should we implement "Login as User" feature for Owners (for support purposes)?
7. Should comment moderation be automatic (AI-based) or manual queue?

## Success Criteria

- ✅ Owners can manage all capabilities and users
- ✅ Admins have configurable, limited capabilities
- ✅ Members can comment and review (when enabled)
- ✅ Guests can purchase products marked as guest-purchaseable
- ✅ Front door login works seamlessly for all roles
- ✅ Back door login requires 2FA for Admins and Owners
- ✅ OAuth + 2FA combination works correctly
- ✅ Capability framework is extensible for future features
- ✅ Zero unauthorized access incidents
- ✅ 2FA setup success rate > 95%

---

**Last Updated**: 2026-01-28
**Status**: Draft - Awaiting stakeholder review
