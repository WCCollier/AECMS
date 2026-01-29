import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsInt,
  IsUUID,
  IsArray,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ContentStatus, ContentVisibility, StockStatus, ProductType } from '@prisma/client';

export class CreateProductDto {
  @ApiProperty({ description: 'Product name', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Product slug (auto-generated if not provided)' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiProperty({ description: 'Product description (HTML or Markdown)' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Short description for listings' })
  @IsString()
  @IsOptional()
  short_description?: string;

  @ApiProperty({ description: 'Product price in USD', minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiPropertyOptional({ description: 'Stock Keeping Unit (unique identifier)' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({ description: 'Stock quantity', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  stock_quantity?: number;

  @ApiPropertyOptional({
    description: 'Stock status',
    enum: StockStatus,
    default: StockStatus.in_stock,
  })
  @IsEnum(StockStatus)
  @IsOptional()
  stock_status?: StockStatus;

  @ApiPropertyOptional({
    description: 'Product status',
    enum: ContentStatus,
    default: ContentStatus.draft,
  })
  @IsEnum(ContentStatus)
  @IsOptional()
  status?: ContentStatus;

  @ApiPropertyOptional({
    description: 'Product visibility',
    enum: ContentVisibility,
    default: ContentVisibility.public,
  })
  @IsEnum(ContentVisibility)
  @IsOptional()
  visibility?: ContentVisibility;

  @ApiPropertyOptional({ description: 'Allow guest purchases', default: false })
  @IsBoolean()
  @IsOptional()
  guest_purchaseable?: boolean;

  @ApiPropertyOptional({
    description: 'Product type',
    enum: ProductType,
    default: ProductType.physical,
  })
  @IsEnum(ProductType)
  @IsOptional()
  product_type?: ProductType;

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

  @ApiPropertyOptional({ description: 'Author can edit this product', default: true })
  @IsBoolean()
  @IsOptional()
  author_can_edit?: boolean;

  @ApiPropertyOptional({ description: 'Author can delete this product', default: true })
  @IsBoolean()
  @IsOptional()
  author_can_delete?: boolean;

  @ApiPropertyOptional({ description: 'Admin can edit this product', default: true })
  @IsBoolean()
  @IsOptional()
  admin_can_edit?: boolean;

  @ApiPropertyOptional({ description: 'Admin can delete this product', default: true })
  @IsBoolean()
  @IsOptional()
  admin_can_delete?: boolean;
}
