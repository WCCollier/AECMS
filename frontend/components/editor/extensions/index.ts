import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { CalloutNode } from './callout';
import { VideoEmbedNode } from './video-embed';
import { XEmbedNode } from './x-embed';
import { MediaCarouselNode } from './media-carousel';
import { RichTextBoxNode } from './rich-text-box';
import { ArticleEmbedNode } from './article-embed';
import { ProductEmbedNode } from './product-embed';
import { RssEmbedNode } from './rss-embed';
import { SearchResultsEmbedNode } from './search-results-embed';
import { DropCapExtension, EnhancedTextStyle } from './typographic';

export { CalloutNode } from './callout';
export { VideoEmbedNode } from './video-embed';
export { XEmbedNode } from './x-embed';
export { MediaCarouselNode } from './media-carousel';
export { RichTextBoxNode } from './rich-text-box';
export { ArticleEmbedNode } from './article-embed';
export { ProductEmbedNode } from './product-embed';
export { RssEmbedNode } from './rss-embed';
export { SearchResultsEmbedNode } from './search-results-embed';
export { conditionalDisplayAttribute, SHOW_WHEN_OPTIONS, SHOW_WHEN_LABELS } from './conditionalDisplay';
export { DropCapExtension, EnhancedTextStyle } from './typographic';

const TEXT_ALIGN_TYPES = ['heading', 'paragraph'];

const baseExtensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
  TextAlign.configure({ types: TEXT_ALIGN_TYPES, alignments: ['left', 'center', 'right', 'justify'] }),
  EnhancedTextStyle,
  DropCapExtension,
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { class: 'text-accent underline hover:text-accent-hover' },
    // Allow target attribute so "open in new tab" is preserved in the stored JSON
    defaultProtocol: 'https',
  }).extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        target: { default: null, parseHTML: (el) => el.getAttribute('target'), renderHTML: (attrs) => attrs.target ? { target: attrs.target, rel: 'noopener noreferrer' } : {} },
      };
    },
  }),
  Image.configure({
    inline: false,
    allowBase64: false,
    HTMLAttributes: { class: 'rounded-lg max-w-full my-4' },
  }),
  CalloutNode,
  VideoEmbedNode,
  XEmbedNode,
  MediaCarouselNode,
  RichTextBoxNode,
  ArticleEmbedNode,
  ProductEmbedNode,
  RssEmbedNode,
  SearchResultsEmbedNode,
];

/** Extensions for the write editor (links are not click-navigable while editing) */
export function getEditorExtensions() {
  return baseExtensions;
}

/** Extensions for the read-only display (links open on click) */
export function getDisplayExtensions() {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
    TextAlign.configure({ types: TEXT_ALIGN_TYPES, alignments: ['left', 'center', 'right', 'justify'] }),
    EnhancedTextStyle,
    DropCapExtension,
    Link.configure({
      openOnClick: true,
      HTMLAttributes: { class: 'text-accent underline hover:text-accent-hover' },
    }),
    Image.configure({
      inline: false,
      allowBase64: false,
      HTMLAttributes: { class: 'rounded-lg max-w-full my-4' },
    }),
    CalloutNode,
    VideoEmbedNode,
    XEmbedNode,
    MediaCarouselNode,
    RichTextBoxNode,
    ArticleEmbedNode,
    ProductEmbedNode,
    RssEmbedNode,
    SearchResultsEmbedNode,
  ];
}
