export const KEY_PROVIDER = 'KEY_PROVIDER';

export interface KeyProvider {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}
