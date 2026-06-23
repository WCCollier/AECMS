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
import { PlusCircle } from 'lucide-react';
import { SectionEditor } from './SectionEditor';
import type { PageSection } from '@/types';

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

interface SectionsPageEditorProps {
  sections: PageSection[];
  onChange: (sections: PageSection[]) => void;
}

export function SectionsPageEditor({ sections, onChange }: SectionsPageEditorProps) {
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
