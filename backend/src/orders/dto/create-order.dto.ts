import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ShippingAddressDto {
  @ApiPropertyOptional({ description: 'Recipient name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Street address' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ description: 'State/Province' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiPropertyOptional({ description: 'Postal/ZIP code' })
  @IsString()
  @IsNotEmpty()
  postal_code: string;

  @ApiPropertyOptional({ description: 'Country code (e.g., US)' })
  @IsString()
  @IsNotEmpty()
  country: string;
}

export class CreateOrderDto {
  @ApiPropertyOptional({ description: 'Guest email (omit if authenticated)' })
  @IsEmail()
  @IsOptional()
  guest_email?: string;

  // NOTE: Amazon Pay is surfaced automatically by Stripe Checkout — no separate provider.
  @ApiPropertyOptional({
    description: 'Payment method (set when payment is initiated)',
    enum: ['stripe', 'paypal'],
  })
  @IsEnum(['stripe', 'paypal'])
  @IsOptional()
  payment_method?: 'stripe' | 'paypal';

  @ApiPropertyOptional({ description: 'Shipping address (required for physical products)' })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  @IsOptional()
  shipping_address?: ShippingAddressDto;
}

export class UpdateOrderStatusDto {
  @ApiPropertyOptional({
    description: 'New order status',
    enum: ['pending', 'processing', 'scheduled', 'shipped', 'completed', 'cancelled', 'refunded'],
  })
  @IsEnum(['pending', 'processing', 'scheduled', 'shipped', 'completed', 'cancelled', 'refunded'])
  status: 'pending' | 'processing' | 'scheduled' | 'shipped' | 'completed' | 'cancelled' | 'refunded';
}

export class UpdateFulfillmentDto {
  @ApiPropertyOptional({ description: 'Carrier name (e.g., UPS, USPS, FedEx)' })
  @IsString()
  @IsOptional()
  tracking_carrier?: string;

  @ApiPropertyOptional({ description: 'Tracking number' })
  @IsString()
  @IsOptional()
  tracking_number?: string;

  @ApiPropertyOptional({ description: 'Mark order as shipped (physical)' })
  @IsBoolean()
  @IsOptional()
  mark_shipped?: boolean;

  @ApiPropertyOptional({ description: 'Mark order as scheduled (service)' })
  @IsBoolean()
  @IsOptional()
  mark_scheduled?: boolean;

  @ApiPropertyOptional({ description: 'Scheduled appointment date/time (ISO string)' })
  @IsString()
  @IsOptional()
  scheduled_at?: string;

  @ApiPropertyOptional({ description: 'Note for the customer about the scheduled appointment' })
  @IsString()
  @IsOptional()
  scheduled_note?: string;
}
