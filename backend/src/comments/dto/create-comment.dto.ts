import {
  IsString, IsUUID, IsOptional, MinLength, MaxLength,
  IsArray, ValidateNested, IsInt, Min, Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCommentRatingDto {
  @ApiPropertyOptional({ description: 'Rating dimension title (e.g. "Overall")' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional({ description: 'Rating value 1–5' })
  @IsInt()
  @Min(1)
  @Max(5)
  value: number;
}

export class CreateCommentDto {
  @ApiPropertyOptional({ description: 'Article ID to comment on' })
  @IsOptional()
  @IsUUID()
  article_id?: string;

  @ApiPropertyOptional({ description: 'Product ID to comment on' })
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiPropertyOptional({ description: 'Comment body', minLength: 1, maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({ description: 'Review headline (only meaningful when submitting ratings)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: 'Ratings array. First entry must have title "Overall". Presence of ratings makes this a review.',
    type: [CreateCommentRatingDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCommentRatingDto)
  ratings?: CreateCommentRatingDto[];

  @ApiPropertyOptional({ description: 'Parent comment ID for replies' })
  @IsOptional()
  @IsUUID()
  parent_id?: string;
}
