import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class CreateAddressDto {
  @ApiPropertyOptional({ description: 'Address label (e.g. Home, Office)' })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({ description: 'Full name for this address' })
  @IsString()
  @IsOptional()
  full_name?: string;

  @ApiProperty({ description: 'Street address' })
  @IsString()
  street: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  city: string;

  @ApiProperty({ description: 'State or province (plaintext — used for tax)' })
  @IsString()
  state: string;

  @ApiProperty({ description: 'Postal code' })
  @IsString()
  postal_code: string;

  @ApiProperty({ description: 'Country code (plaintext — used for tax)', default: 'US' })
  @IsString()
  country: string;

  @ApiPropertyOptional({ description: 'Set as default shipping address' })
  @IsBoolean()
  @IsOptional()
  is_default?: boolean;
}
