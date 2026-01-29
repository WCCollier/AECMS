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
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequiresCapability } from '../capabilities/decorators/requires-capability.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateMediaDto, QueryMediaDto } from './dto';

@ApiTags('media')
@Controller('media')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseGuards(CapabilityGuard)
  @RequiresCapability('media.upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload media file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        alt_text: {
          type: 'string',
          description: 'Alt text for accessibility',
        },
        caption: {
          type: 'string',
          description: 'Caption or description',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or file too large' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
    @Body('alt_text') altText?: string,
    @Body('caption') caption?: string,
  ) {
    return this.mediaService.upload(file, user.id, altText, caption);
  }

  @Get()
  @ApiOperation({ summary: 'List media files' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Media list retrieved successfully' })
  async findAll(@Query() query: QueryMediaDto) {
    return this.mediaService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get media file details' })
  @ApiParam({ name: 'id', description: 'Media ID' })
  @ApiResponse({ status: 200, description: 'Media details retrieved' })
  @ApiResponse({ status: 404, description: 'Media not found' })
  async findOne(@Param('id') id: string) {
    return this.mediaService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(CapabilityGuard)
  @RequiresCapability('media.upload')
  @ApiOperation({ summary: 'Update media metadata' })
  @ApiParam({ name: 'id', description: 'Media ID' })
  @ApiResponse({ status: 200, description: 'Media metadata updated' })
  @ApiResponse({ status: 404, description: 'Media not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async update(@Param('id') id: string, @Body() dto: UpdateMediaDto) {
    return this.mediaService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(CapabilityGuard)
  @RequiresCapability('media.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete media file' })
  @ApiParam({ name: 'id', description: 'Media ID' })
  @ApiResponse({ status: 204, description: 'Media deleted successfully' })
  @ApiResponse({ status: 404, description: 'Media not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async remove(@Param('id') id: string) {
    await this.mediaService.remove(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download media file' })
  @ApiParam({ name: 'id', description: 'Media ID' })
  @ApiResponse({ status: 200, description: 'Media file download' })
  @ApiResponse({ status: 404, description: 'Media not found' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const { buffer, media } = await this.mediaService.getFileBuffer(id);

    res.set({
      'Content-Type': media.mime_type,
      'Content-Length': buffer.length,
      'Content-Disposition': `attachment; filename="${media.original_name}"`,
    });

    res.send(buffer);
  }
}
