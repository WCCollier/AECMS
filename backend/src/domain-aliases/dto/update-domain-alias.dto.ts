import { IsString, IsOptional, IsBoolean, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDomainAliasDto {
  @ApiProperty({
    description: 'Target route to serve for this domain',
    example: '/author',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  @Matches(/^\/[a-zA-Z0-9\-_\/]*$/, {
    message: 'Target route must start with / and contain only valid path characters',
  })
  target_route?: string;

  @ApiProperty({
    description: 'Whether the alias is active',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
