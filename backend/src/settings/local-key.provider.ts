import * as crypto from 'crypto';
import { KeyProvider } from './key-provider.interface';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export class LocalKeyProvider implements KeyProvider {
  private readonly key: Buffer;

  constructor(masterKeyHex: string) {
    if (!masterKeyHex || masterKeyHex.length !== 64) {
      throw new Error(
        'SETTINGS_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }
    this.key = Buffer.from(masterKeyHex, 'hex');
  }

  async encrypt(plaintext: string): Promise<string> {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv) as crypto.CipherGCM;
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: base64(iv[12] + tag[16] + ciphertext)
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  async decrypt(stored: string): Promise<string> {
    const buf = Buffer.from(stored, 'base64');
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  }
}
