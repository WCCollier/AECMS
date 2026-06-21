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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto, UpdateFulfillmentDto, QueryOrdersDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BackstageGuard } from '../auth/guards/backstage.guard';
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
    return this.ordersService.createFromCart(dto, user?.id, sessionId, user?.email);
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

  @Get('export')
  @UseGuards(JwtAuthGuard, BackstageGuard, CapabilityGuard)
  @RequiresCapability('order.view.all')
  @ApiOperation({ summary: 'Download transaction history as CSV' })
  async exportCsv(
    @Query('from') fromStr: string,
    @Query('to') toStr: string,
    @Res() res: Response,
  ) {
    const from = fromStr ? new Date(fromStr) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to   = toStr   ? new Date(toStr)   : new Date();
    const csv  = await this.ordersService.exportCsv(from, to);
    const fromLabel = from.toISOString().slice(0, 10);
    const toLabel   = to.toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transactions-${fromLabel}-${toLabel}.csv"`);
    res.send(csv);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get order by ID' })
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    const isAdmin = user?.session_type === 'backstage';
    return this.ordersService.findById(id, user?.id, isAdmin);
  }

  @Get('number/:orderNumber')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get order by order number' })
  findByOrderNumber(
    @Param('orderNumber') orderNumber: string,
    @CurrentUser() user: any,
  ) {
    const isAdmin = user?.session_type === 'backstage';
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
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateStatus(id, dto, user?.id);
  }

  @Patch(':id/fulfillment')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('order.edit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update fulfillment info: tracking, mark shipped/scheduled (admin)' })
  updateFulfillment(
    @Param('id') id: string,
    @Body() dto: UpdateFulfillmentDto,
    @CurrentUser() user: any,
  ) {
    return this.ordersService.updateFulfillment(id, dto, user?.id);
  }

  @Post(':id/cancel')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Cancel order' })
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    const isAdmin = user?.session_type === 'backstage';
    return this.ordersService.cancel(id, user?.id, isAdmin);
  }

}
