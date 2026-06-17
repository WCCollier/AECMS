import { LocalKeyProvider } from './local-key.provider';

const TEST_KEY = 'b'.repeat(64);

describe('LocalKeyProvider', () => {
  let provider: LocalKeyProvider;

  beforeEach(() => {
    provider = new LocalKeyProvider(TEST_KEY);
  });

  it('round-trips correctly', async () => {
    const plaintext = 'sk_test_hello_world_123';
    const ciphertext = await provider.encrypt(plaintext);
    const decrypted = await provider.decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext each call (random IV)', async () => {
    const plaintext = 'same_value';
    const c1 = await provider.encrypt(plaintext);
    const c2 = await provider.encrypt(plaintext);
    expect(c1).not.toBe(c2);
  });

  it('throws on tampered ciphertext', async () => {
    const ciphertext = await provider.encrypt('secret');
    const buf = Buffer.from(ciphertext, 'base64');
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString('base64');
    await expect(provider.decrypt(tampered)).rejects.toThrow();
  });

  it('throws on invalid master key length', () => {
    expect(() => new LocalKeyProvider('tooshort')).toThrow('SETTINGS_ENCRYPTION_KEY');
  });
});
