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
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CapabilitiesService } from '../capabilities/capabilities.service';
import { CreateCommentDto, UpdateCommentDto, QueryCommentsDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequiresCapability } from '../capabilities/decorators/requires-capability.decorator';

@ApiTags('comments')
@Controller('comments')
export class CommentsController {
  constructor(
    private readonly commentsService: CommentsService,
    private readonly capabilitiesService: CapabilitiesService,
  ) {}

  /**
   * Create a new comment (requires authentication)
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a comment on an article' })
  @ApiResponse({ status: 201, description: 'Comment created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - login required' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async create(@Body() dto: CreateCommentDto, @Request() req: any) {
    return this.commentsService.create(dto, req.user);
  }

  /**
   * Get comments for an article (public)
   */
  @Get('article/:articleId')
  @ApiOperation({ summary: 'Get comments for an article' })
  @ApiResponse({ status: 200, description: 'Returns paginated comments' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async findByArticle(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.commentsService.findByArticle(
      articleId,
      page || 1,
      limit || 20,
    );
  }

  @Get('product/:productId')
  @ApiOperation({ summary: 'Get comments for a product' })
  async findByProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.commentsService.findByProduct(productId, page || 1, limit || 20);
  }

  /**
   * Get the authenticated user's own comments and reviews
   */
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all comments and reviews by the current user' })
  @ApiResponse({ status: 200, description: 'Returns paginated comments' })
  async findMine(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.commentsService.findByUser(req.user.id, page || 1, limit || 20);
  }

  /**
   * Get a single comment by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a comment by ID' })
  @ApiResponse({ status: 200, description: 'Returns the comment' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.commentsService.findById(id);
  }

  /**
   * Update own comment (comment.edit.own required)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('comment.edit.own')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update your own comment' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Cannot edit others comments' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto,
    @Request() req: any,
  ) {
    return this.commentsService.update(id, dto, req.user.id);
  }

  /**
   * Delete own comment (comment.delete.own required; comment.delete gives admin delete-any)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('comment.delete.own', 'comment.delete')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete your own comment' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Cannot delete others comments' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const canDeleteAny = await this.capabilitiesService.userHasCapability(req.user.id, 'comment.delete');
    return this.commentsService.remove(id, req.user.id, canDeleteAny);
  }

  // ==================== ADMIN ENDPOINTS ====================

  /**
   * Admin: List all comments with filters
   */
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('comment.view.all')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: List all comments with filters' })
  @ApiResponse({ status: 200, description: 'Returns paginated comments' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Missing required capability' })
  async findAll(@Query() query: QueryCommentsDto) {
    return this.commentsService.findAll(query);
  }

  /**
   * Admin: Get flagged comments for moderation
   */
  @Get('admin/flagged')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('comment.moderate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get comments pending moderation' })
  @ApiResponse({ status: 200, description: 'Returns flagged comments' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Missing required capability' })
  async findFlagged(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.commentsService.findFlagged(page || 1, limit || 20);
  }

  /**
   * Admin: Approve a comment
   */
  @Post('admin/:id/approve')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('comment.moderate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Approve a comment' })
  @ApiResponse({ status: 200, description: 'Comment approved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Missing required capability' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async approve(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.commentsService.approve(id, req.user?.id);
  }

  /**
   * Admin: Reject a comment
   */
  @Post('admin/:id/reject')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('comment.moderate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Reject a comment' })
  @ApiResponse({ status: 200, description: 'Comment rejected' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Missing required capability' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async reject(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.commentsService.reject(id, req.user?.id);
  }

  /**
   * Admin: Mark comment as spam
   */
  @Post('admin/:id/spam')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('comment.moderate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Mark comment as spam' })
  @ApiResponse({ status: 200, description: 'Comment marked as spam' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Missing required capability' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async markAsSpam(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.commentsService.markAsSpam(id, req.user?.id);
  }

  /**
   * Admin: Delete any comment
   */
  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('comment.delete')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Delete any comment' })
  @ApiResponse({ status: 200, description: 'Comment deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Missing required capability' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async adminRemove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.commentsService.remove(id, req.user.id, true);
  }
}
