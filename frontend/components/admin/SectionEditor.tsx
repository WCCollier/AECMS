'use client';

import { useRef, useState } from 'react';
import { GripVertical, Plus, Trash2, CopyPlus, Layers } from 'lucide-react';
import { TipTapEditor } from '@/components/editor/TipTapEditor';
import { WidgetSizeProvider } from '@/contexts/WidgetSizeContext';
import { SectionBackgroundPanel } from '@/components/admin/SectionBackgroundPanel';
import type { PageSection, PageZone, SectionBackground } from '@/types';

// ── Template definitions ───────────────────────────────────────────────────────

interface TemplateSpec {
  name: string;
  columns: number;
  zones: { span: number }[];
}

const TEMPLATES: TemplateSpec[] = [
  { name: 'Full Width',         columns: 1, zones: [{ span: 1 }] },
  { name: 'Half / Half',        columns: 2, zones: [{ span: 1 }, { span: 1 }] },
  { name: 'Two-thirds / Third', columns: 3, zones: [{ span: 2 }, { span: 1 }] },
  { name: 'Third / Two-thirds', columns: 3, zones: [{ span: 1 }, { span: 2 }] },
  { name: 'Three Equal',        columns: 3, zones: [{ span: 1 }, { span: 1 }, { span: 1 }] },
  { name: 'Feature Centre',     columns: 4, zones: [{ span: 1 }, { span: 2 }, { span: 1 }] },
  { name: 'Four Equal',         columns: 4, zones: [{ span: 1 }, { span: 1 }, { span: 1 }, { span: 1 }] },
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

function zoneHasContent(zone: PageZone): boolean {
  const c = zone.content as { content?: unknown[] };
  return Array.isArray(c?.content) && c.content.length > 0;
}

function sectionHasContent(section: PageSection): boolean {
  return section.zones.some(zoneHasContent);
}

function getTemplateName(section: PageSection): string {
  const match = TEMPLATES.find(
    t =>
      t.columns === section.columns &&
      t.zones.length === section.zones.length &&
      t.zones.every((z, i) => z.span === section.zones[i].span),
  );
  return match?.name ?? 'Custom';
}

// ── Template icon ──────────────────────────────────────────────────────────────

function TemplateIcon({ template }: { template: TemplateSpec }) {
  return (
    <div className="flex gap-0.5 w-14 h-3.5">
      {template.zones.map((z, i) => (
        <div key={i} className="bg-current rounded-sm opacity-40" style={{ flex: z.span }} />
      ))}
    </div>
  );
}

// ── Span Diagram ───────────────────────────────────────────────────────────────

interface SpanDiagramProps {
  section: PageSection;
  onUpdate: (s: PageSection) => void;
}

function SpanDiagram({ section, onUpdate }: SpanDiagramProps) {
  const diagramRef = useRef<HTMLDivElement>(null);
  const gutterDrag = useRef<{
    idx: number;
    startX: number;
    startLeftSpan: number;
    available: number;
  } | null>(null);
  const [hoveredZone, setHoveredZone] = useState<number | null>(null);

  function handleGutterPointerDown(e: React.PointerEvent<HTMLDivElement>, idx: number) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    gutterDrag.current = {
      idx,
      startX: e.clientX,
      startLeftSpan: section.zones[idx].span,
      available: section.zones[idx].span + section.zones[idx + 1].span,
    };
  }

  function handleGutterPointerMove(e: React.PointerEvent<HTMLDivElement>, idx: number) {
    const drag = gutterDrag.current;
    if (!drag || drag.idx !== idx || !diagramRef.current) return;
    const unitWidth = diagramRef.current.clientWidth / section.columns;
    const deltaSpan = Math.round((e.clientX - drag.startX) / unitWidth);
    if (deltaSpan === 0) return;
    const newLeft = Math.max(1, Math.min(drag.available - 1, drag.startLeftSpan + deltaSpan));
    const newRight = drag.available - newLeft;
    onUpdate({
      ...section,
      zones: section.zones.map((z, i) =>
        i === idx ? { ...z, span: newLeft } : i === idx + 1 ? { ...z, span: newRight } : z,
      ),
    });
  }

  function handleRemoveZone(idx: number) {
    if (section.zones.length <= 1) return;
    if (zoneHasContent(section.zones[idx]) && !window.confirm('Remove this zone? Content will be lost.')) return;
    const absorb = section.zones[idx].span;
    const newZones = section.zones.filter((_, i) => i !== idx);
    const neighborIdx = idx < newZones.length ? idx : idx - 1;
    onUpdate({
      ...section,
      zones: newZones.map((z, i) => (i === neighborIdx ? { ...z, span: z.span + absorb } : z)),
    });
  }

  return (
    <div className="flex-1 min-w-0 select-none flex flex-col gap-0.5">
      {/* Column ruler — one cell per column unit, aligned to the zone blocks below */}
      <div className="flex h-2">
        {Array.from({ length: section.columns }).map((_, i) => (
          <div
            key={i}
            className="flex-1 flex items-center justify-center border-l border-foreground/20 last:border-r"
          >
            <span className="text-[7px] text-foreground/30 leading-none">{i + 1}</span>
          </div>
        ))}
      </div>

      {/* Zone blocks — ref here so gutter drag clientWidth matches the ruler width */}
      <div ref={diagramRef} className="relative flex h-7 gap-0">
        {section.zones.map((zone, i) => (
          <div
            key={zone.id}
            onMouseEnter={() => setHoveredZone(i)}
            onMouseLeave={() => setHoveredZone(null)}
            className="relative flex items-center justify-center bg-foreground/10 border border-foreground/20 rounded text-xs text-foreground/50 transition-colors hover:bg-foreground/15"
            style={{ flex: zone.span, minWidth: 0 }}
          >
            <span>{zone.span}</span>

            {section.zones.length > 1 && hoveredZone === i && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemoveZone(i); }}
                className="absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-red-500/80 text-white text-[9px] leading-none hover:bg-red-600"
                title="Remove zone — its columns merge into the adjacent zone"
              >×</button>
            )}

            {i < section.zones.length - 1 && (
              <div
                className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize z-10 translate-x-1/2 flex items-center justify-center hover:bg-accent/20 rounded"
                onPointerDown={(e) => handleGutterPointerDown(e, i)}
                onPointerMove={(e) => handleGutterPointerMove(e, i)}
                onPointerUp={() => { gutterDrag.current = null; }}
                onPointerCancel={() => { gutterDrag.current = null; }}
              >
                <div className="w-px h-4 bg-foreground/40" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Template Picker ────────────────────────────────────────────────────────────

interface TemplatePickerProps {
  section: PageSection;
  onApply: (t: TemplateSpec) => void;
}

function TemplatePicker({ section, onApply }: TemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const currentName = getTemplateName(section);

  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-border hover:bg-surface-raised transition-colors whitespace-nowrap"
      >
        {currentName}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-surface border border-border rounded-lg shadow-lg p-1.5 w-52">
            {TEMPLATES.map(t => (
              <button
                key={t.name}
                type="button"
                onClick={() => { onApply(t); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-surface-raised text-xs text-left transition-colors ${t.name === currentName ? 'text-accent' : ''}`}
              >
                <TemplateIcon template={t} />
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main SectionEditor ─────────────────────────────────────────────────────────

interface SectionEditorProps {
  section: PageSection;
  index: number;
  canDelete: boolean;
  dragHandleListeners?: Record<string, unknown>;
  dragHandleAttributes?: Record<string, unknown>;
  onUpdate: (section: PageSection) => void;
  onDelete: () => void;
}

export function SectionEditor({
  section,
  index,
  canDelete,
  dragHandleListeners,
  dragHandleAttributes,
  onUpdate,
  onDelete,
}: SectionEditorProps) {
  const [bgPanelOpen, setBgPanelOpen] = useState(false);

  function applyTemplate(template: TemplateSpec) {
    if (sectionHasContent(section) && !window.confirm('Apply template? Existing zone content will be removed.')) return;
    onUpdate({
      ...section,
      columns: template.columns,
      zones: template.zones.map(z => ({ id: uid(), span: z.span, content: {} })),
    });
  }

  function handleAddZone() {
    onUpdate({
      ...section,
      columns: section.columns + 1,
      zones: [...section.zones, { id: uid(), span: 1, content: {} }],
    });
  }

  function handleSplitZone(idx: number) {
    const zone = section.zones[idx];
    if (zone.span > 1) {
      const leftSpan = Math.floor(zone.span / 2);
      const rightSpan = zone.span - leftSpan;
      const newZones = [
        ...section.zones.slice(0, idx),
        { ...zone, span: leftSpan },
        { id: uid(), span: rightSpan, content: {} },
        ...section.zones.slice(idx + 1),
      ];
      onUpdate({ ...section, zones: newZones });
    } else {
      const newZones = [
        ...section.zones.slice(0, idx + 1),
        { id: uid(), span: 1, content: {} },
        ...section.zones.slice(idx + 1),
      ];
      onUpdate({ ...section, columns: section.columns + 1, zones: newZones });
    }
  }

  function handleZoneContentChange(idx: number, value: string) {
    try {
      const parsed = JSON.parse(value);
      onUpdate({ ...section, zones: section.zones.map((z, i) => (i === idx ? { ...z, content: parsed } : z)) });
    } catch { /* ignore */ }
  }

  function handleDelete() {
    if (sectionHasContent(section) && !window.confirm('Delete this section? All content will be lost.')) return;
    onDelete();
  }

  const heightValue = section.minHeight ?? '';

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Section header bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface border-b border-border">
        {/* Drag handle */}
        <button
          type="button"
          {...(dragHandleListeners as React.ButtonHTMLAttributes<HTMLButtonElement>)}
          {...(dragHandleAttributes as React.ButtonHTMLAttributes<HTMLButtonElement>)}
          className="cursor-grab active:cursor-grabbing text-foreground/30 hover:text-foreground/60 flex-shrink-0 touch-none"
          tabIndex={-1}
          aria-label={`Drag section ${index + 1} to reorder`}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <span className="text-xs text-foreground/30 flex-shrink-0">§{index + 1}</span>

        <TemplatePicker section={section} onApply={applyTemplate} />

        <SpanDiagram section={section} onUpdate={onUpdate} />

        <button
          type="button"
          onClick={handleAddZone}
          className="flex-shrink-0 p-1 rounded hover:bg-surface-raised transition-colors text-foreground/40 hover:text-foreground"
          title="Add zone"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setBgPanelOpen(true)}
          title="Section background, overlay &amp; transition"
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors flex-shrink-0 ${
            section.background && section.background.type !== 'none'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border hover:bg-surface-raised'
          }`}
        >
          <Layers className="w-3 h-3" />
          <span>BG</span>
        </button>

        <select
          value={section.padding ?? 'normal'}
          onChange={(e) => onUpdate({ ...section, padding: e.target.value as import('@/types').SectionPadding })}
          className="text-xs px-1.5 py-1 border border-border rounded bg-background cursor-pointer flex-shrink-0"
          title="Section padding"
        >
          <option value="none">No pad</option>
          <option value="compact">Compact</option>
          <option value="normal">Normal</option>
          <option value="spacious">Spacious</option>
        </select>

        <select
          value={heightValue}
          onChange={(e) => onUpdate({ ...section, minHeight: e.target.value || undefined })}
          className="text-xs px-1.5 py-1 border border-border rounded bg-background cursor-pointer flex-shrink-0"
          title="Section min-height"
        >
          <option value="">Auto</option>
          <option value="50vh">50vh</option>
          <option value="60vh">60vh</option>
          <option value="75vh">75vh</option>
          <option value="100vh">100vh</option>
        </select>

        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="flex-shrink-0 p-1 rounded hover:bg-red-500/10 transition-colors text-foreground/30 hover:text-red-500"
            title="Delete section"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Zone editors */}
      <div
        className="p-3 bg-background"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${section.columns}, 1fr)`,
          gap: '0.75rem',
          ...(section.minHeight ? { minHeight: section.minHeight } : {}),
        }}
      >
        {section.zones.map((zone, idx) => (
          <div
            key={zone.id}
            style={{ gridColumn: `span ${zone.span}` }}
            className="min-w-0 relative group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-foreground/25 select-none">Span {zone.span}</span>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <select
                  value={zone.scheme ?? 'inherit'}
                  onChange={(e) => {
                    const scheme = e.target.value as import('@/types').ZoneScheme;
                    onUpdate({ ...section, zones: section.zones.map((z, i) => i === idx ? { ...z, scheme } : z) });
                  }}
                  className="text-[10px] px-1 py-0.5 border border-border rounded bg-background cursor-pointer"
                  title="Zone text colour scheme"
                >
                  <option value="inherit">inherit</option>
                  <option value="light">light</option>
                  <option value="dark">dark</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleSplitZone(idx)}
                  className="text-foreground/40 hover:text-foreground/70 flex items-center gap-0.5"
                  title="Split zone"
                >
                  <CopyPlus className="w-3 h-3" />
                </button>
              </div>
            </div>
            <WidgetSizeProvider size="large">
              <TipTapEditor
                content={zoneHasContent(zone) ? JSON.stringify(zone.content) : ''}
                onChange={(val) => handleZoneContentChange(idx, val)}
                placeholder="Start writing…"
              />
            </WidgetSizeProvider>
          </div>
        ))}
      </div>

      {/* Background / overlay / transition panel (slide-in drawer) */}
      <SectionBackgroundPanel
        open={bgPanelOpen}
        background={section.background}
        onUpdate={(bg) => onUpdate({ ...section, background: bg })}
        onClose={() => setBgPanelOpen(false)}
      />
    </div>
  );
}
