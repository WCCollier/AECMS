import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMediaDto {
  @ApiPropertyOptional({
    description: 'Alt text for accessibility',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  alt_text?: string;

  @ApiPropertyOptional({
    description: 'Caption or description',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  caption?: string;
}
