import { BadGatewayException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ImageProvider } from './image-provider.interface';
import type { ImageBrief } from '../mul-converter.types';

const ASPECT_TO_SIZE: Record<string, string> = {
  '1:1':  '1024x1024',
  '16:9': '1792x1024',
  '9:16': '1024x1792',
  '4:3':  '1024x1024',
  '3:2':  '1792x1024',
  '3:4':  '1024x1024',
};

export class GptImage1Provider implements ImageProvider {
  private readonly logger = new Logger(GptImage1Provider.name);

  constructor(private readonly apiKey: string, private readonly model = 'gpt-image-1') {}

  async generate(brief: ImageBrief): Promise<Buffer> {
    const size = ASPECT_TO_SIZE[brief.aspectRatio] ?? '1024x1024';

    const body: Record<string, unknown> = {
      model: this.model,
      prompt: brief.prompt,
      n: 1,
      size,
      response_format: 'b64_json',
    };

    // Reference mode: pass imageSourceUrl as additional context via prompt injection
    // (gpt-image-1 via chat completions supports image inputs; via images endpoint, prompt only)
    if (brief.imageSourceUrl) {
      body.prompt = `Style and composition reference: ${brief.imageSourceUrl}\n\n${brief.prompt}`;
    }

    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      throw new BadGatewayException('Image provider request failed: ' + err.message);
    }

    if (res.status === 429) throw new HttpException('Image provider rate limit reached.', HttpStatus.TOO_MANY_REQUESTS);
    if (!res.ok) throw new BadGatewayException(`Image provider returned HTTP ${res.status}`);

    const json = await res.json() as any;
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new BadGatewayException('Image provider returned no image data.');

    return Buffer.from(b64, 'base64');
  }
}
