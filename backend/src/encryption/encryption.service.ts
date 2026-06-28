import { Injectable, Inject } from '@nestjs/common';
import type { KeyProvider } from '../settings/key-provider.interface';

export const ENCRYPTION_KEY_PROVIDER = 'ENCRYPTION_KEY_PROVIDER';

@Injectable()
export class EncryptionService {
  constructor(@Inject(ENCRYPTION_KEY_PROVIDER) private readonly kp: KeyProvider) {}

  async encrypt(value: string | null | undefined): Promise<string | null> {
    if (value == null || value === '') return null;
    return this.kp.encrypt(value);
  }

  async decrypt(value: string | null | undefined): Promise<string | null> {
    if (value == null || value === '') return null;
    return this.kp.decrypt(value);
  }
}
