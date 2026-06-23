import {
  BadRequestException,
  Injectable,
  Logger,
  RequestTimeoutException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { MediaService } from '../media/media.service';
import { extractPageData } from './html-extractor';
import { buildSystemPrompt } from './system-prompt';
import { AnthropicMulProvider } from './providers/anthropic-mul.provider';
import { OpenAIMulProvider } from './providers/openai-mul.provider';
import { XAIMulProvider } from './providers/xai-mul.provider';
import { GptImage1Provider } from './image-providers/gpt-image1.provider';
import { FluxProvider } from './image-providers/flux.provider';
import { StabilityProvider } from './image-providers/stability.provider';
import type { MulProvider } from './providers/mul-provider.interface';
import type { ImageProvider } from './image-providers/image-provider.interface';
import type { MulConfig, MulResult } from './mul-converter.types';

const MAX_HTML_BYTES = 2 * 1024 * 1024; // 2 MB
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1|fd[0-9a-f]{2}:|fc|169\.254\.)/i;

function isPrivateIp(hostname: string): boolean {
  return PRIVATE_IP_RE.test(hostname);
}

function validateTargetUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestException('Invalid URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('URL must use http or https.');
  }
  if (isPrivateIp(parsed.hostname)) {
    throw new BadRequestException('This URL points to a private or restricted address and cannot be analyzed.');
  }
  return parsed;
}

@Injectable()
export class MulConverterService {
  private readonly logger = new Logger(MulConverterService.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly mediaService: MediaService,
  ) {}

  async getSettings(): Promise<Record<string, string>> {
    const keys = [
      'mul.text_provider',
      'mul.text_model',
      'mul.anthropic_api_key_enc',
      'mul.openai_api_key_enc',
      'mul.xai_api_key_enc',
      'mul.image_provider',
      'mul.image_model',
      'mul.fal_api_key_enc',
      'mul.stability_api_key_enc',
      'mul.image_reference_mode',
    ];

    const all = await this.settings.getAll();
    const result: Record<string, string> = {};
    for (const k of keys) {
      result[k] = all[k] ?? '';
    }
    return result;
  }

  async saveSettings(updates: Record<string, string>, userId: string): Promise<void> {
    const allowed = Object.fromEntries(
      Object.entries(updates).filter(([k]) => k.startsWith('mul.')),
    );
    await this.settings.set(allowed, userId);
  }

  async analyze(url: string, userId: string): Promise<MulResult> {
    const parsed = validateTargetUrl(url);

    const html = await this.fetchHtml(parsed.toString());
    const pageData = extractPageData(url, html);

    const config = await this.loadConfig();
    const systemPrompt = buildSystemPrompt(config);

    const textProvider = this.buildTextProvider(config);
    const result = await textProvider.analyze(pageData, systemPrompt);

    if (config.imageProvider && result.imageBriefs) {
      const imageProvider = this.buildImageProvider(config);
      if (imageProvider) {
        await this.generateAndAttachImages(result, imageProvider, userId);
      }
    }

    return result;
  }

  private async fetchHtml(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AECMS/1.0; +https://github.com/WCCollier/AECMS)',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new RequestTimeoutException('The target page took too long to respond.');
      }
      throw new BadRequestException('Failed to fetch URL: ' + err.message);
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new BadRequestException(`Target page returned HTTP ${res.status}.`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) {
      throw new BadRequestException('Target URL does not return an HTML page.');
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_HTML_BYTES) {
      throw new PayloadTooLargeException('The page is too large to analyze (limit: 2 MB of HTML).');
    }

    // Stream with size limit
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const reader = res.body?.getReader();
    if (!reader) throw new BadRequestException('Could not read response body.');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_HTML_BYTES) {
        reader.cancel();
        throw new PayloadTooLargeException('The page is too large to analyze (limit: 2 MB of HTML).');
      }
      chunks.push(value);
    }

    return Buffer.concat(chunks).toString('utf-8');
  }

  private async loadConfig(): Promise<MulConfig> {
    const [
      textProvider,
      textModel,
      anthropicKey,
      openaiKey,
      xaiKey,
      imageProvider,
      imageModel,
      falKey,
      stabilityKey,
      imageReferenceMode,
    ] = await Promise.all([
      this.settings.getEffective('mul.text_provider'),
      this.settings.getEffective('mul.text_model'),
      this.settings.getEffective('mul.anthropic_api_key_enc'),
      this.settings.getEffective('mul.openai_api_key_enc'),
      this.settings.getEffective('mul.xai_api_key_enc'),
      this.settings.getEffective('mul.image_provider'),
      this.settings.getEffective('mul.image_model'),
      this.settings.getEffective('mul.fal_api_key_enc'),
      this.settings.getEffective('mul.stability_api_key_enc'),
      this.settings.getEffective('mul.image_reference_mode'),
    ]);

    const provider = (textProvider || 'anthropic') as MulConfig['textProvider'];
    const apiKey = provider === 'openai' ? openaiKey
      : provider === 'xai' ? xaiKey
      : anthropicKey || process.env.ANTHROPIC_API_KEY || '';

    const imgProvider = (imageProvider || '') as MulConfig['imageProvider'] | '' | 'disabled';
    const imgApiKey = imgProvider === 'openai' ? openaiKey
      : imgProvider === 'flux' ? falKey
      : imgProvider === 'stability' ? stabilityKey
      : '';

    return {
      textProvider: provider,
      textModel: textModel || this.defaultModel(provider),
      textApiKey: apiKey,
      imageProvider: (imgProvider && imgProvider !== 'disabled') ? imgProvider as MulConfig['imageProvider'] : undefined,
      imageModel: imageModel || undefined,
      imageApiKey: imgApiKey || undefined,
      imageReferenceMode: (imageReferenceMode as MulConfig['imageReferenceMode']) || 'brief-only',
    };
  }

  private defaultModel(provider: string): string {
    if (provider === 'openai') return 'gpt-4o';
    if (provider === 'xai') return 'grok-4';
    return 'claude-sonnet-4-6';
  }

  private buildTextProvider(config: MulConfig): MulProvider {
    switch (config.textProvider) {
      case 'openai': return new OpenAIMulProvider(config.textApiKey, config.textModel);
      case 'xai':    return new XAIMulProvider(config.textApiKey, config.textModel);
      default:       return new AnthropicMulProvider(config.textApiKey, config.textModel);
    }
  }

  private buildImageProvider(config: MulConfig): ImageProvider | null {
    if (!config.imageProvider || !config.imageApiKey) return null;
    switch (config.imageProvider) {
      case 'openai':    return new GptImage1Provider(config.imageApiKey, config.imageModel);
      case 'flux':      return new FluxProvider(config.imageApiKey, config.imageModel);
      case 'stability': return new StabilityProvider(config.imageApiKey, config.imageModel);
      default:          return null;
    }
  }

  private async generateAndAttachImages(
    result: MulResult,
    imageProvider: ImageProvider,
    userId: string,
  ): Promise<void> {
    if (!result.imageBriefs) return;

    for (const [id, brief] of Object.entries(result.imageBriefs)) {
      try {
        const buffer = await imageProvider.generate(brief);

        const mockFile: Express.Multer.File = {
          fieldname: 'file',
          originalname: `mul-generated-${id}.png`,
          encoding: '7bit',
          mimetype: 'image/png',
          buffer,
          size: buffer.byteLength,
          stream: null as any,
          destination: '',
          filename: '',
          path: '',
        };

        const media = await this.mediaService.upload(
          mockFile,
          userId,
          brief.prompt.slice(0, 120),
          undefined,
        );

        // Replace "media://placeholder" with real uuid in sections
        this.replaceMediaPlaceholder(result, id, media.id);
      } catch (err) {
        this.logger.warn(`Image generation failed for brief "${id}": ${err.message}`);
        // Non-fatal: leave placeholder in place; user can fill manually
      }
    }
  }

  private replaceMediaPlaceholder(result: MulResult, briefId: string, mediaId: string): void {
    const sections = result.page.sections as any[];
    for (const section of sections) {
      if (
        section.id === briefId &&
        section.background?.type === 'image' &&
        section.background?.value === 'media://placeholder'
      ) {
        section.background.value = `media://${mediaId}`;
        return;
      }
      // Also check zone ids (for zone-level image backgrounds — future use)
      if (section.zones) {
        for (const zone of section.zones) {
          if (
            zone.id === briefId &&
            zone.background?.type === 'image' &&
            zone.background?.value === 'media://placeholder'
          ) {
            zone.background.value = `media://${mediaId}`;
            return;
          }
        }
      }
    }
  }
}
