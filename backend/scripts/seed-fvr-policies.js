/**
 * One-shot script: seed Terms of Service and Privacy Policy pages for Fantasy V Reality.
 * Generates content from the same templates used by the setup wizard.
 *
 * Run against the live DB:
 *   DATABASE_URL="<live-url>" node backend/scripts/seed-fvr-policies.js
 *
 * Pages are created in DRAFT status. Review and publish via Admin → Pages.
 */

'use strict';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ── TipTap node builders ───────────────────────────────────────────────────────
const p = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });
const li = (text) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const ul = (...items) => ({ type: 'bulletList', content: items.map(li) });

const SITE_NAME = 'Fantasy V Reality';
const SITE_URL = 'https://fantasyvreality.com';
const CONTACT_EMAIL = 'contact@fantasyvreality.com';
const OWNER_NAME = 'Fantasy V Reality';
const EFFECTIVE_DATE = 'June 26, 2026';

// ── Terms of Service ───────────────────────────────────────────────────────────
function buildTerms() {
  return JSON.stringify({
    type: 'doc',
    content: [
      h2('Terms of Service'),
      p(`Effective date: ${EFFECTIVE_DATE}`),
      p(`Please read these Terms of Service ("Terms") carefully before using ${SITE_NAME} ("the Service") at ${SITE_URL}. By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.`),

      h2('1. The Service'),
      p(`${SITE_NAME} is an independent creative writing and fiction platform. We publish articles, essays, and commentary in the fantasy and speculative fiction genre, and we sell digital products including ebooks and downloadable reading materials.`),

      h2('2. Use of the Service'),
      p(`You may use the Service for personal, non-commercial purposes. You agree not to:`),
      ul(
        'Use the Service in any way that violates applicable federal, state, or local law.',
        'Attempt to gain unauthorised access to any part of the Service or its systems.',
        'Upload or transmit content that is unlawful, defamatory, or infringing of third-party intellectual property rights.',
        'Use automated scripts or bots to scrape data from the Service.',
        'Impersonate any person or entity.',
      ),

      h2('3. User Accounts'),
      p(`When you create an account, you must provide accurate information and keep your credentials confidential. You are responsible for all activity under your account. Notify us immediately at ${CONTACT_EMAIL} if you suspect unauthorised use of your account.`),
      p(`We may suspend or terminate accounts that violate these Terms without prior notice.`),

      h2('4. Purchases and Payments'),
      p(`All prices are displayed in US dollars. Payments are processed by Stripe and PayPal; by completing a purchase you authorise the applicable processor to charge your payment method.`),
      p(`Pricing may change at any time and does not apply retroactively to completed purchases. All sales are final except as described in Section 5.`),

      h2('5. Digital Products — No Refund Policy'),
      p(`All digital product sales (ebooks, downloads, and similar digital content) are final. Because digital files are delivered immediately upon payment and cannot be "returned," we do not offer refunds once a download link has been issued.`),
      p(`Exceptions:`),
      ul(
        'If a file is corrupted or undeliverable due to a technical error on our part, we will provide a replacement at no charge.',
        'If you are charged but receive no download confirmation, contact us at ' + CONTACT_EMAIL + ' within 7 days.',
      ),
      p(`You receive a personal, non-exclusive, non-transferable licence to use purchased digital files for private reading and enjoyment. Redistribution, resale, or commercial use is prohibited.`),

      h2('6. Intellectual Property'),
      p(`All creative content on ${SITE_NAME} — including articles, fiction, artwork, and product descriptions — is the original work of ${OWNER_NAME} or its contributing authors and is protected by United States copyright law.`),
      p(`You may quote short passages for review or commentary purposes (fair use), but reproduction of substantial portions without written permission is prohibited. Contact us at ${CONTACT_EMAIL} for licensing enquiries.`),

      h2('7. User-Generated Content'),
      p(`If you post comments or reviews on the Service, you grant us a non-exclusive, royalty-free licence to display that content as part of the Service. You retain ownership of your comments. We reserve the right to remove any content that violates these Terms or our community standards.`),

      h2('8. Third-Party Links'),
      p(`The Service may link to external websites (e.g., Amazon, Goodreads, publisher sites). We are not responsible for the content, policies, or practices of any linked site.`),

      h2('9. Disclaimers'),
      p(`The Service is provided "AS IS" without warranties of any kind, express or implied. We make no representations about the accuracy, completeness, or reliability of any content. Creative fiction is fictional — any resemblance to real persons, places, or events is coincidental.`),

      h2('10. Limitation of Liability'),
      p(`To the maximum extent permitted by law, ${OWNER_NAME} shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, even if we have been advised of the possibility of such damages. Our total liability for any claim shall not exceed the amount you paid us in the 12 months preceding the claim.`),

      h2('11. Governing Law'),
      p(`These Terms are governed by the laws of the State of Texas, United States. Any dispute shall be resolved in the courts of Texas.`),

      h2('12. Changes to These Terms'),
      p(`We may update these Terms at any time. We will revise the effective date when we do. Continued use of the Service after changes constitutes your acceptance of the new Terms.`),

      h2('13. Contact'),
      p(`Questions about these Terms? Email us at ${CONTACT_EMAIL}.`),
    ],
  });
}

// ── Privacy Policy ─────────────────────────────────────────────────────────────
function buildPrivacy() {
  return JSON.stringify({
    type: 'doc',
    content: [
      h2('Privacy Policy'),
      p(`Effective date: ${EFFECTIVE_DATE}`),
      p(`${SITE_NAME} ("we," "us," or "our") operates ${SITE_URL}. This Privacy Policy explains what personal information we collect, how we use it, and your rights regarding that information.`),

      h2('1. Information We Collect'),
      ul(
        'Account information: your email address, username, and optionally your first and last name.',
        'Order information: items purchased, order total, shipping address (for physical goods), and customer name.',
        'Technical data: IP address, browser type, referrer URL, and page visit timestamps collected automatically via server logs.',
      ),
      p(`We do not collect payment card numbers. All payment details are entered directly into Stripe or PayPal's secure interfaces and are governed by their privacy policies.`),

      h2('2. How We Use Your Information'),
      ul(
        'To process and fulfil your orders, including delivering digital downloads.',
        'To personalise digital files with your name (if that option is enabled for a product).',
        'To send transactional emails: order confirmations, download links, and account verification.',
        'To respond to your support enquiries.',
        'To improve the security and functionality of the Service.',
        'To comply with applicable legal obligations, including tax record-keeping.',
      ),
      p(`We do not sell your personal information. We do not use your data for advertising or share it with third-party marketers.`),

      h2('3. Payment Processing'),
      p(`Payments are handled by Stripe, Inc. and/or PayPal Holdings, Inc. When you purchase something, your payment details are submitted directly to those processors. ${SITE_NAME} does not receive, store, or have access to your card number, CVV, or bank account details.`),
      p(`Stripe privacy policy: https://stripe.com/privacy`),
      p(`PayPal privacy policy: https://www.paypal.com/webapps/mpp/ua/privacy-full`),

      h2('4. Cookies and Browser Storage'),
      p(`We use browser localStorage (not third-party tracking cookies) to maintain your login session and shopping cart. This data stays on your device.`),
      p(`We do not use advertising tracking pixels, analytics services that identify you personally, or any third-party tracking technology.`),

      h2('5. Data Retention'),
      p(`We keep account information for as long as your account remains active. Order records are retained for at least seven years for tax and accounting compliance. If you delete your account, your order history is retained as required by law but is no longer associated with a public profile.`),

      h2('6. Security'),
      p(`We use industry-standard safeguards including encrypted password storage, encrypted credentials in our database, and HTTPS for all connections. No system is perfectly secure; if you suspect a security issue please contact us at ${CONTACT_EMAIL}.`),

      h2('7. Third-Party Services'),
      ul(
        'Cloudflare Turnstile — used for CAPTCHA verification during registration. No personally identifiable information is shared beyond a standard HTTP request.',
        'Cloud storage (Google Cloud Storage or S3-compatible) — used to store uploaded media and digital product files. Files are stored securely and are not shared with the storage provider for any purpose other than storage and delivery.',
      ),

      h2('8. Your Rights'),
      p(`Depending on where you live, you may have rights to:`),
      ul(
        'Access the personal data we hold about you.',
        'Correct inaccurate information.',
        'Request deletion of your account and personal data (subject to legal retention requirements).',
        'Receive a copy of your data in a portable format.',
      ),
      p(`To exercise these rights, email ${CONTACT_EMAIL}. You can also delete your own account at any time from your Account page.`),

      h2('9. Children\'s Privacy'),
      p(`${SITE_NAME} is not directed at children under 13. We do not knowingly collect information from children under 13. If you believe we have done so accidentally, contact us at ${CONTACT_EMAIL} and we will delete it immediately.`),

      h2('10. Changes to This Policy'),
      p(`We may update this Privacy Policy from time to time. The effective date at the top of this page will reflect the most recent revision. Continued use of the Service constitutes acceptance of any changes.`),

      h2('11. Contact'),
      p(`Privacy questions or requests: ${CONTACT_EMAIL}`),
      p(`${SITE_NAME}`),
      p(SITE_URL),
    ],
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding policy pages for Fantasy V Reality...\n');

  const [existingTerms, existingPrivacy] = await Promise.all([
    prisma.page.findFirst({ where: { slug: 'terms', deleted_at: null } }),
    prisma.page.findFirst({ where: { slug: 'privacy', deleted_at: null } }),
  ]);

  if (existingTerms) {
    console.log('✓ /terms page already exists — skipping.');
  } else {
    await prisma.page.create({
      data: {
        slug: 'terms',
        title: 'Terms of Service',
        content: buildTerms(),
        status: 'draft',
        visibility: 'public',
        show_in_nav: false,
        meta_title: `Terms of Service — ${SITE_NAME}`,
        meta_description: `Terms of Service for ${SITE_NAME} at ${SITE_URL}.`,
      },
    });
    console.log('✓ Created /terms (Terms of Service) — status: draft');
  }

  if (existingPrivacy) {
    console.log('✓ /privacy page already exists — skipping.');
  } else {
    await prisma.page.create({
      data: {
        slug: 'privacy',
        title: 'Privacy Policy',
        content: buildPrivacy(),
        status: 'draft',
        visibility: 'public',
        show_in_nav: false,
        meta_title: `Privacy Policy — ${SITE_NAME}`,
        meta_description: `Privacy Policy for ${SITE_NAME} — how we collect, use, and protect your information.`,
      },
    });
    console.log('✓ Created /privacy (Privacy Policy) — status: draft');
  }

  console.log('\nDone. Review and publish both pages at Admin → Pages before going live.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
