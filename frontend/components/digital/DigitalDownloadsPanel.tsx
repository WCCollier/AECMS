'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Download, Send, RefreshCcw, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { fetcher } from '@/lib/swr';
import type { DigitalDownload } from '@/types';
import { KindleWizard } from './KindleWizard';

interface Props {
  orderId: string;
}

function DownloadBar({ count, max }: { count: number; max: number }) {
  const remaining = Math.max(0, max - count);
  const pct = max > 0 ? Math.min(100, (remaining / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-foreground/50">
      <div className="w-24 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span>{remaining} of {max} remaining</span>
    </div>
  );
}

export function DigitalDownloadsPanel({ orderId }: Props) {
  const { data: downloads, isLoading, mutate } = useSWR<DigitalDownload[]>(
    orderId ? `/digital-products/orders/${orderId}/downloads` : null,
    fetcher,
  );
  const [kindleTarget, setKindleTarget] = useState<DigitalDownload | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [regenerated, setRegenerated] = useState<string | null>(null);

  if (isLoading) return null;
  if (!downloads || downloads.length === 0) return null;

  const expired = (d: DigitalDownload) => new Date(d.expiresAt) < new Date();
  const exhausted = (d: DigitalDownload) => d.downloadCount >= d.maxDownloads;

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

  // Find earliest expiry
  const earliestExpiry = downloads.reduce<Date | null>((acc, d) => {
    const exp = new Date(d.expiresAt);
    return acc === null || exp < acc ? exp : acc;
  }, null);

  // Group by product name
  const byProduct = downloads.reduce<Record<string, DigitalDownload[]>>((acc, d) => {
    const key = d.productName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  return (
    <>
      <div className="bg-surface border border-border rounded-xl p-6 mt-6">
        <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-accent" />
          Your Digital Downloads
        </h2>

        <div className="space-y-6">
          {Object.entries(byProduct).map(([productName, productDownloads]) => (
            <div key={productName}>
              <p className="font-medium mb-3">{productName}</p>
              <div className="space-y-3 pl-2">
                {productDownloads.map((d) => {
                  const isExpired = expired(d);
                  const isExhausted = exhausted(d);
                  const unavailable = isExpired || isExhausted;

                  return (
                    <div key={d.id} className={`flex items-center justify-between gap-4 p-3 rounded-lg border ${unavailable ? 'border-red-500/20 bg-red-500/5' : 'border-border bg-foreground/3'}`}>
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
                              <CheckCircle className="w-3 h-3" /> Regenerated
                            </span>
                          )}
                        </div>
                        {!unavailable && <DownloadBar count={d.downloadCount} max={d.maxDownloads} />}
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
                            <a
                              href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/digital-products/download/${d.downloadToken}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-accent hover:text-white hover:border-accent transition-colors"
                              onClick={() => setTimeout(() => mutate(), 2000)}
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </a>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setKindleTarget(d)}
                            >
                              <Send className="w-3 h-3 mr-1" />
                              Kindle
                            </Button>
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

        {earliestExpiry && (
          <p className="text-xs text-foreground/40 mt-4">
            Links expire: {earliestExpiry.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        )}
      </div>

      {kindleTarget && (
        <KindleWizard
          download={kindleTarget}
          onClose={() => { setKindleTarget(null); mutate(); }}
        />
      )}
    </>
  );
}
