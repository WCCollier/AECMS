import { Logger } from '@nestjs/common';
import { OpenAIMulProvider } from './openai-mul.provider';

export class XAIMulProvider extends OpenAIMulProvider {
  protected override readonly logger = new Logger(XAIMulProvider.name);
  protected override readonly baseUrl = 'https://api.x.ai/v1';

  constructor(apiKey: string, model: string) {
    super(apiKey, model);
  }
}
