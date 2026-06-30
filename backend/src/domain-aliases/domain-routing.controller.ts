import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DomainAliasesService } from './domain-aliases.service';

/**
 * Unauthenticated controller for the Next.js middleware routing table.
 * Exposes only active+verified alias records (domain → target_route + alias_type).
 * No auth guards — this is a server-to-server call from the Next.js middleware.
 * The data (public URL mappings) is not sensitive.
 */
@ApiTags('domain-aliases')
@Controller('domain-aliases')
export class DomainRoutingController {
  constructor(private readonly service: DomainAliasesService) {}

  @Get('routing')
  @ApiOperation({ summary: 'Get active alias routing table (unauthenticated — for middleware use)' })
  @ApiResponse({ status: 200, description: 'Active alias routing table' })
  async getRoutingTable() {
    return this.service.findAllActive();
  }
}
