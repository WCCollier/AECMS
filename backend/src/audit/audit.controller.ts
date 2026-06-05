import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { CapabilitiesService } from '../capabilities/capabilities.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackstageGuard } from '../auth/guards/backstage.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Prisma } from '@prisma/client';

@ApiTags('audit-logs')
@Controller('audit-logs')
export class AuditController {
  constructor(
    private prisma: PrismaService,
    private capabilitiesService: CapabilitiesService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, BackstageGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Query audit log (system.view_audit sees all; others see own entries)' })
  async findAll(
    @CurrentUser() user: any,
    @Query('page') page = 1,
    @Query('limit') limit = 30,
    @Query('event_type') eventType?: string,
    @Query('resource_type') resourceType?: string,
    @Query('resource_id') resourceId?: string,
  ) {
    const skip = (Number(page) - 1) * Number(limit);
    const where: Prisma.AuditLogWhereInput = {};

    const canViewAll = await this.capabilitiesService.userHasCapability(user.id, 'system.view_audit');
    if (!canViewAll) {
      where.user_id = user.id;
    }

    if (eventType) where.event_type = eventType;
    if (resourceType) where.resource_type = resourceType;
    if (resourceId) where.resource_id = resourceId;

    const [entries, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: Number(limit),
        select: {
          id: true,
          event_type: true,
          user_id: true,
          ip_address: true,
          resource_type: true,
          resource_id: true,
          changes: true,
          metadata: true,
          created_at: true,
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: entries,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        total_pages: Math.ceil(total / Number(limit)),
      },
    };
  }
}
