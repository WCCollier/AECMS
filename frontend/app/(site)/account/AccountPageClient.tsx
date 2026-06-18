'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useOrders } from '@/hooks/useOrders';
import { Button, Input } from '@/components/ui';
import api, { getErrorMessage } from '@/lib/api';
import { ShoppingBag, MessageSquare, Lock, Trash2, ChevronRight, Star, Pencil, ExternalLink, MapPin } from 'lucide-react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import type { Comment, PaginatedResponse, SavedShippingAddress } from '@/types';
import { CommentForm } from '@/components/comments/CommentForm';
import { DigitalLibraryPanel } from '@/components/digital/DigitalLibraryPanel';
import { orderStatusClass } from '@/lib/orderStatus';

const formatPrice = (p: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p);

const formatDate = (s: string) =>
  new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

export function AccountPageClient() {
  const router = useRouter();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { orders, isLoading: ordersLoading } = useOrders({ limit: 5 });
  const { data: commentsData, isLoading: commentsLoading, mutate: mutateComments } = useSWR<PaginatedResponse<Comment>>(
    user ? '/comments/mine?limit=5' : null,
    fetcher,
  );

  const [activeSection, setActiveSection] = useState<'orders' | 'comments' | 'shipping' | 'password' | 'delete' | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);

  // Shipping address state
  const { data: shippingData, mutate: mutateShipping } = useSWR<SavedShippingAddress>(
    user ? '/auth/shipping-address' : null,
    fetcher,
  );
  const [shippingForm, setShippingForm] = useState({
    shipping_street: '',
    shipping_city: '',
    shipping_state: '',
    shipping_postal_code: '',
    shipping_country: 'US',
  });
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState('');
  const [shippingSuccess, setShippingSuccess] = useState('');

  // Populate shipping form when data loads
  if (shippingData && !shippingLoading && shippingForm.shipping_street === '' && shippingData.has_address) {
    setShippingForm({
      shipping_street: shippingData.shipping_street ?? '',
      shipping_city: shippingData.shipping_city ?? '',
      shipping_state: shippingData.shipping_state ?? '',
      shipping_postal_code: shippingData.shipping_postal_code ?? '',
      shipping_country: shippingData.shipping_country ?? 'US',
    });
  }

  // Change password state
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // Delete account state
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (authLoading) return <div className="container mx-auto px-4 py-16 text-center text-foreground/60">Loading…</div>;

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-foreground/60 mb-4">You must be logged in to view your account.</p>
        <Link href="/auth/login?from=/account"><Button>Sign In</Button></Link>
      </div>
    );
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pwForm.newPassword !== pwForm.confirm) {
      setPwError('New passwords do not match');
      return;
    }
    setPwLoading(true);
    try {
      const res = await api.patch('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwSuccess(res.data.message);
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
      // All sessions revoked — log out and redirect to login
      setTimeout(() => { logout(); router.push('/auth/login'); }, 2000);
    } catch (err) {
      setPwError(getErrorMessage(err));
    } finally {
      setPwLoading(false);
    }
  }

  async function handleShippingUpdate(e: FormEvent) {
    e.preventDefault();
    setShippingError('');
    setShippingSuccess('');
    setShippingLoading(true);
    try {
      await api.patch('/auth/shipping-address', shippingForm);
      setShippingSuccess('Shipping address saved.');
      mutateShipping();
    } catch (err) {
      setShippingError(getErrorMessage(err));
    } finally {
      setShippingLoading(false);
    }
  }

  async function handleDeleteAccount(e: FormEvent) {
    e.preventDefault();
    setDeleteError('');
    setDeleteLoading(true);
    try {
      await api.delete('/auth/account', { data: { password: deletePassword } });
      await logout();
      router.push('/');
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    } finally {
      setDeleteLoading(false);
    }
  }

  const comments = commentsData?.data ?? [];

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <h1 className="text-2xl font-bold mb-8">My Account</h1>

      {/* Admin panel shortcut — only for admin/owner logged in via front door */}
      {user.hasBackstageAccess && (
        <div className="mb-6 p-4 bg-surface border border-border rounded-xl flex items-center justify-between text-sm">
          <span className="text-foreground/60">
            You have admin access. The admin panel requires a separate login with 2FA.
          </span>
          <Link href="/admin" className="text-accent hover:underline font-medium shrink-0 ml-4">
            Go to Admin Panel →
          </Link>
        </div>
      )}

      {/* Profile */}
      <section className="bg-surface border border-border rounded-xl p-6 mb-6">
        <h2 className="font-semibold text-lg mb-4">Profile</h2>
        <div className="space-y-2 text-sm">
          {(user.firstName || user.lastName) && (
            <div className="flex justify-between">
              <span className="text-foreground/60">Name</span>
              <span className="font-medium">
                {[user.firstName, user.lastName].filter(Boolean).join(' ')}
              </span>
            </div>
          )}
          {user.username && (
            <div className="flex justify-between">
              <span className="text-foreground/60">Username</span>
              <span className="font-medium">@{user.username}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-foreground/60">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/60">Role</span>
            <span className="capitalize font-medium">{user.role}</span>
          </div>
          {user.createdAt && (
            <div className="flex justify-between">
              <span className="text-foreground/60">Member since</span>
              <span className="font-medium">{formatDate(user.createdAt!)}</span>
            </div>
          )}
        </div>
      </section>

      {/* Digital Library — only renders if user has downloads */}
      <DigitalLibraryPanel />

      {/* Order History */}
      <section className="bg-surface border border-border rounded-xl mb-6 overflow-hidden">
        <button
          onClick={() => setActiveSection(activeSection === 'orders' ? null : 'orders')}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-raised transition-colors"
        >
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-accent" />
            <span className="font-semibold">Order History</span>
          </div>
          <ChevronRight className={`w-4 h-4 text-foreground/40 transition-transform ${activeSection === 'orders' ? 'rotate-90' : ''}`} />
        </button>

        {activeSection === 'orders' && (
          <div className="border-t border-border px-6 py-4">
            {ordersLoading ? (
              <p className="text-sm text-foreground/60">Loading orders…</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-foreground/60">No orders yet.</p>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="py-2 border-b border-border last:border-0">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium font-mono text-xs text-foreground/50">{order.order_number}</p>
                        <p className="font-medium">{formatPrice(order.total)}</p>
                        <p className="text-foreground/50 text-xs">{formatDate(order.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`capitalize text-xs px-2 py-0.5 rounded-full ${orderStatusClass(order.status)}`}>{order.status}</span>
                        <Link href={`/order-confirmation?order=${order.id}`} className="text-accent hover:underline text-xs">
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
                {orders.length === 5 && (
                  <p className="text-xs text-foreground/50 text-center pt-1">Showing 5 most recent orders.</p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Comment & Review History */}
      <section className="bg-surface border border-border rounded-xl mb-6 overflow-hidden">
        <button
          onClick={() => setActiveSection(activeSection === 'comments' ? null : 'comments')}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-raised transition-colors"
        >
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-accent" />
            <span className="font-semibold">Comments &amp; Reviews</span>
          </div>
          <ChevronRight className={`w-4 h-4 text-foreground/40 transition-transform ${activeSection === 'comments' ? 'rotate-90' : ''}`} />
        </button>

        {activeSection === 'comments' && (
          <div className="border-t border-border px-6 py-4">
            {commentsLoading ? (
              <p className="text-sm text-foreground/60">Loading…</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-foreground/60">No comments or reviews yet.</p>
            ) : (
              <div className="space-y-1">
                {comments.map((c) => {
                  const overallRating = c.ratings?.find((r) => r.title === 'Overall');
                  const target = c.article
                    ? { href: `/articles/${c.article.slug}`, name: c.article.title }
                    : c.product
                    ? { href: `/shop/${c.product.slug}`, name: c.product.title }
                    : null;
                  const commentHref = target ? `${target.href}#comment-${c.id}` : null;

                  if (editingCommentId === c.id) {
                    return (
                      <div key={c.id} className="py-3 border-b border-border last:border-0">
                        <CommentForm
                          commentId={c.id}
                          articleId={c.article_id ?? undefined}
                          productId={c.product_id ?? undefined}
                          isProduct={!!c.product_id}
                          initialContent={c.content}
                          initialTitle={c.title ?? ''}
                          initialRatings={c.ratings?.map(({ title, value }) => ({ title, value })) ?? []}
                          onSuccess={() => { setEditingCommentId(null); mutateComments(); }}
                          onCancel={() => setEditingCommentId(null)}
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={c.id} className="py-3 border-b border-border last:border-0 text-sm">
                      {/* Article / product attribution */}
                      {target && (
                        <Link
                          href={target.href}
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline mb-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {target.name}
                        </Link>
                      )}
                      {/* Rating */}
                      {overallRating && (
                        <div className="flex items-center gap-0.5 mb-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${i < overallRating.value ? 'fill-amber-400 text-amber-400' : 'text-foreground/20'}`}
                            />
                          ))}
                        </div>
                      )}
                      {c.title && <p className="font-medium mb-0.5">{c.title}</p>}
                      {/* Comment body — links to comment anchor */}
                      {commentHref ? (
                        <Link href={commentHref} className="text-foreground/70 hover:text-foreground line-clamp-2 block">
                          {c.content}
                        </Link>
                      ) : (
                        <p className="text-foreground/70 line-clamp-2">{c.content}</p>
                      )}
                      {/* Footer: date + edit */}
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-foreground/40 text-xs">{formatDate(c.created_at)}</p>
                        <button
                          onClick={() => setEditingCommentId(c.id)}
                          className="p-1 text-foreground/40 hover:text-accent transition-colors rounded"
                          aria-label="Edit comment"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {comments.length === 5 && (
                  <p className="text-xs text-foreground/50 text-center pt-1">Showing 5 most recent.</p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Shipping Address */}
      <section className="bg-surface border border-border rounded-xl mb-6 overflow-hidden">
        <button
          onClick={() => setActiveSection(activeSection === 'shipping' ? null : 'shipping')}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-raised transition-colors"
        >
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-accent" />
            <span className="font-semibold">Shipping Address</span>
            {shippingData?.has_address && (
              <span className="text-xs text-foreground/50">{shippingData.shipping_city}, {shippingData.shipping_state}</span>
            )}
          </div>
          <ChevronRight className={`w-4 h-4 text-foreground/40 transition-transform ${activeSection === 'shipping' ? 'rotate-90' : ''}`} />
        </button>
        {activeSection === 'shipping' && (
          <div className="px-6 pb-6">
            <form onSubmit={handleShippingUpdate} className="space-y-3">
              <Input
                label="Street Address"
                type="text"
                value={shippingForm.shipping_street}
                onChange={(e) => setShippingForm((p) => ({ ...p, shipping_street: e.target.value }))}
                placeholder="123 Main St"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="City"
                  type="text"
                  value={shippingForm.shipping_city}
                  onChange={(e) => setShippingForm((p) => ({ ...p, shipping_city: e.target.value }))}
                />
                <Input
                  label="State"
                  type="text"
                  value={shippingForm.shipping_state}
                  onChange={(e) => setShippingForm((p) => ({ ...p, shipping_state: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Postal Code"
                  type="text"
                  value={shippingForm.shipping_postal_code}
                  onChange={(e) => setShippingForm((p) => ({ ...p, shipping_postal_code: e.target.value }))}
                />
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Country</label>
                  <select
                    value={shippingForm.shipping_country}
                    onChange={(e) => setShippingForm((p) => ({ ...p, shipping_country: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-foreground/20 bg-background text-sm"
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                  </select>
                </div>
              </div>
              {shippingError && <p className="text-sm text-red-500">{shippingError}</p>}
              {shippingSuccess && <p className="text-sm text-green-600">{shippingSuccess}</p>}
              <Button type="submit" size="sm" isLoading={shippingLoading}>Save Address</Button>
            </form>
          </div>
        )}
      </section>

      {/* Change Password */}
      <section className="bg-surface border border-border rounded-xl mb-6 overflow-hidden">
        <button
          onClick={() => setActiveSection(activeSection === 'password' ? null : 'password')}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-raised transition-colors"
        >
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-accent" />
            <span className="font-semibold">Change Password</span>
          </div>
          <ChevronRight className={`w-4 h-4 text-foreground/40 transition-transform ${activeSection === 'password' ? 'rotate-90' : ''}`} />
        </button>

        {activeSection === 'password' && (
          <div className="border-t border-border px-6 py-4">
            <form onSubmit={handlePasswordChange} className="space-y-3">
              {pwError && <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{pwError}</p>}
              {pwSuccess && <p className="text-sm text-green-600 bg-green-500/10 border border-green-500/20 rounded px-3 py-2">{pwSuccess} Redirecting…</p>}
              <Input
                label="Current password"
                type="password"
                name="currentPassword"
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                required
                autoComplete="current-password"
              />
              <Input
                label="New password"
                type="password"
                name="newPassword"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                required
                autoComplete="new-password"
              />
              <Input
                label="Confirm new password"
                type="password"
                name="confirm"
                value={pwForm.confirm}
                onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                required
                autoComplete="new-password"
              />
              <Button type="submit" size="sm" isLoading={pwLoading}>Update Password</Button>
            </form>
          </div>
        )}
      </section>

      {/* Delete Account */}
      <section className="bg-surface border border-red-500/20 rounded-xl overflow-hidden">
        <button
          onClick={() => setActiveSection(activeSection === 'delete' ? null : 'delete')}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-red-500/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Trash2 className="w-5 h-5 text-red-500" />
            <span className="font-semibold text-red-500">Delete Account</span>
          </div>
          <ChevronRight className={`w-4 h-4 text-red-500/40 transition-transform ${activeSection === 'delete' ? 'rotate-90' : ''}`} />
        </button>

        {activeSection === 'delete' && (
          <div className="border-t border-red-500/20 px-6 py-4">
            <p className="text-sm text-foreground/70 mb-4">
              This action is permanent and cannot be undone. Enter your password to confirm.
            </p>
            <form onSubmit={handleDeleteAccount} className="space-y-3">
              {deleteError && <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{deleteError}</p>}
              <Input
                label="Password"
                type="password"
                name="deletePassword"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <Button type="submit" variant="danger" size="sm" isLoading={deleteLoading}>
                Permanently Delete My Account
              </Button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
