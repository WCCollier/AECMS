'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, LayoutTemplate, ArrowUpCircle } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import adminApi from '@/lib/adminApi';
import { PageZoneEditor } from '@/components/admin/PageZoneEditor';
import { SectionsPageEditor } from '@/components/admin/SectionsPageEditor';
import { VersionHistoryPanel } from '@/components/admin/VersionHistoryPanel';
import { SiblingReorderPanel } from '@/components/admin/SiblingReorderPanel';
import {
  getZonesForLayout,
  parseAnyPageContent,
  isSectionsContent,
  legacyToSections,
  LAYOUT_LABELS,
} from '@/lib/pageContent';
import type { Page, PageLayout, PageContent, PageSection } from '@/types';

const LAYOUT_OPTIONS: PageLayout[] = ['no_sidebar', 'sidebar_left', 'sidebar_right', 'split_comparison'];

interface EditPageClientProps {
  pageId: string;
}

export function EditPageClient({ pageId }: EditPageClientProps) {
  const router = useRouter();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');

  // Content mode: 'sections' (new schema) or 'legacy' (flat zones)
  const [contentMode, setContentMode] = useState<'sections' | 'legacy'>('sections');

  // Legacy mode state
  const [layout, setLayout] = useState<PageLayout>('no_sidebar');
  const [zones, setZones] = useState<PageContent['zones']>({});
  const [previewSmall, setPreviewSmall] = useState(false);
  const [layoutChangeWarning, setLayoutChangeWarning] = useState(false);
  const [pendingLayout, setPendingLayout] = useState<PageLayout | null>(null);

  // Sections mode state
  const [sections, setSections] = useState<PageSection[]>([]);

  const [showInNav, setShowInNav] = useState(true);
  const [parentId, setParentId] = useState<string | null>(null);
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [allPages, setAllPages] = useState<Array<{ id: string; title: string }>>([]);
  const [pendingReorder, setPendingReorder] = useState<{ id: string; nav_order: number }[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versionKey, setVersionKey] = useState(0);
  const [zoneKey, setZoneKey] = useState(0);
  const handleParentChange = (newParentId: string | null) => {
    setParentId(newParentId);
    setPendingReorder(null);
    setDirty(true);
  };

  const handleReorder = (pages: { id: string; nav_order: number }[]) => {
    setPendingReorder(pages);
    setDirty(true);
  };

  function applyParsedContent(raw: string | object | null | undefined) {
    const parsed = parseAnyPageContent(raw);
    if (isSectionsContent(parsed)) {
      setContentMode('sections');
      setSections(parsed.sections);
    } else {
      setContentMode('legacy');
      setLayout((parsed as PageContent).layout);
      setZones((parsed as PageContent).zones);
    }
  }

  const handleRestored = async () => {
    try {
      const res = await adminApi.get<Page>(`/pages/${pageId}`);
      const p = res.data;
      setPage(p);
      setTitle(p.title);
      setSlug(p.slug);
      setStatus(p.status);
      setShowInNav((p as unknown as { show_in_nav?: boolean }).show_in_nav ?? true);
      setParentId(p.parent_id ?? null);
      setMetaTitle((p as any).meta_title ?? '');
      setMetaDescription((p as any).meta_description ?? '');
      setOgImageUrl((p as any).og_image_url ?? '');
      applyParsedContent(p.content);
      setDirty(false);
      setPendingReorder(null);
      setVersionKey(k => k + 1);
      setZoneKey(k => k + 1);
    } catch { /* version list will refresh via key */ }
  };

  useEffect(() => {
    adminApi.get('/pages?limit=100&status=published').then((res) => {
      setAllPages((res.data?.data ?? []).filter((p: { id: string }) => p.id !== pageId));
    }).catch(() => {});

    adminApi.get<Page>(`/pages/${pageId}`)
      .then((res) => {
        const p = res.data;
        setPage(p);
        setTitle(p.title);
        setSlug(p.slug);
        setStatus(p.status);
        setShowInNav((p as unknown as { show_in_nav?: boolean }).show_in_nav ?? true);
        setParentId(p.parent_id ?? null);
        setMetaTitle((p as any).meta_title ?? '');
        setMetaDescription((p as any).meta_description ?? '');
        setOgImageUrl((p as any).og_image_url ?? '');
        applyParsedContent(p.content);
      })
      .catch(() => setError('Failed to load page.'))
      .finally(() => setLoading(false));
  }, [pageId]);

  const handleLayoutChange = (newLayout: PageLayout) => {
    if (newLayout === layout) return;
    setPendingLayout(newLayout);
    setLayoutChangeWarning(true);
  };

  const confirmLayoutChange = () => {
    if (!pendingLayout) return;
    const mainContent = zones.main ?? zones.left ?? null;
    setZones({ main: mainContent ?? undefined });
    setLayout(pendingLayout);
    setPendingLayout(null);
    setLayoutChangeWarning(false);
    setDirty(true);
  };

  const handleUpgradeToSections = () => {
    if (!window.confirm('Upgrade this page to the new section layout? The content will be preserved and converted losslessly.')) return;
    const upgraded = legacyToSections({ layout, zones });
    setContentMode('sections');
    setSections(upgraded.sections);
    setDirty(true);
  };

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const pageContent =
        contentMode === 'sections'
          ? { type: 'sections', sections }
          : { layout, zones };

      const body: Record<string, unknown> = {
        title: title.trim(),
        slug,
        content: JSON.stringify(pageContent),
        status,
        show_in_nav: showInNav,
        parent_id: parentId,
        meta_title: metaTitle || undefined,
        meta_description: metaDescription || undefined,
        og_image_url: ogImageUrl || undefined,
      };

      // layout column only relevant for legacy pages
      if (contentMode === 'legacy') body.layout = layout;

      await adminApi.patch(`/pages/${pageId}`, body);

      if (pendingReorder) {
        await adminApi.patch('/pages/reorder', { pages: pendingReorder });
      }
      setDirty(false);
      setPendingReorder(null);
      setSaved(true);
      setVersionKey(k => k + 1);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ?? 'Save failed.';
      setError(Array.isArray(msg) ? msg.join(', ') : msg as string);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-foreground/50">Loading page…</div>;
  }

  if (!page && !loading) {
    return <div className="p-6 text-center text-red-500">{error ?? 'Page not found.'}</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/admin/pages" className="inline-flex items-center text-foreground/60 hover:text-foreground mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Pages
          </Link>
          <h1 className="text-2xl font-bold">Edit Page</h1>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/admin/pages/${pageId}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-border rounded-lg hover:bg-surface-raised transition-colors"
          >
            <Eye className="w-4 h-4" />
            Preview
          </a>
          {contentMode === 'legacy' && getZonesForLayout(layout).length > 1 && (
            <button
              type="button"
              onClick={() => setPreviewSmall(v => !v)}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                previewSmall ? 'border-accent bg-accent/10 text-accent' : 'border-border hover:bg-surface-raised'
              }`}
            >
              <Eye className="w-4 h-4" />
              {previewSmall ? 'Small preview ON' : 'Preview small widgets'}
            </button>
          )}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as typeof status); setDirty(true); }}
            className="text-sm px-3 py-1.5 border border-border rounded-lg bg-background"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <Button onClick={handleSave} disabled={saving || saved || !dirty}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Metadata row */}
      <div className="grid sm:grid-cols-2 gap-4 mb-4 p-4 bg-surface rounded-lg border border-border">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <Input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Slug</label>
          {page?.slug === '_home_' ? (
            <div className="flex items-center gap-2">
              <span className="text-foreground/40 text-sm">/</span>
              <span className="flex-1 text-sm font-mono px-3 py-1.5 bg-foreground/5 border border-border rounded-lg text-foreground/40 cursor-not-allowed select-none">
                _home_
              </span>
              <span className="text-xs text-foreground/40">System page — slug is fixed</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-foreground/40 text-sm">/</span>
              <Input value={slug} onChange={(e) => { setSlug(e.target.value); setDirty(true); }} />
            </div>
          )}
        </div>
      </div>

      {/* Navigation settings */}
      <div className="mb-6 p-4 bg-surface rounded-lg border border-border space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Parent Page</label>
            <select
              value={parentId ?? ''}
              onChange={(e) => handleParentChange(e.target.value || null)}
              className="w-full text-sm px-3 py-1.5 border border-border rounded-lg bg-background"
            >
              <option value="">None (top-level)</option>
              {allPages.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="show_in_nav"
              checked={showInNav}
              onChange={(e) => { setShowInNav(e.target.checked); setDirty(true); }}
              className="accent-accent"
            />
            <label htmlFor="show_in_nav" className="text-sm font-medium cursor-pointer">Show in navigation</label>
          </div>
        </div>
        <p className="text-xs text-foreground/40">
          URL: <span className="font-mono text-foreground/60">
            {parentId
              ? `/${allPages.find(p => p.id === parentId)?.title?.toLowerCase().replace(/\s+/g, '-') ?? '…'}/${slug}`
              : `/${slug}`}
          </span>
        </p>
        <div className="border-t border-border pt-3">
          <label className="block text-sm font-medium mb-2">Navigation Order</label>
          <SiblingReorderPanel
            pageId={pageId}
            parentId={parentId}
            currentTitle={title}
            currentShowInNav={showInNav}
            onReorder={handleReorder}
          />
        </div>
      </div>

      {/* Layout mode: legacy shows selector + upgrade option; sections shows badge */}
      {contentMode === 'legacy' ? (
        <div className="mb-6">
          <p className="text-sm font-medium mb-2">Layout</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleLayoutChange(opt)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  opt === layout
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border hover:border-accent/50'
                }`}
              >
                <LayoutTemplate className="w-3.5 h-3.5" />
                {LAYOUT_LABELS[opt]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleUpgradeToSections}
            className="flex items-center gap-1.5 text-xs text-foreground/50 hover:text-accent transition-colors"
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            Upgrade to Section Layout
          </button>

          {layoutChangeWarning && pendingLayout && (
            <div className="mt-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Change layout to {LAYOUT_LABELS[pendingLayout]}?</p>
              <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                Main/Left zone content will be preserved. Sidebar and Right zone content will be discarded.
              </p>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" onClick={confirmLayoutChange} className="text-sm">Confirm Change</Button>
                <Button variant="ghost" onClick={() => { setLayoutChangeWarning(false); setPendingLayout(null); }} className="text-sm">Cancel</Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">Section Layout</span>
          <span className="text-xs text-foreground/40">{sections.length} section{sections.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Content editor */}
      {contentMode === 'legacy' ? (
        <PageZoneEditor
          key={zoneKey}
          layout={layout}
          zones={zones}
          onChange={(z) => { setZones(z); setDirty(true); }}
          previewSmall={previewSmall}
        />
      ) : (
        <SectionsPageEditor
          sections={sections}
          onChange={(s) => { setSections(s); setDirty(true); }}
        />
      )}

      {/* SEO */}
      <div className="mt-6 p-4 bg-surface rounded-lg border border-border space-y-4">
        <h3 className="text-sm font-semibold">SEO</h3>
        {/* Snippet preview */}
        <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3 text-xs">
          <p className="text-[11px] text-foreground/40 mb-1 uppercase tracking-wide">Preview</p>
          <p className="text-blue-400 truncate">yoursite.com/{slug || '…'}</p>
          <p className="text-[15px] text-blue-300 font-medium mt-0.5 truncate">{metaTitle || title || 'Page title'}</p>
          <p className="text-foreground/60 mt-0.5">{metaDescription || 'Meta description will appear here'}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium">Meta Title</label>
              <span className={`text-xs ${metaTitle.length > 60 ? 'text-red-400' : 'text-foreground/40'}`}>{metaTitle.length}/60</span>
            </div>
            <Input value={metaTitle} onChange={(e) => { setMetaTitle(e.target.value); setDirty(true); }} placeholder={title || 'SEO title (defaults to page title)'} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">OG Image URL</label>
            <Input value={ogImageUrl} onChange={(e) => { setOgImageUrl(e.target.value); setDirty(true); }} placeholder="Override social sharing image" />
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium">Meta Description</label>
            <span className={`text-xs ${metaDescription.length > 160 ? 'text-red-400' : 'text-foreground/40'}`}>{metaDescription.length}/160</span>
          </div>
          <textarea
            value={metaDescription}
            onChange={(e) => { setMetaDescription(e.target.value); setDirty(true); }}
            placeholder="SEO description (defaults to site description)"
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
          />
        </div>
      </div>

      <div className="mt-6">
        <VersionHistoryPanel resourceType="pages" resourceId={pageId} refreshKey={versionKey} onRestored={handleRestored} />
      </div>
    </div>
  );
}
