import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTagDto {
  @ApiProperty({
    description: 'Tag name',
    example: 'JavaScript',
  })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({
    description: 'URL-friendly slug (auto-generated if not provided)',
    example: 'javascript',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  slug?: string;

  @ApiPropertyOptional({
    description: 'Tag description',
    example: 'Articles related to JavaScript programming',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
