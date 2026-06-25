import { BadGatewayException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ImageProvider } from './image-provider.interface';
import type { ImageBrief } from '../mul-converter.types';

const MODEL_APP_MAP: Record<string, string> = {
  'flux-schnell':      'fal-ai/flux/schnell',
  'flux-dev':          'fal-ai/flux/dev',
  'flux-kontext-pro':  'fal-ai/flux-pro/kontext',
  'flux-pro':          'fal-ai/flux-pro',
};

function toFalApp(model: string): string {
  return MODEL_APP_MAP[model] ?? model;
}

function toFalAspect(ratio: string): string {
  const MAP: Record<string, string> = {
    '1:1':  'square',
    '16:9': 'landscape_16_9',
    '9:16': 'portrait_16_9',
    '4:3':  'landscape_4_3',
    '3:4':  'portrait_4_3',
    '3:2':  'landscape_16_9',
  };
  return MAP[ratio] ?? 'landscape_16_9';
}

export class FluxProvider implements ImageProvider {
  private readonly logger = new Logger(FluxProvider.name);

  constructor(private readonly apiKey: string, private readonly model = 'flux-kontext-pro') {}

  async generate(brief: ImageBrief): Promise<Buffer> {
    const app = toFalApp(this.model);
    const isKontext = app.includes('kontext');

    const input: Record<string, unknown> = {
      prompt: brief.prompt,
      image_size: toFalAspect(brief.aspectRatio),
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
    };

    if (isKontext && brief.imageSourceUrl) {
      input.image_url = brief.imageSourceUrl;
    }

    // Submit request
    let submitRes: Response;
    try {
      submitRes = await fetch(`https://queue.fal.run/${app}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${this.apiKey}`,
        },
        body: JSON.stringify({ input }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      throw new BadGatewayException('Image provider request failed: ' + err.message);
    }

    if (submitRes.status === 429) throw new HttpException('Image provider rate limit reached.', HttpStatus.TOO_MANY_REQUESTS);
    if (!submitRes.ok) throw new BadGatewayException(`Image provider returned HTTP ${submitRes.status}`);

    const { request_id } = await submitRes.json() as { request_id: string };

    // Poll for result (up to 8 minutes)
    const start = Date.now();
    while (Date.now() - start < 480_000) {
      await new Promise((r) => setTimeout(r, 3000));

      const pollRes = await fetch(`https://queue.fal.run/${app}/requests/${request_id}`, {
        headers: { Authorization: `Key ${this.apiKey}` },
        signal: AbortSignal.timeout(30_000),
      });

      if (!pollRes.ok) continue;
      const result = await pollRes.json() as any;

      if (result.status === 'COMPLETED') {
        const imageUrl = result.output?.images?.[0]?.url;
        if (!imageUrl) throw new BadGatewayException('FLUX returned no image URL.');
        return this.downloadImage(imageUrl);
      }
      if (result.status === 'FAILED') {
        throw new BadGatewayException('FLUX image generation failed: ' + (result.error ?? 'unknown'));
      }
    }

    throw new BadGatewayException('FLUX image generation timed out after 8 minutes.');
  }

  private async downloadImage(url: string): Promise<Buffer> {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new BadGatewayException('Failed to download FLUX image.');
    return Buffer.from(await res.arrayBuffer());
  }
}
