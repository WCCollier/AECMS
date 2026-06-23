import { Extension } from '@tiptap/core';
import { TextStyle } from '@tiptap/extension-text-style';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dropCap: {
      toggleDropCap: () => ReturnType;
    };
  }
}

/**
 * DropCap — paragraph-level attribute.
 * When dropCap: true, the paragraph gets class "drop-cap" and CSS applies
 * an enlarged first-letter via ::first-letter pseudo-element.
 */
export const DropCapExtension = Extension.create({
  name: 'dropCap',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          dropCap: {
            default: false,
            parseHTML: (el: HTMLElement) => el.classList.contains('drop-cap'),
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs['dropCap'] ? { class: 'drop-cap' } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      toggleDropCap:
        () =>
        // eslint-disable-next-line
        ({ commands, editor }: { commands: any; editor: any }) => {
          const isActive = editor.isActive({ dropCap: true });
          return commands.updateAttributes('paragraph', { dropCap: !isActive });
        },
    };
  },
});

/**
 * EnhancedTextStyle — extends @tiptap/extension-text-style with
 * textTransform and letterSpacing attributes for editorial label styling.
 *
 * Usage in marks array:
 *   { "type": "textStyle", "attrs": { "textTransform": "uppercase", "letterSpacing": "wide" } }
 */
export const EnhancedTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      textTransform: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          el.style.textTransform || el.dataset['textTransform'] || null,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs['textTransform']
            ? {
                style: `text-transform: ${attrs['textTransform']}`,
                'data-text-transform': attrs['textTransform'],
              }
            : {},
      },
      letterSpacing: {
        default: null,
        parseHTML: (el: HTMLElement) => el.dataset['letterSpacing'] || null,
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs['letterSpacing']) return {};
          const map: Record<string, string> = {
            tight:  '-0.04em',
            normal: '0',
            wide:   '0.08em',
            wider:  '0.16em',
          };
          const key = attrs['letterSpacing'] as string;
          const value = map[key] ?? key;
          return {
            style: `letter-spacing: ${value}`,
            'data-letter-spacing': attrs['letterSpacing'],
          };
        },
      },
    };
  },
});
