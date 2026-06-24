export interface MulPalette {
  name: string;
  scheme: string;
  colors: Record<string, string>;
}

export interface ImagePromptStyle {
  model: string;
  approach: string;
  exampleFormat: string;
}

export interface ImageBrief {
  prompt: string;
  aspectRatio: string;
  style: 'photorealistic' | 'illustration' | 'abstract';
  imageSourceUrl?: string | null;
}

export interface MulResult {
  palette: MulPalette;
  page: {
    suggestedTitle: string;
    fontImport?: string | null;
    fontVariables?: { heading?: string | null; body?: string | null } | null;
    sections: unknown[];
  };
  imagePromptStyle?: ImagePromptStyle;
  imageBriefs?: Record<string, ImageBrief>;
  metadata: {
    confidence: 'high' | 'medium' | 'low';
    notes: string;
  };
}

export interface MulSettings {
  'mul.text_provider': string;
  'mul.text_model': string;
  'mul.anthropic_api_key_enc': string;
  'mul.openai_api_key_enc': string;
  'mul.xai_api_key_enc': string;
  'mul.image_provider': string;
  'mul.image_model': string;
  'mul.fal_api_key_enc': string;
  'mul.stability_api_key_enc': string;
  'mul.image_reference_mode': string;
}
