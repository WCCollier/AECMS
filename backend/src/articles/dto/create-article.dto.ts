import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
  IsArray,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus, ContentVisibility } from '@prisma/client';

export class CreateArticleDto {
  @ApiProperty({ description: 'Article title', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Article slug (auto-generated if not provided)' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiProperty({ description: 'Article content (HTML or Markdown)' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Article excerpt' })
  @IsString()
  @IsOptional()
  excerpt?: string;

  @ApiPropertyOptional({ description: 'Featured image ID', type: String })
  @IsUUID()
  @IsOptional()
  featured_image_id?: string;

  @ApiPropertyOptional({
    description: 'Article status',
    enum: ContentStatus,
    default: ContentStatus.draft,
  })
  @IsEnum(ContentStatus)
  @IsOptional()
  status?: ContentStatus;

  @ApiPropertyOptional({
    description: 'Article visibility',
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

  @ApiPropertyOptional({ description: 'Category IDs', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  category_ids?: string[];

  @ApiPropertyOptional({ description: 'Tag IDs', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  tag_ids?: string[];

  @ApiPropertyOptional({ description: 'Enable version control for this article', default: false })
  @IsBoolean()
  @IsOptional()
  version_control_enabled?: boolean;

  @ApiPropertyOptional({ description: 'Author can edit this article', default: true })
  @IsBoolean()
  @IsOptional()
  author_can_edit?: boolean;

  @ApiPropertyOptional({ description: 'Author can delete this article', default: true })
  @IsBoolean()
  @IsOptional()
  author_can_delete?: boolean;

  @ApiPropertyOptional({ description: 'Admin can edit this article', default: true })
  @IsBoolean()
  @IsOptional()
  admin_can_edit?: boolean;

  @ApiPropertyOptional({ description: 'Admin can delete this article', default: true })
  @IsBoolean()
  @IsOptional()
  admin_can_delete?: boolean;
}
