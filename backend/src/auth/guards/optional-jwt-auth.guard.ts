import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT Auth Guard
 * Attaches user to request if JWT is valid, but allows unauthenticated access
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // Try to authenticate, but don't fail if not authenticated
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    // No error thrown if user is not authenticated
    // Just return the user (or undefined) to the request
    return user;
  }
}
