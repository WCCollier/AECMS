export interface AnimationSignals {
  hasFixedBackground: boolean;       // background-attachment: fixed detected in CSS
  hasScrollTimeline: boolean;        // animation-timeline or scroll() detected
  hasKeyframes: boolean;             // @keyframes present
  hasOpacityTransition: boolean;     // transition/animation referencing opacity
  hasTransformTransition: boolean;   // transition/animation referencing transform
  hasStickyElements: boolean;        // position: sticky detected
  hasHighZIndexStack: boolean;       // z-index > 10 on multiple elements (stacked backgrounds)
  libraryFingerprints: string[];     // e.g. ['aos', 'gsap', 'locomotive', 'framer-motion']
  overlayGradients: string[];        // gradient strings extracted from likely overlay elements
  motionClassNames: string[];        // class names: parallax, fade, scroll-reveal, etc.
}

export interface PageData {
  url: string;
  title: string;
  description: string;
  colors: string[];          // top 30 CSS colors by frequency
  domStructure: string;      // lightweight structural summary
  imageUrls: string[];       // candidate source images (og:image, hero imgs)
  ogImage?: string;
  animationSignals: AnimationSignals;
}

export interface MulPalette {
  name: string;
  scheme: string;
  colors: Record<string, string>;
}

export interface MulPage {
  suggestedTitle: string;
  fontImport?: string;
  fontVariables?: { heading?: string; body?: string };
  sections: unknown[];  // SectionsPageContent.sections — stored as JSONB, validated by renderer
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
  imageSourceUrl?: string;
}

export interface MulResult {
  palette: MulPalette;
  page: MulPage;
  imagePromptStyle?: ImagePromptStyle;
  imageBriefs?: Record<string, ImageBrief>;
  metadata: {
    confidence: 'high' | 'medium' | 'low';
    notes: string;
  };
}

export interface MulConfig {
  textProvider: 'anthropic' | 'openai' | 'xai';
  textModel: string;
  textApiKey: string;
  imageProvider?: 'openai' | 'xai' | 'flux' | 'stability';
  imageModel?: string;
  imageApiKey?: string;
  imageReferenceMode?: 'brief-only' | 'reference';
}
