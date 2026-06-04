import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { CalloutNode } from './callout';
import { VideoEmbedNode } from './video-embed';
import { XEmbedNode } from './x-embed';
import { MediaCarouselNode } from './media-carousel';
import { RichTextBoxNode } from './rich-text-box';
import { ArticleEmbedNode } from './article-embed';
import { ProductEmbedNode } from './product-embed';

export { CalloutNode } from './callout';
export { VideoEmbedNode } from './video-embed';
export { XEmbedNode } from './x-embed';
export { MediaCarouselNode } from './media-carousel';
export { RichTextBoxNode } from './rich-text-box';
export { ArticleEmbedNode } from './article-embed';
export { ProductEmbedNode } from './product-embed';
export { conditionalDisplayAttribute, SHOW_WHEN_OPTIONS, SHOW_WHEN_LABELS } from './conditionalDisplay';

const baseExtensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
  Link.configure({
    openOnClick: false,
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
];

/** Extensions for the write editor (links are not click-navigable while editing) */
export function getEditorExtensions() {
  return baseExtensions;
}

/** Extensions for the read-only display (links open on click) */
export function getDisplayExtensions() {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
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
  ];
}
