'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import adminApi from '@/lib/adminApi';
import { defaultSectionsContent } from '@/lib/pageContent';

function generateSlug(title: string): string {
  return title.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 80);
}

export function NewPageClient() {
  const router = useRouter();
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
      const content = defaultSectionsContent();
      const res = await adminApi.post('/pages', {
        title: title.trim(),
        slug,
        content: JSON.stringify(content),
        status: 'draft',
      });
      const newId = res.data?.id ?? res.data?.data?.id;
      router.push(`/admin/pages/${newId}/edit`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Save failed.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg as string);
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <Link href="/admin/pages" className="inline-flex items-center text-foreground/60 hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Pages
        </Link>
        <h1 className="text-3xl font-bold">New Page</h1>
        <p className="text-foreground/60 mt-1">Give your page a title — you can build the layout in the editor.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
          {error}
        </div>
      )}

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
