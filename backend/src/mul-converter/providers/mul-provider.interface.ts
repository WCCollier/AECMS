import type { PageData, MulResult } from '../mul-converter.types';

export interface MulProvider {
  analyze(data: PageData, systemPrompt: string): Promise<MulResult>;
}
