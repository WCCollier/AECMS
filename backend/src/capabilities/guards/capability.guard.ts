import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CAPABILITIES_KEY } from '../decorators/requires-capability.decorator';
import { CapabilitiesService } from '../capabilities.service';

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private capabilitiesService: CapabilitiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required capabilities from decorator
    const requiredCapabilities = this.reflector.getAllAndOverride<string[]>(
      CAPABILITIES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no capabilities required, allow access
    if (!requiredCapabilities || requiredCapabilities.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User must be authenticated
    if (!user || !user.id) {
      return false;
    }

    // Check if user has ANY of the required capabilities (OR logic)
    return this.capabilitiesService.userHasAnyCapability(
      user.id,
      requiredCapabilities,
    );
  }
}
