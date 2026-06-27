'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { Tag as TagIcon, Plus, Edit2, Trash2, Users, Check, X, AlertTriangle } from 'lucide-react';
import adminApi from '@/lib/adminApi';
import { getErrorMessage } from '@/lib/api';
import type { Article, Product } from '@/types';

interface TagRow {
  id: string;
  name: string;
  slug: string;
  _count: { articles: number; products: number };
}

function adminFetcher(url: string) {
  return adminApi.get(url).then((r) => r.data);
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── Add Tag form ─────────────────────────────────────────────────────────────

function AddTagForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugManual) setSlug(generateSlug(v));
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await adminApi.post('/tags', { name: name.trim(), slug: slug.trim() || generateSlug(name.trim()) });
      setName('');
      setSlug('');
      setSlugManual(false);
      setOpen(false);
      onAdded();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-sm hover:bg-accent/90 transition-colors"
      >
        <Plus className="w-4 h-4" /> Add Tag
      </button>
    );
  }

  return (
    <div className="border border-accent/30 rounded-lg bg-surface p-4 mb-4 space-y-3">
      <p className="text-sm font-semibold">New tag</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Tag name"
          className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent/40"
          autoFocus
        />
        <input
          type="text"
          value={slug}
          onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
          placeholder="slug"
          className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent/40 font-mono"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="px-3 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(null); setName(''); setSlug(''); setSlugManual(false); }}
          className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-surface-raised transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Assign Modal ─────────────────────────────────────────────────────────────

function AssignModal({ tag, onClose, onDone }: { tag: TagRow; onClose: () => void; onDone: () => void }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminApi.get('/articles?limit=1000&status=published').then((r) => r.data),
      adminApi.get('/products?limit=1000&status=published').then((r) => r.data),
    ]).then(([aRes, pRes]) => {
      setArticles(aRes.data ?? []);
      setProducts(pRes.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const articleAlreadyTagged = (a: Article) => a.tags.some((t) => t.slug === tag.slug);
  const productAlreadyTagged = (p: Product) => p.tags.some((t) => t.slug === tag.slug);

  const toggleArticle = (id: string) =>
    setSelectedArticles((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleProduct = (id: string) =>
    setSelectedProducts((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const untaggedArticles = articles.filter((a) => !articleAlreadyTagged(a));
  const untaggedProducts = products.filter((p) => !productAlreadyTagged(p));

  const handleSelectAllArticles = () =>
    setSelectedArticles(selectedArticles.size === untaggedArticles.length ? new Set() : new Set(untaggedArticles.map((a) => a.id)));
  const handleSelectAllProducts = () =>
    setSelectedProducts(selectedProducts.size === untaggedProducts.length ? new Set() : new Set(untaggedProducts.map((p) => p.id)));

  const totalSelected = selectedArticles.size + selectedProducts.size;

  const handleAssign = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminApi.post(`/tags/${tag.id}/assign`, {
        article_ids: Array.from(selectedArticles),
        product_ids: Array.from(selectedProducts),
      });
      onDone();
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-background border border-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">Assign &ldquo;{tag.name}&rdquo; to content</h2>
          <button type="button" onClick={onClose} className="text-foreground/50 hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-6">
          {loading ? (
            <p className="text-sm text-foreground/50">Loading content…</p>
          ) : (
            <>
              {/* Articles */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">Articles ({untaggedArticles.length} untagged)</p>
                  {untaggedArticles.length > 0 && (
                    <button type="button" onClick={handleSelectAllArticles} className="text-xs text-accent hover:underline">
                      {selectedArticles.size === untaggedArticles.length ? 'Deselect all' : 'Select all'}
                    </button>
                  )}
                </div>
                {untaggedArticles.length === 0 ? (
                  <p className="text-xs text-foreground/40">All published articles already have this tag.</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {untaggedArticles.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface cursor-pointer text-sm">
                        <input type="checkbox" checked={selectedArticles.has(a.id)} onChange={() => toggleArticle(a.id)} className="accent-accent" />
                        {a.title}
                      </label>
                    ))}
                  </div>
                )}
                {articles.filter(articleAlreadyTagged).length > 0 && (
                  <p className="text-xs text-foreground/40 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> {articles.filter(articleAlreadyTagged).length} already tagged
                  </p>
                )}
              </div>

              {/* Products */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">Products ({untaggedProducts.length} untagged)</p>
                  {untaggedProducts.length > 0 && (
                    <button type="button" onClick={handleSelectAllProducts} className="text-xs text-accent hover:underline">
                      {selectedProducts.size === untaggedProducts.length ? 'Deselect all' : 'Select all'}
                    </button>
                  )}
                </div>
                {untaggedProducts.length === 0 ? (
                  <p className="text-xs text-foreground/40">All published products already have this tag.</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {untaggedProducts.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface cursor-pointer text-sm">
                        <input type="checkbox" checked={selectedProducts.has(p.id)} onChange={() => toggleProduct(p.id)} className="accent-accent" />
                        {p.title}
                      </label>
                    ))}
                  </div>
                )}
                {products.filter(productAlreadyTagged).length > 0 && (
                  <p className="text-xs text-foreground/40 mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> {products.filter(productAlreadyTagged).length} already tagged
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {error && <p className="px-5 pb-2 text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 p-5 border-t border-border">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-surface-raised transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={saving || totalSelected === 0}
            className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Assigning…' : `Assign to ${totalSelected} item${totalSelected !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tag Row ───────────────────────────────────────────────────────────────────

function TagTableRow({ tag, onMutate }: { tag: TagRow; onMutate: () => void }) {
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState(tag.name);
  const [editSlug, setEditSlug] = useState(tag.slug);
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const slugChanged = editSlug !== tag.slug;

  const handleEditNameChange = (v: string) => {
    setEditName(v);
    if (!slugManual) setEditSlug(generateSlug(v));
  };

  const handleSave = async () => {
    setSaving(true);
    setEditError(null);
    try {
      await adminApi.patch(`/tags/${tag.id}`, { name: editName.trim(), slug: editSlug.trim() });
      setEditMode(false);
      setSlugManual(false);
      onMutate();
    } catch (e) {
      setEditError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await adminApi.delete(`/tags/${tag.id}`);
      onMutate();
    } catch (e) {
      setDeleteError(getErrorMessage(e));
      setDeleting(false);
    }
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditName(tag.name);
    setEditSlug(tag.slug);
    setSlugManual(false);
    setEditError(null);
  };

  if (editMode) {
    return (
      <>
        <tr className="border-b border-border bg-surface/30">
          <td className="px-4 py-3">
            <input
              type="text"
              value={editName}
              onChange={(e) => handleEditNameChange(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-accent/40 rounded bg-background focus:outline-none focus:ring-1 focus:ring-accent/40"
              autoFocus
            />
          </td>
          <td className="px-4 py-3">
            <input
              type="text"
              value={editSlug}
              onChange={(e) => { setEditSlug(e.target.value); setSlugManual(true); }}
              className={`w-full px-2 py-1 text-sm border rounded bg-background font-mono focus:outline-none focus:ring-1 focus:ring-accent/40 ${slugChanged ? 'border-amber-400' : 'border-accent/40'}`}
            />
            {slugChanged && (
              <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Slug change will break existing Collection embeds and bookmarked URLs using the old slug.
              </p>
            )}
          </td>
          <td className="px-4 py-3 text-sm text-foreground/60">{tag._count.articles}</td>
          <td className="px-4 py-3 text-sm text-foreground/60">{tag._count.products}</td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !editName.trim()}
                className="px-2.5 py-1 text-xs bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={cancelEdit} className="px-2.5 py-1 text-xs border border-border rounded hover:bg-surface-raised transition-colors">
                Cancel
              </button>
            </div>
            {editError && <p className="text-[10px] text-red-500 mt-1">{editError}</p>}
          </td>
        </tr>
      </>
    );
  }

  return (
    <>
      <tr className="border-b border-border hover:bg-surface/30 transition-colors">
        <td className="px-4 py-3 font-medium text-sm">{tag.name}</td>
        <td className="px-4 py-3 text-sm text-foreground/60 font-mono">{tag.slug}</td>
        <td className="px-4 py-3 text-sm text-foreground/60">{tag._count.articles}</td>
        <td className="px-4 py-3 text-sm text-foreground/60">{tag._count.products}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-border rounded hover:bg-surface-raised transition-colors"
            >
              <Edit2 className="w-3 h-3" /> Edit
            </button>
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-border rounded hover:bg-surface-raised transition-colors"
            >
              <Users className="w-3 h-3" /> Assign
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </td>
      </tr>

      {/* Delete confirmation row */}
      {confirmDelete && (
        <tr className="border-b border-border bg-red-50/50 dark:bg-red-950/20">
          <td colSpan={5} className="px-4 py-3">
            <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">
              Delete &ldquo;{tag.name}&rdquo;?
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400 mb-2">
              This will remove it from {tag._count.articles} article{tag._count.articles !== 1 ? 's' : ''} and {tag._count.products} product{tag._count.products !== 1 ? 's' : ''}. Collection embeds and bookmarked URLs filtering by this tag will stop working. This cannot be undone.
            </p>
            {deleteError && <p className="text-xs text-red-500 mb-1">{deleteError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button type="button" onClick={() => { setConfirmDelete(false); setDeleteError(null); }} className="px-3 py-1 text-xs border border-border rounded hover:bg-surface-raised transition-colors">
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}

      {assignOpen && (
        <AssignModal
          tag={tag}
          onClose={() => setAssignOpen(false)}
          onDone={onMutate}
        />
      )}
    </>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export function TagEditorClient() {
  const { data: tags, isLoading, error, mutate } = useSWR<TagRow[]>('/tags', adminFetcher);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TagIcon className="w-5 h-5 text-accent" />
          <h1 className="text-xl font-semibold">Tags</h1>
        </div>
        <AddTagForm onAdded={() => mutate()} />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {getErrorMessage(error)}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-surface rounded-lg animate-pulse" />)}
        </div>
      ) : !tags || tags.length === 0 ? (
        <div className="text-center py-16 text-foreground/40">
          <TagIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No tags yet. Add your first tag above.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-foreground/60 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-xs font-semibold text-foreground/60 uppercase tracking-wider">Slug</th>
                <th className="px-4 py-3 text-xs font-semibold text-foreground/60 uppercase tracking-wider">Articles</th>
                <th className="px-4 py-3 text-xs font-semibold text-foreground/60 uppercase tracking-wider">Products</th>
                <th className="px-4 py-3 text-xs font-semibold text-foreground/60 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <TagTableRow key={tag.id} tag={tag} onMutate={() => mutate()} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
