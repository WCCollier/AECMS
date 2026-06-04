import { slugToSku } from '@/lib/sku';

describe('slugToSku', () => {
  it('produces correct prefix per product type', () => {
    expect(slugToSku('test-item', 'physical')).toMatch(/^P-/);
    expect(slugToSku('test-item', 'digital')).toMatch(/^D-/);
    expect(slugToSku('test-item', 'service')).toMatch(/^S-/);
  });

  it('takes up to three significant words from the slug', () => {
    expect(slugToSku('american-shooter-hat', 'physical')).toBe('P-AMER-SHOO-HAT');
  });

  it('strips stop words before selecting words', () => {
    // "for" and "the" are stop words
    expect(slugToSku('guide-for-the-beginner', 'digital')).toBe('D-GUID-BEGI');
  });

  it('truncates each word to 4 characters', () => {
    expect(slugToSku('marksmanship-fundamentals-course', 'service')).toBe('S-MARK-FUND-COUR');
  });

  it('uppercases all output', () => {
    const result = slugToSku('some-product-name', 'physical');
    expect(result).toBe(result.toUpperCase());
  });

  it('handles slugs shorter than three segments', () => {
    expect(slugToSku('hat', 'physical')).toBe('P-HAT');
    expect(slugToSku('my-hat', 'physical')).toBe('P-MY-HAT');
  });

  it('handles slug with only stop words gracefully', () => {
    const result = slugToSku('a-the-or', 'service');
    // All stop words are stripped — result is just the prefix
    expect(result).toBe('S');
  });

  it('uses known examples from PRD', () => {
    expect(slugToSku('american-shooter-hat', 'physical')).toBe('P-AMER-SHOO-HAT');
    expect(slugToSku('how-writing-works', 'digital')).toBe('D-HOW-WRIT-WORK');
    expect(slugToSku('american-shooter-safe-gun-ownership', 'service')).toBe('S-AMER-SHOO-SAFE');
  });

  it('falls back to X prefix for unknown type', () => {
    expect(slugToSku('some-item', 'unknown')).toMatch(/^X-/);
  });
});
