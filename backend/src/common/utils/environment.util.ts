/**
 * ============================================================================
 * Environment Utility
 * ============================================================================
 * Provides environment detection and URL construction utilities for both
 * local development and GitHub Codespaces environments.
 *
 * This utility enables seamless transition between environments without
 * requiring secret updates or configuration changes.
 */

/**
 * Detects if the application is running in GitHub Codespaces
 */
export function isCodespaces(): boolean {
  return process.env.CODESPACES === 'true';
}

/**
 * Detects if the application is running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Detects if the application is running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Constructs a public URL for the given port, automatically detecting
 * Codespaces environment and adjusting accordingly.
 *
 * @param defaultUrl - The default URL to use (typically localhost)
 * @param port - The port number the service is running on
 * @returns The public URL for accessing the service
 *
 * @example
 * // In local development:
 * getPublicUrl('http://localhost:3000', 3000)
 * // Returns: 'http://localhost:3000'
 *
 * @example
 * // In GitHub Codespaces:
 * getPublicUrl('http://localhost:3000', 3000)
 * // Returns: 'https://[codespace-name]-3000.app.github.dev'
 */
export function getPublicUrl(defaultUrl: string, port: number): string {
  if (isCodespaces()) {
    const codespaceName = process.env.CODESPACE_NAME;
    const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;

    if (!codespaceName || !domain) {
      console.warn(
        'Codespaces detected but CODESPACE_NAME or GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN not set. Falling back to default URL.',
      );
      return defaultUrl;
    }

    return `https://${codespaceName}-${port}.${domain}`;
  }

  return defaultUrl;
}

/**
 * Gets the frontend URL, automatically detecting environment
 */
export function getFrontendUrl(): string {
  const defaultUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return getPublicUrl(defaultUrl, 3000);
}

/**
 * Gets the backend API URL, automatically detecting environment
 */
export function getBackendUrl(): string {
  const defaultUrl = process.env.API_URL || 'http://localhost:4000';
  return getPublicUrl(defaultUrl, 4000);
}

/**
 * Gets the admin dashboard URL, automatically detecting environment
 */
export function getAdminUrl(): string {
  const frontendUrl = getFrontendUrl();
  return `${frontendUrl}/admin`;
}

/**
 * Validates that a secret/environment variable is properly configured
 * and not a placeholder value.
 *
 * @param value - The environment variable value to check
 * @returns true if valid, false if placeholder or empty
 */
export function isValidSecret(value: string | undefined): boolean {
  if (!value) return false;
  if (value === 'PLACEHOLDER') return false;
  if (value.trim() === '') return false;
  return true;
}

/**
 * Gets environment configuration for OAuth providers,
 * checking for valid (non-placeholder) values.
 *
 * @returns Object indicating which OAuth providers are properly configured
 */
export function getOAuthConfig() {
  return {
    google: {
      enabled:
        isValidSecret(process.env.GOOGLE_CLIENT_ID) &&
        isValidSecret(process.env.GOOGLE_CLIENT_SECRET),
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    apple: {
      enabled:
        isValidSecret(process.env.APPLE_CLIENT_ID) &&
        isValidSecret(process.env.APPLE_CLIENT_SECRET),
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    },
  };
}

/**
 * Logs environment information at startup (useful for debugging)
 */
export function logEnvironmentInfo(): void {
  console.log('🌍 Environment Information:');
  console.log(`  Mode: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`  Codespaces: ${isCodespaces() ? 'Yes' : 'No'}`);
  console.log(`  Frontend URL: ${getFrontendUrl()}`);
  console.log(`  Backend URL: ${getBackendUrl()}`);
  console.log(`  Admin URL: ${getAdminUrl()}`);

  const oauth = getOAuthConfig();
  console.log('  OAuth Providers:');
  console.log(`    Google: ${oauth.google.enabled ? 'Configured ✅' : 'Not configured'}`);
  console.log(`    Apple: ${oauth.apple.enabled ? 'Configured ✅' : 'Not configured'}`);
}
