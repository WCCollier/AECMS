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
  UploadedFiles,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
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
import { BackstageGuard } from '../auth/guards/backstage.guard';
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
  @UseGuards(BackstageGuard, CapabilityGuard)
  @RequiresCapability('media.upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a single media file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        alt_text: { type: 'string' },
        caption: { type: 'string' },
      },
      required: ['file'],
    },
  })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
    @Body('alt_text') altText?: string,
    @Body('caption') caption?: string,
  ) {
    return this.mediaService.upload(file, user.id, altText, caption);
  }

  @Post('bulk-upload')
  @UseGuards(BackstageGuard, CapabilityGuard)
  @RequiresCapability('media.upload')
  @UseInterceptors(FilesInterceptor('files', 100))
  @ApiOperation({ summary: 'Upload multiple files; zip files are extracted automatically' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } },
      required: ['files'],
    },
  })
  async bulkUpload(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: any,
  ) {
    return this.mediaService.bulkUpload(files, user.id);
  }

  @Post(':id/replace')
  @UseGuards(BackstageGuard, CapabilityGuard)
  @RequiresCapability('media.manage')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Replace file bytes at the same storage key — URL stays stable' })
  @ApiParam({ name: 'id', description: 'Media ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  async replace(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    return this.mediaService.replace(id, file, user.id);
  }

  @Delete('bulk')
  @UseGuards(BackstageGuard, CapabilityGuard)
  @RequiresCapability('media.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete multiple media files' })
  @ApiBody({ schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] } })
  async bulkRemove(
    @Body('ids') ids: string[],
    @CurrentUser() user: any,
  ) {
    return this.mediaService.bulkRemove(ids, user.id);
  }

  @Get(':id/usage')
  @UseGuards(BackstageGuard)
  @ApiOperation({ summary: 'Get articles, products, and pages that reference this media file' })
  @ApiParam({ name: 'id', description: 'Media ID' })
  async getUsage(@Param('id') id: string) {
    return this.mediaService.getUsage(id);
  }

  @Get()
  @ApiOperation({ summary: 'List media files' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'mime_type', required: false, type: String, description: 'e.g. image, image/png, application/pdf' })
  @ApiQuery({ name: 'in_use', required: false, type: Boolean })
  @ApiQuery({ name: 'sort', required: false, enum: ['date', 'name', 'size'] })
  async findAll(@Query() query: QueryMediaDto) {
    return this.mediaService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get media file details' })
  @ApiParam({ name: 'id', description: 'Media ID' })
  async findOne(@Param('id') id: string) {
    return this.mediaService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(BackstageGuard, CapabilityGuard)
  @RequiresCapability('media.upload')
  @ApiOperation({ summary: 'Update media metadata (alt text, caption)' })
  @ApiParam({ name: 'id', description: 'Media ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateMediaDto) {
    return this.mediaService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(BackstageGuard, CapabilityGuard)
  @RequiresCapability('media.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a media file' })
  @ApiParam({ name: 'id', description: 'Media ID' })
  async remove(@Param('id') id: string) {
    await this.mediaService.remove(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download media file' })
  @ApiParam({ name: 'id', description: 'Media ID' })
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
