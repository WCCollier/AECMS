import { ConflictException, BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';

function build(order: any) {
  const tx: any = {
    order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    orderItem: { findMany: jest.fn().mockResolvedValue([{ product_id: 'p1', quantity: 2 }]) },
    product: { update: jest.fn(), updateMany: jest.fn() },
  };
  const prisma: any = {
    order: { findUnique: jest.fn().mockResolvedValue(order), update: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const auditLog: any = { log: jest.fn() };
  const service = new OrdersService(prisma, {} as any, auditLog, {} as any, {} as any, { decrypt: jest.fn() } as any);
  return { service, prisma, tx, auditLog };
}

describe('OrdersService.markAsPaid status guard', () => {
  it('refuses a cancelled order, flags it for refund, and does not change it', async () => {
    const { service, prisma, auditLog } = build({ id: 'o1', status: 'cancelled' });
    await expect(service.markAsPaid('o1', 'cs_1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'order.payment_on_cancelled' }),
    );
  });

  it('refuses an already-processed order', async () => {
    const { service, prisma } = build({ id: 'o1', status: 'processing' });
    await expect(service.markAsPaid('o1', 'cs_1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});

describe('OrdersService.cancelPendingOrder', () => {
  it('flips pending -> cancelled once and restores stock without forcing in_stock', async () => {
    const { service, tx, auditLog } = build({});
    await expect(service.cancelPendingOrder('o1', 'test')).resolves.toBe(true);
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { stock_quantity: { increment: 2 } },
    });
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', stock_status: 'out_of_stock', stock_quantity: { gt: 0 } },
      data: { stock_status: 'in_stock' },
    });
    expect(auditLog.log).toHaveBeenCalled();
  });

  it('is a no-op (no stock change) when the order is no longer pending', async () => {
    const { service, tx, auditLog } = build({});
    tx.order.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.cancelPendingOrder('o1', 'test')).resolves.toBe(false);
    expect(tx.product.update).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });
});

describe('OrdersService.cancel with a payment session', () => {
  const order = { id: 'o1', user_id: 'u1', status: 'pending', payment_method: 'stripe', payment_intent_id: 'cs_1', items: [] };

  it('refuses to cancel when the buyer has paid', async () => {
    const { service } = build(order);
    service.setPaymentSettler(jest.fn().mockResolvedValue(true));
    await expect(service.cancel('o1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('closes the session then cancels when unpaid', async () => {
    const { service, tx } = build(order);
    const settler = jest.fn().mockResolvedValue(false);
    service.setPaymentSettler(settler);
    jest.spyOn(service as any, 'transformOrder').mockResolvedValue({ id: 'o1' });
    jest.spyOn(service as any, 'getOrderIncludes').mockReturnValue({});
    await service.cancel('o1', 'u1');
    expect(settler).toHaveBeenCalled();
    expect(tx.order.updateMany).toHaveBeenCalled();
  });
});
