# PRD 09: User Management & Authentication

**Version:** 1.2
**Date:** 2026-01-29
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
reports.export       - Export ecommerce reports (CSV)
cart.manage          - Add/remove cart items
checkout.guest       - Checkout without account
```

**Users & Comments**:
```
user.create                  - Create user accounts
user.edit.own                - Edit own profile
user.edit.any                - Edit any user profile
user.delete                  - Delete users
users.promote                - Elevate Member to Admin (Owner only)
users.promote.owner          - Elevate Member to Owner (Owner only)
users.reset_password.member  - Force password reset for Members
users.reset_password.admin   - Force password reset for Admins
comment.create               - Leave comments
comment.edit.own             - Edit own comments
comment.edit.any             - Edit any comments
comment.delete.own           - Delete own comments
comment.delete.any           - Delete any comments
review.create                - Leave product reviews
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
| reports.export | ✅ | ❌ | ❌ | ❌ |
| user.create | ✅ | ✅* | ❌ | ❌ |
| user.delete | ✅ | ✅* | ❌ | ❌ |
| users.promote | ✅ | ❌ | ❌ | ❌ |
| users.promote.owner | ✅ | ❌ | ❌ | ❌ |
| users.reset_password.member | ✅ | ✅ | ❌ | ❌ |
| users.reset_password.admin | ✅ | ❌ | ❌ | ❌ |
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

## Account Creation & Verification

### Member Account Creation

**All Member accounts must verify their email address** to prevent creation of spam accounts.

**Account Creation Flow**:

1. User visits site and clicks "Sign Up" (front door)
2. User enters:
   - Email address
   - Password (min 16 characters, at least one uppercase + one special character)
   - Display name
3. System validates input and creates account with `email_verified = false`
4. System sends verification email with unique token (valid 24 hours)
5. User clicks link in email: `/auth/verify-email?token=xxx`
6. System marks `email_verified = true`
7. User can now log in and access Member features

**Email Verification Requirement**:
- ✅ **Required for Members**: Cannot log in until email verified
- ❌ **Not required for Guest Checkout**: Transaction completion is sufficient validation
- ✅ **OAuth Auto-Verified**: OAuth sign-ins (Google, Apple) are pre-verified by provider

**Resend Verification Email**:
- User can request new verification email if original expires
- Rate limited: 1 email per 5 minutes per account

**Implementation**:

```typescript
// Email verification token (24-hour expiry)
model EmailVerificationToken {
  id         String   @id @default(uuid())
  user_id    String
  user       User     @relation(fields: [user_id])
  token      String   @unique
  expires_at DateTime
  created_at DateTime @default(now())

  @@index([user_id])
  @@index([token])
}

// Verify email endpoint
POST /api/auth/verify-email
Body: { token: 'xxx' }
Response: { success: true, message: 'Email verified' }

// Resend verification email
POST /api/auth/resend-verification
Body: { email: 'user@example.com' }
Response: { success: true, message: 'Verification email sent' }
```

### Admin/Owner Account Creation (Elevation Flow)

**Admins and Owners are not created directly.** Instead, they are created by elevating existing Member accounts.

**Account Elevation Flow**:

1. User creates Member account (email verified)
2. Owner logs in to admin panel
3. Owner navigates to Users → All Users
4. Owner finds Member account
5. Owner clicks "Change Role" → Selects "Admin" or "Owner"
6. System updates user role
7. **If elevated to Admin/Owner**, system forces user to:
   - Set up 2FA on next back-door login (mandatory)
   - User receives email notification of role change

**Capability Requirement**:
- Elevating Member → Admin: Requires `users.promote` or `users.manage` capability (Owner default)
- Elevating Member → Owner: Requires `users.promote.owner` capability (**Owner-only**)
- Owners have all capabilities by default
- Future: Custom "Super Admin" role could also have `users.promote` capability

**Security Note**: This prevents unauthorized account creation at elevated privilege levels. All elevated accounts start as verified Members, ensuring email ownership and identity verification.

### Guest Checkout (No Account Required)

Guests can purchase products marked as `guest_purchaseable` without creating an account:
- No email verification required
- Email used for order confirmation only
- Transaction completion validates email ownership
- Post-purchase, guest can optionally create Member account and claim order history

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
│  Lost device? [Reset via Email]         │
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
- **2FA Required** (TOTP only, no SMS)
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
- 2FA (TOTP) proves possession of second factor (authenticator app)
- Layering OAuth + 2FA provides defense in depth

**Recommendation**: **Yes, allow OAuth for back-door with mandatory 2FA**

**Flow**:
```
1. Admin visits /admin
2. Chooses OAuth login (Google/Apple)
3. OAuth provider authenticates
4. System checks role (Admin/Owner required)
5. System prompts for 2FA code (TOTP)
6. Admin enters 6-digit TOTP code from authenticator app
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
1. Admin/Owner navigates to account settings (or prompted on first back-door login)
2. System generates TOTP secret key
3. System displays QR code + manual entry code
4. User scans QR code with authenticator app (Google Authenticator, Authy, 1Password, etc.)
5. User enters 6-digit verification code to confirm setup
6. System saves encrypted TOTP secret
7. 2FA now required for all future back-door logins

**Pros**:
- Free, no ongoing costs
- Offline, works anywhere
- Industry standard
- Most secure option

**Cons**:
- Requires smartphone with authenticator app
- Can be lost if phone lost (recovery codes needed)

#### Option 2: SMS-Based 2FA - ❌ NOT IMPLEMENTED
**Rejected due to costs and security concerns**

- Ongoing SMS costs (~$1-5/month)
- Vulnerable to SIM swapping attacks
- SMS delivery delays
- Not needed when TOTP is free and more secure

#### Option 3: Email-Based 2FA - ❌ NOT IMPLEMENTED
**Rejected - Not secure enough for admin access**

- Email compromise = account compromise
- Defeats purpose of 2FA
- Slower than TOTP

#### Option 4: Hardware Security Keys - ❌ NOT IN MVP
**Future consideration, not part of MVP**

- Requires user hardware purchase ($25-70)
- More complex setup
- TOTP provides adequate security for MVP

### Recommended 2FA Strategy for AECMS ✅ **CONFIRMED**

**MVP**:
- ✅ **TOTP Only** - Free, secure, offline, no ongoing costs

**Not Implemented**:
- ❌ **SMS Backup** - Not needed (avoids costs/complexity)
- ❌ **Recovery Codes** - Not needed (see password reset for device loss recovery)
- ❌ **Hardware Keys** - Not needed for MVP
- ❌ **Email 2FA** - Not secure enough for admin access

**Rationale**: TOTP-only approach minimizes costs and complexity while providing strong security. Lost device recovery is handled via password reset (see [Password Reset & Recovery](#password-reset--recovery) section).

### 2FA Enforcement Policy ✅ **CONFIRMED**

**Back Door (/admin)** - MANDATORY:
- **Owner**: 2FA mandatory, cannot be disabled
- **Admin**: 2FA mandatory, cannot be disabled
- **Member**: N/A (no admin access)
- **No login path exists for disabled 2FA** - Admins/Owners must enable 2FA to access `/admin`

**Front Door**:
- **All roles**: 2FA optional (future feature, user can enable)

**Critical Rule**: Back-door login REQUIRES 2FA. There is no bypass. Admins/Owners are forced to set up TOTP on first back-door login attempt.

### 2FA Recovery (Lost Device) ✅ **CONFIRMED APPROACH**

**If 2FA Device Lost** - Use Password Reset:

1. User initiates password reset via email link
2. Email verification proves email ownership
3. User sets new password
4. **2FA is automatically reset/cleared** for users with back-door access
5. On next login, user must set up 2FA again with new device
6. New TOTP secret generated

**Security Rationale**:
- Email ownership is the ultimate security boundary
- Password reset already proves identity
- No additional recovery mechanism needed
- Simpler than recovery codes
- Standard industry pattern

**No Recovery Codes Implemented**: Recovery codes are not needed because password reset serves as the recovery mechanism. This reduces complexity and eliminates the need for users to store recovery codes securely.

**Admin-Initiated 2FA Reset**: See [Password Reset & Recovery](#password-reset--recovery) section for capability-based password/2FA reset by elevated users.

## Password Reset & Recovery

### Self-Initiated Password Reset

**Any Member or above can initiate their own password reset.**

**Password Reset Flow**:

1. User clicks "Forgot Password?" on login page
2. User enters email address
3. System sends password reset email with unique token (valid 1 hour)
4. User clicks link in email: `/auth/reset-password?token=xxx`
5. User enters new password (min 16 characters, at least one uppercase + one special character)
6. System validates token and updates password
7. **If user has back-door access (Admin/Owner)**: System clears 2FA secret (forces 2FA reconfiguration)
8. User receives email confirmation of password change
9. All existing sessions/refresh tokens are invalidated (security)

**Password Reset Implementation**:

```typescript
model PasswordResetToken {
  id         String   @id @default(uuid())
  user_id    String
  user       User     @relation(fields: [user_id])
  token      String   @unique
  expires_at DateTime // 1 hour from creation
  created_at DateTime @default(now())

  @@index([user_id])
  @@index([token])
}

// Password reset service
async function resetPassword(token: string, newPassword: string) {
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true }
  })

  if (!resetToken || resetToken.expires_at < new Date()) {
    throw new Error('Invalid or expired reset token')
  }

  // Update password
  const hashedPassword = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: resetToken.user_id },
    data: {
      password_hash: hashedPassword,
      // If user has back-door access, clear 2FA (forces reconfiguration)
      two_factor_secret: resetToken.user.role === 'admin' || resetToken.user.role === 'owner'
        ? null
        : resetToken.user.two_factor_secret,
      two_factor_enabled: resetToken.user.role === 'admin' || resetToken.user.role === 'owner'
        ? false
        : resetToken.user.two_factor_enabled
    }
  })

  // Invalidate all sessions
  await revokeAllRefreshTokens(resetToken.user_id)

  // Delete used reset token
  await prisma.passwordResetToken.delete({ where: { id: resetToken.id } })

  // Send confirmation email
  await sendEmail({
    to: resetToken.user.email,
    subject: 'Password Changed',
    body: 'Your password has been successfully changed. If you did not make this change, contact support immediately.'
  })

  // Log in audit trail
  await auditLog.create({
    action: 'password_reset',
    userId: resetToken.user_id,
    metadata: { method: 'self_initiated' }
  })
}
```

### Admin-Initiated Password Reset (Force Reset)

**Elevated users can force password resets for other users based on capabilities.**

**Capability-Based Password Reset Permissions**:

Given the potential for future roles with non-hierarchical relationships, password reset is handled with **granular per-role capabilities**:

**Capability Names**:
- `users.reset_password.member` - Can force password reset for Members
- `users.reset_password.admin` - Can force password reset for Admins
- `users.reset_password.owner` - Can force password reset for Owners (future, if needed)

**Default Capability Assignments**:

| Role | Capabilities |
|------|-------------|
| **Owner** | `users.reset_password.member`<br>`users.reset_password.admin` |
| **Admin** | `users.reset_password.member` |
| **Member** | None |

**Admin-Initiated Reset Flow**:

1. Admin/Owner navigates to Users → View User
2. Admin/Owner clicks "Force Password Reset"
3. System checks if admin has capability for target user's role
4. System sends password reset email to target user
5. **If target has back-door access**: Password reset also clears 2FA
6. Target user receives email and follows reset flow
7. Admin/Owner receives confirmation notification

**Permission Check Example**:

```typescript
async function canResetPasswordFor(adminUser: User, targetUser: User): Promise<boolean> {
  // Owner has all capabilities
  if (adminUser.role === 'owner') return true

  // Check specific capability for target role
  const requiredCapability = `users.reset_password.${targetUser.role}`
  return await adminUser.hasCapability(requiredCapability)
}

// API endpoint with capability guard
@UseGuards(JwtAuthGuard, CapabilityGuard)
@Post('/api/users/:id/force-password-reset')
async forcePasswordReset(
  @Param('id') targetUserId: string,
  @CurrentUser() adminUser: User
) {
  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } })

  if (!await canResetPasswordFor(adminUser, targetUser)) {
    throw new ForbiddenException('Cannot reset password for this user role')
  }

  // Send password reset email
  await sendPasswordResetEmail(targetUser.email)

  // Log in audit trail
  await auditLog.create({
    action: 'password_reset_forced',
    userId: adminUser.id,
    targetUserId: targetUser.id,
    metadata: { targetRole: targetUser.role }
  })

  return { success: true, message: 'Password reset email sent' }
}
```

### Username/UID Recovery

**Users can recover their username (email address) if forgotten**:

**Recovery Flow**:
1. User clicks "Forgot Username?" on login page
2. User enters possible email addresses
3. If account exists, system sends email with username reminder
4. Email includes link to password reset (if needed)
5. No indication given if account doesn't exist (security)

### Password Reset + 2FA Reset Security Model ✅ **CONFIRMED SECURE**

**For users with back-door access (Admin/Owner), password reset ALSO resets 2FA.**

**Rationale**:
- **Email ownership is the ultimate security boundary**
- If attacker has email access, they can already reset password
- Adding 2FA reset doesn't create additional vulnerability
- This handles lost 2FA device scenario cleanly
- Standard industry pattern (GitHub, Google, Microsoft use this approach)

**Security Analysis**:
✅ Email verification proves identity
✅ Password reset link expires in 1 hour
✅ All sessions invalidated on password change
✅ User receives confirmation email
✅ If email compromised, account is compromised regardless of 2FA
✅ Users should protect email with separate 2FA (external to AECMS)
❌ **No vulnerability identified** - This approach is secure

**Lost Device Recovery Flow**:
1. Admin loses phone with TOTP app
2. Admin initiates password reset from login page
3. Admin clicks email link (proves email ownership)
4. Admin sets new password
5. System automatically clears 2FA secret
6. Admin logs in with new password
7. System forces 2FA setup on new device
8. Admin scans new QR code with authenticator app
9. Admin verifies code and gains access
10. New TOTP secret saved

## Database Schema

### Users Table

```typescript
model User {
  id                  String    @id @default(uuid())
  email               String    @unique
  email_verified      Boolean   @default(false) // Email verification required for Members
  password_hash       String?   // Null for OAuth-only users
  display_name        String
  role                UserRole  @default(member)

  // OAuth (OAuth sign-ins are pre-verified)
  google_id           String?   @unique
  apple_id            String?   @unique

  // 2FA (TOTP only, no SMS, no recovery codes)
  two_factor_enabled  Boolean   @default(false)
  two_factor_secret   String?   // TOTP secret, encrypted

  // Metadata
  created_at          DateTime  @default(now())
  updated_at          DateTime  @updatedAt
  last_login          DateTime?
  login_count         Int       @default(0)

  // Relationships
  articles            Article[]
  comments            Comment[]
  orders              Order[]
  emailVerificationTokens EmailVerificationToken[]
  passwordResetTokens     PasswordResetToken[]
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
POST   /api/auth/register               # Sign up as Member (sends verification email)
POST   /api/auth/verify-email           # Verify email with token
POST   /api/auth/resend-verification    # Resend verification email
POST   /api/auth/forgot-password        # Request password reset
POST   /api/auth/reset-password         # Reset password with token (also resets 2FA for Admin/Owner)
POST   /api/auth/forgot-username        # Request username/email reminder

# Back Door
POST   /api/admin/auth/login            # Admin login (email + password)
POST   /api/admin/auth/oauth/google     # Admin OAuth login
POST   /api/admin/auth/oauth/apple      # Admin OAuth login
POST   /api/admin/auth/2fa/verify       # Verify TOTP code
POST   /api/admin/auth/2fa/setup        # Setup 2FA (TOTP only, generates QR code)
POST   /api/admin/auth/logout           # Admin logout

# Removed (not implemented):
# POST /api/admin/auth/2fa/disable     # 2FA cannot be disabled for Admin/Owner
# POST /api/admin/auth/recovery-code   # No recovery codes (use password reset instead)
# POST /api/admin/auth/2fa/sms-setup   # No SMS 2FA

# User Management
GET    /api/users                       # List users (Admin+)
GET    /api/users/:id                   # Get user details
POST   /api/users                       # Create user (Admin+ - creates Member, then elevate)
PUT    /api/users/:id                   # Update user
PUT    /api/users/:id/role              # Elevate user role (Owner only, requires capability)
DELETE /api/users/:id                   # Delete user (Admin+)
GET    /api/users/me                    # Get current user profile
PUT    /api/users/me                    # Update own profile
POST   /api/users/:id/force-password-reset  # Force password reset (Admin+, capability-based)

# Capability Management
GET    /api/capabilities                # List all capabilities (Owner)
GET    /api/roles/:role/capabilities    # Get role capabilities (Owner)
PUT    /api/roles/:role/capabilities    # Update role capabilities (Owner)
```

## Security Considerations

### Front Door Security
- JWT access tokens (15 minutes)
- Refresh tokens (persistent, no expiry until logout, httpOnly cookie)
- "Log Out All Devices" feature to revoke all refresh tokens
- Rate limiting: 5 login attempts per 15 minutes per IP
- No 2FA required (optional future feature for Members)
- OAuth with verified email only

### Back Door Security
- JWT access tokens (15 minutes)
- Refresh tokens (7 days, httpOnly cookie)
- **2FA mandatory** (TOTP only, no SMS/recovery codes)
- Rate limiting: 3 login attempts per 15 minutes per IP
- IP allowlisting (optional, Owner-configurable)
- Audit logging of all admin actions
- Session timeout: 30 minutes of inactivity
- OAuth with 2FA verification (TOTP)

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

1. ~~Should we implement "Remember Me" functionality for front door login?~~ → **YES - Front door sessions are persistent by default (no expiry until logout)**
2. ~~Should we allow Admins to reset their own 2FA, or require Owner intervention?~~ → **YES - Self-service via password reset (also resets 2FA)**
3. Should we implement session concurrency limits (max N active sessions per user)? → **TBD - Not MVP, consider for security enhancement**
4. Should we implement automatic logout on role downgrade (e.g., Owner → Member)? → **YES - Security best practice, invalidate sessions on role change**
5. Should we support federated identity (SAML, OpenID Connect) for enterprise deployments? → **NO - Out of scope, personal CMS focus**
6. Should we implement "Login as User" feature for Owners (for support purposes)? → **TBD - Nice-to-have for support, requires careful audit logging**
7. ~~Should comment moderation be automatic (AI-based) or manual queue?~~ → **BOTH - Reactive AI moderation (post immediately, flag for manual review)**

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
