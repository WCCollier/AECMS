'use client';

import { useCallback } from 'react';
import { TipTapEditor } from '@/components/editor/TipTapEditor';
import { WidgetSizeProvider } from '@/contexts/WidgetSizeContext';
import { getZonesForLayout } from '@/lib/pageContent';
import type { PageLayout, PageContent } from '@/types';

const ZONE_LABELS: Record<keyof PageContent['zones'], string> = {
  main:    'Main Content',
  sidebar: 'Sidebar',
  left:    'Left Panel',
  right:   'Right Panel',
};

const ZONE_HINT: Partial<Record<keyof PageContent['zones'], string>> = {
  sidebar: 'Content here renders in compact (small) widget mode.',
};

interface PageZoneEditorProps {
  layout: PageLayout;
  zones: PageContent['zones'];
  onChange: (zones: PageContent['zones']) => void;
  previewSmall?: boolean;
}

export function PageZoneEditor({ layout, zones, onChange, previewSmall = false }: PageZoneEditorProps) {
  const zoneKeys = getZonesForLayout(layout);

  const handleZoneChange = useCallback((key: keyof PageContent['zones'], value: string) => {
    try {
      const parsed = JSON.parse(value);
      onChange({ ...zones, [key]: parsed });
    } catch {
      onChange({ ...zones, [key]: value });
    }
  }, [zones, onChange]);

  const isMultiZone = zoneKeys.length > 1;

  return (
    <div className={isMultiZone ? 'grid lg:grid-cols-2 gap-6' : 'space-y-6'}>
      {zoneKeys.map((key) => {
        const isSmallZone = key === 'sidebar';
        const editorSize = previewSmall ? 'small' : (isSmallZone ? 'small' : 'large');
        const zoneContent = zones[key];
        const contentStr = zoneContent
          ? (typeof zoneContent === 'string' ? zoneContent : JSON.stringify(zoneContent))
          : '';

        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground/80">{ZONE_LABELS[key]}</h3>
              {isSmallZone && (
                <span className="text-xs bg-foreground/10 text-foreground/60 px-2 py-0.5 rounded-full">
                  Small widgets
                </span>
              )}
            </div>
            {ZONE_HINT[key] && (
              <p className="text-xs text-foreground/50">{ZONE_HINT[key]}</p>
            )}
            <WidgetSizeProvider size={editorSize}>
              <TipTapEditor
                content={contentStr}
                onChange={(val) => handleZoneChange(key, val)}
                placeholder={`Start writing ${ZONE_LABELS[key].toLowerCase()}…`}
              />
            </WidgetSizeProvider>
          </div>
        );
      })}
    </div>
  );
}
