import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentIntentDto,
  CapturePayPalPaymentDto,
  CaptureAmazonPayPaymentDto,
  RefundPaymentDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CapabilityGuard } from '../capabilities/guards/capability.guard';
import { RequiresCapability } from '../capabilities/decorators/requires-capability.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('providers')
  @ApiOperation({ summary: 'Get available payment providers' })
  getProviders() {
    return {
      providers: this.paymentsService.getAvailableProviders(),
    };
  }

  @Post('create-intent')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Create payment intent for an order' })
  createPaymentIntent(
    @Body() dto: CreatePaymentIntentDto,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.createPaymentIntent(dto, user?.id);
  }

  @Post('capture-paypal')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Capture PayPal payment after user approval' })
  capturePayPalPayment(
    @Body() dto: CapturePayPalPaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.capturePayPalPayment(dto, user?.id);
  }

  @Post('capture-amazon-pay')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Capture Amazon Pay payment after user approval' })
  captureAmazonPayPayment(
    @Body() dto: CaptureAmazonPayPaymentDto,
    @CurrentUser() user: any,
  ) {
    return this.paymentsService.captureAmazonPayPayment(dto, user?.id);
  }

  @Get('amazon-pay/button-config')
  @ApiOperation({ summary: 'Get Amazon Pay button configuration for frontend' })
  getAmazonPayButtonConfig() {
    return this.paymentsService.getAmazonPayButtonConfig();
  }

  @Post('refund/:orderId')
  @UseGuards(JwtAuthGuard, CapabilityGuard)
  @RequiresCapability('order.refund')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Process refund for an order' })
  refund(@Param('orderId') orderId: string, @Body() dto: RefundPaymentDto) {
    return this.paymentsService.refund(orderId, dto);
  }

  @Post('webhooks/stripe')
  @ApiOperation({ summary: 'Stripe webhook handler' })
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const payload = req.rawBody;
    if (!payload) {
      throw new Error('Missing raw body');
    }
    return this.paymentsService.handleStripeWebhook(payload, signature);
  }

  @Post('webhooks/paypal')
  @ApiOperation({ summary: 'PayPal webhook handler' })
  async handlePayPalWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('paypal-transmission-sig') signature: string,
  ) {
    const payload = req.rawBody;
    if (!payload) {
      throw new Error('Missing raw body');
    }
    return this.paymentsService.handlePayPalWebhook(payload, signature || '');
  }

  @Post('webhooks/amazon-pay')
  @ApiOperation({ summary: 'Amazon Pay webhook (IPN) handler' })
  async handleAmazonPayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-amz-sns-message-type') messageType: string,
  ) {
    const payload = req.rawBody;
    if (!payload) {
      throw new Error('Missing raw body');
    }
    // Amazon Pay uses SNS for notifications, signature is embedded in the message
    return this.paymentsService.handleAmazonPayWebhook(payload, messageType || '');
  }

  @Post('test/simulate/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Simulate payment completion (test mode only)' })
  simulatePayment(@Param('orderId') orderId: string) {
    return this.paymentsService.simulatePaymentCompletion(orderId);
  }
}
