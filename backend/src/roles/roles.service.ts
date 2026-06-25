import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

// Only structurally invariant roles — owner (immutable singleton) and guest (virtual/constrained).
// 'admin' and 'member' are canonical seeds but are freely deletable; the default registration
// role is now a setting (general.default_role) rather than a hardcoded constant.
const RESERVED_NAMES = ['owner', 'guest'];

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const roles = await this.prisma.role.findMany({
      orderBy: { created_at: 'asc' },
    });

    const userCounts = await this.prisma.user.groupBy({
      by: ['role_name'],
      _count: { id: true },
    });

    const countMap = new Map(userCounts.map((r) => [r.role_name, r._count.id]));

    const capCounts = await this.prisma.roleCapability.groupBy({
      by: ['role_name'],
      _count: { id: true },
    });
    const capMap = new Map(capCounts.map((r) => [r.role_name, r._count.id]));

    return roles.map((role) => ({
      ...role,
      user_count: role.name === 'guest' ? 0 : (countMap.get(role.name) ?? 0),
      capability_count: capMap.get(role.name) ?? 0,
      is_virtual: role.name === 'guest',
    }));
  }

  async findOne(name: string) {
    const role = await this.prisma.role.findUnique({ where: { name } });
    if (!role) throw new NotFoundException(`Role '${name}' not found`);
    return role;
  }

  async create(dto: CreateRoleDto) {
    if (RESERVED_NAMES.includes(dto.name)) {
      throw new ConflictException(`'${dto.name}' is a reserved role name`);
    }
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Role '${dto.name}' already exists`);

    return this.prisma.role.create({
      data: { name: dto.name, label: dto.label, protection: 'none' },
    });
  }

  async update(name: string, dto: UpdateRoleDto) {
    const role = await this.findOne(name);
    if (role.protection === 'full') {
      throw new ForbiddenException(`Role '${name}' cannot be modified`);
    }
    return this.prisma.role.update({ where: { name }, data: dto });
  }

  async remove(name: string) {
    const role = await this.findOne(name);

    if (role.protection !== 'none') {
      throw new ForbiddenException(`Role '${name}' cannot be deleted`);
    }

    // Dynamic delete guard: block deletion of whichever role is currently the default
    const defaultRoleSetting = await this.prisma.siteSettings.findUnique({
      where: { key: 'general.default_role' },
    });
    const defaultRole = defaultRoleSetting?.value ?? 'member';
    if (name === defaultRole) {
      throw new ConflictException(
        `'${name}' is the default registration role. Change the default in Settings → General before deleting it.`,
      );
    }

    const userCount = await this.prisma.user.count({ where: { role_name: name } });
    if (userCount > 0) {
      throw new ConflictException(
        `Cannot delete role '${name}': ${userCount} user(s) are assigned to it. Reassign them first.`,
      );
    }

    await this.prisma.roleCapability.deleteMany({ where: { role_name: name } });
    await this.prisma.role.delete({ where: { name } });
  }

  async getCapabilities(name: string) {
    await this.findOne(name);
    return this.prisma.roleCapability.findMany({
      where: { role_name: name },
      include: { capability: true },
      orderBy: { capability: { name: 'asc' } },
    });
  }

  async setCapabilities(name: string, capabilityIds: string[]) {
    const role = await this.findOne(name);
    if (role.protection === 'full') {
      throw new ForbiddenException(`Cannot edit capabilities of role '${name}'`);
    }

    // For constrained roles (Guest), only customer-scope caps allowed
    if (role.protection === 'constrained' && capabilityIds.length > 0) {
      const caps = await this.prisma.capability.findMany({
        where: { id: { in: capabilityIds } },
      });
      const backstageCap = caps.find((c) => c.scope === 'backstage');
      if (backstageCap) {
        throw new BadRequestException(
          `Role '${name}' only allows customer-scoped capabilities. '${backstageCap.name}' is backstage-scoped.`,
        );
      }
    }

    // Verify all capability IDs exist
    if (capabilityIds.length > 0) {
      const caps = await this.prisma.capability.findMany({
        where: { id: { in: capabilityIds } },
      });
      if (caps.length !== capabilityIds.length) {
        throw new BadRequestException('One or more capability IDs not found');
      }
    }

    // Replace: delete existing, create new
    await this.prisma.roleCapability.deleteMany({ where: { role_name: name } });

    if (capabilityIds.length > 0) {
      // For canonical roles that still have the enum column, write role too
      const canonicalRoles = ['admin', 'member', 'guest'] as const;
      const isCanonical = (canonicalRoles as readonly string[]).includes(name);

      await this.prisma.roleCapability.createMany({
        data: capabilityIds.map((cid) => ({
          role_name: name,
          ...(isCanonical ? { role: name as any } : {}),
          capability_id: cid,
        })),
      });
    }

    return { message: `Capabilities updated for role '${name}'` };
  }

  async getMembers(name: string) {
    await this.findOne(name);
    if (name === 'guest') {
      return {
        users: [],
        total: 0,
        note: 'Guest is a virtual role — no users are assigned to it.',
      };
    }

    const users = await this.prisma.user.findMany({
      where: { role_name: name, deleted_at: null },
      select: {
        id: true,
        email: true,
        username: true,
        first_name: true,
        last_name: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return { users, total: users.length };
  }
}
