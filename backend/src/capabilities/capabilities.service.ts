import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, Capability, RoleCapability, UserCapability } from '@prisma/client';

@Injectable()
export class CapabilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all capabilities
   */
  async getAllCapabilities(): Promise<Capability[]> {
    return this.prisma.capability.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get capabilities for a specific role
   */
  async getRoleCapabilities(role: UserRole): Promise<Capability[]> {
    // Owner always has all capabilities
    if (role === UserRole.owner) {
      return this.getAllCapabilities();
    }

    const roleCapabilities = await this.prisma.roleCapability.findMany({
      where: { role },
      include: { capability: true },
    });

    return roleCapabilities.map((rc) => rc.capability);
  }

  /**
   * Get capabilities for a specific user
   * Includes both role-based and user-specific capabilities
   */
  async getUserCapabilities(userId: string): Promise<Capability[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Owner always has all capabilities
    if (user.role === UserRole.owner) {
      return this.getAllCapabilities();
    }

    // Get role capabilities
    const roleCapabilities = await this.getRoleCapabilities(user.role);

    // Get user-specific capabilities
    const userCapabilities = await this.prisma.userCapability.findMany({
      where: { user_id: userId },
      include: { capability: true },
    });

    // Merge and deduplicate
    const capabilityMap = new Map<string, Capability>();

    roleCapabilities.forEach((cap) => {
      capabilityMap.set(cap.id, cap);
    });

    userCapabilities.forEach((uc) => {
      capabilityMap.set(uc.capability.id, uc.capability);
    });

    return Array.from(capabilityMap.values());
  }

  /**
   * Check if a user has a specific capability
   */
  async userHasCapability(userId: string, capabilityName: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return false;
    }

    // Owner always has all capabilities
    if (user.role === UserRole.owner) {
      return true;
    }

    // Check if capability exists
    const capability = await this.prisma.capability.findUnique({
      where: { name: capabilityName },
    });

    if (!capability) {
      return false;
    }

    // Check role capability
    const roleCapability = await this.prisma.roleCapability.findFirst({
      where: {
        role: user.role,
        capability_id: capability.id,
      },
    });

    if (roleCapability) {
      return true;
    }

    // Check user-specific capability
    const userCapability = await this.prisma.userCapability.findFirst({
      where: {
        user_id: userId,
        capability_id: capability.id,
      },
    });

    return !!userCapability;
  }

  /**
   * Check if user has ANY of the specified capabilities (OR logic)
   */
  async userHasAnyCapability(userId: string, capabilityNames: string[]): Promise<boolean> {
    for (const capName of capabilityNames) {
      if (await this.userHasCapability(userId, capName)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Assign a capability to a role
   */
  async assignCapabilityToRole(role: UserRole, capabilityId: string): Promise<RoleCapability> {
    // Owner cannot have capabilities assigned (they always have all)
    if (role === UserRole.owner) {
      throw new BadRequestException('Owner role always has all capabilities');
    }

    // Verify capability exists
    const capability = await this.prisma.capability.findUnique({
      where: { id: capabilityId },
    });

    if (!capability) {
      throw new NotFoundException('Capability not found');
    }

    // Check if already assigned
    const existing = await this.prisma.roleCapability.findFirst({
      where: {
        role,
        capability_id: capabilityId,
      },
    });

    if (existing) {
      throw new ConflictException('Capability already assigned to this role');
    }

    return this.prisma.roleCapability.create({
      data: {
        role,
        capability_id: capabilityId,
      },
      include: { capability: true },
    });
  }

  /**
   * Remove a capability from a role
   */
  async removeCapabilityFromRole(role: UserRole, capabilityId: string): Promise<void> {
    // Owner cannot have capabilities removed
    if (role === UserRole.owner) {
      throw new BadRequestException('Cannot remove capabilities from Owner role');
    }

    const roleCapability = await this.prisma.roleCapability.findFirst({
      where: {
        role,
        capability_id: capabilityId,
      },
    });

    if (!roleCapability) {
      throw new NotFoundException('Role capability not found');
    }

    await this.prisma.roleCapability.delete({
      where: { id: roleCapability.id },
    });
  }

  /**
   * Assign a capability to a specific user
   */
  async assignCapabilityToUser(
    userId: string,
    capabilityId: string,
    grantedBy: string,
  ): Promise<UserCapability> {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Owner doesn't need user-specific capabilities
    if (user.role === UserRole.owner) {
      throw new BadRequestException('Owner role always has all capabilities');
    }

    // Verify capability exists
    const capability = await this.prisma.capability.findUnique({
      where: { id: capabilityId },
    });

    if (!capability) {
      throw new NotFoundException('Capability not found');
    }

    // Check if already assigned
    const existing = await this.prisma.userCapability.findFirst({
      where: {
        user_id: userId,
        capability_id: capabilityId,
      },
    });

    if (existing) {
      throw new ConflictException('Capability already assigned to this user');
    }

    return this.prisma.userCapability.create({
      data: {
        user_id: userId,
        capability_id: capabilityId,
        granted_by: grantedBy,
      },
      include: { capability: true },
    });
  }

  /**
   * Remove a capability from a specific user
   */
  async removeCapabilityFromUser(userId: string, capabilityId: string): Promise<void> {
    const userCapability = await this.prisma.userCapability.findFirst({
      where: {
        user_id: userId,
        capability_id: capabilityId,
      },
    });

    if (!userCapability) {
      throw new NotFoundException('User capability not found');
    }

    await this.prisma.userCapability.delete({
      where: { id: userCapability.id },
    });
  }
}
