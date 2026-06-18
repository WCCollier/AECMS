import { KeyProvider } from './key-provider.interface';
import { LocalKeyProvider } from './local-key.provider';

/**
 * Fetches the Settings Encryption Key (SEK) from Google Cloud Secret Manager
 * and delegates all encrypt/decrypt operations to LocalKeyProvider.
 *
 * Auth: Workload Identity on Cloud Run; Application Default Credentials locally.
 * Selected by SETTINGS_KMS_PROVIDER=gcp env var.
 */
export class GcpKeyProvider implements KeyProvider {
  private readonly projectId: string;
  private readonly secretId: string;
  private _delegate: LocalKeyProvider | null = null;

  constructor(projectId: string, secretId: string) {
    this.projectId = projectId;
    this.secretId = secretId;
  }

  private async getDelegate(): Promise<LocalKeyProvider> {
    if (this._delegate) return this._delegate;

    const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
    const client = new SecretManagerServiceClient();
    const name = `projects/${this.projectId}/secrets/${this.secretId}/versions/latest`;

    const [version] = await client.accessSecretVersion({ name });
    const payload = version.payload?.data;
    if (!payload) throw new Error(`GCP secret '${this.secretId}' returned no payload`);

    const keyHex = Buffer.isBuffer(payload)
      ? payload.toString('utf-8')
      : String(payload);

    this._delegate = new LocalKeyProvider(keyHex.trim());
    return this._delegate;
  }

  async encrypt(plaintext: string): Promise<string> {
    return (await this.getDelegate()).encrypt(plaintext);
  }

  async decrypt(ciphertext: string): Promise<string> {
    return (await this.getDelegate()).decrypt(ciphertext);
  }
}
