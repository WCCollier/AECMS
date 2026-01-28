# PRD 05: Security & Compliance

**Version:** 1.0
**Date:** 2026-01-27
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
- Minimum 12 characters
- Must include: uppercase, lowercase, number, special character
- No common passwords (use dictionary check)
- No password reuse (check against previous 5 passwords)
- Passwords hashed with **bcrypt** (cost factor 12)

#### Password Reset Flow
1. User requests password reset with email
2. Generate secure random token (32 bytes, hex encoded)
3. Store token hash with expiration (15 minutes)
4. Send reset link via email (HTTPS only)
5. Validate token on reset page
6. Allow password change only with valid token
7. Invalidate token after use or expiration
8. Log password reset events

#### Multi-Factor Authentication (MFA)
**Phase 2 Feature**
- TOTP (Time-based One-Time Password)
- SMS backup option
- Recovery codes
- Mandatory for admin accounts

### Session Management

#### JWT-Based Authentication

**Access Tokens:**
- Short-lived (15 minutes)
- Contain user ID, role, permissions
- Signed with HS256 or RS256
- Stored in memory (not localStorage)

**Refresh Tokens:**
- Long-lived (7 days, sliding window)
- Stored in httpOnly, secure, SameSite=Strict cookie
- Rotate on each refresh
- Single-use (prevent replay attacks)
- Stored in database with user ID, issued timestamp
- Revocable (logout, security event)

#### Session Security
- Use HTTPS exclusively (no HTTP)
- httpOnly cookies (prevent XSS access)
- Secure flag on cookies (HTTPS only)
- SameSite=Strict (prevent CSRF)
- CSRF tokens for state-changing operations
- Session timeout: 30 minutes of inactivity
- Absolute session timeout: 24 hours

#### Token Revocation
- Maintain token revocation list in Redis
- Revoke tokens on:
  - User logout
  - Password change
  - Account deletion
  - Suspicious activity detected
  - Admin-initiated revocation

### Authorization

#### Role-Based Access Control (RBAC)

**Roles:**
1. **Super Admin**:
   - Full system access
   - User management
   - System settings
   - Payment settings

2. **Admin**:
   - Content management (full)
   - Product management (full)
   - Order management (full)
   - Limited user management

3. **Editor**:
   - Create/edit own articles
   - Media upload
   - View products
   - No system settings access

4. **Customer**:
   - View public content
   - Purchase products
   - Manage own account
   - View own orders

**Permission Checks:**
- Verify on every API request
- Check both role and resource ownership
- Use NestJS Guards for consistent enforcement
- Fail securely (deny by default)

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
- No storage of raw credit card numbers
- Stripe tokenization for payment methods
- Anonymize analytics data

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
| Order data | 7 years | Archive |
| Payment tokens | Until card removal | Delete |
| Audit logs | 1 year | Archive |
| Session data | 7 days | Auto-delete |
| Media files | Until manual deletion | Keep |

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

**Implementation:**
- Use **@nestjs/throttler** or Redis-based rate limiter
- Return `429 Too Many Requests` with `Retry-After` header
- Log excessive requests for abuse detection

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

**Approach: Stripe/PayPal Integration (No Card Data Handling)**

By using Stripe and PayPal, AECMS achieves PCI compliance through:
1. **No card data touching servers**: Stripe.js collects card data directly
2. **Tokenization**: Stripe returns a token, not card data
3. **Secure payment processing**: Stripe handles all payment processing
4. **PCI DSS Level 1 Service Provider**: Stripe and PayPal are compliant

**AECMS Responsibilities:**
- Serve pages with HTTPS
- Use official Stripe/PayPal libraries
- Don't log or store card data
- Secure webhook endpoints
- Follow secure coding practices

### Payment Workflow Security

**Frontend:**
1. Load Stripe.js from Stripe CDN (integrity check)
2. Use Stripe Elements for card input (Stripe-hosted iframe)
3. Stripe.js tokenizes card data
4. Send token to backend (never send card data)

**Backend:**
1. Validate order data
2. Create Stripe Payment Intent with token
3. Store Payment Intent ID (not card data)
4. Return client secret to frontend
5. Frontend confirms payment with Stripe
6. Stripe webhooks confirm payment status
7. Update order status

### Webhook Security

**Stripe Webhooks:**
- Verify webhook signature (Stripe-Signature header)
- Use Stripe signing secret
- Validate event ID (prevent replay)
- Handle events idempotently

**PayPal Webhooks:**
- Verify webhook signature (PayPal-Transmission-Sig)
- Validate event with PayPal API
- Handle events idempotently

**Webhook Endpoint Security:**
- Use dedicated endpoints (not admin routes)
- Rate limiting (but allow legitimate burst)
- Log all webhook events
- Alert on failed validations

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

### Container Security (if using Docker)

- Use official base images
- Scan images for vulnerabilities (Trivy, Snyk)
- Non-root user in containers
- Minimal images (alpine or distroless)
- Read-only root filesystem
- Resource limits (CPU, memory)

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
- Never commit secrets to version control
- Use environment variables
- Use secrets manager (AWS Secrets Manager, HashiCorp Vault)
- Rotate secrets regularly

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
script-src 'self' https://js.stripe.com https://www.paypal.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https://api.stripe.com https://www.paypal.com;
frame-src https://js.stripe.com https://www.paypal.com;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

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
- Privacy policy page
- Cookie consent banner
- Account export functionality
- Account deletion functionality
- Data processing agreement with third parties

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

## Open Questions

1. Do we need SOC 2 compliance for enterprise customers?
2. Should we implement IP-based geolocation blocking for high-risk countries?
3. Do we need an internal security audit before launch?
4. Should we implement honeypots for attack detection?
5. Do we need a dedicated security operations center (SOC)?

## Success Metrics

- Zero payment security incidents
- Zero data breaches
- < 0.1% false positive rate on fraud detection (future)
- 100% critical vulnerabilities patched within 24 hours
- 100% of staff complete security training annually
- WCAG AA compliance score: 100%
- Security audit findings: Zero critical, zero high
