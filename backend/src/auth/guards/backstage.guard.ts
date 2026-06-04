import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Requires a backstage session (session_type === 'backstage' in the JWT).
 * Must run after JwtAuthGuard so req.user is already populated.
 * Owner users with a customer-session token are still blocked — they must
 * go through /auth/admin/login + 2FA to obtain a backstage token.
 */
@Injectable()
export class BackstageGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (user?.session_type === 'backstage') {
      return true;
    }
    throw new ForbiddenException('Backstage session required. Please log in via /admin/login.');
  }
}
