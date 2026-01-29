import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  ValidateNested,
  IsArray,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ShippingAddressDto {
  @ApiProperty({ description: 'Recipient name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Street address' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ description: 'City' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'State/Province' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ description: 'Postal/ZIP code' })
  @IsString()
  @IsNotEmpty()
  zip: string;

  @ApiProperty({ description: 'Country code (e.g., US)' })
  @IsString()
  @IsNotEmpty()
  country: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'Customer email' })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Payment method',
    enum: ['stripe', 'paypal', 'amazon_pay'],
  })
  @IsEnum(['stripe', 'paypal', 'amazon_pay'])
  payment_method: 'stripe' | 'paypal' | 'amazon_pay';

  @ApiPropertyOptional({ description: 'Shipping address (required for physical products)' })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  @IsOptional()
  shipping_address?: ShippingAddressDto;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'New order status',
    enum: ['pending', 'processing', 'completed', 'cancelled', 'refunded'],
  })
  @IsEnum(['pending', 'processing', 'completed', 'cancelled', 'refunded'])
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'refunded';
}
