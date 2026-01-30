import { IsEnum, IsUUID, IsOptional, IsNumber, Min, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePaymentIntentDto {
  @ApiProperty({ description: 'Order ID to create payment for' })
  @IsUUID()
  order_id: string;

  @ApiProperty({
    description: 'Payment provider',
    enum: ['stripe', 'paypal', 'amazon_pay'],
  })
  @IsEnum(['stripe', 'paypal', 'amazon_pay'])
  provider: 'stripe' | 'paypal' | 'amazon_pay';
}

export class CapturePayPalPaymentDto {
  @ApiProperty({ description: 'PayPal order ID to capture' })
  @IsString()
  paypal_order_id: string;

  @ApiProperty({ description: 'AECMS order ID' })
  @IsUUID()
  order_id: string;
}

export class CaptureAmazonPayPaymentDto {
  @ApiProperty({ description: 'Amazon Pay checkout session ID to capture' })
  @IsString()
  checkout_session_id: string;

  @ApiProperty({ description: 'AECMS order ID' })
  @IsUUID()
  order_id: string;
}

export class RefundPaymentDto {
  @ApiPropertyOptional({ description: 'Partial refund amount in cents (full refund if not specified)' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ description: 'Reason for refund' })
  @IsOptional()
  reason?: string;
}

export class PaymentIntentResponseDto {
  @ApiProperty({ description: 'Payment intent/order ID from provider' })
  payment_id: string;

  @ApiProperty({ description: 'Client secret for frontend SDK (Stripe), approval URL (PayPal), or checkout session ID (Amazon Pay)' })
  client_secret: string;

  @ApiProperty({ description: 'Payment provider' })
  provider: 'stripe' | 'paypal' | 'amazon_pay';

  @ApiProperty({ description: 'Payment status' })
  status: string;
}
