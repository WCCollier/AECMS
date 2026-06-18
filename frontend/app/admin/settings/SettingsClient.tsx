'use client';

import React, { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { Save, Send, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import adminApi from '@/lib/adminApi';

const fetcher = (url: string) => adminApi.get(url).then((r) => r.data);

type TabId = 'general' | 'identity' | 'email' | 'payment' | 'storage';

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'identity', label: 'Site Identity' },
  { id: 'email', label: 'Email / SMTP' },
  { id: 'payment', label: 'Payment Providers' },
  { id: 'storage', label: 'File Storage' },
];

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'UTC', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Europe/Moscow', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Bangkok',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland',
];

function FieldRow({ label, help, children }: { label: React.ReactNode; help?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 items-start py-4 border-b border-neutral-800 last:border-0">
      <div>
        <label className="text-sm font-medium text-neutral-200">{label}</label>
        {help && <p className="text-xs text-neutral-500 mt-0.5">{help}</p>}
      </div>
      <div className="col-span-2">{children}</div>
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, type = 'text',
}: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
    />
  );
}

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '••••••••'}
        className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 pr-10 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function SaveBar({ onSave, saving, saved, dirty }: { onSave: () => void; saving: boolean; saved: boolean; dirty: boolean }) {
  return (
    <div className="flex items-center justify-between pt-4 mt-4 border-t border-neutral-800">
      <span className="text-xs text-neutral-500">{dirty ? 'Unsaved changes' : saved ? 'Saved' : ''}</span>
      <button
        onClick={onSave}
        disabled={saving || !dirty}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  );
}

export function SettingsClient() {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const { data: allSettings, mutate } = useSWR<Record<string, string>>('/settings', fetcher);

  const [fields, setFields] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pages list for homepage picker
  const { data: pagesData } = useSWR<{ data: { id: string; title: string; slug: string }[] }>(
    fields['general.homepage_mode'] === 'static_page' ? '/pages?limit=100&status=published' : null,
    fetcher,
  );
  const publishedPages = pagesData?.data ?? [];

  // Favicon upload state
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [faviconError, setFaviconError] = useState<string | null>(null);

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFaviconUploading(true);
    setFaviconError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await adminApi.post<{ url: string }>('/settings/favicon', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFields((prev) => ({ ...prev, 'identity.favicon_url': res.data.url }));
    } catch (err: any) {
      setFaviconError(err?.response?.data?.message ?? 'Upload failed');
    } finally {
      setFaviconUploading(false);
      e.target.value = '';
    }
  };

  // Email test state
  const [emailTesting, setEmailTesting] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Payment verify state
  const [stripeStatus, setStripeStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [stripeError, setStripeError] = useState('');
  const [paypalStatus, setPaypalStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [paypalError, setPaypalError] = useState('');

  useEffect(() => {
    if (allSettings) {
      setFields(allSettings);
      setDirty(false);
    }
  }, [allSettings]);

  const set = useCallback((key: string, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setDirty(true);
    setSaved(false);
  }, []);

  const f = (key: string) => fields[key] ?? '';

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await adminApi.patch('/settings', { updates: fields });
      await mutate();
      setSaved(true);
      setDirty(false);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setEmailTesting(true);
    setEmailTestResult(null);
    try {
      const res = await adminApi.post('/settings/test-email');
      setEmailTestResult(res.data);
    } catch (err: any) {
      setEmailTestResult({ success: false, message: err?.response?.data?.message ?? 'Request failed' });
    } finally {
      setEmailTesting(false);
    }
  };

  const handleVerifyStripe = async () => {
    setStripeStatus('checking');
    setStripeError('');
    try {
      await adminApi.post('/payments/verify/stripe');
      setStripeStatus('ok');
    } catch (err: any) {
      setStripeStatus('error');
      setStripeError(err?.response?.data?.message ?? 'Stripe connection failed');
    }
  };

  const handleVerifyPayPal = async () => {
    setPaypalStatus('checking');
    setPaypalError('');
    try {
      await adminApi.post('/payments/verify/paypal');
      setPaypalStatus('ok');
    } catch (err: any) {
      setPaypalStatus('error');
      setPaypalError(err?.response?.data?.message ?? 'PayPal connection failed');
    }
  };

  const [storageStatus, setStorageStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [storageMessage, setStorageMessage] = useState('');

  const handleTestStorage = async () => {
    setStorageStatus('checking');
    setStorageMessage('');
    try {
      const res = await adminApi.post<{ success: boolean; provider: string; message: string }>('/settings/test-storage');
      if (res.data.success) {
        setStorageStatus('ok');
        setStorageMessage(res.data.message);
      } else {
        setStorageStatus('error');
        setStorageMessage(res.data.message);
      }
    } catch (err: any) {
      setStorageStatus('error');
      setStorageMessage(err?.response?.data?.message ?? 'Storage test failed');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-neutral-100 mb-6">Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-neutral-800 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
              activeTab === tab.id
                ? 'bg-neutral-800 text-neutral-100 border-b-2 border-blue-500'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* ─── General ─── */}
      {activeTab === 'general' && (
        <div>
          <FieldRow label="Site Title" help="Displayed in browser tabs and emails">
            <TextInput value={f('general.site_title')} onChange={(v) => set('general.site_title', v)} />
          </FieldRow>
          <FieldRow label="Tagline" help="Short description shown in the site header">
            <TextInput value={f('general.tagline')} onChange={(v) => set('general.tagline', v)} />
          </FieldRow>
          <FieldRow label="Timezone">
            <Select
              value={f('general.timezone') || 'America/New_York'}
              onChange={(v) => set('general.timezone', v)}
              options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
            />
          </FieldRow>
          <FieldRow label="Date Format">
            <Select
              value={f('general.date_format') || 'MMM D, YYYY'}
              onChange={(v) => set('general.date_format', v)}
              options={[
                { value: 'MMM D, YYYY', label: 'Jun 17, 2026' },
                { value: 'D MMM YYYY', label: '17 Jun 2026' },
                { value: 'YYYY-MM-DD', label: '2026-06-17' },
              ]}
            />
          </FieldRow>
          <FieldRow label="Homepage" help="What visitors see when they arrive at the root URL (/)">
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="homepage_mode"
                  value="latest_articles"
                  checked={f('general.homepage_mode') !== 'static_page'}
                  onChange={() => set('general.homepage_mode', 'latest_articles')}
                  className="accent-blue-500 mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium text-neutral-200">Article Feed</span>
                  <p className="text-xs text-neutral-500 mt-0.5">Visitors arriving at / are redirected to /articles</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="homepage_mode"
                  value="static_page"
                  checked={f('general.homepage_mode') === 'static_page'}
                  onChange={() => set('general.homepage_mode', 'static_page')}
                  className="accent-blue-500 mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium text-neutral-200">Custom Page</span>
                  <p className="text-xs text-neutral-500 mt-0.5">A specific page from your Pages library is displayed at /</p>
                </div>
              </label>
              {f('general.homepage_mode') === 'static_page' && (
                <div className="ml-7 space-y-2">
                  <select
                    value={f('general.homepage_page_id')}
                    onChange={(e) => set('general.homepage_page_id', e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-neutral-500"
                  >
                    <option value="">— select a page —</option>
                    {publishedPages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}{p.slug === '_home_' ? ' (built-in homepage)' : ''}
                      </option>
                    ))}
                  </select>
                  {f('general.homepage_page_id') && (() => {
                    const selected = publishedPages.find((p) => p.id === f('general.homepage_page_id'));
                    return selected ? (
                      <p className="text-xs text-neutral-500">
                        Edit this page at{' '}
                        <a
                          href={`/admin/pages/${selected.id}/edit`}
                          className="text-blue-400 hover:underline"
                        >
                          Admin → Pages → {selected.title}
                        </a>
                      </p>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          </FieldRow>
          <SaveBar onSave={handleSave} saving={saving} saved={saved} dirty={dirty} />
        </div>
      )}

      {/* ─── Site Identity ─── */}
      {activeTab === 'identity' && (
        <div>
          <FieldRow
            label={<span className="flex items-center gap-2">Logo URL <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400">Not yet active</span></span>}
            help="Saved but not yet displayed — header logo rendering is a planned feature"
          >
            <TextInput value={f('identity.logo_url')} onChange={(v) => set('identity.logo_url', v)} />
            {f('identity.logo_url') && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f('identity.logo_url')} alt="Logo preview" className="mt-2 h-12 object-contain rounded border border-neutral-700" />
            )}
          </FieldRow>
          <FieldRow label="Favicon" help="Icon shown in browser tabs (ICO, PNG, JPG, or SVG)">
            <div className="flex items-center gap-4">
              {f('identity.favicon_url') && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f('identity.favicon_url')} alt="Current favicon" className="h-8 w-8 object-contain rounded border border-neutral-700 bg-neutral-800" />
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-neutral-200 text-sm px-3 py-1.5 rounded transition-colors">
                  {faviconUploading ? 'Uploading…' : f('identity.favicon_url') ? 'Replace' : 'Upload file'}
                </span>
                <input
                  type="file"
                  accept="image/x-icon,image/png,image/jpeg,image/svg+xml,.ico"
                  onChange={handleFaviconUpload}
                  disabled={faviconUploading}
                  className="sr-only"
                />
              </label>
            </div>
            {faviconError && <p className="mt-1 text-xs text-red-400">{faviconError}</p>}
          </FieldRow>
          <FieldRow
            label={<span className="flex items-center gap-2">Brand Color <span className="text-xs font-normal px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400">Not yet active</span></span>}
            help="Saved but not yet applied — use the Appearance tab to set your theme colours for now"
          >
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={f('identity.brand_color') || '#6366f1'}
                onChange={(e) => set('identity.brand_color', e.target.value)}
                className="h-10 w-16 rounded border border-neutral-700 bg-neutral-900 cursor-pointer"
              />
              <TextInput
                value={f('identity.brand_color')}
                onChange={(v) => set('identity.brand_color', v)}
                placeholder="#6366f1"
              />
            </div>
          </FieldRow>
          <SaveBar onSave={handleSave} saving={saving} saved={saved} dirty={dirty} />
        </div>
      )}

      {/* ─── Email / SMTP ─── */}
      {activeTab === 'email' && (
        <div>
          <FieldRow label="SMTP Host">
            <TextInput value={f('email.smtp_host')} onChange={(v) => set('email.smtp_host', v)} placeholder="smtp.gmail.com" />
          </FieldRow>
          <FieldRow label="SMTP Port">
            <TextInput value={f('email.smtp_port')} onChange={(v) => set('email.smtp_port', v)} placeholder="587" type="number" />
          </FieldRow>
          <FieldRow label="Security">
            <Select
              value={f('email.smtp_security') || 'starttls'}
              onChange={(v) => set('email.smtp_security', v)}
              options={[
                { value: 'none', label: 'None' },
                { value: 'ssl', label: 'SSL (port 465)' },
                { value: 'starttls', label: 'STARTTLS (port 587)' },
              ]}
            />
          </FieldRow>
          <FieldRow label="Username">
            <TextInput value={f('email.smtp_user')} onChange={(v) => set('email.smtp_user', v)} placeholder="you@gmail.com" />
          </FieldRow>
          <FieldRow label="Password" help="Leave blank to keep existing password">
            <SecretInput value={f('email.smtp_pass_enc')} onChange={(v) => set('email.smtp_pass_enc', v)} />
          </FieldRow>
          <FieldRow label="From Address">
            <TextInput value={f('email.from_address')} onChange={(v) => set('email.from_address', v)} placeholder="noreply@yoursite.com" type="email" />
          </FieldRow>
          <FieldRow label="From Name">
            <TextInput value={f('email.from_name')} onChange={(v) => set('email.from_name', v)} placeholder="My Site" />
          </FieldRow>
          <FieldRow label="Kindle From Address" help="Must be on Amazon's Approved Personal Document Email List">
            <TextInput value={f('email.kindle_from')} onChange={(v) => set('email.kindle_from', v)} placeholder="you@gmail.com" type="email" />
          </FieldRow>

          <div className="pt-4 flex items-center gap-4">
            <button
              onClick={handleTestEmail}
              disabled={emailTesting}
              className="flex items-center gap-2 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded"
            >
              {emailTesting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {emailTesting ? 'Sending…' : 'Send Test Email'}
            </button>
            {emailTestResult && (
              <span className={`flex items-center gap-1 text-sm ${emailTestResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {emailTestResult.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {emailTestResult.message}
              </span>
            )}
          </div>

          <SaveBar onSave={handleSave} saving={saving} saved={saved} dirty={dirty} />
        </div>
      )}

      {/* ─── Payment Providers ─── */}
      {activeTab === 'payment' && (
        <div className="space-y-8">
          {/* Stripe */}
          <div className="border border-neutral-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-200">Stripe</h3>
              {stripeStatus === 'ok' && <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle size={12} /> Connected</span>}
              {stripeStatus === 'error' && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> {stripeError}</span>}
              {stripeStatus === 'idle' && <span className="text-xs text-neutral-500">Not verified</span>}
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Publishable Key</label>
                <TextInput value={f('payment.stripe_publishable_key')} onChange={(v) => set('payment.stripe_publishable_key', v)} placeholder="pk_test_..." />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Secret Key</label>
                <SecretInput value={f('payment.stripe_secret_key_enc')} onChange={(v) => set('payment.stripe_secret_key_enc', v)} />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Webhook Secret</label>
                <SecretInput value={f('payment.stripe_webhook_secret_enc')} onChange={(v) => set('payment.stripe_webhook_secret_enc', v)} placeholder="whsec_..." />
              </div>
            </div>
            <button
              onClick={handleVerifyStripe}
              disabled={stripeStatus === 'checking'}
              className="mt-3 flex items-center gap-2 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded"
            >
              {stripeStatus === 'checking' ? <Loader2 size={12} className="animate-spin" /> : null}
              Verify Stripe Connection
            </button>
          </div>

          {/* PayPal */}
          <div className="border border-neutral-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-200">PayPal</h3>
              {paypalStatus === 'ok' && <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle size={12} /> Connected</span>}
              {paypalStatus === 'error' && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> {paypalError}</span>}
              {paypalStatus === 'idle' && <span className="text-xs text-neutral-500">Not verified</span>}
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Client ID</label>
                <TextInput value={f('payment.paypal_client_id')} onChange={(v) => set('payment.paypal_client_id', v)} placeholder="AaBbCc..." />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Client Secret</label>
                <SecretInput value={f('payment.paypal_client_secret_enc')} onChange={(v) => set('payment.paypal_client_secret_enc', v)} />
              </div>
            </div>
            <button
              onClick={handleVerifyPayPal}
              disabled={paypalStatus === 'checking'}
              className="mt-3 flex items-center gap-2 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded"
            >
              {paypalStatus === 'checking' ? <Loader2 size={12} className="animate-spin" /> : null}
              Verify PayPal Connection
            </button>
          </div>

          <SaveBar onSave={handleSave} saving={saving} saved={saved} dirty={dirty} />
        </div>
      )}

      {/* ─── File Storage (ESM) ─── */}
      {activeTab === 'storage' && (
        <div className="space-y-8">
          {/* Provider selector */}
          <FieldRow label="Storage Provider" help="Where uploaded media and digital product files are stored">
            <Select
              value={f('storage.provider_type') || 'local'}
              onChange={(v) => set('storage.provider_type', v)}
              options={[
                { value: 'local', label: 'Local filesystem (default — dev / single-server)' },
                { value: 'gcs', label: 'Google Cloud Storage (GCS)' },
                { value: 's3', label: 'S3-compatible (AWS, Cloudflare R2, Backblaze B2, etc.)' },
              ]}
            />
            <p className="text-xs text-neutral-500 mt-1">
              Changing this requires restarting the backend. Credentials are read lazily — no restart needed after saving keys.
            </p>
          </FieldRow>

          {/* CDN Base URL — applies to any cloud provider */}
          {(f('storage.provider_type') === 'gcs' || f('storage.provider_type') === 's3') && (
            <FieldRow label="CDN Base URL" help="Optional. If set, public media URLs are prefixed with this instead of the default bucket URL (e.g. https://cdn.example.com)">
              <TextInput value={f('storage.cdn_base_url')} onChange={(v) => set('storage.cdn_base_url', v)} placeholder="https://cdn.yourdomain.com" />
            </FieldRow>
          )}

          {/* GCS config */}
          {f('storage.provider_type') === 'gcs' && (
            <div className="border border-neutral-800 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-neutral-200 mb-2">Google Cloud Storage</h3>
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Media Bucket <span className="text-neutral-500">(public images, uploaded media)</span></label>
                <TextInput value={f('storage.gcs_bucket_media')} onChange={(v) => set('storage.gcs_bucket_media', v)} placeholder="my-site-media" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Digital Files Bucket <span className="text-neutral-500">(private — EPUBs, PDFs, downloads)</span></label>
                <TextInput value={f('storage.gcs_bucket_digital')} onChange={(v) => set('storage.gcs_bucket_digital', v)} placeholder="my-site-digital" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">GCP Project ID <span className="text-neutral-500">(optional if using Workload Identity)</span></label>
                <TextInput value={f('storage.gcs_project_id')} onChange={(v) => set('storage.gcs_project_id', v)} placeholder="my-gcp-project" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Service Account JSON <span className="text-neutral-500">(leave blank on Cloud Run — uses Workload Identity automatically)</span></label>
                <SecretInput value={f('storage.gcs_credentials_json_enc')} onChange={(v) => set('storage.gcs_credentials_json_enc', v)} placeholder='{"type":"service_account",...}' />
              </div>
            </div>
          )}

          {/* S3 config */}
          {f('storage.provider_type') === 's3' && (
            <div className="border border-neutral-800 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-neutral-200 mb-2">S3-Compatible Storage</h3>
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Media Bucket <span className="text-neutral-500">(public images, uploaded media)</span></label>
                <TextInput value={f('storage.s3_bucket_media')} onChange={(v) => set('storage.s3_bucket_media', v)} placeholder="my-site-media" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Digital Files Bucket <span className="text-neutral-500">(private — EPUBs, PDFs, downloads)</span></label>
                <TextInput value={f('storage.s3_bucket_digital')} onChange={(v) => set('storage.s3_bucket_digital', v)} placeholder="my-site-digital" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Region</label>
                <TextInput value={f('storage.s3_region')} onChange={(v) => set('storage.s3_region', v)} placeholder="us-east-1" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Endpoint URL <span className="text-neutral-500">(leave blank for AWS; required for R2, B2, Spaces, etc.)</span></label>
                <TextInput value={f('storage.s3_endpoint')} onChange={(v) => set('storage.s3_endpoint', v)} placeholder="https://abc123.r2.cloudflarestorage.com" />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Access Key ID</label>
                <TextInput value={f('storage.s3_access_key_id')} onChange={(v) => set('storage.s3_access_key_id', v)} placeholder="AKIA..." />
              </div>
              <div>
                <label className="text-xs text-neutral-400 mb-1 block">Secret Access Key</label>
                <SecretInput value={f('storage.s3_secret_access_key_enc')} onChange={(v) => set('storage.s3_secret_access_key_enc', v)} />
              </div>
            </div>
          )}

          {/* Test connection */}
          <div className="border border-neutral-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-neutral-200">Connection Test</h3>
              {storageStatus === 'ok' && <span className="flex items-center gap-1 text-xs text-green-400"><CheckCircle size={12} /> {storageMessage}</span>}
              {storageStatus === 'error' && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} /> {storageMessage}</span>}
            </div>
            <p className="text-xs text-neutral-500 mb-3">Save your settings first, then click Test to verify a write/read/delete round-trip against the active provider.</p>
            <button
              onClick={handleTestStorage}
              disabled={storageStatus === 'checking'}
              className="flex items-center gap-2 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded"
            >
              {storageStatus === 'checking' ? <Loader2 size={12} className="animate-spin" /> : null}
              Test Storage Connection
            </button>
          </div>

          <SaveBar onSave={handleSave} saving={saving} saved={saved} dirty={dirty} />
        </div>
      )}
    </div>
  );
}
