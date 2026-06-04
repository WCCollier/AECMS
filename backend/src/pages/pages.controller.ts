import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PagesService } from './pages.service';
import { CreatePageDto, UpdatePageDto, QueryPagesDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackstageGuard } from '../auth/guards/backstage.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequiresCapability } from '../capabilities/decorators/requires-capability.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('pages')
@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('page.create')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new page' })
  create(@Body() dto: CreatePageDto, @CurrentUser() user: any) {
    return this.pagesService.create(dto, user.id);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get all pages with filtering and pagination' })
  findAll(@Query() query: QueryPagesDto, @CurrentUser() user: any) {
    const isAdmin = user?.role === 'owner' || user?.role === 'admin';
    return this.pagesService.findAll(query, user?.id, isAdmin);
  }

  @Get('hierarchy')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get page hierarchy tree' })
  getHierarchy(@CurrentUser() user: any) {
    const isAdmin = user?.role === 'owner' || user?.role === 'admin';
    return this.pagesService.getHierarchy(user?.id, isAdmin);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get page by ID' })
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    const isAdmin = user?.role === 'owner' || user?.role === 'admin';
    return this.pagesService.findById(id, user?.id, isAdmin);
  }

  @Get('slug/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get page by slug' })
  findBySlug(@Param('slug') slug: string, @CurrentUser() user: any) {
    const isAdmin = user?.role === 'owner' || user?.role === 'admin';
    return this.pagesService.findBySlug(slug, user?.id, isAdmin);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('page.edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a page' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
    @CurrentUser() user: any,
  ) {
    const isAdmin = user.role === 'owner' || user.role === 'admin';
    return this.pagesService.update(id, dto, user.id, isAdmin);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('page.delete')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a page' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    const isAdmin = user.role === 'owner' || user.role === 'admin';
    return this.pagesService.remove(id, user.id, isAdmin);
  }

  @Get(':id/versions')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('page.edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List page versions' })
  getVersions(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.pagesService.getVersions(id, page, limit);
  }

  @Get(':id/versions/:vnum')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('page.edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific page version' })
  getPageVersion(@Param('id') id: string, @Param('vnum') vnum: string) {
    return this.pagesService.getPageVersion(id, parseInt(vnum, 10));
  }

  @Post(':id/versions/:vnum/restore')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('page.edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore page to a previous version (creates new draft)' })
  restorePageVersion(
    @Param('id') id: string,
    @Param('vnum') vnum: string,
    @CurrentUser() user: any,
  ) {
    return this.pagesService.restorePageVersion(id, parseInt(vnum, 10), user.id);
  }
}
