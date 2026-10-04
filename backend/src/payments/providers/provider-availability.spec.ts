import { StripeProvider } from './stripe.provider';
import { PayPalProvider } from './paypal.provider';

const settings = (values: Record<string, string>) =>
  ({ getEffective: jest.fn(async (k: string) => values[k] ?? '') }) as any;
const config = { get: jest.fn() } as any;

describe('StripeProvider.isAvailable', () => {
  it('is available when the key is only in the ISM', async () => {
    const p = new StripeProvider(config, settings({ 'payment.stripe_secret_key_enc': 'sk_test_x' }));
    await expect(p.isAvailable()).resolves.toBe(true);
  });

  it('is unavailable when no key resolves', async () => {
    const p = new StripeProvider(config, settings({}));
    await expect(p.isAvailable()).resolves.toBe(false);
  });
});

describe('PayPalProvider.isAvailable', () => {
  it('is available when credentials are only in the ISM', async () => {
    const p = new PayPalProvider(
      config,
      settings({
        'payment.paypal_client_id': 'id',
        'payment.paypal_client_secret_enc': 'secret',
      }),
    );
    await expect(p.isAvailable()).resolves.toBe(true);
  });

  it('is unavailable when either credential is missing', async () => {
    const p = new PayPalProvider(config, settings({ 'payment.paypal_client_id': 'id' }));
    await expect(p.isAvailable()).resolves.toBe(false);
  });
});
