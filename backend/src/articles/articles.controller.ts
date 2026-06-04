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
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ArticlesService } from './articles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackstageGuard } from '../auth/guards/backstage.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequiresCapability } from '../capabilities/decorators/requires-capability.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CreateArticleDto, UpdateArticleDto, QueryArticlesDto } from './dto';
import type { Request } from 'express';

@ApiTags('articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('article.create')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new article' })
  @ApiResponse({ status: 201, description: 'Article created successfully' })
  @ApiResponse({ status: 409, description: 'Article slug already exists' })
  @ApiResponse({ status: 400, description: 'Invalid category or tag IDs' })
  async create(@Body() dto: CreateArticleDto, @Req() req: Request) {
    const userId = (req.user as any).id;
    return this.articlesService.create(dto, userId);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get all articles with filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Articles retrieved successfully' })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'published', 'archived'] })
  @ApiQuery({ name: 'visibility', required: false, enum: ['public', 'logged_in_only', 'admin_only'] })
  @ApiQuery({ name: 'category_id', required: false, type: String })
  @ApiQuery({ name: 'tag_id', required: false, type: String })
  @ApiQuery({ name: 'author_id', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'sort_by', required: false, enum: ['created_at', 'updated_at', 'published_at', 'title'] })
  @ApiQuery({ name: 'sort_order', required: false, enum: ['asc', 'desc'] })
  async findAll(@Query() query: QueryArticlesDto, @Req() req: Request) {
    const user = req.user as any;
    const userId = user?.id;
    const isAdmin = user?.capabilities?.includes('system.configure') || false;
    return this.articlesService.findAll(query, userId, isAdmin);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get article by ID' })
  @ApiParam({ name: 'id', description: 'Article ID' })
  @ApiResponse({ status: 200, description: 'Article retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findById(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const userId = user?.id;
    const isAdmin = user?.capabilities?.includes('system.configure') || false;
    return this.articlesService.findById(id, userId, isAdmin);
  }

  @Get('by-slug/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get article by slug' })
  @ApiParam({ name: 'slug', description: 'Article slug' })
  @ApiResponse({ status: 200, description: 'Article retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async findBySlug(@Param('slug') slug: string, @Req() req: Request) {
    const user = req.user as any;
    const userId = user?.id;
    const isAdmin = user?.capabilities?.includes('system.configure') || false;
    return this.articlesService.findBySlug(slug, userId, isAdmin);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, BackstageGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an article' })
  @ApiParam({ name: 'id', description: 'Article ID' })
  @ApiResponse({ status: 200, description: 'Article updated successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  @ApiResponse({ status: 409, description: 'Article slug already exists' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    const userId = user.id;
    const isAdmin = user.capabilities?.includes('article.edit.any') || false;
    return this.articlesService.update(id, dto, userId, isAdmin);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, BackstageGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an article' })
  @ApiParam({ name: 'id', description: 'Article ID' })
  @ApiResponse({ status: 204, description: 'Article deleted successfully' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const userId = user.id;
    const isAdmin = user.capabilities?.includes('article.delete.any') || false;
    await this.articlesService.remove(id, userId, isAdmin);
  }

  @Get(':id/versions')
  @UseGuards(JwtAuthGuard, BackstageGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List article versions' })
  getVersions(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.articlesService.getVersions(id, page, limit);
  }

  @Get(':id/versions/:vnum')
  @UseGuards(JwtAuthGuard, BackstageGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a specific article version' })
  getVersion(@Param('id') id: string, @Param('vnum') vnum: string) {
    return this.articlesService.getVersion(id, parseInt(vnum, 10));
  }

  @Post(':id/versions/:vnum/restore')
  @UseGuards(JwtAuthGuard, BackstageGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Restore article to a previous version (creates new draft)' })
  restoreVersion(
    @Param('id') id: string,
    @Param('vnum') vnum: string,
    @Req() req: Request,
  ) {
    const userId = (req.user as any).id;
    return this.articlesService.restoreVersion(id, parseInt(vnum, 10), userId);
  }
}
