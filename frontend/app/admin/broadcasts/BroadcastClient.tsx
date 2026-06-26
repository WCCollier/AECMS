'use client';

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Send, Loader2, CheckCircle } from 'lucide-react';
import adminApi from '@/lib/adminApi';

interface SubscriberCounts {
  articles: number;
  products: number;
  news: number;
}

export function BroadcastClient() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: counts } = useSWR<SubscriberCounts>(
    '/subscriptions/counts',
    (url: string) => adminApi.get(url).then((r) => r.data),
  );

  const canSend = subject.trim().length > 0 && body.trim().length > 0;

  const handleSend = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await adminApi.post('/subscriptions/broadcast', { subject: subject.trim(), body: body.trim() });
      setSent(res.data.sent);
      setShowConfirm(false);
      setSubject('');
      setBody('');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Broadcasts</h1>
      <p className="text-neutral-400 text-sm mb-6">
        Send a news or alert email to all subscribers ({counts?.news ?? '…'} recipient{counts?.news !== 1 ? 's' : ''}).
      </p>

      {sent !== null && (
        <div className="flex items-center gap-2 mb-6 p-4 bg-green-900/30 border border-green-700 rounded text-green-300 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Broadcast sent to {sent} subscriber{sent !== 1 ? 's' : ''}.
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); setSent(null); }}
            placeholder="Your subject line"
            maxLength={200}
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
          />
          <p className="text-xs text-neutral-600 mt-1">{subject.length}/200</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1">Message</label>
          <textarea
            value={body}
            onChange={(e) => { setBody(e.target.value); setSent(null); }}
            placeholder="Write your message here. Each paragraph will be formatted as a separate block in the email."
            rows={8}
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500 resize-y"
          />
        </div>

        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!canSend || sending}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
          >
            <Send className="w-4 h-4" />
            Send to {counts?.news ?? '…'} subscriber{counts?.news !== 1 ? 's' : ''}
          </button>
        ) : (
          <div className="p-4 bg-neutral-800 border border-neutral-700 rounded space-y-3">
            <p className="text-sm text-neutral-200">
              Send <strong>&ldquo;{subject}&rdquo;</strong> to <strong>{counts?.news ?? '…'} subscriber{counts?.news !== 1 ? 's' : ''}</strong>?
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-700 text-white text-sm font-medium rounded transition-colors"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Sending…' : 'Confirm Send'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={sending}
                className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 text-sm font-medium rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
