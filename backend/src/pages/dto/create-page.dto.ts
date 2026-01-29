import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus, ContentVisibility } from '@prisma/client';

export class CreatePageDto {
  @ApiProperty({ description: 'Page title', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Page slug (auto-generated if not provided)' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiProperty({ description: 'Page content (HTML or Markdown)' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Parent page ID for hierarchical structure' })
  @IsUUID()
  @IsOptional()
  parent_id?: string;

  @ApiPropertyOptional({
    description: 'Page template',
    default: 'full-width',
    enum: ['full-width', 'sidebar-left', 'sidebar-right', 'split-comparison'],
  })
  @IsString()
  @IsOptional()
  template?: string;

  @ApiPropertyOptional({
    description: 'Page status',
    enum: ContentStatus,
    default: ContentStatus.draft,
  })
  @IsEnum(ContentStatus)
  @IsOptional()
  status?: ContentStatus;

  @ApiPropertyOptional({
    description: 'Page visibility',
    enum: ContentVisibility,
    default: ContentVisibility.public,
  })
  @IsEnum(ContentVisibility)
  @IsOptional()
  visibility?: ContentVisibility;

  @ApiPropertyOptional({ description: 'SEO meta title', maxLength: 60 })
  @IsString()
  @IsOptional()
  @MaxLength(60)
  meta_title?: string;

  @ApiPropertyOptional({ description: 'SEO meta description', maxLength: 160 })
  @IsString()
  @IsOptional()
  @MaxLength(160)
  meta_description?: string;

  @ApiPropertyOptional({ description: 'Author can edit this page', default: true })
  @IsBoolean()
  @IsOptional()
  author_can_edit?: boolean;

  @ApiPropertyOptional({ description: 'Author can delete this page', default: true })
  @IsBoolean()
  @IsOptional()
  author_can_delete?: boolean;

  @ApiPropertyOptional({ description: 'Admin can edit this page', default: true })
  @IsBoolean()
  @IsOptional()
  admin_can_edit?: boolean;

  @ApiPropertyOptional({ description: 'Admin can delete this page', default: true })
  @IsBoolean()
  @IsOptional()
  admin_can_delete?: boolean;
}
