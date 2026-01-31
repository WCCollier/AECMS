import { IsOptional, IsUUID, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CommentStatus, ModerationStatus } from '@prisma/client';

export class QueryCommentsDto {
  @ApiPropertyOptional({ description: 'Filter by article ID' })
  @IsOptional()
  @IsUUID()
  article_id?: string;

  @ApiPropertyOptional({ description: 'Filter by comment status', enum: CommentStatus })
  @IsOptional()
  @IsEnum(CommentStatus)
  status?: CommentStatus;

  @ApiPropertyOptional({ description: 'Filter by moderation status', enum: ModerationStatus })
  @IsOptional()
  @IsEnum(ModerationStatus)
  moderation_status?: ModerationStatus;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
