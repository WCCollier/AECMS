import type { ImageBrief } from '../mul-converter.types';

export interface ImageProvider {
  generate(brief: ImageBrief): Promise<Buffer>;
}
