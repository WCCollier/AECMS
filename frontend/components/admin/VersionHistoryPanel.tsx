'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { History, RotateCcw, ChevronDown, ChevronUp, X } from 'lucide-react';
import adminApi from '@/lib/adminApi';

interface Version {
  id: string;
  version_number: number;
  title: string;
  change_summary?: string;
  created_by: string;
  created_at: string;
}

interface Props {
  resourceType: 'articles' | 'products' | 'pages';
  resourceId: string;
  refreshKey?: number;
  onRestored?: () => void;
}

const fetcher = (url: string) => adminApi.get(url).then((r) => r.data);

export function VersionHistoryPanel({ resourceType, resourceId, refreshKey = 0, onRestored }: Props) {
  const [open, setOpen] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<number | null>(null);

  const { data, error, isLoading } = useSWR(
    open && resourceId ? `/${resourceType}/${resourceId}/versions?limit=50&_r=${refreshKey}` : null,
    fetcher,
  );

  const versions: Version[] = data?.data ?? [];

  async function handleRestore(vnum: number) {
    setRestoring(vnum);
    setRestoreError(null);
    try {
      await adminApi.post(`/${resourceType}/${resourceId}/versions/${vnum}/restore`);
      setConfirmRestore(null);
      onRestored?.();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Restore failed';
      setRestoreError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-3 bg-foreground/5 hover:bg-foreground/10 transition-colors text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <History className="w-4 h-4" />
          Version History
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="divide-y divide-border max-h-96 overflow-y-auto">
          {isLoading && (
            <div className="px-4 py-6 text-center text-foreground/50 text-sm">Loading…</div>
          )}
          {error && (
            <div className="px-4 py-4 text-red-500 text-sm">Failed to load versions.</div>
          )}
          {!isLoading && !error && versions.length === 0 && (
            <div className="px-4 py-6 text-center text-foreground/50 text-sm">No versions saved yet.</div>
          )}
          {versions.map((v) => (
            <div key={v.id} className="px-4 py-3 flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  className="text-sm font-medium hover:text-primary text-left w-full truncate"
                  onClick={() => setSelectedVersion(selectedVersion === v.version_number ? null : v.version_number)}
                >
                  v{v.version_number} — {v.title}
                </button>
                <p className="text-xs text-foreground/50 mt-0.5">
                  {new Date(v.created_at).toLocaleString()}
                  {v.change_summary ? ` · ${v.change_summary}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmRestore(v.version_number)}
                className="shrink-0 text-xs text-foreground/50 hover:text-primary flex items-center gap-1 mt-0.5"
                title="Restore this version as a new draft"
              >
                <RotateCcw className="w-3 h-3" />
                Restore
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Restore confirmation modal */}
      {confirmRestore !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-background border border-border rounded-xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-lg">Restore version {confirmRestore}?</h3>
              <button type="button" onClick={() => setConfirmRestore(null)}>
                <X className="w-5 h-5 text-foreground/50" />
              </button>
            </div>
            <p className="text-sm text-foreground/70 mb-6">
              The title and content will be replaced with version {confirmRestore}. Navigation settings, slug, and visibility are not affected. A new draft will be created — you can review and publish when ready.
            </p>
            {restoreError && (
              <p className="text-sm text-red-500 mb-4 bg-red-500/10 border border-red-500/30 rounded p-2">
                {restoreError}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setConfirmRestore(null); setRestoreError(null); }}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-foreground/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRestore(confirmRestore)}
                disabled={restoring === confirmRestore}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {restoring === confirmRestore ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
