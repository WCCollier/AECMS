'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { BookOpen, Download, Send, RefreshCcw, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { fetcher } from '@/lib/swr';
import api from '@/lib/api';
import type { DigitalDownload } from '@/types';
import { KindleWizard } from './KindleWizard';

function DownloadBar({ count, max }: { count: number; max: number }) {
  const remaining = Math.max(0, max - count);
  const pct = max > 0 ? Math.min(100, (remaining / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-foreground/50">
      <div className="w-24 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span>{remaining} of {max} remaining</span>
    </div>
  );
}

export function DigitalLibraryPanel() {
  const { data: downloads, isLoading, mutate } = useSWR<DigitalDownload[]>(
    '/digital-products/my-downloads',
    fetcher,
  );
  const [kindleTarget, setKindleTarget] = useState<DigitalDownload | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [regenerated, setRegenerated] = useState<string | null>(null);

  if (isLoading || !downloads || downloads.length === 0) return null;

  const expired = (d: DigitalDownload) => new Date(d.expiresAt) < new Date();
  const exhausted = (d: DigitalDownload) => d.downloadCount >= d.maxDownloads;

  const handleDownload = async (d: DigitalDownload) => {
    setDownloading(d.id);
    try {
      const res = await api.get(`/digital-products/download/${d.downloadToken}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: res.headers['content-type'] ?? 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${d.productName}-${d.format}.${d.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setTimeout(() => mutate(), 1500);
    } catch {
      alert('Download failed. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  const handleRegenerate = async (downloadId: string) => {
    setRegenerating(downloadId);
    try {
      const res = await fetch(`/api/digital-products/downloads/${downloadId}/regenerate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}` },
      });
      if (res.ok) {
        setRegenerated(downloadId);
        mutate();
      }
    } finally {
      setRegenerating(null);
    }
  };

  // Group by product name, sorting active before expired/exhausted
  const byProduct = downloads.reduce<Record<string, DigitalDownload[]>>((acc, d) => {
    if (!acc[d.productName]) acc[d.productName] = [];
    acc[d.productName].push(d);
    return acc;
  }, {});

  const activeCount = downloads.filter((d) => !expired(d) && !exhausted(d)).length;

  return (
    <>
      <section className="bg-surface border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-accent" />
            Digital Library
          </h2>
          {activeCount > 0 && (
            <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">
              {activeCount} active {activeCount === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        <div className="space-y-6">
          {Object.entries(byProduct).map(([productName, productDownloads]) => (
            <div key={productName}>
              <p className="font-medium text-sm mb-2">{productName}</p>
              <div className="space-y-2 pl-2">
                {productDownloads.map((d) => {
                  const isExpired = expired(d);
                  const isExhausted = exhausted(d);
                  const unavailable = isExpired || isExhausted;

                  return (
                    <div
                      key={d.id}
                      className={`flex items-center justify-between gap-4 p-3 rounded-lg border ${
                        unavailable ? 'border-red-500/20 bg-red-500/5 opacity-60' : 'border-border bg-foreground/3'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-foreground/60 bg-foreground/10 px-2 py-0.5 rounded">
                            {d.format}
                          </span>
                          {isExpired && (
                            <span className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Expired
                            </span>
                          )}
                          {isExhausted && !isExpired && (
                            <span className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Limit reached
                            </span>
                          )}
                          {regenerated === d.id && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Renewal requested
                            </span>
                          )}
                        </div>
                        {!unavailable && <DownloadBar count={d.downloadCount} max={d.maxDownloads} />}
                        <p className="text-xs text-foreground/40 mt-1">
                          {isExpired
                            ? `Expired ${new Date(d.expiresAt).toLocaleDateString()}`
                            : `Expires ${new Date(d.expiresAt).toLocaleDateString()}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {unavailable ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRegenerate(d.id)}
                            isLoading={regenerating === d.id}
                          >
                            <RefreshCcw className="w-3 h-3 mr-1" />
                            Request renewal
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownload(d)}
                              isLoading={downloading === d.id}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Download
                            </Button>
                            {d.format === 'epub' && (
                              <Button size="sm" variant="outline" onClick={() => setKindleTarget(d)}>
                                <Send className="w-3 h-3 mr-1" />
                                Kindle
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {kindleTarget && (
        <KindleWizard
          download={kindleTarget}
          onClose={() => { setKindleTarget(null); mutate(); }}
        />
      )}
    </>
  );
}
