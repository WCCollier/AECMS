import { Logger } from '@nestjs/common';
import { GptImage1Provider } from './gpt-image1.provider';

export class XAIImageProvider extends GptImage1Provider {
  protected override readonly logger = new Logger(XAIImageProvider.name);
  protected override readonly baseUrl = 'https://api.x.ai/v1';

  constructor(apiKey: string, model = 'grok-imagine-image-quality') {
    super(apiKey, model);
  }
}
