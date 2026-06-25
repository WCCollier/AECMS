import { BadGatewayException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ImageProvider } from './image-provider.interface';
import type { ImageBrief } from '../mul-converter.types';

function toStabilityDimensions(ratio: string): { width: number; height: number } {
  const MAP: Record<string, { width: number; height: number }> = {
    '1:1':  { width: 1024, height: 1024 },
    '16:9': { width: 1344, height: 768 },
    '9:16': { width: 768,  height: 1344 },
    '4:3':  { width: 1152, height: 896 },
    '3:4':  { width: 896,  height: 1152 },
    '3:2':  { width: 1216, height: 832 },
  };
  return MAP[ratio] ?? { width: 1024, height: 1024 };
}

export class StabilityProvider implements ImageProvider {
  private readonly logger = new Logger(StabilityProvider.name);

  constructor(
    private readonly apiKey: string,
    private readonly model = 'stable-diffusion-xl-1024-v1-0',
  ) {}

  async generate(brief: ImageBrief): Promise<Buffer> {
    const { width, height } = toStabilityDimensions(brief.aspectRatio);

    const body = {
      text_prompts: [
        { text: brief.prompt, weight: 1 },
        { text: 'blurry, low quality, distorted, watermark', weight: -1 },
      ],
      cfg_scale: 7,
      height,
      width,
      samples: 1,
      steps: 30,
    };

    let res: Response;
    try {
      res = await fetch(
        `https://api.stability.ai/v1/generation/${this.model}/text-to-image`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(300_000),
        },
      );
    } catch (err) {
      throw new BadGatewayException('Image provider request failed: ' + err.message);
    }

    if (res.status === 429) throw new HttpException('Image provider rate limit reached.', HttpStatus.TOO_MANY_REQUESTS);
    if (!res.ok) throw new BadGatewayException(`Image provider returned HTTP ${res.status}`);

    const json = await res.json() as any;
    const b64 = json.artifacts?.[0]?.base64;
    if (!b64) throw new BadGatewayException('Stability AI returned no image data.');

    return Buffer.from(b64, 'base64');
  }
}
