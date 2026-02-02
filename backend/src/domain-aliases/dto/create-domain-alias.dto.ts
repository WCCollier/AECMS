import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDomainAliasDto {
  @ApiProperty({
    description: 'Domain name (e.g., wccollier.com)',
    example: 'wccollier.com',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9-_.]*\.[a-zA-Z]{2,}$/, {
    message: 'Invalid domain format',
  })
  domain: string;

  @ApiProperty({
    description: 'Target route to serve for this domain (e.g., /author)',
    example: '/author',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^\/[a-zA-Z0-9\-_\/]*$/, {
    message: 'Target route must start with / and contain only valid path characters',
  })
  target_route: string;
}
