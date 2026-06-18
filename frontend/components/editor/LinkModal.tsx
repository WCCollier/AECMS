'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, FileText, ShoppingBag, Globe, X, Loader2, LayoutDashboard } from 'lucide-react';
import adminApi from '@/lib/adminApi';

type Tab = 'pages' | 'articles' | 'products' | 'external';

interface InternalItem {
  id: string;
  title: string;
  href: string;
}

interface LinkModalProps {
  isOpen: boolean;
  initialHref?: string;
  initialTarget?: string;
  onApply: (href: string, target: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

function detectInitialTab(href: string | undefined): Tab {
  if (!href) return 'pages';
  if (href.startsWith('/articles/')) return 'articles';
  if (href.startsWith('/products/')) return 'products';
  if (href.startsWith('/') || href.startsWith('#')) return 'pages';
  return 'external';
}

const TAB_CONFIG: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'pages',    label: 'Pages',    icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
  { id: 'articles', label: 'Articles', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'products', label: 'Products', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
  { id: 'external', label: 'URL',      icon: <Globe className="w-3.5 h-3.5" /> },
];

export function LinkModal({ isOpen, initialHref, initialTarget, onApply, onRemove, onClose }: LinkModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>(() => detectInitialTab(initialHref));
  const [search, setSearch] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [newTab, setNewTab] = useState(false);
  const [selected, setSelected] = useState<string>('');

  const [pages, setPages] = useState<InternalItem[]>([]);
  const [articles, setArticles] = useState<InternalItem[]>([]);
  const [products, setProducts] = useState<InternalItem[]>([]);
  const [loading, setLoading] = useState<Tab | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const tab = detectInitialTab(initialHref);
    setActiveTab(tab);
    setNewTab(initialTarget === '_blank');
    setSearch('');
    if (tab === 'external') {
      setExternalUrl(initialHref ?? '');
      setSelected('');
    } else {
      setExternalUrl('');
      setSelected(initialHref ?? '');
    }
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [isOpen, initialHref, initialTarget]);

  const fetchItems = useCallback(async (tab: Tab, q: string) => {
    if (tab === 'external') return;
    setLoading(tab);
    try {
      if (tab === 'pages') {
        const res = await adminApi.get('/pages', { params: { search: q || undefined, limit: 100 } });
        const items = (res.data.data ?? res.data).filter((p: any) => p.slug !== '_home_');
        setPages(items.map((p: any) => ({ id: p.id, title: p.title, href: `/${p.slug}` })));
      } else if (tab === 'articles') {
        const res = await adminApi.get('/articles', { params: { search: q || undefined, limit: 100, status: 'published' } });
        const items = res.data.data ?? res.data;
        setArticles(items.map((a: any) => ({ id: a.id, title: a.title, href: `/articles/${a.slug}` })));
      } else if (tab === 'products') {
        const res = await adminApi.get('/products', { params: { search: q || undefined, limit: 100, status: 'published' } });
        const items = res.data.data ?? res.data;
        setProducts(items.map((p: any) => ({ id: p.id, title: p.title, href: `/products/${p.slug}` })));
      }
    } catch {
      // leave existing list in place on error
    } finally {
      setLoading(null);
    }
  }, []);

  // Fetch when tab changes or search changes (debounced)
  useEffect(() => {
    if (!isOpen || activeTab === 'external') return;
    const timer = setTimeout(() => fetchItems(activeTab, search), 250);
    return () => clearTimeout(timer);
  }, [isOpen, activeTab, search, fetchItems]);

  const currentItems = activeTab === 'pages' ? pages : activeTab === 'articles' ? articles : products;

  const handleApply = () => {
    const href = activeTab === 'external' ? externalUrl.trim() : selected;
    if (!href) return;
    onApply(href, newTab ? '_blank' : '');
  };

  const canApply = activeTab === 'external' ? !!externalUrl.trim() : !!selected;
  const hasExistingLink = !!initialHref;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl focus:outline-none"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <Dialog.Title className="text-sm font-semibold text-[var(--color-foreground)]">
              {hasExistingLink ? 'Edit link' : 'Insert link'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="p-1 rounded hover:bg-[var(--color-surface-raised)] text-[var(--color-muted)]">
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--color-border)]">
            {TAB_CONFIG.map((t) => (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setSearch(''); setSelected(''); }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === t.id
                    ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                    : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-foreground)]'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3">
            {/* Internal item picker */}
            {activeTab !== 'external' && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-muted)]" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Search ${activeTab}…`}
                    className="w-full pl-8 pr-3 py-2 text-sm bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto space-y-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)]">
                  {loading === activeTab ? (
                    <div className="flex items-center justify-center py-8 text-[var(--color-muted)]">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      <span className="text-xs">Loading…</span>
                    </div>
                  ) : currentItems.length === 0 ? (
                    <p className="text-xs text-center text-[var(--color-muted)] py-8">No {activeTab} found</p>
                  ) : (
                    currentItems.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelected(item.href)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          selected === item.href
                            ? 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)]'
                            : 'text-[var(--color-foreground)] hover:bg-[var(--color-surface)]'
                        }`}
                      >
                        <span className="block font-medium truncate">{item.title}</span>
                        <span className={`block text-xs truncate ${selected === item.href ? 'opacity-70' : 'text-[var(--color-muted)]'}`}>
                          {item.href}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {/* External URL input */}
            {activeTab === 'external' && (
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-muted)]" />
                <input
                  ref={searchRef}
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full pl-8 pr-3 py-2 text-sm bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg text-[var(--color-foreground)] placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                  onKeyDown={(e) => { if (e.key === 'Enter' && canApply) handleApply(); }}
                />
              </div>
            )}

            {/* Open in new tab */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newTab}
                onChange={(e) => setNewTab(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              <span className="text-xs text-[var(--color-muted)]">Open in new tab</span>
            </label>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
            <div>
              {hasExistingLink && (
                <button
                  onClick={onRemove}
                  className="text-xs text-[var(--color-danger)] hover:underline"
                >
                  Remove link
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={!canApply}
                className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-accent)] text-[var(--color-accent-foreground)] font-medium disabled:opacity-40 hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
