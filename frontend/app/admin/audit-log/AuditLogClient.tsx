'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { ChevronDown, ChevronRight, Search, Filter } from 'lucide-react';
import adminApi from '@/lib/adminApi';

interface AuditEntry {
  id: string;
  event_type: string;
  user_id?: string;
  ip_address?: string;
  resource_type?: string;
  resource_id?: string;
  changes?: object;
  metadata?: object;
  created_at: string;
}

interface ApiResponse {
  data: AuditEntry[];
  meta: { total: number; page: number; limit: number; total_pages: number };
}

const fetcher = (url: string) => adminApi.get(url).then((r) => r.data);

const EVENT_TYPE_OPTIONS = [
  '', 'auth.login', 'auth.login_failed', 'auth.logout', 'auth.2fa_success', 'auth.sessions_revoked',
  'order.status_changed', 'order.refund_initiated',
  'article.created', 'article.updated', 'article.published', 'article.unpublished', 'article.deleted',
  'product.created', 'product.updated', 'product.deleted',
  'page.created', 'page.updated', 'page.published', 'page.unpublished', 'page.deleted',
  'comment.moderated',
  'media.uploaded', 'media.deleted',
];

const RESOURCE_TYPE_OPTIONS = ['', 'order', 'article', 'product', 'page', 'comment', 'media'];

export function AuditLogClient() {
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: '30' });
  if (eventType) params.set('event_type', eventType);
  if (resourceType) params.set('resource_type', resourceType);
  if (search) params.set('resource_id', search);

  const { data, isLoading, error } = useSWR<ApiResponse>(
    `/audit-logs?${params}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const entries = data?.data ?? [];
  const meta = data?.meta;

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function badgeColor(eventType: string) {
    if (eventType.startsWith('auth.login_failed')) return 'bg-red-500/20 text-red-400';
    if (eventType.startsWith('auth.')) return 'bg-blue-500/20 text-blue-400';
    if (eventType.startsWith('order.')) return 'bg-amber-500/20 text-amber-400';
    if (eventType.includes('.deleted')) return 'bg-red-500/20 text-red-400';
    if (eventType.includes('.published')) return 'bg-green-500/20 text-green-400';
    return 'bg-foreground/10 text-foreground/70';
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Audit Log</h1>
        <p className="text-foreground/60 mt-1">System-wide event trail. Owner-only view.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
          <input
            type="text"
            placeholder="Resource ID…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-primary w-48"
          />
        </div>
        <div className="relative flex items-center gap-2">
          <Filter className="w-4 h-4 text-foreground/40" />
          <select
            value={eventType}
            onChange={(e) => { setEventType(e.target.value); setPage(1); }}
            className="py-2 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
          >
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt || 'All events'}</option>
            ))}
          </select>
        </div>
        <select
          value={resourceType}
          onChange={(e) => { setResourceType(e.target.value); setPage(1); }}
          className="py-2 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-primary"
        >
          {RESOURCE_TYPE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt || 'All resources'}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-foreground/5 text-foreground/60 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left w-8"></th>
              <th className="px-4 py-3 text-left">Event</th>
              <th className="px-4 py-3 text-left">Resource</th>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-foreground/50">Loading…</td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-red-500">Failed to load audit log.</td>
              </tr>
            )}
            {!isLoading && !error && entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-foreground/50">No entries found.</td>
              </tr>
            )}
            {entries.map((entry) => (
              <React.Fragment key={entry.id}>
                <tr
                  className="hover:bg-foreground/5 cursor-pointer"
                  onClick={() => toggleRow(entry.id)}
                >
                  <td className="px-4 py-3 text-foreground/40">
                    {expandedId === entry.id
                      ? <ChevronDown className="w-4 h-4" />
                      : <ChevronRight className="w-4 h-4" />}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-mono ${badgeColor(entry.event_type)}`}>
                      {entry.event_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {entry.resource_type
                      ? <span className="font-mono text-xs">{entry.resource_type}/{entry.resource_id?.slice(0, 8)}…</span>
                      : <span className="text-foreground/30">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-foreground/70 font-mono text-xs">
                    {entry.user_id ? entry.user_id.slice(0, 8) + '…' : <span className="text-foreground/30">system</span>}
                  </td>
                  <td className="px-4 py-3 text-foreground/50 text-xs whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                </tr>
                {expandedId === entry.id && (
                  <tr className="bg-foreground/3">
                    <td colSpan={5} className="px-6 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {entry.changes && (
                          <div>
                            <h4 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-2">Changes</h4>
                            <pre className="text-xs bg-background border border-border rounded p-3 overflow-auto max-h-40">
                              {JSON.stringify(entry.changes, null, 2)}
                            </pre>
                          </div>
                        )}
                        {entry.metadata && (
                          <div>
                            <h4 className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-2">Metadata</h4>
                            <pre className="text-xs bg-background border border-border rounded p-3 overflow-auto max-h-40">
                              {JSON.stringify(entry.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                        {entry.ip_address && (
                          <p className="text-xs text-foreground/50">IP: {entry.ip_address}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-foreground/50">
            {meta.total} entries · page {meta.page} of {meta.total_pages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-foreground/5"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= meta.total_pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-40 hover:bg-foreground/5"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
