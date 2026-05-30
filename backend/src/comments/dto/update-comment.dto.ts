import { IsString, IsOptional, MinLength, MaxLength, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CommentStatus, ModerationStatus } from '@prisma/client';
import { CreateCommentRatingDto } from './create-comment.dto';

export class UpdateCommentDto {
  @ApiPropertyOptional({ description: 'Comment body', minLength: 1, maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional({ description: 'Review headline' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: 'Ratings array. Replaces all existing ratings. First entry must be "Overall".',
    type: [CreateCommentRatingDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCommentRatingDto)
  ratings?: CreateCommentRatingDto[];
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
