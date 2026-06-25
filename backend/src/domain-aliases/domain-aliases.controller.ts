import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { DomainAliasesService } from './domain-aliases.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackstageGuard } from '../auth/guards/backstage.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequiresCapability } from '../capabilities/decorators/requires-capability.decorator';
import { CreateDomainAliasDto, UpdateDomainAliasDto } from './dto';

@ApiTags('domain-aliases')
@Controller('domain-aliases')
@UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
@RequiresCapability('domain.manage')
@ApiBearerAuth()
export class DomainAliasesController {
  constructor(private readonly domainAliasesService: DomainAliasesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new domain alias (Owner only)' })
  @ApiResponse({ status: 201, description: 'Domain alias created successfully' })
  @ApiResponse({ status: 409, description: 'Domain alias already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden - backstage session + domain.manage required' })
  async create(@Body() dto: CreateDomainAliasDto, @Req() req: Request & { user: any }) {
    const alias = await this.domainAliasesService.create(dto, req.user.id);
    const instructions = this.domainAliasesService.getVerificationInstructions(alias);
    return { alias, ...instructions };
  }

  @Get()
  @ApiOperation({ summary: 'Get all domain aliases' })
  @ApiResponse({ status: 200, description: 'Domain aliases retrieved successfully' })
  async findAll() {
    return this.domainAliasesService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Get all active domain aliases (for routing)' })
  @ApiResponse({ status: 200, description: 'Active aliases retrieved successfully' })
  async findAllActive() {
    return this.domainAliasesService.findAllActive();
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my domain aliases' })
  @ApiResponse({ status: 200, description: 'Domain aliases retrieved successfully' })
  async findMine(@Req() req: Request & { user: any }) {
    return this.domainAliasesService.findByOwner(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get domain alias by ID' })
  @ApiParam({ name: 'id', description: 'Domain alias ID' })
  @ApiResponse({ status: 200, description: 'Domain alias retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Domain alias not found' })
  async findById(@Param('id') id: string) {
    const alias = await this.domainAliasesService.findById(id);
    const instructions = this.domainAliasesService.getVerificationInstructions(alias);
    return { alias, ...instructions };
  }

  @Get(':id/instructions')
  @ApiOperation({ summary: 'Get DNS verification instructions' })
  @ApiParam({ name: 'id', description: 'Domain alias ID' })
  @ApiResponse({ status: 200, description: 'Instructions retrieved successfully' })
  async getInstructions(@Param('id') id: string) {
    const alias = await this.domainAliasesService.findById(id);
    return this.domainAliasesService.getVerificationInstructions(alias);
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Verify domain ownership via DNS TXT record' })
  @ApiParam({ name: 'id', description: 'Domain alias ID' })
  @ApiResponse({ status: 200, description: 'Domain verified successfully' })
  @ApiResponse({ status: 400, description: 'Verification failed - check DNS configuration' })
  async verify(@Param('id') id: string, @Req() req: Request & { user: any }) {
    return this.domainAliasesService.verify(id, req.user.id);
  }

  @Post(':id/regenerate-token')
  @ApiOperation({ summary: 'Regenerate verification token' })
  @ApiParam({ name: 'id', description: 'Domain alias ID' })
  @ApiResponse({ status: 200, description: 'Token regenerated successfully' })
  async regenerateToken(@Param('id') id: string, @Req() req: Request & { user: any }) {
    const alias = await this.domainAliasesService.regenerateToken(id, req.user.id);
    return this.domainAliasesService.getVerificationInstructions(alias);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a domain alias' })
  @ApiParam({ name: 'id', description: 'Domain alias ID' })
  @ApiResponse({ status: 200, description: 'Domain alias updated successfully' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDomainAliasDto,
    @Req() req: Request & { user: any },
  ) {
    return this.domainAliasesService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a domain alias' })
  @ApiParam({ name: 'id', description: 'Domain alias ID' })
  @ApiResponse({ status: 204, description: 'Domain alias deleted successfully' })
  async remove(@Param('id') id: string, @Req() req: Request & { user: any }) {
    await this.domainAliasesService.remove(id, req.user.id);
  }
}
