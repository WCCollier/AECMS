'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  ChevronDown,
  ChevronUp,
  Shield,
  Trash2,
  Lock,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import adminApi from '@/lib/adminApi';

// ── Types ──────────────────────────────────────────────────────────────────

interface RoleRow {
  name: string;
  label: string;
  protection: 'none' | 'constrained' | 'full';
  created_at: string;
  user_count: number;
  capability_count: number;
  is_virtual: boolean;
}

interface Capability {
  id: string;
  name: string;
  category: string;
  scope: string;
  description: string;
}

interface RoleCapabilityRow {
  id: string;
  role_name: string;
  capability_id: string;
  capability: Capability;
}

// ── Protection badge ───────────────────────────────────────────────────────

function ProtectionBadge({ protection }: { protection: RoleRow['protection'] }) {
  if (protection === 'full') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/15 text-amber-600 border border-amber-500/30">
        <Lock className="w-3 h-3" /> System
      </span>
    );
  }
  if (protection === 'constrained') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/15 text-blue-600 border border-blue-500/30">
        <Shield className="w-3 h-3" /> Constrained
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-foreground/5 text-foreground/50 border border-border">
      Custom
    </span>
  );
}

// ── Capability matrix for a single role ────────────────────────────────────

interface CapabilityMatrixProps {
  role: RoleRow;
  allCaps: Capability[];
  roleCaps: RoleCapabilityRow[];
  onSave: (roleId: string, capIds: string[]) => Promise<void>;
  saving: boolean;
}

function CapabilityMatrix({ role, allCaps, roleCaps, onSave, saving }: CapabilityMatrixProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(roleCaps.map((rc) => rc.capability_id)),
  );
  const [dirty, setDirty] = useState(false);

  // Sync when roleCaps changes (e.g. after load)
  useEffect(() => {
    setSelected(new Set(roleCaps.map((rc) => rc.capability_id)));
    setDirty(false);
  }, [roleCaps]);

  const toggle = (capId: string, scope: string) => {
    if (role.protection === 'full') return; // Owner: read-only
    if (role.protection === 'constrained' && scope === 'backstage') return; // Guest: no backstage
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(capId)) next.delete(capId);
      else next.add(capId);
      return next;
    });
    setDirty(true);
  };

  const backstageCaps = allCaps.filter((c) => c.scope === 'backstage');
  const customerCaps = allCaps.filter((c) => c.scope === 'customer');

  const groupByCategory = (caps: Capability[]) => {
    const map = new Map<string, Capability[]>();
    for (const c of caps) {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    }
    return map;
  };

  const renderGroup = (caps: Capability[], scope: 'backstage' | 'customer') => {
    const grouped = groupByCategory(caps);
    return Array.from(grouped.entries()).map(([category, items]) => (
      <div key={category} className="mb-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/40 mb-2 capitalize">
          {category}
        </h4>
        <div className="space-y-1">
          {items.map((cap) => {
            const isChecked = selected.has(cap.id);
            const isReadOnly = role.protection === 'full';
            const isDisabled =
              isReadOnly || (role.protection === 'constrained' && scope === 'backstage');
            return (
              <label
                key={cap.id}
                className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                  isDisabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-surface-raised'
                }`}
                title={
                  isReadOnly
                    ? 'Owner always has all capabilities'
                    : isDisabled
                    ? 'Not available for constrained roles (Guest)'
                    : cap.description
                }
              >
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isDisabled}
                    onChange={() => toggle(cap.id, scope)}
                    className="sr-only"
                  />
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isChecked
                        ? 'bg-accent border-accent'
                        : 'border-border bg-surface'
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3 text-accent-foreground" />}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium font-mono">{cap.name}</p>
                  <p className="text-xs text-foreground/50">{cap.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    ));
  };

  const handleSave = () => {
    onSave(role.name, Array.from(selected)).then(() => setDirty(false));
  };

  return (
    <div className="mt-2 border border-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Backstage capabilities */}
        <div className="p-4">
          <h3 className="font-semibold text-sm mb-3 text-foreground/70">Backstage Capabilities</h3>
          {renderGroup(backstageCaps, 'backstage')}
        </div>
        {/* Customer capabilities */}
        <div className="p-4">
          <h3 className="font-semibold text-sm mb-3 text-foreground/70">Customer Capabilities</h3>
          {renderGroup(customerCaps, 'customer')}
        </div>
      </div>
      {role.protection !== 'full' && (
        <div className="px-4 py-3 border-t border-border bg-surface-raised flex items-center justify-between">
          <p className="text-xs text-foreground/50">
            {selected.size} capability{selected.size !== 1 ? 'ies' : 'y'} selected
          </p>
          <Button
            size="sm"
            disabled={!dirty || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save Capabilities'}
          </Button>
        </div>
      )}
      {role.protection === 'full' && (
        <div className="px-4 py-3 border-t border-border bg-surface-raised">
          <p className="text-xs text-foreground/50 flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            Owner always holds every capability — this cannot be edited.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function RolesClient() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [allCaps, setAllCaps] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded row + its loaded capabilities
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedCaps, setExpandedCaps] = useState<RoleCapabilityRow[]>([]);
  const [capsLoading, setCapsLoading] = useState(false);
  const [capsSaving, setCapsSaving] = useState(false);

  // New role form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete confirmation
  const [pendingDelete, setPendingDelete] = useState<RoleRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, capsRes] = await Promise.all([
        adminApi.get('/roles'),
        adminApi.get('/capabilities'),
      ]);
      setRoles(rolesRes.data as RoleRow[]);
      setAllCaps(capsRes.data as Capability[]);
    } catch {
      setError('Failed to load roles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleExpand = async (name: string) => {
    if (expanded === name) {
      setExpanded(null);
      return;
    }
    setExpanded(name);
    setCapsLoading(true);
    try {
      const res = await adminApi.get(`/roles/${name}/capabilities`);
      setExpandedCaps(res.data as RoleCapabilityRow[]);
    } catch {
      setExpandedCaps([]);
    } finally {
      setCapsLoading(false);
    }
  };

  const handleSaveCaps = async (roleName: string, capIds: string[]) => {
    setCapsSaving(true);
    try {
      await adminApi.put(`/roles/${roleName}/capabilities`, { capability_ids: capIds });
      // Refresh role list to update counts
      const res = await adminApi.get('/roles');
      setRoles(res.data as RoleRow[]);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to save capabilities.';
      alert(Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setCapsSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newName || !newLabel) return;
    setCreating(true);
    setCreateError(null);
    try {
      await adminApi.post('/roles', { name: newName, label: newLabel });
      setNewName('');
      setNewLabel('');
      setShowNewForm(false);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create role.';
      setCreateError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await adminApi.delete(`/roles/${pendingDelete.name}`);
      setPendingDelete(null);
      if (expanded === pendingDelete.name) setExpanded(null);
      await load();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to delete role.';
      alert(Array.isArray(msg) ? msg.join('\n') : msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center text-foreground/60 hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Dashboard
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Roles</h1>
            <p className="text-foreground/60 mt-1">
              Manage roles and their capability assignments
            </p>
          </div>
          <Button onClick={() => setShowNewForm((v) => !v)}>
            <Plus className="w-4 h-4 mr-2" />
            New Role
          </Button>
        </div>
      </div>

      {/* New role form */}
      {showNewForm && (
        <div className="mb-6 p-4 border border-border rounded-xl bg-surface-raised">
          <h2 className="font-semibold mb-3">Create Role</h2>
          {createError && (
            <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-500">
              {createError}
            </div>
          )}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-medium text-foreground/60 mb-1">
                Role Name <span className="text-foreground/40">(slug, e.g. moderator)</span>
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="moderator"
                className="font-mono"
              />
            </div>
            <div className="flex-1 min-w-40">
              <label className="block text-xs font-medium text-foreground/60 mb-1">Display Label</label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Moderator"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleCreate} disabled={!newName || !newLabel || creating}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
              <Button variant="outline" onClick={() => { setShowNewForm(false); setCreateError(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Roles list */}
      <div className="space-y-2">
        {loading && (
          <div className="py-12 text-center text-foreground/40">Loading…</div>
        )}
        {!loading && roles.length === 0 && (
          <div className="py-12 text-center text-foreground/40">No roles found.</div>
        )}
        {!loading && roles.map((role) => {
          const isExpanded = expanded === role.name;
          const canDelete = role.protection === 'none' && role.user_count === 0;
          return (
            <div key={role.name} className="border border-border rounded-xl overflow-hidden">
              {/* Role header row */}
              <div
                className="flex items-center gap-4 px-4 py-3 bg-surface hover:bg-surface-raised/50 cursor-pointer transition-colors"
                onClick={() => handleExpand(role.name)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{role.label}</span>
                    <code className="text-xs text-foreground/50 bg-surface-raised px-1.5 py-0.5 rounded">
                      {role.name}
                    </code>
                    <ProtectionBadge protection={role.protection} />
                  </div>
                  <p className="text-xs text-foreground/50 mt-0.5">
                    {role.is_virtual
                      ? 'Virtual role — applies to unauthenticated visitors'
                      : `${role.user_count} user${role.user_count !== 1 ? 's' : ''}`}
                    {' · '}
                    {role.protection === 'full'
                      ? 'All capabilities'
                      : `${role.capability_count} capability${role.capability_count !== 1 ? 'ies' : 'y'}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPendingDelete(role); }}
                      className="p-1.5 text-foreground/40 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                      title="Delete role"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-foreground/40" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-foreground/40" />
                  )}
                </div>
              </div>

              {/* Expanded capability matrix */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border">
                  {capsLoading ? (
                    <div className="py-6 text-center text-foreground/40 text-sm">Loading capabilities…</div>
                  ) : (
                    <CapabilityMatrix
                      role={role}
                      allCaps={allCaps}
                      roleCaps={expandedCaps}
                      onSave={handleSaveCaps}
                      saving={capsSaving}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-lg">Delete Role</h3>
                <p className="text-sm text-foreground/60 mt-1">
                  Are you sure you want to delete the <strong>{pendingDelete.label}</strong> role?
                  This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-500 hover:bg-red-600 text-white"
              >
                {deleting ? 'Deleting…' : 'Delete Role'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
