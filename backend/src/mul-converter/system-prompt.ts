import type { MulConfig } from './mul-converter.types';
import { ROLE_PROMPT } from './prompts/01-role.prompt';
import { PALETTE_SCHEMA_PROMPT } from './prompts/02-palette-schema.prompt';
import { PAGE_SCHEMA_PROMPT } from './prompts/03-page-schema.prompt';
import { AESTHETIC_TOOLS_PROMPT } from './prompts/04-aesthetic-tools.prompt';
import { SIGNAL_MAPPING_PROMPT } from './prompts/05-signal-mapping.prompt';

export function buildSystemPrompt(
  config: Pick<MulConfig, 'imageProvider' | 'imageModel' | 'imageReferenceMode'>,
  nativeMode = false,
): string {
  const hasImages = Boolean(config.imageProvider);
  const referenceMode = config.imageReferenceMode === 'reference';

  return `You are a design analysis assistant for AECMS, a content management system.

${ROLE_PROMPT}

${PALETTE_SCHEMA_PROMPT}

${PAGE_SCHEMA_PROMPT}

${AESTHETIC_TOOLS_PROMPT}

${SIGNAL_MAPPING_PROMPT}

[SECTION 4 — Output format]
Return ONLY a valid JSON object matching this schema. No prose, no markdown, no code fences.

{
  "palette": {
    "name": string,
    "scheme": string,
    "colors": {
      "background": string, "surface": string, "surface-raised": string,
      "foreground": string, "muted": string, "border": string,
      "accent": string, "accent-hover": string, "accent-dim": string, "accent-foreground": string
    }
  },
  "page": {
    "suggestedTitle": string,
    "fontImport": string | null,
    "fontVariables": { "heading": string | null, "body": string | null } | null,
    "sections": [
      {
        "id": string,
        "columns": number,
        "minHeight": string | null,
        "padding": "none" | "compact" | "normal" | "spacious" | null,
        "background": {
          "type": "none" | "color" | "gradient" | "image",
          "value": string | null,
          "mode": "traditional" | "animated",
          "imageSize": "cover" | "fit-width" | null,
          "movement": "fixed" | "parallax" | null,
          "exit": "none" | "fade" | "wipe-v" | "wipe-left" | "wipe-right" | "slide-up" | null,
          "overlay": { "color": string, "opacity": number, "gradient": string | null } | null
        } | null,
        "zones": [
          {
            "id": string,
            "span": number,
            "scheme": "inherit" | "light" | "dark" | null,
            "content": { "type": "doc", "content": array }
          }
        ]
      }
    ]
  },${hasImages ? `
  "imagePromptStyle": {
    "model": string,
    "approach": string,
    "exampleFormat": string
  },
  "imageBriefs": {
    "<section-or-zone-id>": {
      "prompt": string,
      "aspectRatio": string,
      "style": "photorealistic" | "illustration" | "abstract",
      "imageSourceUrl": ${referenceMode ? 'string | null' : 'null'}
    }
  },` : ''}
  "metadata": {
    "confidence": "high" | "medium" | "low",
    "notes": string
  }
}

Output format rules:
  — mode "traditional": set imageSize if applicable; set movement and exit to null.
  — mode "animated": set both movement and exit explicitly; set imageSize to null.
  — type "none": set mode "traditional", movement null, exit null, imageSize null, overlay null.
  — value field: hex string for type "color"; CSS gradient for type "gradient"; "media://placeholder" for type "image"; null for type "none".
${hasImages ? `
[SECTION 5 — Image brief optimization]
Before writing any imageBriefs, emit an "imagePromptStyle" field. In it:
  1. State the image model name: "${config.imageModel ?? 'unknown'}"
  2. Describe how that model responds best to prompts — vocabulary, syntax, ordering, what to emphasize, what to avoid. Draw on your knowledge of this model.
  3. Provide one concrete example of the prompt format you will use.

Apply that declared style consistently to all prompts in the "imageBriefs" field.

If the model name is unfamiliar to you, note this explicitly in "approach" and fall back to universal best practices: subject-first descriptions, clear style declaration, explicit lighting and mood descriptors, technical specs as trailing descriptors. Aspect ratio is always a separate structured field — never embed it in the prompt string.

Write an imageBrief for every section that uses background.type === "image". ${referenceMode ? 'Reference mode is ENABLED: populate imageSourceUrl from the source page image URLs when available.' : 'Reference mode is disabled: always set imageSourceUrl to null.'}
` : ''}${nativeMode ? `
[SECTION 6 — Native image generation]
After emitting the complete JSON response, call the image_generation tool exactly once for each section that has background.type === "image", in the same order those sections appear in the sections array. Use the prompt from the corresponding imageBriefs entry for each call. Do not emit any text between image_generation calls.
` : ''}`;
}
