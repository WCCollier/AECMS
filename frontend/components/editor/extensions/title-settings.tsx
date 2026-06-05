import React from 'react';

export type TitleCase  = 'default' | 'uppercase';
export type TitleAlign = 'left' | 'center' | 'right';
export type TitleLevel = 'h1' | 'h2' | 'h3' | 'body';

export interface TitleAttrs {
  titleOverride: string;
  titleCase:     TitleCase;
  titleAlign:    TitleAlign;
  titleLevel:    TitleLevel;
  titleHidden:   boolean;
}

/** Drop-in addAttributes() entries for any embed node that supports title settings. */
export const titleAttributeDefaults = {
  titleOverride: {
    default: '',
    parseHTML:  (el: Element) => el.getAttribute('data-title-override') ?? '',
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs.titleOverride ? { 'data-title-override': attrs.titleOverride } : {},
  },
  titleCase: {
    default: 'default' as TitleCase,
    parseHTML:  (el: Element) => (el.getAttribute('data-title-case') ?? 'default') as TitleCase,
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs.titleCase && attrs.titleCase !== 'default' ? { 'data-title-case': attrs.titleCase } : {},
  },
  titleAlign: {
    default: 'left' as TitleAlign,
    parseHTML:  (el: Element) => (el.getAttribute('data-title-align') ?? 'left') as TitleAlign,
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs.titleAlign && attrs.titleAlign !== 'left' ? { 'data-title-align': attrs.titleAlign } : {},
  },
  titleLevel: {
    default: 'h3' as TitleLevel,
    parseHTML:  (el: Element) => (el.getAttribute('data-title-level') ?? 'h3') as TitleLevel,
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs.titleLevel && attrs.titleLevel !== 'h3' ? { 'data-title-level': attrs.titleLevel } : {},
  },
  titleHidden: {
    default: false,
    parseHTML:  (el: Element) => el.getAttribute('data-title-hidden') === 'true',
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs.titleHidden ? { 'data-title-hidden': 'true' } : {},
  },
};

const pill = (active: boolean) =>
  `text-xs px-2 py-0.5 rounded border transition-colors select-none ${
    active
      ? 'bg-foreground/20 border-foreground/40 font-medium'
      : 'border-foreground/15 hover:bg-foreground/10'
  }`;

export function TitleSettingsPanel({
  attrs,
  onUpdate,
  onDone,
}: {
  attrs:    TitleAttrs;
  onUpdate: (updates: Partial<TitleAttrs>) => void;
  onDone:   () => void;
}) {
  return (
    <div className="my-4 p-4 border border-border rounded-lg bg-surface space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">
          Title Settings
        </p>
        <button type="button" onClick={onDone} className="text-xs text-accent hover:underline">
          Done
        </button>
      </div>

      {/* Text override */}
      <div>
        <label className="text-xs text-foreground/50 mb-1 block">Display title</label>
        <input
          type="text"
          value={attrs.titleOverride}
          onChange={(e) => onUpdate({ titleOverride: e.target.value })}
          placeholder="Leave blank to use original title"
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent/40"
        />
      </div>

      {/* Visibility */}
      <div>
        <label className="text-xs text-foreground/50 mb-1 block">Visibility</label>
        <button
          type="button"
          onClick={() => onUpdate({ titleHidden: !attrs.titleHidden })}
          className={pill(attrs.titleHidden)}
        >
          {attrs.titleHidden ? '👁 Hidden' : 'Hide title'}
        </button>
      </div>

      {!attrs.titleHidden && (
        <>
          {/* Case */}
          <div>
            <label className="text-xs text-foreground/50 mb-1 block">Case</label>
            <div className="flex gap-1">
              {(['default', 'uppercase'] as TitleCase[]).map((c) => (
                <button key={c} type="button" onClick={() => onUpdate({ titleCase: c })} className={pill(c === attrs.titleCase)}>
                  {c === 'default' ? 'Normal' : 'ALL CAPS'}
                </button>
              ))}
            </div>
          </div>

          {/* Align */}
          <div>
            <label className="text-xs text-foreground/50 mb-1 block">Align</label>
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as TitleAlign[]).map((a) => (
                <button key={a} type="button" onClick={() => onUpdate({ titleAlign: a })} className={pill(a === attrs.titleAlign)}>
                  {a === 'left' ? '← Left' : a === 'center' ? '↔ Center' : '→ Right'}
                </button>
              ))}
            </div>
          </div>

          {/* Level */}
          <div>
            <label className="text-xs text-foreground/50 mb-1 block">Size</label>
            <div className="flex gap-1">
              {(['h1', 'h2', 'h3', 'body'] as TitleLevel[]).map((l) => (
                <button key={l} type="button" onClick={() => onUpdate({ titleLevel: l })} className={pill(l === attrs.titleLevel)}>
                  {l === 'body' ? 'Body' : l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
