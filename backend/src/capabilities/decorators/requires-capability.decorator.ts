import { SetMetadata } from '@nestjs/common';

export const CAPABILITIES_KEY = 'capabilities';

/**
 * Decorator to specify required capabilities for an endpoint.
 * Multiple capabilities are treated with OR logic (user needs ANY of them).
 *
 * Usage:
 * @RequiresCapability('article.create')
 * @RequiresCapability('article.edit.any', 'article.edit.own')
 */
export const RequiresCapability = (...capabilities: string[]) =>
  SetMetadata(CAPABILITIES_KEY, capabilities);
