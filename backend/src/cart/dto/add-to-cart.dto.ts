import { IsUUID, IsInt, Min, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AddToCartDto {
  @ApiProperty({ description: 'Product ID to add' })
  @IsUUID()
  product_id: string;

  @ApiPropertyOptional({ description: 'Quantity to add', default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number = 1;
}

export class UpdateCartItemDto {
  @ApiProperty({ description: 'New quantity', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CartSessionDto {
  @ApiPropertyOptional({ description: 'Session ID for guest carts' })
  @IsString()
  @IsOptional()
  session_id?: string;
}
