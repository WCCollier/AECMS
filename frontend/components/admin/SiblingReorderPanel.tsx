'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, EyeOff } from 'lucide-react';
import adminApi from '@/lib/adminApi';

interface SiblingPage {
  id: string;
  title: string;
  slug: string;
  nav_order: number;
  show_in_nav: boolean;
  parent_id: string | null;
}

function SortableRow({ page, isCurrentPage }: { page: SiblingPage; isCurrentPage: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors select-none
        ${isDragging ? 'opacity-50 bg-surface-raised border-accent/40 shadow-lg' : 'border-transparent hover:bg-surface-raised'}
        ${isCurrentPage ? 'border-l-2 !border-l-accent bg-accent/5' : ''}
      `}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        {...attributes}
        type="button"
        className="cursor-grab active:cursor-grabbing text-foreground/25 hover:text-foreground/60 transition-colors flex-shrink-0 touch-none"
        tabIndex={-1}
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>

      {/* Title */}
      <span className={`text-sm flex-1 truncate ${isCurrentPage ? 'text-accent font-medium' : 'text-foreground/70'}`}>
        {page.title}
      </span>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isCurrentPage && (
          <span className="text-[10px] text-foreground/40 bg-foreground/10 px-1.5 py-0.5 rounded">
            this page
          </span>
        )}
        {!page.show_in_nav && (
          <span className="text-foreground/30" title="Hidden from navigation">
            <EyeOff size={11} />
          </span>
        )}
      </div>
    </div>
  );
}

interface Props {
  pageId: string;
  parentId: string | null;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function SiblingReorderPanel({ pageId, parentId }: Props) {
  const [siblings, setSiblings] = useState<SiblingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    adminApi.get('/pages?limit=100').then((res) => {
      const all: SiblingPage[] = res.data?.data ?? res.data ?? [];
      const sibs = all
        .filter((p) => p.parent_id === parentId && p.slug !== '_home_')
        .sort((a, b) => (a.nav_order ?? 0) - (b.nav_order ?? 0) || a.title.localeCompare(b.title));
      setSiblings(sibs);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [parentId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = siblings.findIndex((p) => p.id === active.id);
    const newIndex = siblings.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(siblings, oldIndex, newIndex);
    setSiblings(reordered);

    if (saveTimer) clearTimeout(saveTimer);
    setSaveState('saving');
    try {
      await adminApi.patch('/pages/reorder', {
        pages: reordered.map((p, i) => ({ id: p.id, nav_order: i })),
      });
      setSaveState('saved');
      const t = setTimeout(() => setSaveState('idle'), 2000);
      setSaveTimer(t);
    } catch {
      setSiblings(siblings); // revert
      setSaveState('error');
      const t = setTimeout(() => setSaveState('idle'), 3000);
      setSaveTimer(t);
    }
  };

  if (loading) {
    return <p className="text-xs text-foreground/40 py-1">Loading…</p>;
  }

  if (siblings.length <= 1) {
    return <p className="text-xs text-foreground/40 py-1">No sibling pages to reorder.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-foreground/40">Drag to reorder navigation</span>
        {saveState === 'saving' && <span className="text-xs text-foreground/40">Saving…</span>}
        {saveState === 'saved'  && <span className="text-xs text-accent">Saved ✓</span>}
        {saveState === 'error'  && <span className="text-xs text-red-400">Save failed</span>}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={siblings.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5">
            {siblings.map((p) => (
              <SortableRow key={p.id} page={p} isCurrentPage={p.id === pageId} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
