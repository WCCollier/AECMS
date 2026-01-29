import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  IsNumber,
  Min,
  Max,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContentStatus, ContentVisibility, StockStatus, ProductType } from '@prisma/client';

export class QueryProductsDto {
  @ApiPropertyOptional({ description: 'Filter by status', enum: ContentStatus })
  @IsEnum(ContentStatus)
  @IsOptional()
  status?: ContentStatus;

  @ApiPropertyOptional({ description: 'Filter by visibility', enum: ContentVisibility })
  @IsEnum(ContentVisibility)
  @IsOptional()
  visibility?: ContentVisibility;

  @ApiPropertyOptional({ description: 'Filter by stock status', enum: StockStatus })
  @IsEnum(StockStatus)
  @IsOptional()
  stock_status?: StockStatus;

  @ApiPropertyOptional({ description: 'Filter by product type', enum: ProductType })
  @IsEnum(ProductType)
  @IsOptional()
  product_type?: ProductType;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsUUID()
  @IsOptional()
  category_id?: string;

  @ApiPropertyOptional({ description: 'Filter by tag ID' })
  @IsUUID()
  @IsOptional()
  tag_id?: string;

  @ApiPropertyOptional({ description: 'Minimum price' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  min_price?: number;

  @ApiPropertyOptional({ description: 'Maximum price' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  max_price?: number;

  @ApiPropertyOptional({ description: 'Filter guest purchaseable products only' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  guest_purchaseable?: boolean;

  @ApiPropertyOptional({ description: 'Search query (name, description, SKU)' })
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

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['created_at', 'updated_at', 'published_at', 'name', 'price'],
  })
  @IsString()
  @IsOptional()
  sort_by?: string = 'created_at';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'] })
  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sort_order?: 'asc' | 'desc' = 'desc';
}
