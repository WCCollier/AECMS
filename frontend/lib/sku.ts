const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'for', 'in', 'to', 'with', 'by', 'at']);

const TYPE_PREFIX: Record<string, string> = {
  physical: 'P',
  digital: 'D',
  service: 'S',
};

/**
 * Derives a SKU from a product slug and type.
 *
 * Scheme: TYPE-WORD-WORD-WORD
 *   TYPE  = P | D | S (physical / digital / service)
 *   WORDs = up to 3 significant slug segments, each truncated to 4 chars, uppercased
 *
 * Examples:
 *   "american-shooter-hat"  + physical → "P-AMER-SHOO-HAT"
 *   "how-writing-works"     + digital  → "D-HOW-WRIT-WORK"
 *   "lesson-1-marksmanship" + service  → "S-LESS-1-MA"
 */
export function slugToSku(slug: string, type: string): string {
  const prefix = TYPE_PREFIX[type] ?? 'X';

  const parts = slug
    .toLowerCase()
    .split('-')
    .filter((p) => p.length > 0 && !STOP_WORDS.has(p))
    .slice(0, 3)
    .map((p) => p.slice(0, 4).toUpperCase());

  if (parts.length === 0) return prefix;
  return `${prefix}-${parts.join('-')}`;
}
