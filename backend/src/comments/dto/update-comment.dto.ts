import { IsString, IsOptional, MinLength, MaxLength, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CommentStatus, ModerationStatus } from '@prisma/client';

export class UpdateCommentDto {
  @ApiPropertyOptional({ description: 'Comment content', minLength: 1, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content?: string;
}

export class ModerateCommentDto {
  @ApiPropertyOptional({ description: 'Comment status', enum: CommentStatus })
  @IsOptional()
  @IsEnum(CommentStatus)
  status?: CommentStatus;

  @ApiPropertyOptional({ description: 'Moderation status', enum: ModerationStatus })
  @IsOptional()
  @IsEnum(ModerationStatus)
  moderation_status?: ModerationStatus;
}
