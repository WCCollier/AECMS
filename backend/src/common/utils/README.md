# Common Utilities

## Environment Utilities (`environment.util.ts`)

Provides environment detection and URL construction utilities for seamless operation across local development and GitHub Codespaces.

### Key Features

- **Auto-detection**: Automatically detects GitHub Codespaces environment
- **URL Construction**: Dynamically generates correct URLs based on environment
- **OAuth Validation**: Checks for valid (non-placeholder) OAuth credentials
- **Zero Configuration**: Works without modifying secrets between environments

### Usage Examples

```typescript
import {
  getPublicUrl,
  getFrontendUrl,
  getBackendUrl,
  getAdminUrl,
  isCodespaces,
  getOAuthConfig,
  logEnvironmentInfo,
} from '@/common/utils';

// Get environment-aware URLs
const frontendUrl = getFrontendUrl();
// Local: http://localhost:3000
// Codespaces: https://[codespace-name]-3000.app.github.dev

const backendUrl = getBackendUrl();
// Local: http://localhost:4000
// Codespaces: https://[codespace-name]-4000.app.github.dev

// Check environment
if (isCodespaces()) {
  console.log('Running in GitHub Codespaces');
}

// Validate OAuth configuration
const oauth = getOAuthConfig();
if (oauth.google.enabled) {
  // Google OAuth is properly configured
  console.log('Google OAuth available');
}

// Log environment info at startup
logEnvironmentInfo();
```

### How It Works

The utility checks for GitHub-provided environment variables:
- `CODESPACES=true` - Indicates Codespaces environment
- `CODESPACE_NAME` - Unique codespace identifier
- `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN` - Base domain for forwarding

When detected, it constructs URLs using the pattern:
```
https://[CODESPACE_NAME]-[PORT].[DOMAIN]
```

When not in Codespaces, it falls back to the configured default URLs (localhost).

### Benefits

1. **No Secret Updates**: Same secrets work in both environments
2. **Portable**: Code works locally and in Codespaces without changes
3. **OAuth Ready**: Automatically generates correct callback URLs for OAuth
4. **Future-Proof**: Easy to add support for other cloud environments

### For OAuth Integration (Phase 1)

When implementing OAuth in Phase 1:

```typescript
import { getFrontendUrl } from '@/common/utils';

// OAuth callback URL automatically adjusts
const callbackUrl = `${getFrontendUrl()}/auth/callback/google`;
// Local: http://localhost:3000/auth/callback/google
// Codespaces: https://[codespace]-3000.app.github.dev/auth/callback/google
```

No need to update secrets when switching between environments!
