'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Download, RefreshCcw, Clock, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui';
import adminApi from '@/lib/adminApi';
import { getErrorMessage } from '@/lib/api';
import type { DigitalDownload } from '@/types';

const adminFetcher = (url: string) => adminApi.get(url).then((r) => r.data);

function UsageBar({ count, max }: { count: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-foreground/50">
      <div className="w-20 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span>{count} of {max} used</span>
    </div>
  );
}

interface Props {
  orderId: string;
}

export function AdminDigitalPanel({ orderId }: Props) {
  const { data: downloads, isLoading, mutate } = useSWR<DigitalDownload[]>(
    orderId ? `/digital-products/orders/${orderId}/downloads` : null,
    adminFetcher,
  );

  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [extending, setExtending] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState<Record<string, string>>({});

  if (isLoading) return <p className="text-sm text-foreground/50 animate-pulse">Loading download records…</p>;
  if (!downloads || downloads.length === 0) {
    return (
      <p className="text-sm text-foreground/50">
        No download tokens yet. Tokens are created automatically when payment is confirmed.
      </p>
    );
  }

  const handleRegenerate = async (id: string) => {
    setRegenerating(id);
    try {
      await adminApi.post(`/digital-products/downloads/${id}/regenerate`);
      mutate();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setRegenerating(null);
    }
  };

  const handleExtend = async (id: string) => {
    const days = parseInt(extendDays[id] ?? '30', 10);
    if (!days || days < 1) return;
    setExtending(id);
    try {
      await adminApi.post(`/digital-products/downloads/${id}/extend`, { days });
      mutate();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setExtending(null);
    }
  };

  // Group by product name
  const byProduct = downloads.reduce<Record<string, DigitalDownload[]>>((acc, d) => {
    const key = d.productName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {Object.entries(byProduct).map(([productName, productDownloads]) => (
        <div key={productName}>
          <p className="text-sm font-semibold mb-3 text-foreground/80">{productName}</p>
          <div className="space-y-3">
            {productDownloads.map((d) => {
              const expired = new Date(d.expiresAt) < new Date();
              return (
                <div
                  key={d.id}
                  className={`p-4 rounded-lg border ${expired ? 'border-red-500/20 bg-red-500/5' : 'border-border bg-foreground/3'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-semibold uppercase tracking-wider bg-foreground/10 text-foreground/60 px-2 py-0.5 rounded">
                      {d.format.toUpperCase()}
                    </span>
                    {expired && <span className="text-xs text-red-500 font-medium">Expired</span>}
                  </div>

                  <UsageBar count={d.downloadCount} max={d.maxDownloads} />

                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-foreground/50">
                    {d.kindleSendCount > 0 && (
                      <div className="flex items-center gap-1">
                        <Smartphone className="w-3 h-3" />
                        Kindle sends: {d.kindleSendCount}
                      </div>
                    )}
                    {d.lastDownloadedAt && (
                      <div className="flex items-center gap-1">
                        <Download className="w-3 h-3" />
                        Last downloaded: {new Date(d.lastDownloadedAt).toLocaleDateString()}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Expires: {new Date(d.expiresAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-foreground/10 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRegenerate(d.id)}
                      isLoading={regenerating === d.id}
                    >
                      <RefreshCcw className="w-3 h-3 mr-1" />
                      Regenerate token
                    </Button>

                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={extendDays[d.id] ?? '30'}
                        onChange={(e) => setExtendDays((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        className="w-14 px-2 py-1 text-xs rounded border border-foreground/20 bg-background"
                      />
                      <span className="text-xs text-foreground/50">days</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExtend(d.id)}
                        isLoading={extending === d.id}
                      >
                        Extend expiry
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
