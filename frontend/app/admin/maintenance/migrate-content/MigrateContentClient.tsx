'use client';

import { useState, useCallback } from 'react';
import { useEditor } from '@tiptap/react';
import adminApi from '@/lib/adminApi';
import { getErrorMessage } from '@/lib/api';
import { getEditorExtensions } from '@/components/editor/extensions';
import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';

interface MigrationResult {
  id: string;
  title: string;
  type: 'article' | 'product';
  status: 'ok' | 'error' | 'skipped';
  note?: string;
}

export function MigrateContentClient() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<MigrationResult[]>([]);
  const [done, setDone] = useState(false);

  const conversionEditor = useEditor({
    immediatelyRender: false,
    extensions: getEditorExtensions(),
    content: '',
  });

  const htmlToJson = useCallback((html: string): string => {
    if (!conversionEditor) throw new Error('Editor not ready');
    conversionEditor.commands.setContent(html);
    return JSON.stringify(conversionEditor.getJSON());
  }, [conversionEditor]);

  const isAlreadyJson = (s: string) => {
    try { const p = JSON.parse(s); return typeof p === 'object' && p.type === 'doc'; }
    catch { return false; }
  };

  const runMigration = useCallback(async () => {
    if (!conversionEditor) return;
    setRunning(true);
    setResults([]);
    setDone(false);
    const log: MigrationResult[] = [];

    const push = (r: MigrationResult) => { log.push(r); setResults([...log]); };

    try {
      const articlesRes = await adminApi.get('/articles?limit=200&page=1');
      const articles: any[] = articlesRes.data?.data ?? [];

      for (const a of articles) {
        if (!a.content) { push({ id: a.id, title: a.title, type: 'article', status: 'skipped', note: 'No content' }); continue; }
        if (isAlreadyJson(a.content)) { push({ id: a.id, title: a.title, type: 'article', status: 'skipped', note: 'Already JSON' }); continue; }
        try {
          const json = htmlToJson(a.content);
          await adminApi.patch(`/articles/${a.id}`, { content: json });
          push({ id: a.id, title: a.title, type: 'article', status: 'ok' });
        } catch (e) {
          push({ id: a.id, title: a.title, type: 'article', status: 'error', note: getErrorMessage(e) });
        }
      }

      const productsRes = await adminApi.get('/products?limit=200&page=1');
      const products: any[] = productsRes.data?.data ?? [];

      for (const p of products) {
        if (!p.description) { push({ id: p.id, title: p.title, type: 'product', status: 'skipped', note: 'No description' }); continue; }
        if (isAlreadyJson(p.description)) { push({ id: p.id, title: p.title, type: 'product', status: 'skipped', note: 'Already JSON' }); continue; }
        try {
          const json = htmlToJson(p.description);
          await adminApi.patch(`/products/${p.id}`, { description: json });
          push({ id: p.id, title: p.title, type: 'product', status: 'ok' });
        } catch (e) {
          push({ id: p.id, title: p.title, type: 'product', status: 'error', note: getErrorMessage(e) });
        }
      }
    } catch (e) {
      push({ id: 'global', title: 'Migration failed', type: 'article', status: 'error', note: getErrorMessage(e) });
    }

    setRunning(false);
    setDone(true);
  }, [conversionEditor, htmlToJson]);

  const counts = results.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Content Migration Tool</h1>
      <p className="text-foreground/60 text-sm mb-6">
        Converts all article and product HTML content to TipTap JSON format.
        Already-migrated content is skipped. Safe to run multiple times.
      </p>

      {!running && !done && (
        <div className="p-4 border border-yellow-500/40 bg-yellow-500/10 rounded-lg mb-6 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-1">Before running:</p>
            <ul className="list-disc list-inside space-y-1 text-foreground/70">
              <li>Back up your database</li>
              <li>Run only once — or verify &quot;already JSON&quot; skips work correctly</li>
              <li>Keep this page open until migration completes</li>
            </ul>
          </div>
        </div>
      )}

      <button
        onClick={runMigration}
        disabled={running || !conversionEditor}
        className="px-6 py-2.5 bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2 mb-6"
      >
        {running && <Loader2 className="w-4 h-4 animate-spin" />}
        {running ? 'Migrating…' : done ? 'Run Again' : 'Start Migration'}
      </button>

      {done && (
        <div className="flex gap-4 text-sm mb-4">
          <span className="text-green-500">✓ {counts.ok ?? 0} converted</span>
          <span className="text-foreground/50">⊘ {counts.skipped ?? 0} skipped</span>
          {(counts.error ?? 0) > 0 && <span className="text-red-500">✕ {counts.error} errors</span>}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1 max-h-[500px] overflow-y-auto border border-border rounded-lg p-3">
          {results.map((r) => (
            <div key={`${r.type}-${r.id}`} className="flex items-center gap-2 text-sm py-0.5">
              {r.status === 'ok'      && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
              {r.status === 'error'   && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
              {r.status === 'skipped' && <span className="w-4 h-4 flex-shrink-0 text-foreground/30 text-center">–</span>}
              <span className={`flex-1 truncate ${r.status === 'error' ? 'text-red-400' : r.status === 'skipped' ? 'text-foreground/40' : ''}`}>
                [{r.type}] {r.title}
              </span>
              {r.note && <span className="text-xs text-foreground/40 flex-shrink-0">{r.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
