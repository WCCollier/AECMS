import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

function build(order: any, opts: { stripeState?: string } = {}) {
  const prisma: any = {
    order: {
      findUnique: jest.fn().mockResolvedValue(order),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
  };
  const ordersService: any = {
    setPaymentSettler: jest.fn(),
    cancelPendingOrder: jest.fn().mockResolvedValue(true),
  };
  const mkProvider = (name: string) => ({
    name,
    isAvailable: jest.fn().mockResolvedValue(true),
    getPaymentState: jest.fn().mockResolvedValue(opts.stripeState ?? 'closed'),
    expirePayment: jest.fn().mockResolvedValue(undefined),
    createPayment: jest.fn().mockResolvedValue({ id: 'cs_new', clientSecret: 'https://stripe/new', status: 'requires_action' }),
  });
  const stripe: any = mkProvider('stripe');
  const paypal: any = mkProvider('paypal');
  const settings: any = { getEffective: jest.fn().mockResolvedValue('') };
  const service = new PaymentsService(
    prisma, ordersService, {} as any, {} as any, stripe, paypal, { log: jest.fn() } as any, {} as any, settings,
  );
  return { service, prisma, ordersService, stripe };
}

const pendingOrder = (extra: any = {}) => ({
  id: 'o1', status: 'pending', user_id: null, email: 'a@b.c', order_number: 'N1',
  total: '10.00', payment_intent_id: null, payment_method: null, items: [], ...extra,
});

describe('PaymentsService.createPaymentIntent retry', () => {
  it('creates a new session for an order whose earlier session lapsed, then expires the old one', async () => {
    const { service, stripe, prisma } = build(pendingOrder({ payment_intent_id: 'cs_old', payment_method: 'stripe' }));
    const res = await service.createPaymentIntent({ order_id: 'o1', provider: 'stripe' } as any);
    expect(res.payment_id).toBe('cs_new');
    expect(stripe.expirePayment).toHaveBeenCalledWith('cs_old');
    // new id is stored before the old session is expired
    const updateOrder = prisma.order.update.mock.invocationCallOrder[0];
    const expireOrder = stripe.expirePayment.mock.invocationCallOrder[0];
    expect(updateOrder).toBeLessThan(expireOrder);
  });

  it('refuses when the earlier session was already paid', async () => {
    const { service, stripe } = build(
      pendingOrder({ payment_intent_id: 'cs_old', payment_method: 'stripe' }),
      { stripeState: 'paid' },
    );
    await expect(
      service.createPaymentIntent({ order_id: 'o1', provider: 'stripe' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(stripe.createPayment).not.toHaveBeenCalled();
  });
});

describe('PaymentsService expired-session handling', () => {
  const event = (id: string) => ({
    provider: 'stripe', type: 'checkout.session.expired', id: 'evt',
    data: { id, metadata: { order_id: 'o1' } },
  });

  it('cancels the order and restores stock when the CURRENT session expires', async () => {
    const { service, ordersService } = build(pendingOrder({ payment_intent_id: 'cs_cur', payment_method: 'stripe' }));
    await (service as any).handlePaymentFailed(event('cs_cur'));
    expect(ordersService.cancelPendingOrder).toHaveBeenCalledWith('o1', 'stripe_session_expired');
  });

  it('ignores the expiry of a superseded session', async () => {
    const { service, ordersService } = build(pendingOrder({ payment_intent_id: 'cs_new', payment_method: 'stripe' }));
    await (service as any).handlePaymentFailed(event('cs_old'));
    expect(ordersService.cancelPendingOrder).not.toHaveBeenCalled();
  });
});

describe('PaymentsService.sweepStalePendingOrders', () => {
  it('cancels idle unpaid orders but skips ones whose session is paid', async () => {
    const { service, prisma, ordersService, stripe } = build(null);
    prisma.order.findMany.mockResolvedValue([
      { id: 'a', order_number: 'A', payment_method: null, payment_intent_id: null },
      { id: 'b', order_number: 'B', payment_method: 'stripe', payment_intent_id: 'cs_paid' },
      { id: 'c', order_number: 'C', payment_method: 'stripe', payment_intent_id: 'cs_open' },
    ]);
    stripe.getPaymentState.mockImplementation(async (id: string) => (id === 'cs_paid' ? 'paid' : 'open'));
    const res = await service.sweepStalePendingOrders();
    expect(res).toEqual({ checked: 3, cancelled: 2, skipped: 1 });
    expect(ordersService.cancelPendingOrder).toHaveBeenCalledTimes(2);
    expect(stripe.expirePayment).toHaveBeenCalledWith('cs_open');
  });
});
