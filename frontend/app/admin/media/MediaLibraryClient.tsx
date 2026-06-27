'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import adminApi from '@/lib/adminApi';
import {
  Upload, Trash2, Download, RefreshCw, X, ChevronDown, ChevronUp,
  Image as ImageIcon, FileText, AlertTriangle, Check, Loader2, FolderOpen,
} from 'lucide-react';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────────────

interface MediaItem {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  width?: number;
  height?: number;
  url: string;
  thumbnail_path?: string;
  thumbnail_url?: string | null;
  alt_text?: string;
  caption?: string;
  uploaded_at: string;
  total_uses: number;
  uploader?: { first_name?: string; last_name?: string; email: string };
}

interface UsageData {
  total_uses: number;
  articles: { id: string; title: string; slug: string }[];
  products: { id: string; title: string; slug: string }[];
  pages: { id: string; title: string; slug: string }[];
}

interface DigitalFile {
  id: string;
  product_id: string;
  product: { id: string; title: string; slug: string; status: string } | null;
  format: string;
  file_path: string;
  personalization_enabled: boolean;
  personalization_tested: boolean;
  max_downloads: number;
  created_at: string;
}

interface QueuedFile {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const fetcher = (url: string) => adminApi.get(url).then((r) => r.data);

function MediaThumb({ item, selected, onSelect, onClick }: {
  item: MediaItem;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const isImage = item.mime_type.startsWith('image/');
  const thumbUrl = item.thumbnail_url ?? item.url;

  return (
    <div
      className={`relative group rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
        selected ? 'border-accent' : 'border-border hover:border-muted-foreground'
      }`}
      onClick={onClick}
    >
      {/* Checkbox */}
      <div
        className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-opacity ${
          selected ? 'opacity-100 bg-accent border-accent' : 'opacity-0 group-hover:opacity-100 bg-background border-border'
        }`}
        onClick={(e) => { e.stopPropagation(); onSelect(e); }}
      >
        {selected && <Check className="w-3 h-3 text-white" />}
      </div>

      {/* In-use badge */}
      {item.total_uses > 0 && (
        <div className="absolute top-2 right-2 z-10 w-2.5 h-2.5 rounded-full bg-green-500 border border-background" title="In use" />
      )}

      {/* Thumbnail */}
      <div className="aspect-square bg-muted flex items-center justify-center">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt={item.alt_text || item.original_name} className="w-full h-full object-cover" />
        ) : (
          <FileText className="w-10 h-10 text-muted-foreground" />
        )}
      </div>

      {/* Caption */}
      <div className="p-2 bg-card">
        <p className="text-xs font-medium truncate" title={item.original_name}>{item.original_name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(item.size)}</p>
      </div>
    </div>
  );
}

// ── Bulk Uploader ─────────────────────────────────────────────────────────────

function BulkUploader({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ succeeded: number; failed: { name: string; error: string }[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    setQueue((prev) => [...prev, ...arr.map((f) => ({ file: f, status: 'pending' as const }))]);
    setResult(null);
    setOpen(true);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (queue.length === 0) return;
    setUploading(true);

    const form = new FormData();
    queue.forEach((q) => form.append('files', q.file));

    try {
      const res = await adminApi.post('/media/bulk-upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data as { succeeded: unknown[]; failed: { name: string; error: string }[] };
      setResult({ succeeded: data.succeeded.length, failed: data.failed });
      setQueue([]);
      onDone();
    } catch (err: any) {
      setResult({ succeeded: 0, failed: [{ name: 'Upload batch', error: err.message }] });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-6 border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-3 bg-card hover:bg-muted/50 text-sm font-medium"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2"><Upload className="w-4 h-4" /> Upload Files</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragging ? 'border-accent bg-accent/5' : 'border-border'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drag & drop files here, or</p>
            <button
              className="mt-2 text-sm text-accent hover:underline"
              onClick={() => inputRef.current?.click()}
            >
              browse files
            </button>
            <p className="text-xs text-muted-foreground mt-1">Images, PDFs, and .zip archives. Max 10 MB per file, 50 MB per zip.</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,application/pdf,.zip"
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </div>

          {/* Queue */}
          {queue.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {queue.map((q, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted">
                  <span className="truncate flex-1">{q.file.name}</span>
                  <span className="text-muted-foreground ml-2">{formatBytes(q.file.size)}</span>
                  <button onClick={() => setQueue((prev) => prev.filter((_, j) => j !== i))} className="ml-2">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`text-sm rounded p-2 ${result.failed.length > 0 ? 'bg-yellow-500/10 text-yellow-700' : 'bg-green-500/10 text-green-700'}`}>
              {result.succeeded > 0 && <p>✓ {result.succeeded} file{result.succeeded !== 1 ? 's' : ''} uploaded</p>}
              {result.failed.map((f, i) => <p key={i} className="text-red-600">✗ {f.name}: {f.error}</p>)}
            </div>
          )}

          <div className="flex gap-2">
            <button
              disabled={queue.length === 0 || uploading}
              onClick={handleUpload}
              className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded text-sm disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload {queue.length > 0 ? `${queue.length} file${queue.length !== 1 ? 's' : ''}` : ''}
            </button>
            {queue.length > 0 && (
              <button onClick={() => setQueue([])} className="px-3 py-2 border border-border rounded text-sm">
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ item, onClose, onDeleted, onReplaced }: {
  item: MediaItem;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onReplaced: () => void;
}) {
  const [altText, setAltText] = useState(item.alt_text || '');
  const [caption, setCaption] = useState(item.caption || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState(false);

  const { data: usage } = useSWR<UsageData>(`/media/${item.id}/usage`, fetcher);

  const isImage = item.mime_type.startsWith('image/');
  const thumbUrl = item.thumbnail_url ?? item.url;

  const saveMetadata = async (field: 'alt_text' | 'caption', value: string) => {
    setSaving(true);
    try {
      await adminApi.patch(`/media/${item.id}`, { [field]: value });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await adminApi.delete(`/media/${item.id}`);
      onDeleted(item.id);
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplacing(true);
    const form = new FormData();
    form.append('file', file);
    try {
      await adminApi.post(`/media/${item.id}/replace`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onReplaced();
    } finally {
      setReplacing(false);
      if (replaceRef.current) replaceRef.current.value = '';
    }
  };

  const handleDownload = async () => {
    const res = await adminApi.get(`/media/${item.id}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.original_name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-80 border-l border-border flex flex-col bg-card h-full overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-sm truncate">{item.original_name}</h3>
        <button onClick={onClose}><X className="w-4 h-4" /></button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* Preview */}
        <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbUrl} alt={item.alt_text || item.original_name} className="max-w-full max-h-full object-contain" />
          ) : (
            <FileText className="w-16 h-16 text-muted-foreground" />
          )}
        </div>

        {/* Metadata */}
        <div className="text-xs space-y-1 text-muted-foreground">
          <p><span className="font-medium text-foreground">Type:</span> {item.mime_type}</p>
          <p><span className="font-medium text-foreground">Size:</span> {formatBytes(item.size)}</p>
          {item.width && item.height && (
            <p><span className="font-medium text-foreground">Dimensions:</span> {item.width} × {item.height}</p>
          )}
          <p><span className="font-medium text-foreground">Uploaded:</span> {formatDate(item.uploaded_at)}</p>
          {item.uploader && (
            <p><span className="font-medium text-foreground">By:</span> {item.uploader.first_name} {item.uploader.last_name || item.uploader.email}</p>
          )}
        </div>

        {/* Alt text */}
        <div>
          <label className="text-xs font-medium block mb-1">Alt text {saving && <span className="text-muted-foreground">(saving…)</span>}</label>
          <input
            className="w-full text-sm border border-border rounded px-2 py-1.5 bg-background"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            onBlur={() => saveMetadata('alt_text', altText)}
            placeholder="Describe the image"
          />
        </div>

        {/* Caption */}
        <div>
          <label className="text-xs font-medium block mb-1">Caption</label>
          <textarea
            className="w-full text-sm border border-border rounded px-2 py-1.5 bg-background resize-none"
            rows={2}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => saveMetadata('caption', caption)}
            placeholder="Optional caption"
          />
        </div>

        {/* Usage */}
        <div>
          <h4 className="text-xs font-semibold mb-2">Used in</h4>
          {!usage ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : usage.total_uses === 0 ? (
            <p className="text-xs text-muted-foreground">Not used anywhere</p>
          ) : (
            <div className="space-y-2">
              {usage.articles.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Articles</p>
                  {usage.articles.map((a) => (
                    <Link key={a.id} href={`/admin/articles/${a.id}/edit`} className="block text-xs text-accent hover:underline truncate">{a.title}</Link>
                  ))}
                </div>
              )}
              {usage.products.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Products</p>
                  {usage.products.map((p) => (
                    <Link key={p.id} href={`/admin/products/${p.id}`} className="block text-xs text-accent hover:underline truncate">{p.title}</Link>
                  ))}
                </div>
              )}
              {usage.pages.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pages</p>
                  {usage.pages.map((p) => (
                    <Link key={p.id} href={`/admin/pages/${p.id}/edit`} className="block text-xs text-accent hover:underline truncate">{p.title}</Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border space-y-2">
        <button
          onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded text-sm hover:bg-muted"
        >
          <Download className="w-4 h-4" /> Download
        </button>

        <button
          onClick={() => replaceRef.current?.click()}
          disabled={replacing}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded text-sm hover:bg-muted disabled:opacity-50"
        >
          {replacing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Replace file
        </button>
        <input ref={replaceRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleReplace} />

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-destructive/50 text-destructive rounded text-sm hover:bg-destructive/5"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        ) : (
          <div className="space-y-1">
            {(usage?.total_uses ?? 0) > 0 && (
              <p className="text-xs text-yellow-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Used in {usage!.total_uses} place{usage!.total_uses !== 1 ? 's' : ''} — deleting will break references
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 px-3 py-1.5 border border-border rounded text-xs">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 px-3 py-1.5 bg-destructive text-white rounded text-xs disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Media Library Tab ─────────────────────────────────────────────────────────

function MediaLibraryTab() {
  const [search, setSearch] = useState('');
  const [mimeFilter, setMimeFilter] = useState('');
  const [inUseFilter, setInUseFilter] = useState('');
  const [sort, setSort] = useState('date');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeItem, setActiveItem] = useState<MediaItem | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [filesInUseForBulk, setFilesInUseForBulk] = useState<number>(0);

  const params = new URLSearchParams({
    page: String(page),
    limit: '40',
    ...(search ? { search } : {}),
    ...(mimeFilter ? { mime_type: mimeFilter } : {}),
    ...(inUseFilter ? { in_use: inUseFilter } : {}),
    ...(sort ? { sort } : {}),
  });

  const { data, isLoading } = useSWR<{ data: MediaItem[]; meta: { total: number; total_pages: number } }>(
    `/media?${params}`,
    fetcher,
  );

  const refreshAll = () => {
    mutate((key: string) => typeof key === 'string' && key.startsWith('/media'));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDeleteClick = async () => {
    const ids = Array.from(selected);
    let inUseCount = 0;
    for (const id of ids) {
      try {
        const res = await adminApi.get<UsageData>(`/media/${id}/usage`);
        if (res.data.total_uses > 0) inUseCount++;
      } catch { /* ignore */ }
    }
    setFilesInUseForBulk(inUseCount);
    setBulkConfirm(true);
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const res = await adminApi.delete('/media/bulk', { data: { ids: Array.from(selected) } });
      const { deleted, failed } = res.data as { deleted: string[]; failed: { id: string; error: string }[] };
      setBulkResult(`Deleted ${deleted.length} file${deleted.length !== 1 ? 's' : ''}${failed.length ? `; ${failed.length} failed` : ''}.`);
      setSelected(new Set());
      if (activeItem && selected.has(activeItem.id)) setActiveItem(null);
      refreshAll();
    } finally {
      setBulkDeleting(false);
      setBulkConfirm(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <BulkUploader onDone={refreshAll} />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          className="flex-1 min-w-40 text-sm border border-border rounded px-3 py-1.5 bg-background"
          placeholder="Search files…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select
          className="text-sm border border-border rounded px-2 py-1.5 bg-background"
          value={mimeFilter}
          onChange={(e) => { setMimeFilter(e.target.value); setPage(1); }}
        >
          <option value="">All types</option>
          <option value="image">Images</option>
          <option value="application/pdf">PDFs</option>
        </select>
        <select
          className="text-sm border border-border rounded px-2 py-1.5 bg-background"
          value={inUseFilter}
          onChange={(e) => { setInUseFilter(e.target.value); setPage(1); }}
        >
          <option value="">All</option>
          <option value="true">In use</option>
          <option value="false">Unused</option>
        </select>
        <select
          className="text-sm border border-border rounded px-2 py-1.5 bg-background"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="date">Newest first</option>
          <option value="name">Name A–Z</option>
          <option value="size">Largest first</option>
        </select>
      </div>

      {/* Selection bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 p-2 bg-accent/10 rounded-lg">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button
            onClick={handleBulkDeleteClick}
            className="flex items-center gap-1.5 text-sm text-destructive hover:underline"
          >
            <Trash2 className="w-4 h-4" /> Delete selected
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-muted-foreground hover:underline ml-auto">
            Clear selection
          </button>
        </div>
      )}

      {bulkResult && (
        <div className="mb-3 text-sm text-muted-foreground bg-muted rounded p-2">{bulkResult}
          <button onClick={() => setBulkResult(null)} className="ml-2 text-xs underline">dismiss</button>
        </div>
      )}

      {/* Grid + Detail panel */}
      <div className="flex flex-1 gap-4 min-h-0">
        <div className={`flex-1 overflow-y-auto ${activeItem ? 'pr-2' : ''}`}>
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data?.data.length ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <ImageIcon className="w-10 h-10 mb-2" />
              <p className="text-sm">No media files found</p>
            </div>
          ) : (
            <div className={`grid gap-3 ${activeItem ? 'grid-cols-3 lg:grid-cols-4' : 'grid-cols-4 lg:grid-cols-6'}`}>
              {data.data.map((item) => (
                <MediaThumb
                  key={item.id}
                  item={item}
                  selected={selected.has(item.id)}
                  onSelect={() => toggleSelect(item.id)}
                  onClick={() => setActiveItem(activeItem?.id === item.id ? null : item)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data && data.meta.total_pages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
              <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} / {data.meta.total_pages}</span>
              <button disabled={page === data.meta.total_pages} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
            </div>
          )}
        </div>

        {activeItem && (
          <DetailPanel
            key={activeItem.id}
            item={activeItem}
            onClose={() => setActiveItem(null)}
            onDeleted={(id) => { setActiveItem(null); setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; }); refreshAll(); }}
            onReplaced={() => { setActiveItem(null); refreshAll(); }}
          />
        )}
      </div>

      {/* Bulk delete modal */}
      {bulkConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="font-semibold text-foreground">Delete {selected.size} file{selected.size !== 1 ? 's' : ''}?</h3>
            {filesInUseForBulk > 0 && (
              <div className="flex items-start gap-2 text-sm text-yellow-600 bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/20">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{filesInUseForBulk} of the {selected.size} selected file{selected.size !== 1 ? 's are' : ' is'} referenced in content. Deleting will break those references.</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setBulkConfirm(false)} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-surface-raised transition-colors">Cancel</button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50 transition-colors">
                {bulkDeleting ? 'Deleting…' : `Delete ${selected.size} file${selected.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Digital Files Tab ─────────────────────────────────────────────────────────

function DigitalFilesTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({
    page: String(page),
    limit: '50',
    ...(search ? { search } : {}),
  });

  const { data, isLoading } = useSWR<{ data: DigitalFile[]; meta: { total: number; total_pages: number } }>(
    `/digital-products/files/all?${params}`,
    fetcher,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded p-3">
        <FolderOpen className="w-4 h-4 shrink-0" />
        <p>Digital source files are managed from each product&apos;s edit page. Click a product name to go there.</p>
      </div>

      <input
        className="w-full text-sm border border-border rounded px-3 py-1.5 bg-background"
        placeholder="Search by product name…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.data.length ? (
        <div className="text-center text-muted-foreground py-12 text-sm">No digital files found</div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs font-medium text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Format</th>
                <th className="text-left px-4 py-2">Product</th>
                <th className="text-left px-4 py-2 hidden lg:table-cell">Storage path</th>
                <th className="text-left px-4 py-2">Flags</th>
                <th className="text-left px-4 py-2">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.data.map((f) => (
                <tr key={f.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <span className="inline-block px-2 py-0.5 rounded bg-accent/10 text-accent text-xs font-mono uppercase">{f.format}</span>
                  </td>
                  <td className="px-4 py-2">
                    {f.product ? (
                      <Link href={`/admin/products/${f.product.id}`} className="text-accent hover:underline font-medium">
                        {f.product.title}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground italic">Product deleted</span>
                    )}
                  </td>
                  <td className="px-4 py-2 hidden lg:table-cell">
                    <span className="font-mono text-xs text-muted-foreground break-all">{f.file_path}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {f.personalization_enabled && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${f.personalization_tested ? 'bg-green-500/10 text-green-700' : 'bg-yellow-500/10 text-yellow-700'}`}>
                          {f.personalization_tested ? '✓ personalized' : '⚠ untested'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(f.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.meta.total_pages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} / {data.meta.total_pages}</span>
          <button disabled={page === data.meta.total_pages} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

// ── Root Component ─────────────────────────────────────────────────────────────

export function MediaLibraryClient() {
  const [tab, setTab] = useState<'media' | 'digital'>('media');

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Media</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {(['media', 'digital'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-accent text-accent' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'media' ? 'Media Library' : 'Digital Files'}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'media' ? <MediaLibraryTab /> : <DigitalFilesTab />}
      </div>
    </div>
  );
}
