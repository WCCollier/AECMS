import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Filter = require('bad-words');

export interface ModerationResult {
  flagged: boolean;
  flags: string[];
  profanityDetected: boolean;
  categories: {
    hate: boolean;
    'hate/threatening': boolean;
    harassment: boolean;
    'harassment/threatening': boolean;
    'self-harm': boolean;
    'self-harm/intent': boolean;
    'self-harm/instructions': boolean;
    sexual: boolean;
    'sexual/minors': boolean;
    violence: boolean;
    'violence/graphic': boolean;
  } | null;
  testMode: boolean;
}

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);
  private readonly openai: OpenAI | null;
  private readonly profanityFilter: any;
  private readonly testMode: boolean;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      this.testMode = false;
      this.logger.log('OpenAI Moderation API initialized');
    } else {
      this.openai = null;
      this.testMode = true;
      this.logger.warn(
        'OPENAI_API_KEY not configured - running in test mode (profanity filter only)',
      );
    }

    // Initialize profanity filter
    this.profanityFilter = new Filter();

    // Add custom bad words if needed
    // this.profanityFilter.addWords('customword1', 'customword2');
  }

  /**
   * Check if running in test mode (no OpenAI API key)
   */
  isTestMode(): boolean {
    return this.testMode;
  }

  /**
   * Moderate text content
   * Returns moderation result with flags and categories
   */
  async moderate(text: string): Promise<ModerationResult> {
    const flags: string[] = [];
    let openaiCategories = null;
    let openaiResult: OpenAI.Moderations.ModerationCreateResponse | null = null;

    // 1. Check profanity with bad-words filter
    const profanityDetected = this.profanityFilter.isProfane(text);
    if (profanityDetected) {
      flags.push('profanity');
      this.logger.debug('Profanity detected in content');
    }

    // 2. Check with OpenAI Moderation API (if available)
    if (this.openai) {
      try {
        openaiResult = await this.openai.moderations.create({
          input: text,
        });

        const result = openaiResult.results[0];
        openaiCategories = result.categories;

        // Map flagged categories to flags array
        if (result.flagged) {
          const categoryNames = Object.entries(result.categories)
            .filter(([_, flagged]) => flagged)
            .map(([name]) => name);

          flags.push(...categoryNames);
          this.logger.debug(`OpenAI flagged categories: ${categoryNames.join(', ')}`);
        }
      } catch (error) {
        this.logger.error('OpenAI Moderation API error:', error);
        // Continue with profanity filter result only
      }
    }

    const flagged = flags.length > 0;

    return {
      flagged,
      flags,
      profanityDetected,
      categories: openaiCategories,
      testMode: this.testMode,
    };
  }

  /**
   * Clean profanity from text (replace with asterisks)
   */
  cleanProfanity(text: string): string {
    return this.profanityFilter.clean(text);
  }

  /**
   * Check if text contains profanity
   */
  hasProfanity(text: string): boolean {
    return this.profanityFilter.isProfane(text);
  }

  /**
   * Moderate content and return simplified boolean result
   */
  async shouldFlag(text: string): Promise<boolean> {
    const result = await this.moderate(text);
    return result.flagged;
  }

  /**
   * Get moderation categories explanation
   */
  getCategoryDescriptions(): Record<string, string> {
    return {
      hate: 'Content that expresses hate toward a group',
      'hate/threatening': 'Hateful content with violence or serious harm',
      harassment: 'Content promoting harassment of any individual',
      'harassment/threatening': 'Harassment with violence or serious harm',
      'self-harm': 'Content promoting self-harm',
      'self-harm/intent': 'Content expressing intent to self-harm',
      'self-harm/instructions': 'Instructions for self-harm',
      sexual: 'Sexual content',
      'sexual/minors': 'Sexual content involving minors',
      violence: 'Content depicting violence',
      'violence/graphic': 'Graphic violence content',
      profanity: 'Contains profane language',
    };
  }
}
