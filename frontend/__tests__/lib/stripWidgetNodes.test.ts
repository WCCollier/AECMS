import { stripWidgetNodes, extractFirstParagraphText } from '@/lib/stripWidgetNodes';

const paragraph = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

const widget = (type: string) => ({ type });

describe('stripWidgetNodes', () => {
  it('removes known widget node types', () => {
    const doc = {
      type: 'doc',
      content: [
        paragraph('Hello'),
        widget('mediaCarousel'),
        paragraph('World'),
        widget('callout'),
        widget('videoEmbed'),
        widget('xEmbed'),
        widget('articleEmbed'),
        widget('productEmbed'),
        widget('image'),
      ],
    };

    const result = stripWidgetNodes(doc) as { type: string; content: { type: string }[] };
    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toBe('paragraph');
    expect(result.content[1].type).toBe('paragraph');
  });

  it('preserves paragraphs, headings, and lists', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
        paragraph('Body text'),
        { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('Item')] }] },
      ],
    };

    const result = stripWidgetNodes(doc) as { type: string; content: unknown[] };
    expect(result.content).toHaveLength(3);
  });

  it('handles nested content — removes widget inside a blockquote', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            paragraph('quoted'),
            widget('xEmbed'),
          ],
        },
      ],
    };

    const result = stripWidgetNodes(doc) as { content: { type: string; content: unknown[] }[] };
    const blockquote = result.content[0];
    expect(blockquote.content).toHaveLength(1);
  });

  it('handles an empty doc', () => {
    const doc = { type: 'doc', content: [] };
    const result = stripWidgetNodes(doc) as { content: unknown[] };
    expect(result.content).toHaveLength(0);
  });

  it('passes through docs with no content field', () => {
    const doc = { type: 'doc' };
    expect(stripWidgetNodes(doc)).toEqual(doc);
  });
});

describe('extractFirstParagraphText', () => {
  it('returns text of the first paragraph', () => {
    const doc = {
      type: 'doc',
      content: [
        paragraph('First paragraph text'),
        paragraph('Second paragraph'),
      ],
    };
    expect(extractFirstParagraphText(doc)).toBe('First paragraph text');
  });

  it('returns empty string when no paragraphs exist', () => {
    const doc = { type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: 'H1' }] }] };
    expect(extractFirstParagraphText(doc)).toBe('');
  });

  it('returns empty string for empty doc', () => {
    expect(extractFirstParagraphText({ type: 'doc', content: [] })).toBe('');
  });

  it('joins multiple text nodes in a paragraph', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world' },
        ],
      }],
    };
    expect(extractFirstParagraphText(doc)).toBe('Hello world');
  });
});
