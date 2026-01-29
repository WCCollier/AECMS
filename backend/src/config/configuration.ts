export default () => ({
  environment: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRATION || '15m',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRATION || '7d',
  },

  urls: {
    app: getPublicUrl(process.env.APP_URL || 'http://localhost:3000', 3000),
    api: getPublicUrl(process.env.API_URL || 'http://localhost:4000', 4000),
    frontend: getPublicUrl(
      process.env.FRONTEND_URL || 'http://localhost:3000',
      3000,
    ),
    frontendAdmin:
      process.env.FRONTEND_ADMIN_URL || 'http://localhost:3000/admin',
  },

  codespaces: {
    enabled: process.env.CODESPACES === 'true',
    name: process.env.CODESPACE_NAME,
    domain: process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN,
  },

  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    },
  },

  payment: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    },
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      mode: process.env.PAYPAL_MODE || 'sandbox',
    },
  },

  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
  },

  email: {
    ses: {
      region: process.env.AWS_SES_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
      fromEmail: process.env.AWS_SES_FROM_EMAIL,
    },
  },
});

/**
 * Auto-detects Codespaces URLs and returns the correct public URL
 * Falls back to default URL for local development
 */
function getPublicUrl(defaultUrl: string, port: number): string {
  if (process.env.CODESPACES === 'true') {
    const codespace = process.env.CODESPACE_NAME;
    const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
    if (codespace && domain) {
      return `https://${codespace}-${port}.${domain}`;
    }
  }
  return defaultUrl;
}
