import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateShippingAddressDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  shipping_street?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  shipping_city?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  shipping_state?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  shipping_postal_code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  shipping_country?: string;
}
