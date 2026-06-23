import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import type { MulProvider } from './mul-provider.interface';
import type { PageData, MulResult } from '../mul-converter.types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export class AnthropicMulProvider implements MulProvider {
  private readonly logger = new Logger(AnthropicMulProvider.name);

  constructor(private readonly apiKey: string, private readonly model: string) {}

  async analyze(data: PageData, systemPrompt: string): Promise<MulResult> {
    const userMessage = this.buildUserMessage(data);

    const body = {
      model: this.model,
      max_tokens: 8192,
      system: systemPrompt,
      tools: [
        {
          name: 'emit_result',
          description: 'Emit the structured analysis result',
          input_schema: { type: 'object', properties: {}, additionalProperties: true },
        },
      ],
      tool_choice: { type: 'tool', name: 'emit_result' },
      messages: [{ role: 'user', content: userMessage }],
    };

    let res: Response;
    try {
      res = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (err) {
      throw new BadGatewayException('AI provider request failed: ' + err.message);
    }

    if (res.status === 429) throw new HttpException('AI provider rate limit reached.', HttpStatus.TOO_MANY_REQUESTS);
    if (!res.ok) throw new BadGatewayException(`AI provider returned HTTP ${res.status}`);

    const json = await res.json() as any;

    const toolUse = json.content?.find((c: any) => c.type === 'tool_use' && c.name === 'emit_result');
    if (!toolUse?.input) {
      this.logger.warn('Anthropic response missing tool_use block', json);
      throw new UnprocessableEntityException('AI response could not be parsed. Try a recommended model.');
    }

    return this.validateResult(toolUse.input);
  }

  private buildUserMessage(data: PageData): string {
    return `Analyze this webpage and produce a palette + page scaffold.

URL: ${data.url}
Title: ${data.title}
Description: ${data.description}

Extracted CSS colors (by frequency):
${data.colors.slice(0, 30).join(', ')}

DOM structure (top elements):
${data.domStructure}

${data.imageUrls.length > 0 ? `Source image URLs (for reference mode):
${data.imageUrls.join('\n')}` : ''}`;
  }

  private validateResult(raw: unknown): MulResult {
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
