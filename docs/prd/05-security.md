# PRD 05: Security & Compliance

**Version:** 1.1
**Date:** 2026-01-29
**Status:** Draft
**Parent:** [Master PRD](./00-master-prd.md)

## Overview

This document defines security requirements, compliance standards, and security practices for AECMS to ensure the protection of user data, payment information, and system integrity.

## Security Objectives

1. **Confidentiality**: Protect sensitive data from unauthorized access
2. **Integrity**: Ensure data accuracy and prevent unauthorized modifications
3. **Availability**: Maintain system uptime and prevent service disruptions
4. **Authentication**: Verify user identities accurately
5. **Authorization**: Control access to resources based on roles and permissions
6. **Compliance**: Meet industry standards and regulations (PCI DSS, GDPR, etc.)

## Threat Model

### Assets to Protect
- User credentials (passwords, tokens)
- Personal information (PII)
- Payment information (handled by Stripe/PayPal)
- Order data
- Admin access
- Content (articles, products)
- System configuration

### Threat Actors
- **External attackers**: Hackers, bots, malicious users
- **Malicious users**: Compromised accounts, insider threats
- **Automated threats**: Botnets, scrapers, DDOS

### Attack Vectors
- SQL injection
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- Authentication bypass
- Session hijacking
- Man-in-the-middle attacks
- Brute force attacks
- DDOS attacks
- Phishing
- API abuse

## Authentication & Authorization

### User Authentication

#### Password Requirements
- Minimum 16 characters
- Must include: at least one uppercase letter and one special character
- Numerals allowed but not required
- Lowercase letters allowed but not required
- No common passwords (use dictionary check against top 10,000 common passwords)
- No password reuse (check against previous 5 passwords)
- Passwords hashed with **bcrypt** (cost factor 12)

**Validation Example:**
```typescript
function validatePassword(password: string): boolean {
  if (password.length < 16) return false
  if (!/[A-Z]/.test(password)) return false // At least one uppercase
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false // At least one special char
  if (isCommonPassword(password)) return false // Check against dictionary
  return true
}
```

#### Password Reset Flow

**Self-Initiated (All Users):**
1. User requests password reset with email
2. Generate secure random token (32 bytes, hex encoded)
3. Store token hash with expiration (15 minutes)
4. Send reset link via email (HTTPS only)
5. Validate token on reset page
6. Allow password change only with valid token
7. **If user is Admin/Owner**: Also reset 2FA (handles lost authenticator device)
8. Invalidate all refresh tokens (force re-login on all devices)
9. Invalidate token after use or expiration
10. Log password reset events

**Admin-Initiated (Capability-Based):**
- Admins can force password reset for Members (if granted `users.reset_password.member`)
- Admins can force password reset for other Admins (if granted `users.reset_password.admin`)
- Owners can force password reset for anyone
- Target user receives email with temporary reset link
- 2FA also reset if target is Admin/Owner
- All sessions invalidated on password change

**Security Considerations:**
- Email ownership is the ultimate security boundary
- If attacker has email access, they can reset password anyway
- Resetting 2FA on password reset doesn't create new vulnerability
- This is standard industry pattern (GitHub, Google, Microsoft)
- Prevents account lockout if user loses authenticator device

#### Multi-Factor Authentication (2FA)

**Back Door (Admin/Owner) - MVP:**
- **TOTP-only** (Time-based One-Time Password via authenticator apps)
- **Mandatory** for all Admin and Owner logins at `/admin`
- No SMS (cost and security concerns)
- No recovery codes
- Password reset also resets 2FA (handles lost authenticator devices)
- Email ownership is the ultimate security boundary

**Front Door (Members) - Post-MVP:**
- Optional TOTP for Members (user-configurable)
- Not required for MVP

**Implementation:**
- Use **speakeasy** or **otplib** library (free, open-source)
- QR code generation for easy setup
- 30-second time window
- 6-digit codes
- Backup via password reset (which resets 2FA)

**Cost:** $0 (TOTP is free, no SMS or external services needed)

**Flow:**
1. User enables 2FA in account settings
2. System generates secret key
3. Display QR code + manual entry key
4. User scans with authenticator app (Google Authenticator, Authy, 1Password, etc.)
5. User enters verification code to confirm setup
6. 2FA required on all subsequent back-door logins
7. Password reset flow resets 2FA if user loses device

### Session Management

#### JWT-Based Authentication

**Access Tokens:**
- Short-lived (15 minutes)
- Contain user ID, role, permissions
- Signed with HS256 or RS256
- Stored in memory (not localStorage)

**Refresh Tokens:**

**Front Door (User-Facing, Members):**
- **Persistent per device** (no expiry until explicit logout)
- Provides user convenience for browsing, shopping, commenting
- Stored in httpOnly, secure, SameSite=Strict cookie
- Rotate on each refresh
- Stored in database with user ID, device fingerprint, issued timestamp
- User can "Log Out All Devices" to revoke all refresh tokens
- Revocable (logout, password change, security event, admin action)

**Back Door (Admin Dashboard, Admin/Owner):**
- **7-day maximum** (rolling window with activity)
- Higher security for administrative access
- Automatic logout after 30 minutes of inactivity
- Stored in httpOnly, secure, SameSite=Strict cookie
- Rotate on each refresh
- Single-use (prevent replay attacks)
- Stored in database with user ID, issued timestamp
- Revocable (logout, password change, security event)

#### Session Security
- Use HTTPS exclusively (no HTTP)
- httpOnly cookies (prevent XSS access)
- Secure flag on cookies (HTTPS only)
- SameSite=Strict (prevent CSRF)
- CSRF tokens for state-changing operations

**Front Door Session Timeouts:**
- Inactivity timeout: None (persistent until logout)
- Absolute timeout: None (persistent until logout)
- User convenience prioritized

**Back Door Session Timeouts:**
- Inactivity timeout: 30 minutes
- Absolute timeout: 7 days
- Security prioritized for admin access
- Requires re-authentication with 2FA after timeout

#### Token Revocation
- Maintain token revocation list in Redis
- Revoke tokens on:
  - User logout
  - Password change
  - Account deletion
  - Suspicious activity detected
  - Admin-initiated revocation

### Authorization

#### Capability-Based Role Access Control (RBAC)

**Architecture:**
- **Capabilities** are granular permissions (e.g., `article.create`, `product.edit`, `user.delete`)
- **Roles** are collections of capabilities, but capabilities can be added/removed from roles by Owners
- System is **extensible** - new capabilities can be added without restructuring roles
- Owner can assign custom capability sets to roles via admin UI

**Roles:**

1. **Owner** (Super-Admin):
   - All capabilities always enabled (cannot be removed)
   - Can assign/remove capabilities to/from other roles
   - Can promote Members to Admin
   - Only Owners can promote Members to Owner
   - Cannot delete themselves (prevent lockout)
   - First Owner must be seeded manually via deployment script

2. **Admin**:
   - Owner-configurable capabilities (not fixed)
   - **Default capabilities** (Owner can modify):
     - `article.create`, `article.edit`, `article.delete` (own + others)
     - `product.create`, `product.edit`, `product.delete`
     - `media.upload`, `media.delete`
     - `order.view`, `order.manage`
     - `user.view`, `user.promote` (Member only, not Admin/Owner)
     - `comments.moderate`
     - `reports.export` (if assigned by Owner)
   - **Cannot**:
     - Manage system settings
     - Configure payment gateways
     - Promote to Admin or Owner
     - Reset Admin/Owner passwords (unless explicitly granted capability)

3. **Member**:
   - Standard logged-in user
   - **Fixed capabilities** (not customizable in MVP):
     - View logged-in-only content
     - Purchase products
     - Leave comments and reviews
     - Manage own account
     - Export own data (GDPR)
   - **Future extensibility**: Owner can grant additional capabilities (e.g., `article.create` to create "Writer" role)

4. **Guest**:
   - Unauthenticated session
   - View public content
   - Purchase guest-purchaseable products
   - No comments, reviews, or logged-in content access

**Capability Categories:**
- `article.*` - Article management
- `page.*` - Page management
- `product.*` - Product management
- `media.*` - Media management
- `order.*` - Order management
- `user.*` - User management
- `system.*` - System configuration
- `reports.*` - Reporting and data export
- `comments.*` - Comment/review moderation

**Permission Checks:**
- Verify on every API request
- Check role capabilities + resource ownership
- Use NestJS Guards for consistent enforcement
- Fail securely (deny by default)
- Owner permissions always return true

**Implementation Example:**
```typescript
@UseGuards(JwtAuthGuard, CapabilityGuard)
@RequireCapability('product.delete')
@Delete('/api/products/:id')
async deleteProduct(@Param('id') id: string, @CurrentUser() user: User) {
  // Owner: Always allowed
  if (user.role === 'owner') return this.productsService.delete(id)

  // Admin: Check if they have 'product.delete' capability
  const hasCapability = await this.capabilitiesService.userHasCapability(user, 'product.delete')
  if (!hasCapability) throw new ForbiddenException()

  return this.productsService.delete(id)
}
```

**Database Schema:**
```typescript
model Role {
  id   String @id @default(uuid())
  name String @unique // 'owner', 'admin', 'member', 'guest'
  capabilities RoleCapability[]
}

model Capability {
  id          String @id @default(uuid())
  name        String @unique // 'article.create', 'product.edit', etc.
  description String
  category    String // 'article', 'product', 'user', 'system', etc.
  roles       RoleCapability[]
}

model RoleCapability {
  role_id       String
  capability_id String
  role          Role       @relation(fields: [role_id], references: [id])
  capability    Capability @relation(fields: [capability_id], references: [id])

  @@id([role_id, capability_id])
}

model User {
  id    String @id @default(uuid())
  role  String // 'owner', 'admin', 'member', 'guest'
  // ... other fields
}
```

#### Resource-Level Permissions
- Users can only edit their own content (unless admin)
- Customers can only view their own orders
- Draft content visible only to author and admins

## Input Validation & Sanitization

### Backend Validation

#### Principles
- **Never trust client input**
- **Validate all inputs server-side**
- **Whitelist validation** (allow known good, not deny known bad)
- **Type checking** (use TypeScript and runtime validation)
- **Length limits** on all string inputs
- **Format validation** (email, URL, phone, etc.)

#### Implementation
- Use **class-validator** with NestJS DTOs
- Validate request body, query params, and path params
- Sanitize HTML content (allow only safe tags)
- Use parameterized queries (Prisma prevents SQL injection)

#### Example Validations
```typescript
// Article creation DTO
class CreateArticleDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title: string;

  @IsString()
  @MinLength(10)
  content: string;

  @IsUUID()
  authorId: string;

  @IsArray()
  @IsUUID('4', { each: true })
  categoryIds: string[];
}
```

### Content Sanitization

#### Rich Text Content
- Use **DOMPurify** or similar library
- Allow only safe HTML tags: `<p>`, `<h1-h6>`, `<a>`, `<strong>`, `<em>`, `<ul>`, `<ol>`, `<li>`, `<img>`, `<code>`, `<pre>`, `<blockquote>`
- Remove JavaScript event handlers (`onclick`, `onerror`, etc.)
- Sanitize URLs (prevent `javascript:` protocol)
- Limit image sources to trusted domains or uploaded media

#### User-Generated Content
- Sanitize before storage
- Escape on output
- Use Content Security Policy (CSP)

## Data Protection

### Encryption

#### Encryption at Rest
- Database: Enable PostgreSQL encryption (transparent data encryption)
- File storage: S3 server-side encryption (SSE-S3 or SSE-KMS)
- Backups: Encrypted backups

#### Encryption in Transit
- **HTTPS/TLS 1.3** for all connections
- Enforce HTTPS (redirect HTTP to HTTPS)
- HSTS header (HTTP Strict Transport Security)
- Certificate pinning for mobile apps (future)

#### Sensitive Data Encryption
- Payment tokens: Handled by Stripe (PCI compliant)
- API keys: Encrypted in database or use secrets manager
- Environment variables: Never commit to version control

### Data Minimization
- Collect only necessary data
- **AECMS never requests or stores credit card numbers**
- Payment data collected directly by payment providers:
  - **Stripe**: Card data collected via Stripe.js (never touches our servers)
  - **PayPal**: Users redirected to PayPal for payment (no card data)
  - **Amazon Pay**: Users authenticate with Amazon (no card data)
- Payment providers return tokens only (not card data)
- AECMS stores only: Payment Intent IDs, transaction status, amount
- Anonymize analytics data
- Email verification prevents fake accounts without collecting excessive data

### Personal Data Handling

#### PII (Personally Identifiable Information)
- Name, email, phone, address
- Stored in database with access controls
- Encrypted in backups
- Deleted on account deletion (GDPR right to be forgotten)

#### Order History
- Retain for tax/legal requirements (7 years typical)
- Anonymize after retention period
- Allow customer export (GDPR data portability)

### Data Retention Policy

| Data Type | Retention Period | Action After |
|-----------|------------------|--------------|
| User accounts | Until deletion | Anonymize |
| Order data | 7 years | Archive/anonymize |
| Payment tokens | Until card removal | Delete |
| Audit logs | 7 years | Archive (legal compliance) |
| Session data (front door) | Until logout | Auto-delete |
| Session data (back door) | 7 days max | Auto-delete |
| Media files | Until manual deletion | Keep |
| Email verification tokens | 15 minutes | Auto-delete |
| Password reset tokens | 15 minutes | Auto-delete |
| Comment moderation flags | Until resolved | Archive |

## API Security

### Rate Limiting

**Public API:**
- 100 requests per 15 minutes per IP
- 1000 requests per day per IP

**Authenticated API:**
- 1000 requests per 15 minutes per user
- 10,000 requests per day per user

**Admin API:**
- 5000 requests per 15 minutes per user

**Implementation Strategy:**

Option A: **@nestjs/throttler** (with Redis storage)
| Pros | Cons |
|------|------|
| Native NestJS integration, decorator-based | Requires Redis configuration |
| Simple configuration | Less flexible for complex rules |
| Built-in support for multiple limits | Performance overhead on every request |
| Can use Redis as storage backend | Limited to time-window based throttling |

Option B: **Redis-based** (custom implementation with ioredis)
| Pros | Cons |
|------|------|
| More flexible rules (burst, sliding window) | More code to maintain |
| Better performance at scale | No built-in NestJS decorators |
| Distributed across multiple servers | Requires custom middleware |
| Can implement complex throttling logic | More setup complexity |

**Recommended: @nestjs/throttler with Redis storage**
- Best balance of simplicity and scalability
- Redis storage enables distributed rate limiting (important if scaling to multiple backend instances)
- Simple decorator-based usage: `@Throttle(100, 60)`
- Free tier Redis (Railway/Oracle) can handle rate limiting data easily

**Implementation:**
```typescript
// app.module.ts
import { ThrottlerModule } from '@nestjs/throttler'
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis'

ThrottlerModule.forRoot({
  storage: new ThrottlerStorageRedisService(process.env.REDIS_URL),
  throttlers: [
    { name: 'short', ttl: 1000, limit: 10 },  // 10 req/second
    { name: 'medium', ttl: 60000, limit: 100 }, // 100 req/minute
    { name: 'long', ttl: 900000, limit: 1000 }, // 1000 req/15min
  ],
})

// Usage in controller
@Throttle({ short: { limit: 5, ttl: 1000 } }) // Override for specific endpoint
@Post('/auth/login')
async login() { /* ... */ }
```

- Return `429 Too Many Requests` with `Retry-After` header
- Log excessive requests for abuse detection
- Monitor rate limit hits in metrics dashboard

### API Authentication
- Require valid JWT for protected endpoints
- Validate token signature
- Check token expiration
- Verify user still exists and is active
- Check role and permissions

### CORS (Cross-Origin Resource Sharing)
- Whitelist allowed origins (frontend domains)
- Allow credentials (cookies)
- Restrict allowed methods and headers
- Don't use wildcard `*` in production

### Request Size Limits
- Request body: 10 MB (configurable per endpoint)
- File uploads: 50 MB
- Use **body-parser** limits
- Prevent denial-of-service via large payloads

## Payment Security

### PCI DSS Compliance

**Approach: Stripe/PayPal/Amazon Pay Integration (No Card Data Handling)**

By using third-party payment providers, AECMS achieves PCI compliance through complete delegation:

1. **No card data touching servers**: Payment data collected directly by providers
2. **Tokenization**: Providers return tokens, not card data
3. **Secure payment processing**: All payment processing handled by providers
4. **PCI DSS Level 1 Service Providers**: Stripe, PayPal, and Amazon Pay are all compliant

**Payment Provider Security:**
- **Stripe**: Stripe.js collects card data in iframe, returns token
- **PayPal**: User redirected to PayPal, returns authorization token
- **Amazon Pay**: User authenticates with Amazon account, returns charge token

**AECMS Responsibilities:**
- Serve pages with HTTPS
- Use official provider libraries/SDKs
- Never log or store card data
- Secure webhook endpoints with signature verification
- Follow secure coding practices
- SAQ A (Self-Assessment Questionnaire A) - shortest PCI form
- Annual compliance attestation

### Payment Workflow Security

**Stripe Workflow:**

*Frontend:*
1. Load Stripe.js from Stripe CDN (integrity check)
2. Use Stripe Elements for card input (Stripe-hosted iframe)
3. Stripe.js tokenizes card data
4. Send token to backend (never send card data)

*Backend:*
1. Validate order data
2. Create Stripe Payment Intent with token
3. Store Payment Intent ID (not card data)
4. Return client secret to frontend
5. Frontend confirms payment with Stripe
6. Stripe webhooks confirm payment status
7. Update order status

**PayPal Workflow:**

*Frontend:*
1. Load PayPal SDK from PayPal CDN
2. Display PayPal button
3. User clicks, redirected to PayPal
4. User authenticates and approves payment

*Backend:*
1. Create PayPal order
2. Return order ID to frontend
3. Frontend redirects to PayPal
4. User approves
5. PayPal webhooks confirm payment
6. Capture payment
7. Update order status

**Amazon Pay Workflow:**

*Frontend:*
1. Load Amazon Pay SDK from Amazon CDN
2. Display Amazon Pay button
3. User clicks, authenticates with Amazon account
4. Amazon returns buyer and shipping info

*Backend:*
1. Create Amazon Pay charge permission
2. User grants permission
3. Backend creates charge
4. Amazon returns charge ID
5. Amazon webhooks confirm payment
6. Update order status
7. Store charge ID (not card data)

### Webhook Security

**Stripe Webhooks:**
- Verify webhook signature (Stripe-Signature header)
- Use Stripe signing secret from environment variable
- Validate event ID (prevent replay)
- Handle events idempotently (check order status before updating)
- Verify amount matches order total

**PayPal Webhooks:**
- Verify webhook signature (PayPal-Transmission-Sig header)
- Validate event with PayPal API
- Handle events idempotently
- Verify amount matches order total

**Amazon Pay Webhooks:**
- Verify webhook signature using Amazon Pay public key
- Validate notification authenticity
- Handle events idempotently
- Verify charge ID and amount match order

**Webhook Endpoint Security:**
- Use dedicated endpoints (not admin routes)
- Rate limiting (but allow legitimate burst from providers)
- Log all webhook events (timestamp, provider, event type, order ID)
- Alert on failed signature validations
- Retry logic for failed processing (use message queue)
- Webhook endpoint examples:
  - `POST /webhooks/stripe`
  - `POST /webhooks/paypal`
  - `POST /webhooks/amazon-pay`

## Infrastructure Security

### Network Security

**Firewall Rules:**
- Allow only HTTPS (443) and HTTP (80 with redirect) inbound
- SSH (22) restricted to admin IPs only
- Database (5432) accessible only from backend
- Redis (6379) accessible only from backend

**DDoS Protection:**
- Use CDN with DDoS protection (Cloudflare)
- Rate limiting at application layer
- Auto-scaling to handle traffic spikes

### Server Security

**Operating System:**
- Use latest LTS versions (Ubuntu 22.04 LTS)
- Automatic security updates
- Disable unused services
- Use non-root user for application

**Application:**
- Run with least privilege
- Use process isolation (containers recommended)
- Limit file system access
- Use read-only file systems where possible

### Database Security

**Access Control:**
- Strong password (32+ characters, random)
- Network isolation (private VPC)
- Application-specific user (not superuser)
- Least privilege (only needed permissions)

**Backups:**
- Automated daily backups
- Encrypted backups
- Offsite backup storage
- Regular restore testing

**Monitoring:**
- Query performance monitoring
- Connection monitoring
- Failed login attempts
- Unusual query patterns

### Container Security

**AECMS uses Docker for all deployments** to ensure portability and consistency.

**Container Hardening:**
- Use official base images (node:20-alpine or node:20-slim)
- Scan images for vulnerabilities (Trivy, Snyk) in CI/CD
- Non-root user in containers (create dedicated `aecms` user)
- Minimal images (alpine or distroless preferred)
- Read-only root filesystem where possible
- Resource limits (CPU, memory) in docker-compose.yml
- No secrets in container images (use environment variables)
- Multi-stage builds to minimize image size
- Regular base image updates

**Docker Compose Security:**
```yaml
services:
  backend:
    image: aecms/backend:latest
    user: "1000:1000"  # Non-root user
    read_only: true
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
```

**Vulnerability Scanning:**
- Run Trivy scan on every build: `trivy image aecms/backend:latest`
- Block deployment if critical vulnerabilities found
- Automated daily scans of production images

## Application Security

### Dependency Management

**Dependency Scanning:**
- Use **npm audit** regularly
- Automated scanning in CI/CD (GitHub Dependabot)
- Monitor for security advisories
- Keep dependencies up to date

**Lock Files:**
- Commit package-lock.json
- Verify integrity on install
- Prevent dependency confusion attacks

### Code Security

**Static Analysis:**
- ESLint with security plugins
- SonarQube or similar (optional)
- TypeScript strict mode
- Regular code reviews

**Secrets Management:**

**Hosting Provider Secrets Support:**
| Provider | Secrets Management | Notes |
|----------|-------------------|-------|
| Railway | Environment variables | Encrypted at rest, accessible via CLI/UI |
| Oracle Cloud | OCI Vault | Full secrets manager with rotation, versioning |
| Vercel | Environment variables | Encrypted, supports preview/production separation |
| Cloudflare Pages | Environment variables | Encrypted, KV storage available |
| Supabase | Environment variables | Encrypted, managed in dashboard |

**Strategy:**
1. **MVP**: Use environment variables provided by hosting platform
   - All free-tier hosts provide encrypted environment variables
   - Sufficient for low-traffic sites
   - No additional cost

2. **Production/Scaling**: Consider dedicated secrets manager
   - Oracle Cloud OCI Vault (free tier available)
   - HashiCorp Vault (self-hosted, adds complexity)
   - AWS Secrets Manager (~$0.40/secret/month + API calls)

**Implementation:**
- Never commit secrets to version control (.env in .gitignore)
- Use `.env.example` with placeholder values
- Store secrets in hosting provider's environment variables
- For API keys that must be stored in database (user-configurable integrations):
  - Encrypt using AES-256-GCM
  - Store encryption key in environment variable (not in database)
  - Use `@nestjs/crypto` or `crypto` module
- Rotate secrets regularly (90-day recommendation)

**Example: Encrypting API Keys in Database**
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_KEY // 32 bytes
const ALGORITHM = 'aes-256-gcm'

function encryptApiKey(apiKey: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv)
  let encrypted = cipher.update(apiKey, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

function decryptApiKey(encryptedKey: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedKey.split(':')
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
```

**Secrets to Manage:**
- JWT signing secret
- Refresh token secret
- Database connection string
- Redis connection string
- Stripe API keys (secret key, webhook secret)
- PayPal API keys (client ID, secret)
- Amazon Pay API keys
- SMTP credentials
- OAuth client secrets (Google, Apple)
- OpenAI API key (for comment moderation)
- Encryption key for database-stored API keys

**Security Headers:**
```javascript
// Example security headers
{
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Content-Security-Policy": "default-src 'self'; ...",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
}
```

### Content Security Policy (CSP)

```
default-src 'self';
script-src 'self' https://js.stripe.com https://www.paypal.com https://static-na.payments-amazon.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https://api.stripe.com https://www.paypal.com https://api-na.amazon.com;
frame-src https://js.stripe.com https://www.paypal.com https://payments.amazon.com;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

**Notes:**
- Payment provider CDNs whitelisted for security
- `'unsafe-inline'` for styles needed for TipTap editor and Tailwind
- `https:` for images allows external image embeds (Admin/Owner only)
- `frame-ancestors 'none'` prevents clickjacking
- `upgrade-insecure-requests` forces HTTPS for all resources

## Logging & Monitoring

### Security Logging

**Events to Log:**
- Authentication attempts (success/failure)
- Password changes/resets
- Role/permission changes
- Payment transactions
- Admin actions
- API errors (4xx, 5xx)
- Rate limit violations
- Webhook failures
- Unusual access patterns

**Log Format:**
```json
{
  "timestamp": "2026-01-27T12:00:00Z",
  "level": "warn",
  "event": "auth.failed_login",
  "userId": "user-id-or-null",
  "ip": "192.168.1.1",
  "userAgent": "...",
  "details": {
    "email": "user@example.com",
    "reason": "invalid_password"
  }
}
```

**Log Storage:**
- Centralized logging system
- Retention: 1 year
- Access restricted to admins
- Encrypted at rest and in transit

### Security Monitoring

**Real-Time Alerts:**
- Multiple failed login attempts (5 in 5 minutes)
- Admin privilege escalation
- Large file uploads
- Payment failures (spike)
- Server errors (spike)
- Unusual access patterns (geographic anomalies)

**Monitoring Tools:**
- Sentry for application errors
- Datadog/New Relic for infrastructure
- CloudFlare for network-level attacks
- Custom alerting for business logic

### Incident Response

**Incident Response Plan:**
1. **Detection**: Automated alerts or user report
2. **Assessment**: Determine severity and scope
3. **Containment**: Isolate affected systems
4. **Eradication**: Remove threat (patch, revoke access)
5. **Recovery**: Restore normal operations
6. **Lessons Learned**: Post-mortem and improvements

**Communication Plan:**
- Notify affected users within 72 hours (GDPR requirement)
- Transparent communication about incident
- Provide guidance to users (password reset, etc.)

## Compliance

### GDPR (General Data Protection Regulation)

**Requirements:**
- **Lawful basis** for data processing (consent, contract, legitimate interest)
- **Data minimization**: Collect only necessary data
- **Right to access**: Users can request their data
- **Right to erasure**: Users can request account deletion
- **Right to portability**: Users can export their data
- **Breach notification**: Within 72 hours
- **Privacy by design**: Build privacy into system

**Implementation:**
- Privacy policy page with version control
- Cookie consent banner
- Account export functionality (JSON/CSV)
- Account deletion functionality (with data anonymization)
- Data processing agreement with third parties
- User acceptance tracking for legal documents

### Version Control for Legal Documents

**Required for Compliance:**
- EULA (End User License Agreement)
- Privacy Policy
- Terms of Service
- Cookie Policy

**Features:**
- **OFF by default** for regular articles, **ON for legal documents**
- Version history with change summaries
- User acceptance tracking (user ID, IP, user agent, timestamp)
- Force re-acceptance when major changes occur
- Audit trail of document changes
- Compliance with GDPR Article 7 (consent records)

**Database Schema:**
```typescript
model ArticleVersion {
  id              String   @id @default(uuid())
  article_id      String
  version_number  Int
  content         String   // Full content snapshot
  change_summary  String   // What changed in this version
  created_at      DateTime @default(now())
  created_by      String   // Admin/Owner who published
  article         Article  @relation(fields: [article_id], references: [id])

  @@unique([article_id, version_number])
}

model UserDocumentAcceptance {
  id              String   @id @default(uuid())
  user_id         String?  // Null for guest acceptance
  article_id      String
  version_number  Int
  accepted_at     DateTime @default(now())
  ip_address      String
  user_agent      String
  user            User?    @relation(fields: [user_id], references: [id])

  @@index([user_id, article_id])
}
```

**Implementation:**
- Admin toggles "Require Acceptance" on Privacy Policy/EULA articles
- When document changes, version number increments
- Users who previously accepted see "Updated - Please Review"
- Cannot proceed (checkout, commenting) until accepted
- Acceptance logged with IP and user agent for legal proof
- 7-year retention for acceptance records

### CCPA (California Consumer Privacy Act)

**Requirements:**
- Disclose data collection practices
- Right to know what data is collected
- Right to delete data
- Right to opt-out of data sale (N/A - we don't sell data)

**Implementation:**
- "Do Not Sell My Information" link (even if N/A)
- User data export
- User data deletion

### PCI DSS (Payment Card Industry Data Security Standard)

**Handled by Stripe/PayPal:**
- No cardholder data environment (CDE)
- Tokenization instead of storage
- Stripe/PayPal are PCI Level 1 compliant

**AECMS Responsibilities:**
- SAQ A (Self-Assessment Questionnaire A) - shortest form
- Annual compliance attestation
- Quarterly network scans (if applicable)

### ADA/WCAG (Web Accessibility)

**WCAG 2.1 Level AA Compliance:**
- Keyboard navigation
- Screen reader support
- Sufficient color contrast
- Alt text for images
- Proper heading hierarchy
- Form labels and error messages

## Security Testing

### Vulnerability Scanning

**Automated Scanning:**
- Dependency scanning: npm audit, Snyk
- SAST (Static Application Security Testing): SonarQube
- Container scanning: Trivy
- Frequency: Every commit (CI/CD)

**Manual Testing:**
- Penetration testing: Annually
- Security code review: For critical features
- OWASP Top 10 testing

### Bug Bounty Program (Future)

**Phase 3 Feature:**
- Responsible disclosure policy
- Scope: Production systems only
- Rewards for valid vulnerabilities
- Platform: HackerOne or Bugcrowd

## Security Training

**Developer Training:**
- OWASP Top 10 awareness
- Secure coding practices
- Code review for security
- Incident response procedures

**Admin Training:**
- Strong password practices
- Phishing awareness
- Social engineering awareness
- Incident reporting procedures

## Email Verification & Account Security

**Email Verification Required:**
- All Member accounts must verify email before full access
- Prevents spam accounts and fake registrations
- OAuth accounts (Google, Apple) are pre-verified

**Verification Flow:**
1. User signs up with email/password
2. Account created but `email_verified = false`
3. Verification email sent with token (15-minute expiry)
4. User clicks link, token validated
5. Account marked as verified
6. User can now comment, review, and access logged-in content

**Admin/Owner Elevation:**
- Admin and Owner accounts created by elevating verified Members
- Prevents direct creation of elevated accounts
- Owner promotes Member → Admin
- Owner promotes Member → Owner (only Owners can create Owners)
- Ensures all elevated accounts have verified emails

**Database Schema:**
```typescript
model User {
  id              String   @id @default(uuid())
  email           String   @unique
  email_verified  Boolean  @default(false)
  role            String   @default('member') // 'owner', 'admin', 'member'
  // ...
}

model EmailVerificationToken {
  id         String   @id @default(uuid())
  user_id    String
  token      String   @unique
  expires_at DateTime
  created_at DateTime @default(now())
  user       User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
}
```

## AI-Powered Comment Moderation

**Automated Content Filtering:**
- **OpenAI Moderation API** (free tier) for detecting:
  - Hate speech
  - Harassment and bullying
  - Violence and threats
  - Sexual content
  - Self-harm content
- **bad-words library** for profanity detection and bleeping

**Profanity Bleeping:**
- Fully redacted (e.g., "f***" becomes "[profanity]")
- No letter hints to prevent circumvention
- Click-to-reveal for logged-in users (consent-based viewing)
- Original text stored in database (for admin review)

**Reactive Moderation:**
- Comments posted immediately (user experience priority)
- AI moderation runs asynchronously (message queue)
- Flagged comments marked for human review
- Admins notified of flagged content
- Admins can approve, edit, or delete flagged comments

**Security Considerations:**
- OpenAI API calls include only comment text (no PII)
- API key stored as encrypted environment variable
- Rate limiting on moderation API calls (prevent abuse)
- Fallback to queue retry if API unavailable
- Cost monitoring (free tier has limits)

**Implementation:**
```typescript
async moderateComment(comment: string): Promise<ModerationResult> {
  // Check profanity first (free, fast)
  const profanityResult = this.profanityFilter.check(comment)

  // Call OpenAI Moderation API
  const openaiResult = await this.openai.moderations.create({
    input: comment
  })

  const flagged = openaiResult.results[0].flagged || profanityResult.hasProfanity

  return {
    flagged,
    categories: openaiResult.results[0].categories,
    profanityDetected: profanityResult.hasProfanity,
    cleanedText: profanityResult.hasProfanity ? profanityResult.cleaned : comment
  }
}
```

## Audit Trail & Compliance Logging

**Immutable Audit Log:**
- Tamper-evident logging with blockchain-like chaining
- Each log entry includes hash of previous entry
- 7-year retention for legal compliance
- Supports GDPR, CCPA, and financial regulations

**Events Tracked (50+ types):**

*User Actions:*
- Login/logout (success/failure)
- Password changes/resets
- Email changes
- 2FA setup/changes
- Account deletion requests

*Content Changes:*
- Article/page/product create/edit/delete
- Media uploads/deletes
- Category/tag changes
- Visibility changes

*Ecommerce:*
- Orders placed/cancelled
- Payments processed/failed
- Refunds issued
- Product price changes
- Stock updates

*Admin Actions:*
- User role changes
- Capability assignments
- System setting changes
- Payment configuration changes
- Forced password resets

**Security Features:**
- Read-only after creation (immutable)
- Checksums prevent tampering
- Searchable and filterable
- Exportable (CSV) for compliance audits
- IP address and user agent logging
- Admin dashboard viewer with filters

**Database Schema:**
```typescript
model AuditLog {
  id              String   @id @default(uuid())
  timestamp       DateTime @default(now())
  event_type      String   // 'user.login', 'article.edit', 'order.create', etc.
  user_id         String?  // Null for guest actions
  target_type     String?  // 'Article', 'Product', 'User', etc.
  target_id       String?
  action          String   // 'create', 'update', 'delete', 'view'
  details         Json?    // Event-specific data
  ip_address      String
  user_agent      String
  previous_hash   String?  // Hash of previous entry (chaining)
  entry_hash      String   // Hash of this entry

  @@index([timestamp])
  @@index([event_type])
  @@index([user_id])
}
```

## Granular Content Permissions

**Per-Content Permission Flags:**
- Separate from role-based capabilities
- Applied at individual article/page/product level
- Evaluated with OR logic (any match grants access)

**Permission Flags:**
```typescript
model Article {
  id                  String  @id @default(uuid())
  author_id           String
  author_can_edit     Boolean @default(true)
  author_can_delete   Boolean @default(false) // Admins must approve deletion
  admin_can_edit      Boolean @default(true)
  admin_can_delete    Boolean @default(true)
  // ...
}
```

**Permission Evaluation:**
```typescript
function canEditArticle(user: User, article: Article): boolean {
  // Owner always can
  if (user.role === 'owner') return true

  // Check per-content flags with OR logic
  if (user.id === article.author_id && article.author_can_edit) return true
  if (user.role === 'admin' && article.admin_can_edit) return true

  return false
}
```

**Use Cases:**
- Lock sensitive articles from author edits (Owner/Admin only)
- Prevent accidental deletion by authors
- Granular control without creating new roles
- Temporary permission restrictions

**Admin UI:**
- Checkboxes on article/page/product edit screen
- Only visible to Admin/Owner
- Owner permissions always true (cannot be toggled off)

## Open Questions

1. ~~Do we need SOC 2 compliance for enterprise customers?~~ **No** - Personal CMS, not targeting enterprise
2. ~~Should we implement IP-based geolocation blocking for high-risk countries?~~ **No** - Rate limiting and authentication sufficient
3. ~~Do we need an internal security audit before launch?~~ **No** - OWASP best practices and automated scanning sufficient for MVP
4. ~~Should we implement honeypots for attack detection?~~ **No** - Over-engineering for low-traffic sites
5. ~~Do we need a dedicated security operations center (SOC)?~~ **No** - Monitoring tools and alerts sufficient

## Success Metrics

- Zero payment security incidents
- Zero data breaches
- < 0.1% false positive rate on fraud detection (future)
- 100% critical vulnerabilities patched within 24 hours
- 100% of staff complete security training annually
- WCAG AA compliance score: 100%
- Security audit findings: Zero critical, zero high
