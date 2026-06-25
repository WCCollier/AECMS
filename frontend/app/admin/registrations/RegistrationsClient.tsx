'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { CheckCircle, XCircle, Clock, Loader2, UserCheck } from 'lucide-react';
import adminApi from '@/lib/adminApi';

interface PendingUser {
  id: string;
  email: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  role_name: string;
  email_verified: boolean;
  created_at: string;
}

const fetcher = (url: string) => adminApi.get(url).then((r) => r.data);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function RegistrationsClient() {
  const { data, mutate, isLoading } = useSWR<{ data: PendingUser[]; total: number }>(
    '/users/pending',
    fetcher,
  );

  const [actingOn, setActingOn] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFlash = (type: 'success' | 'error', message: string) => {
    setFlash({ type, message });
    setTimeout(() => setFlash(null), 4000);
  };

  const handleApprove = async (userId: string, email: string) => {
    setActingOn(userId);
    try {
      await adminApi.post(`/users/${userId}/approve`);
      await mutate();
      showFlash('success', `${email} approved — they can now log in.`);
    } catch (err: any) {
      showFlash('error', err?.response?.data?.message ?? 'Approve failed');
    } finally {
      setActingOn(null);
    }
  };

  const openRejectModal = (userId: string) => {
    setRejectingId(userId);
    setRejectReason('');
    setRejectError('');
  };

  const handleRejectSubmit = async () => {
    if (!rejectingId) return;
    if (!rejectReason.trim()) {
      setRejectError('A reason is required.');
      return;
    }
    setActingOn(rejectingId);
    const targetEmail = data?.data.find((u) => u.id === rejectingId)?.email ?? rejectingId;
    try {
      await adminApi.post(`/users/${rejectingId}/reject`, { reason: rejectReason.trim() });
      setRejectingId(null);
      setRejectReason('');
      await mutate();
      showFlash('success', `${targetEmail} rejected and account removed.`);
    } catch (err: any) {
      setRejectError(err?.response?.data?.message ?? 'Reject failed');
    } finally {
      setActingOn(null);
    }
  };

  const pending = data?.data ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <UserCheck className="w-6 h-6 text-blue-400" />
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Pending Registrations</h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            Accounts that have verified their email and are awaiting approval.
          </p>
        </div>
      </div>

      {flash && (
        <div className={`mb-4 p-3 rounded text-sm flex items-center gap-2 ${
          flash.type === 'success'
            ? 'bg-green-900/30 border border-green-700 text-green-300'
            : 'bg-red-900/30 border border-red-700 text-red-300'
        }`}>
          {flash.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {flash.message}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-neutral-400 py-12 justify-center">
          <Loader2 className="animate-spin" size={20} />
          Loading…
        </div>
      ) : pending.length === 0 ? (
        <div className="text-center py-16 text-neutral-500">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No pending registrations</p>
          <p className="text-sm mt-1">All caught up — the queue is empty.</p>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 text-left">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Registered</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((user) => (
                <tr key={user.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/40">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-100">{user.email}</div>
                    {(user.first_name || user.last_name) && (
                      <div className="text-neutral-400 text-xs mt-0.5">
                        {[user.first_name, user.last_name].filter(Boolean).join(' ')}
                      </div>
                    )}
                    {user.username && (
                      <div className="text-neutral-500 text-xs">@{user.username}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs bg-neutral-800 text-neutral-300 border border-neutral-700">
                      {user.role_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleApprove(user.id, user.email)}
                        disabled={actingOn === user.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded transition-colors"
                      >
                        {actingOn === user.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                        Approve
                      </button>
                      <button
                        onClick={() => openRejectModal(user.id)}
                        disabled={!!actingOn}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-900 hover:bg-red-800 disabled:opacity-50 text-red-200 rounded transition-colors"
                      >
                        <XCircle size={12} />
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-neutral-100 mb-1">Reject Registration</h2>
              <p className="text-sm text-neutral-400 mb-4">
                <strong className="text-neutral-200">
                  {data?.data.find((u) => u.id === rejectingId)?.email}
                </strong>
                {' '}will be soft-deleted. The reason is recorded in the audit log.
              </p>
              <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => { setRejectReason(e.target.value); setRejectError(''); }}
                rows={3}
                placeholder="e.g. Spam account, duplicate registration, policy violation…"
                className="w-full bg-neutral-800 border border-neutral-600 rounded px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-400 resize-none"
              />
              {rejectError && (
                <p className="text-xs text-red-400 mt-1">{rejectError}</p>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setRejectingId(null)}
                disabled={!!actingOn}
                className="flex-1 px-4 py-2 text-sm border border-neutral-700 rounded text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!!actingOn}
                className="flex-1 px-4 py-2 text-sm bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded transition-colors flex items-center justify-center gap-2"
              >
                {actingOn ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                Reject Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
