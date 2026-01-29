import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto } from './dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get current cart' })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Session ID for guest carts' })
  getCart(
    @CurrentUser() user: any,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.cartService.getCart(user?.id, sessionId);
  }

  @Post('items')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Add item to cart' })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Session ID for guest carts' })
  addItem(
    @Body() dto: AddToCartDto,
    @CurrentUser() user: any,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.cartService.addItem(dto, user?.id, sessionId);
  }

  @Patch('items/:itemId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Session ID for guest carts' })
  updateItem(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentUser() user: any,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.cartService.updateItem(itemId, dto, user?.id, sessionId);
  }

  @Delete('items/:itemId')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Session ID for guest carts' })
  removeItem(
    @Param('itemId') itemId: string,
    @CurrentUser() user: any,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.cartService.removeItem(itemId, user?.id, sessionId);
  }

  @Delete()
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear cart' })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Session ID for guest carts' })
  clearCart(
    @CurrentUser() user: any,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.cartService.clearCart(user?.id, sessionId);
  }

  @Post('merge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Merge guest cart into user cart (call after login)' })
  @ApiHeader({ name: 'x-session-id', required: true, description: 'Guest session ID to merge' })
  mergeCart(
    @CurrentUser() user: any,
    @Headers('x-session-id') sessionId: string,
  ) {
    return this.cartService.mergeCart(user.id, sessionId);
  }
}
