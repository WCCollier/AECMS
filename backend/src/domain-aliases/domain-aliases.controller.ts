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
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CreateDomainAliasDto, UpdateDomainAliasDto } from './dto';

@ApiTags('domain-aliases')
@Controller('domain-aliases')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DomainAliasesController {
  constructor(private readonly domainAliasesService: DomainAliasesService) {}

  @Post()
  @Roles(UserRole.owner)
  @ApiOperation({ summary: 'Create a new domain alias (Owner only)' })
  @ApiResponse({ status: 201, description: 'Domain alias created successfully' })
  @ApiResponse({ status: 409, description: 'Domain alias already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden - Owner role required' })
  async create(@Body() dto: CreateDomainAliasDto, @Req() req: Request & { user: any }) {
    const alias = await this.domainAliasesService.create(dto, req.user.id);
    const instructions = this.domainAliasesService.getVerificationInstructions(alias);
    return {
      alias,
      ...instructions,
    };
  }

  @Get()
  @Roles(UserRole.owner)
  @ApiOperation({ summary: 'Get all domain aliases (Owner only)' })
  @ApiResponse({ status: 200, description: 'Domain aliases retrieved successfully' })
  async findAll() {
    return this.domainAliasesService.findAll();
  }

  @Get('active')
  @Roles(UserRole.owner, UserRole.admin)
  @ApiOperation({ summary: 'Get all active domain aliases (for routing)' })
  @ApiResponse({ status: 200, description: 'Active aliases retrieved successfully' })
  async findAllActive() {
    return this.domainAliasesService.findAllActive();
  }

  @Get('my')
  @Roles(UserRole.owner)
  @ApiOperation({ summary: 'Get my domain aliases' })
  @ApiResponse({ status: 200, description: 'Domain aliases retrieved successfully' })
  async findMine(@Req() req: Request & { user: any }) {
    return this.domainAliasesService.findByOwner(req.user.id);
  }

  @Get(':id')
  @Roles(UserRole.owner)
  @ApiOperation({ summary: 'Get domain alias by ID' })
  @ApiParam({ name: 'id', description: 'Domain alias ID' })
  @ApiResponse({ status: 200, description: 'Domain alias retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Domain alias not found' })
  async findById(@Param('id') id: string) {
    const alias = await this.domainAliasesService.findById(id);
    const instructions = this.domainAliasesService.getVerificationInstructions(alias);
    return {
      alias,
      ...instructions,
    };
  }

  @Get(':id/instructions')
  @Roles(UserRole.owner)
  @ApiOperation({ summary: 'Get DNS verification instructions' })
  @ApiParam({ name: 'id', description: 'Domain alias ID' })
  @ApiResponse({ status: 200, description: 'Instructions retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Domain alias not found' })
  async getInstructions(@Param('id') id: string) {
    const alias = await this.domainAliasesService.findById(id);
    return this.domainAliasesService.getVerificationInstructions(alias);
  }

  @Post(':id/verify')
  @Roles(UserRole.owner)
  @ApiOperation({ summary: 'Verify domain ownership via DNS TXT record' })
  @ApiParam({ name: 'id', description: 'Domain alias ID' })
  @ApiResponse({ status: 200, description: 'Domain verified successfully' })
  @ApiResponse({ status: 400, description: 'Verification failed - check DNS configuration' })
  @ApiResponse({ status: 404, description: 'Domain alias not found' })
  async verify(@Param('id') id: string, @Req() req: Request & { user: any }) {
    return this.domainAliasesService.verify(id, req.user.id, req.user.role);
  }

  @Post(':id/regenerate-token')
  @Roles(UserRole.owner)
  @ApiOperation({ summary: 'Regenerate verification token' })
  @ApiParam({ name: 'id', description: 'Domain alias ID' })
  @ApiResponse({ status: 200, description: 'Token regenerated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot regenerate for verified domain' })
  @ApiResponse({ status: 404, description: 'Domain alias not found' })
  async regenerateToken(@Param('id') id: string, @Req() req: Request & { user: any }) {
    const alias = await this.domainAliasesService.regenerateToken(id, req.user.id, req.user.role);
    return this.domainAliasesService.getVerificationInstructions(alias);
  }

  @Patch(':id')
  @Roles(UserRole.owner)
  @ApiOperation({ summary: 'Update a domain alias' })
  @ApiParam({ name: 'id', description: 'Domain alias ID' })
  @ApiResponse({ status: 200, description: 'Domain alias updated successfully' })
  @ApiResponse({ status: 404, description: 'Domain alias not found' })
  @ApiResponse({ status: 400, description: 'Cannot activate unverified domain' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDomainAliasDto,
    @Req() req: Request & { user: any },
  ) {
    return this.domainAliasesService.update(id, dto, req.user.id, req.user.role);
  }

  @Delete(':id')
  @Roles(UserRole.owner)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a domain alias' })
  @ApiParam({ name: 'id', description: 'Domain alias ID' })
  @ApiResponse({ status: 204, description: 'Domain alias deleted successfully' })
  @ApiResponse({ status: 404, description: 'Domain alias not found' })
  async remove(@Param('id') id: string, @Req() req: Request & { user: any }) {
    await this.domainAliasesService.remove(id, req.user.id, req.user.role);
  }
}
