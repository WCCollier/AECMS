import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus, ContentVisibility } from '@prisma/client';

export class QueryArticlesDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: ContentStatus })
  @IsEnum(ContentStatus)
  @IsOptional()
  status?: ContentStatus;

  @ApiPropertyOptional({ description: 'Filter by visibility', enum: ContentVisibility })
  @IsEnum(ContentVisibility)
  @IsOptional()
  visibility?: ContentVisibility;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsUUID()
  @IsOptional()
  category_id?: string;

  @ApiPropertyOptional({ description: 'Filter by tag ID' })
  @IsUUID()
  @IsOptional()
  tag_id?: string;

  @ApiPropertyOptional({ description: 'Filter by author ID' })
  @IsUUID()
  @IsOptional()
  author_id?: string;

  @ApiPropertyOptional({ description: 'Search query (title, excerpt, content)' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Sort field', enum: ['created_at', 'updated_at', 'published_at', 'title'] })
  @IsString()
  @IsOptional()
  sort_by?: string = 'created_at';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'] })
  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sort_order?: 'asc' | 'desc' = 'desc';
}
