export type ShowWhen = 'always' | 'logged_in' | 'logged_out';

export const SHOW_WHEN_OPTIONS: ShowWhen[] = ['always', 'logged_in', 'logged_out'];

export const SHOW_WHEN_LABELS: Record<ShowWhen, string> = {
  always:     'Always',
  logged_in:  'Members only',
  logged_out: 'Guests only',
};

/** Mixin for TipTap node addAttributes() — adds show_when to any widget node. */
export const conditionalDisplayAttribute = {
  show_when: {
    default: 'always' as ShowWhen,
    parseHTML: (el: Element) => (el.getAttribute('data-show-when') ?? 'always') as ShowWhen,
    renderHTML: (attrs: Record<string, unknown>) => ({ 'data-show-when': attrs.show_when }),
  },
};

/** Badge text for the editor overlay when show_when !== 'always'. */
export function showWhenBadge(showWhen: ShowWhen): string | null {
  if (showWhen === 'always') return null;
  return SHOW_WHEN_LABELS[showWhen];
}
