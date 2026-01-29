import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto, QueryOrdersDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequiresCapability } from '../capabilities/decorators/requires-capability.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Create order from cart' })
  @ApiHeader({ name: 'x-session-id', required: false, description: 'Session ID for guest orders' })
  create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: any,
    @Headers('x-session-id') sessionId?: string,
  ) {
    return this.ordersService.createFromCart(dto, user?.id, sessionId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('order.view.all')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all orders (admin)' })
  findAll(@Query() query: QueryOrdersDto) {
    return this.ordersService.findAll(query);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user orders' })
  findMyOrders(@CurrentUser() user: any, @Query() query: QueryOrdersDto) {
    return this.ordersService.findUserOrders(user.id, query);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get order by ID' })
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    const isAdmin = user?.role === 'owner' || user?.role === 'admin';
    return this.ordersService.findById(id, user?.id, isAdmin);
  }

  @Get('number/:orderNumber')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get order by order number' })
  findByOrderNumber(
    @Param('orderNumber') orderNumber: string,
    @CurrentUser() user: any,
  ) {
    const isAdmin = user?.role === 'owner' || user?.role === 'admin';
    return this.ordersService.findByOrderNumber(orderNumber, user?.id, isAdmin);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('order.edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update order status (admin)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto);
  }

  @Post(':id/cancel')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Cancel order' })
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    const isAdmin = user?.role === 'owner' || user?.role === 'admin';
    return this.ordersService.cancel(id, user?.id, isAdmin);
  }
}
