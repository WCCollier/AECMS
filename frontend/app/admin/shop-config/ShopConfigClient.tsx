'use client';

import { useState, useEffect } from 'react';
import { Store, Building2, Truck, Receipt, Save, Loader2 } from 'lucide-react';
import adminApi from '@/lib/adminApi';
import { getErrorMessage } from '@/lib/api';

interface ShopSettings {
  'shop.legal_name': string;
  'shop.ein_enc': string;
  'shop.tax_registration_number': string;
  'shop.address_street': string;
  'shop.address_city': string;
  'shop.address_state': string;
  'shop.address_postal_code': string;
  'shop.address_country': string;
  'shop.shipping_same_as_business': string;
  'shop.shipping_street': string;
  'shop.shipping_city': string;
  'shop.shipping_state': string;
  'shop.shipping_postal_code': string;
  'shop.shipping_country': string;
  // Tax (Step 3)
  'tax.enabled': string;
  'tax.default_stripe_tax_code': string;
  'tax.flat_rate': string;
}

const EMPTY: ShopSettings = {
  'shop.legal_name': '',
  'shop.ein_enc': '',
  'shop.tax_registration_number': '',
  'shop.address_street': '',
  'shop.address_city': '',
  'shop.address_state': '',
  'shop.address_postal_code': '',
  'shop.address_country': 'US',
  'shop.shipping_same_as_business': 'true',
  'shop.shipping_street': '',
  'shop.shipping_city': '',
  'shop.shipping_state': '',
  'shop.shipping_postal_code': '',
  'shop.shipping_country': 'US',
  'tax.enabled': 'false',
  'tax.default_stripe_tax_code': '',
  'tax.flat_rate': '',
};

function Field({
  label, value, onChange, placeholder, type = 'text', hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground/60 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent/40"
      />
      {hint && <p className="text-[10px] text-foreground/40 mt-1">{hint}</p>}
    </div>
  );
}

function AddressBlock({
  prefix, values, onChange, countryKey, disabled,
}: {
  prefix: string;
  values: ShopSettings;
  onChange: (key: keyof ShopSettings, val: string) => void;
  countryKey: keyof ShopSettings;
  disabled?: boolean;
}) {
  const k = (suffix: string) => `${prefix}.${suffix}` as keyof ShopSettings;
  return (
    <div className={`space-y-3 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <Field label="Street address" value={values[k('street')]} onChange={(v) => onChange(k('street'), v)} placeholder="123 Main St" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="City" value={values[k('city')]} onChange={(v) => onChange(k('city'), v)} placeholder="Austin" />
        <Field label="State" value={values[k('state')]} onChange={(v) => onChange(k('state'), v)} placeholder="TX" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Postal code" value={values[k('postal_code')]} onChange={(v) => onChange(k('postal_code'), v)} placeholder="78701" />
        <Field label="Country" value={values[countryKey]} onChange={(v) => onChange(countryKey, v)} placeholder="US" />
      </div>
    </div>
  );
}

export function ShopConfigClient() {
  const [settings, setSettings] = useState<ShopSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.get('/settings/shop')
      .then((r) => setSettings({ ...EMPTY, ...r.data }))
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof ShopSettings, val: string) =>
    setSettings((prev) => ({ ...prev, [key]: val }));

  const sameAsBusiness = settings['shop.shipping_same_as_business'] !== 'false';

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await adminApi.patch('/settings/shop', { updates: settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-foreground/40">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-2">
        <Store className="w-5 h-5 text-accent" />
        <h1 className="text-xl font-semibold">Shop Config</h1>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Business Identity */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Building2 className="w-4 h-4 text-foreground/50" />
          <h2 className="text-sm font-semibold">Business Identity</h2>
        </div>
        <Field
          label="Legal business name"
          value={settings['shop.legal_name']}
          onChange={(v) => set('shop.legal_name', v)}
          placeholder="Acme LLC"
        />
        <Field
          label="EIN / Tax ID"
          value={settings['shop.ein_enc']}
          onChange={(v) => set('shop.ein_enc', v)}
          placeholder="XX-XXXXXXX"
          hint="Stored encrypted. Leave blank if not yet obtained."
        />
        <Field
          label="State tax registration number"
          value={settings['shop.tax_registration_number']}
          onChange={(v) => set('shop.tax_registration_number', v)}
          placeholder="Texas Comptroller permit number"
          hint="Required before activating tax collection."
        />
        <div>
          <p className="text-xs font-medium text-foreground/60 mb-2">Business / registered address</p>
          <AddressBlock
            prefix="shop.address"
            values={settings}
            onChange={set}
            countryKey="shop.address_country"
          />
        </div>
      </section>

      {/* Shipping Origin */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Truck className="w-4 h-4 text-foreground/50" />
          <h2 className="text-sm font-semibold">Shipping Origin</h2>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={sameAsBusiness}
            onChange={(e) => set('shop.shipping_same_as_business', e.target.checked ? 'true' : 'false')}
            className="accent-accent"
          />
          <span className="text-sm">Same as business address</span>
        </label>
        {!sameAsBusiness && (
          <AddressBlock
            prefix="shop.shipping"
            values={settings}
            onChange={set}
            countryKey="shop.shipping_country"
          />
        )}
      </section>

      {/* Tax */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Receipt className="w-4 h-4 text-foreground/50" />
          <h2 className="text-sm font-semibold">Tax</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Tax collection</p>
            <p className="text-xs text-foreground/50">Enable only after registering with your state tax authority and configuring Stripe Tax in the Dashboard.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings['tax.enabled'] === 'true'}
              onChange={(e) => set('tax.enabled', e.target.checked ? 'true' : 'false')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-foreground/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
          </label>
        </div>
        {settings['tax.enabled'] === 'true' && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700/50 p-3 text-xs text-amber-800 dark:text-amber-300">
            Tax collection is active. Ensure Stripe Tax is enabled in your Stripe Dashboard and your registration number is filled in above.
          </div>
        )}
        <Field
          label="Default Stripe Tax code"
          value={settings['tax.default_stripe_tax_code']}
          onChange={(v) => set('tax.default_stripe_tax_code', v)}
          placeholder="e.g. txcd_10040001"
          hint="Applied to all products that don't have a per-product tax code. Find codes at stripe.com/docs/tax/tax-codes."
        />
        <Field
          label="PayPal flat rate (%)"
          value={settings['tax.flat_rate']}
          onChange={(v) => set('tax.flat_rate', v)}
          placeholder="e.g. 8.25"
          hint="Used for PayPal orders (Stripe Tax handles Stripe orders automatically). Enter max state rate."
        />
      </section>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-sm text-green-500">Saved.</span>}
      </div>
    </div>
  );
}
