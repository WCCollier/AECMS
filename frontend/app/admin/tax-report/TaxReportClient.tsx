'use client';

import { useState } from 'react';
import { Receipt, Loader2, Download } from 'lucide-react';
import adminApi from '@/lib/adminApi';
import { getErrorMessage } from '@/lib/api';

interface TaxOrder {
  order_number: string;
  date: string;
  total: number;
  tax_cents: number;
  tax_dollars: string;
  state: string | null;
  payment_method: string | null;
}

interface TaxReport {
  from: string;
  to: string;
  total_tax_cents: number;
  total_tax_dollars: string;
  order_count: number;
  by_state: { state: string; tax_cents: number; tax_dollars: string }[];
  orders: TaxOrder[];
}

const thisYear = new Date().getFullYear();
const defaultFrom = `${thisYear}-01-01`;
const defaultTo = new Date().toISOString().slice(0, 10);

function downloadCsv(report: TaxReport) {
  const rows = [
    ['Order #', 'Date', 'State', 'Payment', 'Order Total', 'Tax Collected'],
    ...report.orders.map((o) => [
      o.order_number, o.date, o.state ?? '', o.payment_method ?? '',
      `$${o.total.toFixed(2)}`, `$${o.tax_dollars}`,
    ]),
    [],
    ['TOTAL', '', '', '', '', `$${report.total_tax_dollars}`],
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tax-report-${report.from}-${report.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TaxReportClient() {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [report, setReport] = useState<TaxReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.get(`/orders/tax-report?from=${from}&to=${to}`);
      setReport(res.data);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Receipt className="w-5 h-5 text-accent" />
        <h1 className="text-xl font-semibold">Tax Report</h1>
      </div>

      {/* Date range */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-foreground/60 mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent/40" />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground/60 mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent/40" />
        </div>
        <button onClick={handleRun} disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Run Report
        </button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {report && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface border border-border rounded-xl p-4">
              <p className="text-xs text-foreground/50 mb-1">Total Tax Collected</p>
              <p className="text-2xl font-bold">${report.total_tax_dollars}</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <p className="text-xs text-foreground/50 mb-1">Orders with Tax</p>
              <p className="text-2xl font-bold">{report.order_count}</p>
            </div>
            <div className="bg-surface border border-border rounded-xl p-4">
              <p className="text-xs text-foreground/50 mb-1">Period</p>
              <p className="text-sm font-medium">{report.from} → {report.to}</p>
            </div>
          </div>

          {/* By state */}
          {report.by_state.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2">By State</h2>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface border-b border-border">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-foreground/60 uppercase">State</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-foreground/60 uppercase">Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.by_state.map((s) => (
                      <tr key={s.state} className="border-b border-border last:border-0">
                        <td className="px-4 py-2">{s.state}</td>
                        <td className="px-4 py-2 text-right font-mono">${s.tax_dollars}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Order list */}
          {report.orders.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">Orders</h2>
                <button onClick={() => downloadCsv(report)}
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                  <Download className="w-3 h-3" /> Export CSV
                </button>
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface border-b border-border">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-foreground/60 uppercase">Order</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-foreground/60 uppercase">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-foreground/60 uppercase">State</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-foreground/60 uppercase">Total</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-foreground/60 uppercase">Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.orders.map((o) => (
                      <tr key={o.order_number} className="border-b border-border last:border-0 hover:bg-surface/50">
                        <td className="px-4 py-2 font-mono text-xs">#{o.order_number}</td>
                        <td className="px-4 py-2 text-foreground/60">{o.date}</td>
                        <td className="px-4 py-2 text-foreground/60">{o.state ?? '—'}</td>
                        <td className="px-4 py-2 text-right">${o.total.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-mono">${o.tax_dollars}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground/50">No tax collected in this period.</p>
          )}
        </>
      )}
    </div>
  );
}
