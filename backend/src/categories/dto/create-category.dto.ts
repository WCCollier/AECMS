import { IsString, IsOptional, MaxLength, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Category name',
    example: 'Technology',
  })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'URL-friendly slug (auto-generated if not provided)',
    example: 'technology',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Articles about technology and innovation',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Parent category ID for hierarchical structure',
  })
  @IsOptional()
  @IsUUID()
  parent_id?: string;
}
