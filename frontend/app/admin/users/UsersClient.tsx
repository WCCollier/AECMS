'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import adminApi from '@/lib/adminApi';

type UserRole = 'member' | 'admin' | 'owner';

interface UserRow {
  id: string;
  email: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  email_verified: boolean;
  created_at: string;
}

interface Page {
  data: UserRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const ROLE_LABELS: Record<UserRole, string> = { owner: 'Owner', admin: 'Admin', member: 'Member' };
const ROLE_COLORS: Record<UserRole, string> = {
  owner: 'bg-amber-500/15 text-amber-600 border border-amber-500/30',
  admin: 'bg-blue-500/15 text-blue-600 border border-blue-500/30',
  member: 'bg-foreground/5 text-foreground/60 border border-border',
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

interface ConfirmModalProps {
  targetEmail: string;
  fromRole: UserRole;
  toRole: UserRole;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ targetEmail, fromRole, toRole, onConfirm, onCancel }: ConfirmModalProps) {
  const isOwnerTransfer = toRole === 'owner';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-start gap-3 mb-4">
          {isOwnerTransfer && <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />}
          <div>
            <h3 className="font-semibold text-lg">
              {isOwnerTransfer ? 'Grant Owner Role' : 'Change Role'}
            </h3>
            <p className="text-sm text-foreground/60 mt-1">
              Change <strong>{targetEmail}</strong> from{' '}
              <RoleBadge role={fromRole} /> to <RoleBadge role={toRole} />?
            </p>
            {isOwnerTransfer && (
              <p className="text-sm text-amber-600 mt-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                Owner is additive — your own Owner role is unaffected. This account will gain full
                system access including all settings, secrets, and the ability to manage other owners.
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={onConfirm}
            className={isOwnerTransfer ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

export function UsersClient() {
  const [page, setPage] = useState<Page | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    user: UserRow;
    newRole: UserRole;
  } | null>(null);

  // Resolve current user id from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('admin_user');
      if (stored) setCurrentUserId(JSON.parse(stored).id ?? null);
    } catch { /* ignore */ }
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: '20' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await adminApi.get(`/users?${params}`);
      setPage(res.data as Page);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch]);

  useEffect(() => { void load(); }, [load]);

  // Reset to page 1 when search changes
  useEffect(() => { setCurrentPage(1); }, [debouncedSearch]);

  async function applyRoleChange(user: UserRow, newRole: UserRole) {
    try {
      await adminApi.patch(`/users/${user.id}/role`, { role: newRole });
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Role change failed.';
      alert(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  }

  function handleRoleSelect(user: UserRow, newRole: UserRole) {
    if (newRole === user.role) return;
    setPending({ user, newRole });
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center text-foreground/60 hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Users</h1>
            <p className="text-foreground/60 mt-1">
              {page ? `${page.total} account${page.total !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email or name…"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-raised">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-foreground/60">Email</th>
              <th className="text-left px-4 py-3 font-medium text-foreground/60">Name / Username</th>
              <th className="text-left px-4 py-3 font-medium text-foreground/60">Role</th>
              <th className="text-left px-4 py-3 font-medium text-foreground/60">Joined</th>
              <th className="text-left px-4 py-3 font-medium text-foreground/60">Verified</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-foreground/40">Loading…</td>
              </tr>
            )}
            {!loading && page?.data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-foreground/40">No users found.</td>
              </tr>
            )}
            {!loading && page?.data.map((user) => {
              const isSelf = user.id === currentUserId;
              const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
              return (
                <tr key={user.id} className="border-t border-border hover:bg-surface-raised/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium">{user.email}</span>
                    {isSelf && (
                      <span className="ml-2 text-xs text-foreground/40">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/70">
                    {fullName || <span className="text-foreground/30">—</span>}
                    {user.username && (
                      <span className="ml-2 text-foreground/40 text-xs">@{user.username}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <RoleBadge role={user.role} />
                    ) : (
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleSelect(user, e.target.value as UserRole)}
                        className="text-xs font-medium rounded border border-border bg-surface px-2 py-1 focus:outline-none focus:border-accent cursor-pointer"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                        <option value="owner">Owner</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground/60">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={user.email_verified ? 'text-green-600' : 'text-foreground/30'}>
                      {user.email_verified ? '✓' : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {page && page.pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-foreground/60">
            Page {page.page} of {page.pages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= page.pages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {pending && (
        <ConfirmModal
          targetEmail={pending.user.email}
          fromRole={pending.user.role}
          toRole={pending.newRole}
          onConfirm={async () => {
            const { user, newRole } = pending;
            setPending(null);
            await applyRoleChange(user, newRole);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
