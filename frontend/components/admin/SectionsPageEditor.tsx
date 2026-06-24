'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PlusCircle, Type, X } from 'lucide-react';
import { useState } from 'react';
import { SectionEditor } from './SectionEditor';
import type { PageSection, SectionsPageContent } from '@/types';
import { CURATED_FONTS, type FontEntry } from '@/lib/fonts';

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

function defaultSection(): PageSection {
  return {
    id: uid(),
    columns: 1,
    zones: [{ id: uid(), span: 1, content: {} }],
  };
}

// ── SortableSection ──────────────────────────────────────────────────────────

interface SortableSectionProps {
  section: PageSection;
  index: number;
  canDelete: boolean;
  onUpdate: (s: PageSection) => void;
  onDelete: () => void;
}

function SortableSection({ section, index, canDelete, onUpdate, onDelete }: SortableSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="mb-4"
    >
      <SectionEditor
        section={section}
        index={index}
        canDelete={canDelete}
        dragHandleListeners={listeners as unknown as Record<string, unknown>}
        dragHandleAttributes={attributes as unknown as Record<string, unknown>}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </div>
  );
}

// ── PageFontPicker ────────────────────────────────────────────────────────────

interface PageFontPickerProps {
  fontImport?: string;
  fontVariables?: SectionsPageContent['fontVariables'];
  onChange: (fontImport: string | undefined, fontVariables: SectionsPageContent['fontVariables'] | undefined) => void;
}

function PageFontPicker({ fontImport, fontVariables, onChange }: PageFontPickerProps) {
  const [open, setOpen] = useState(false);

  // Identify currently selected font by matching importUrl or headingFamily
  const allFonts: FontEntry[] = CURATED_FONTS;
  const activeFont: FontEntry | undefined = !fontImport
    ? allFonts.find(f => f.isSystem)
    : allFonts.find(f => f.importUrl === fontImport);

  const activeName = activeFont?.name ?? (fontVariables?.heading ? 'Custom' : 'System (default)');
  const hasCustomFont = !!fontImport;

  function selectFont(font: FontEntry) {
    if (font.isSystem) {
      onChange(undefined, undefined);
    } else {
      onChange(font.importUrl, { heading: font.headingFamily, body: font.bodyFamily });
    }
    setOpen(false);
  }

  function clearFont() {
    onChange(undefined, undefined);
    setOpen(false);
  }

  return (
    <div className="relative flex-shrink-0">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-colors ${
            hasCustomFont
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border hover:bg-surface-raised text-foreground/60'
          }`}
          title="Page fonts — sets heading and body typefaces for this page"
        >
          <Type className="w-3 h-3" />
          <span className="max-w-[120px] truncate">{activeName}</span>
        </button>
        {hasCustomFont && (
          <button
            type="button"
            onClick={clearFont}
            className="p-1 rounded hover:bg-surface-raised text-foreground/40 hover:text-foreground"
            title="Clear page fonts (revert to site theme fonts)"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-surface border border-border rounded-lg shadow-lg w-72 overflow-hidden">
            <p className="px-3 pt-2.5 pb-1 text-[10px] text-foreground/40 uppercase tracking-wider font-medium">
              Page Fonts
            </p>
            <p className="px-3 pb-2 text-[10px] text-foreground/40 leading-relaxed">
              Sets heading and body typefaces for this page. Font is injected at render time — no reload needed.
            </p>
            <div className="border-t border-border max-h-80 overflow-y-auto">
              {allFonts.map(font => {
                const isActive = font.isSystem ? !hasCustomFont : font.importUrl === fontImport;
                return (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => selectFont(font)}
                    className={`w-full px-3 py-2.5 flex flex-col gap-0.5 text-left hover:bg-surface-raised transition-colors border-b border-border/50 last:border-0 ${
                      isActive ? 'bg-accent/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{font.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        font.isSystem
                          ? 'bg-surface-raised text-foreground/40'
                          : font.category === 'editorial'
                          ? 'bg-amber-500/10 text-amber-600'
                          : font.category === 'modern'
                          ? 'bg-blue-500/10 text-blue-600'
                          : font.category === 'literary'
                          ? 'bg-purple-500/10 text-purple-600'
                          : 'bg-green-500/10 text-green-600'
                      }`}>
                        {font.isSystem ? 'system' : font.category}
                      </span>
                    </div>
                    {!font.isSystem && (
                      <div className="flex gap-2 text-[10px] text-foreground/40">
                        <span>H: {font.headingFamily.split(',')[0].replace(/'/g, '')}</span>
                        <span>·</span>
                        <span>B: {font.bodyFamily.split(',')[0].replace(/'/g, '')}</span>
                      </div>
                    )}
                    {isActive && <span className="text-[10px] text-accent font-medium mt-0.5">Active</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main SectionsPageEditor ───────────────────────────────────────────────────

interface SectionsPageEditorProps {
  sections: PageSection[];
  fontImport?: string;
  fontVariables?: SectionsPageContent['fontVariables'];
  onChange: (sections: PageSection[]) => void;
  onFontChange: (
    fontImport: string | undefined,
    fontVariables: SectionsPageContent['fontVariables'] | undefined,
  ) => void;
}

export function SectionsPageEditor({
  sections,
  fontImport,
  fontVariables,
  onChange,
  onFontChange,
}: SectionsPageEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = sections.findIndex(s => s.id === active.id);
      const newIdx = sections.findIndex(s => s.id === over.id);
      onChange(arrayMove(sections, oldIdx, newIdx));
    }
  }

  function handleUpdate(idx: number, section: PageSection) {
    onChange(sections.map((s, i) => (i === idx ? section : s)));
  }

  function handleDelete(idx: number) {
    onChange(sections.filter((_, i) => i !== idx));
  }

  return (
    <div>
      {/* Page-level typography toolbar */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <PageFontPicker
          fontImport={fontImport}
          fontVariables={fontVariables}
          onChange={onFontChange}
        />
        {fontVariables && (
          <span className="text-[10px] text-foreground/30 truncate">
            {fontVariables.heading?.split(',')[0].replace(/'/g, '')}
            {' / '}
            {fontVariables.body?.split(',')[0].replace(/'/g, '')}
          </span>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {sections.map((section, idx) => (
            <SortableSection
              key={section.id}
              section={section}
              index={idx}
              canDelete={sections.length > 1}
              onUpdate={(s) => handleUpdate(idx, s)}
              onDelete={() => handleDelete(idx)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={() => onChange([...sections, defaultSection()])}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-lg text-sm text-foreground/50 hover:border-accent/50 hover:text-foreground/70 transition-colors"
      >
        <PlusCircle className="w-4 h-4" />
        Add Section
      </button>
    </div>
  );
}
