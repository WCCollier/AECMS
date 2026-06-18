'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LayoutTemplate } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import adminApi from '@/lib/adminApi';
import { LAYOUT_LABELS } from '@/lib/pageContent';
import type { PageLayout, PageContent } from '@/types';

const LAYOUT_OPTIONS: { value: PageLayout; description: string }[] = [
  { value: 'no_sidebar',       description: 'Single full-width content area' },
  { value: 'sidebar_left',     description: 'Main content + left sidebar (compact widgets)' },
  { value: 'sidebar_right',    description: 'Main content + right sidebar (compact widgets)' },
  { value: 'split_comparison', description: 'Two equal panels (desktop: large widgets; mobile: small)' },
];

function generateSlug(title: string): string {
  return title.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 80);
}

export function NewPageClient() {
  const router = useRouter();
  const [layout, setLayout] = useState<PageLayout>('no_sidebar');
  const [title, setTitle] = useState('');
  const [slugOverride, setSlugOverride] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = slugOverride || generateSlug(title);

  const handleCreate = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const pageContent: PageContent = { layout, zones: {} };
      const res = await adminApi.post('/pages', {
        title: title.trim(),
        slug,
        content: JSON.stringify(pageContent),
        layout,
        status: 'draft',
      });
      const newId = res.data?.id ?? res.data?.data?.id;
      router.push(`/admin/pages/${newId}/edit`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/pages" className="inline-flex items-center text-foreground/60 hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Pages
        </Link>
        <h1 className="text-3xl font-bold">New Page</h1>
        <p className="text-foreground/60 mt-1">Choose a layout and name — you can change both later</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {LAYOUT_OPTIONS.map(({ value, description }) => (
          <button
            key={value}
            type="button"
            onClick={() => setLayout(value)}
            className={`p-4 rounded-lg border-2 text-left transition-colors ${
              layout === value
                ? 'border-accent bg-accent/5'
                : 'border-border hover:border-accent/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <LayoutTemplate className={`w-4 h-4 ${layout === value ? 'text-accent' : 'text-foreground/40'}`} />
              <span className="font-medium">{LAYOUT_LABELS[value]}</span>
            </div>
            <p className="text-sm text-foreground/60">{description}</p>
          </button>
        ))}
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Page Title <span className="text-red-500">*</span></label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Page"
            onKeyDown={(e) => e.key === 'Enter' && !saving && title.trim() && handleCreate()}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Slug <span className="text-foreground/40 font-normal">(auto-generated)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-foreground/40 text-sm">/</span>
            <Input
              value={slugOverride}
              onChange={(e) => setSlugOverride(e.target.value)}
              placeholder={generateSlug(title) || 'my-page'}
            />
          </div>
          <p className="text-xs text-foreground/40 mt-1">URL will be: /{slug || 'my-page'}</p>
        </div>
      </div>

      <Button onClick={handleCreate} disabled={saving || !title.trim()}>
        {saving ? 'Creating…' : 'Create Page →'}
      </Button>
    </div>
  );
}
