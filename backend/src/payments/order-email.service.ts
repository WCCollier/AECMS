import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER } from '../email/email.interface';
import type { EmailProvider } from '../email/email.interface';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { EncryptionService } from '../encryption/encryption.service';

@Injectable()
export class OrderEmailService {
  private readonly logger = new Logger(OrderEmailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
    private readonly encryption: EncryptionService,
  ) {}

  async sendOrderConfirmation(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { product: { select: { product_type: true } } },
        },
      },
    });

    if (!order) {
      this.logger.warn(`sendOrderConfirmation: order ${orderId} not found`);
      return;
    }

    const [siteName, contactEmail, appUrl] = await Promise.all([
      this.settingsService.getEffective('general.site_title').then((v) => v || 'AECMS'),
      this.settingsService.getEffective('email.system_from').then((v) => v || ''),
      Promise.resolve(this.configService.get<string>('APP_URL', 'http://localhost:3000')),
    ]);

    const customerName = (await this.encryption.decrypt(order.customer_name_enc)) || 'there';
    const orderDate = order.created_at.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const totalFormatted = `$${parseFloat(order.total.toString()).toFixed(2)}`;

    const hasDigital = order.items.some((i) => i.product.product_type === 'digital');
    const hasPhysical = order.items.some((i) => i.product.product_type === 'physical');
    const hasService = order.items.some((i) => i.product.product_type === 'service');

    const itemsHtml = order.items.map((item) => {
      const price = `$${parseFloat(item.price.toString()).toFixed(2)}`;
      return `<tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${item.product_title}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center;">×${item.quantity}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${price}</td>
      </tr>`;
    }).join('');

    const itemsText = order.items.map((item) => {
      const price = `$${parseFloat(item.price.toString()).toFixed(2)}`;
      return `  - ${item.product_title}  ×${item.quantity}  ${price}`;
    }).join('\n');

    let typeHtml = '';
    let typeText = '';

    if (hasDigital) {
      typeHtml += `<p style="color: #555;">Your download link(s) will arrive in a separate email shortly.</p>`;
      typeText += `\nYour download link(s) will arrive in a separate email shortly.`;
    }
    const shippingName = await this.encryption.decrypt(order.shipping_name_enc);
    const shippingAddress = await this.encryption.decrypt(order.shipping_address_enc);
    const shippingCity = await this.encryption.decrypt(order.shipping_city_enc);
    const shippingZip = await this.encryption.decrypt(order.shipping_zip_enc);
    if (hasPhysical && shippingName) {
      const addr = [shippingName, shippingAddress, `${shippingCity || ''}, ${order.shipping_state || ''} ${shippingZip || ''}`.trim(), order.shipping_country].filter(Boolean).join('\n');
      typeHtml += `<p style="color: #555;"><strong>Shipping to:</strong><br><span style="white-space: pre-line;">${addr.replace(/\n/g, '<br>')}</span></p>`;
      typeText += `\nShipping to:\n${addr}`;
    }
    if (hasService) {
      typeHtml += `<p style="color: #555;">We'll be in touch shortly to arrange your order.</p>`;
      typeText += `\nWe'll be in touch shortly to arrange your order.`;
    }

    const contactLine = contactEmail ? `<p style="color: #999; font-size: 13px;">Questions? Contact us at <a href="mailto:${contactEmail}">${contactEmail}</a>.</p>` : '';
    const contactText = contactEmail ? `\nQuestions? Contact us at ${contactEmail}.` : '';

    await this.emailProvider.send({
      to: order.email,
      subject: `Order confirmed — #${order.order_number}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h1 style="color: #333;">Thank you for your order!</h1>
          <p>Hi ${customerName},</p>
          <p>Your order has been confirmed. Here's a summary:</p>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="color: #666; padding-bottom: 4px;">Order number</td>
              <td style="text-align: right; font-weight: bold;">#${order.order_number}</td>
            </tr>
            <tr>
              <td style="color: #666; padding-bottom: 4px;">Date</td>
              <td style="text-align: right;">${orderDate}</td>
            </tr>
          </table>

          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <thead>
              <tr style="border-bottom: 2px solid #eee;">
                <th style="text-align: left; padding-bottom: 8px; color: #666;">Item</th>
                <th style="text-align: center; padding-bottom: 8px; color: #666;">Qty</th>
                <th style="text-align: right; padding-bottom: 8px; color: #666;">Price</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot>
              ${order.tax_amount && order.tax_amount > 0 ? `
              <tr>
                <td colspan="2" style="padding-top: 8px; text-align: right; padding-right: 8px; color: #666;">Tax</td>
                <td style="padding-top: 8px; text-align: right; color: #666;">$${(order.tax_amount / 100).toFixed(2)}</td>
              </tr>` : ''}
              <tr>
                <td colspan="2" style="padding-top: 12px; font-weight: bold; text-align: right; padding-right: 8px;">Total</td>
                <td style="padding-top: 12px; font-weight: bold; text-align: right;">${totalFormatted}</td>
              </tr>
            </tfoot>
          </table>

          ${typeHtml}
          ${contactLine}

          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            ${siteName} — <a href="${appUrl}" style="color: #999;">${appUrl}</a>
          </p>
        </div>
      `,
      text: `Thank you for your order!\n\nHi ${customerName},\n\nOrder #${order.order_number} — ${orderDate}\n\nItems:\n${itemsText}\n\nTotal: ${totalFormatted}\n${typeText}${contactText}\n\n${siteName}\n${appUrl}`,
    });
  }
}
