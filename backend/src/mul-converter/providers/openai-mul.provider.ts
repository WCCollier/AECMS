import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import type { MulProvider } from './mul-provider.interface';
import type { PageData, MulResult } from '../mul-converter.types';

export class OpenAIMulProvider implements MulProvider {
  protected readonly logger = new Logger(OpenAIMulProvider.name);
  protected readonly baseUrl: string = 'https://api.openai.com/v1';

  constructor(
    protected readonly apiKey: string,
    protected readonly model: string,
  ) {}

  async analyze(data: PageData, systemPrompt: string): Promise<MulResult> {
    const userMessage = this.buildUserMessage(data);

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    };

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(600_000),
      });
    } catch (err) {
      throw new BadGatewayException('AI provider request failed: ' + err.message);
    }

    if (res.status === 429) throw new HttpException('AI provider rate limit reached.', HttpStatus.TOO_MANY_REQUESTS);
    if (!res.ok) throw new BadGatewayException(`AI provider returned HTTP ${res.status}`);

    const json = await res.json() as any;
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      this.logger.warn('OpenAI response missing content', json);
      throw new UnprocessableEntityException('AI response could not be parsed. Try a recommended model.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new UnprocessableEntityException('AI response is not valid JSON.');
    }

    return this.validateResult(parsed);
  }

  protected buildUserMessage(data: PageData): string {
    const sig = data.animationSignals;
    const sigLines = [
      `fixed-background: ${sig.hasFixedBackground}`,
      `scroll-timeline: ${sig.hasScrollTimeline}`,
      `keyframes: ${sig.hasKeyframes}`,
      `opacity-transition: ${sig.hasOpacityTransition}`,
      `transform-transition: ${sig.hasTransformTransition}`,
      `sticky-elements: ${sig.hasStickyElements}`,
      `high-z-stack: ${sig.hasHighZIndexStack}`,
      sig.libraryFingerprints.length ? `libraries: ${sig.libraryFingerprints.join(', ')}` : null,
      sig.overlayGradients.length ? `overlay-gradients: ${sig.overlayGradients.join(' | ')}` : null,
      sig.motionClassNames.length ? `motion-classes: ${sig.motionClassNames.join(', ')}` : null,
    ].filter(Boolean).join('\n');

    return `Analyze this webpage and produce a palette + page scaffold.

URL: ${data.url}
Title: ${data.title}
Description: ${data.description}

Extracted CSS colors (by frequency):
${data.colors.slice(0, 30).join(', ')}

DOM structure (top elements):
${data.domStructure}

Animation signals (from page CSS/JS):
${sigLines}

${data.imageUrls.length > 0 ? `Source image URLs (for reference mode):
${data.imageUrls.join('\n')}` : ''}`;
  }

  protected validateResult(raw: unknown): MulResult {
    if (typeof raw !== 'object' || raw === null) {
      throw new UnprocessableEntityException('AI response is not a valid object.');
    }
    const r = raw as any;
    if (!r.palette?.colors || !r.page?.sections) {
      throw new UnprocessableEntityException('AI response missing required fields (palette.colors, page.sections).');
    }
    return r as MulResult;
  }
}
