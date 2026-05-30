import { IsString, IsUUID, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiPropertyOptional({ description: 'Article ID to comment on' })
  @IsOptional()
  @IsUUID()
  article_id?: string;

  @ApiPropertyOptional({ description: 'Product ID to comment on' })
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiPropertyOptional({ description: 'Comment content', minLength: 1, maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({ description: 'Parent comment ID for replies' })
  @IsOptional()
  @IsUUID()
  parent_id?: string;
}
