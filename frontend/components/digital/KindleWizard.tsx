'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { X, ChevronLeft, ChevronRight, Send, Loader2, CheckCircle, AlertCircle, Maximize2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import api, { getErrorMessage } from '@/lib/api';
import { fetcher } from '@/lib/swr';
import type { DigitalDownload, KindleDevice } from '@/types';

// The Kindle guide images should be placed in /public/kindle-guide/
// When the images don't exist yet, the component shows a styled placeholder.
const STEP_IMAGES: Record<number, string[]> = {
  1: [
    '/kindle-guide/to-kindle_1_marked.jpg',
    '/kindle-guide/to-kindle_2_marked.jpg',
    '/kindle-guide/to-kindle_3_marked.jpg',
  ],
  2: [
    '/kindle-guide/to-kindle_3_marked.jpg',
    '/kindle-guide/to-kindle_4_marked.jpg',
  ],
};

// Auto-advance interval in ms (slow as requested)
const CAROUSEL_INTERVAL = 6000;

function ImageCarousel({ step }: { step: number }) {
  const images = STEP_IMAGES[step] ?? [];
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setIdx(0);
    setImgErrors({});
  }, [step]);

  useEffect(() => {
    if (images.length <= 1) return;
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % images.length);
    }, CAROUSEL_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [images.length, step]);

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);

  const visibleImages = images.filter((_, i) => !imgErrors[i]);
  if (visibleImages.length === 0) return null;

  const currentSrc = images[idx];
  const hasError = imgErrors[idx];

  return (
    <>
      <div className="relative w-full aspect-video bg-foreground/5 rounded-xl overflow-hidden mb-5 border border-border">
        {hasError ? (
          <div className="absolute inset-0 flex items-center justify-center text-foreground/30 text-sm">
            Screenshot not yet available
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentSrc}
            alt={`Step guide ${idx + 1}`}
            className="w-full h-full object-contain cursor-zoom-in"
            onClick={() => setLightbox(currentSrc)}
            onError={() => setImgErrors((e) => ({ ...e, [idx]: true }))}
          />
        )}

        {/* Enlarge button */}
        {!hasError && (
          <button
            className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-black/60 rounded-lg text-white transition-colors"
            onClick={() => setLightbox(currentSrc)}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Prev / next */}
        {images.length > 1 && (
          <>
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
              onClick={prev}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors"
              onClick={next}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? 'bg-white' : 'bg-white/40'}`}
                onClick={() => setIdx(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Enlarged guide screenshot"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </>
  );
}

// Helper for rendering colored words
function G({ children }: { children: React.ReactNode }) {
  return <strong className="text-green-500">{children}</strong>;
}
function M({ children }: { children: React.ReactNode }) {
  return <strong className="text-pink-500">{children}</strong>;
}

type WizardState =
  | 'device-select'
  | 'step-find-email'
  | 'step-whitelist'
  | 'step-name-device'
  | 'step-confirm'
  | 'sending'
  | 'done'
  | 'error';

interface Props {
  download: DigitalDownload;
  onClose: () => void;
}

export function KindleWizard({ download, onClose }: Props) {
  const { data: devices, isLoading: devicesLoading } = useSWR<KindleDevice[]>(
    '/kindle/devices',
    fetcher,
  );
  const { data: profile } = useSWR<{ kindleFromEmail: string }>('/setup/profile', fetcher);
  const storeKindleEmail = profile?.kindleFromEmail || 'books@yourstore.com';

  const [state, setState] = useState<WizardState | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [kindleEmail, setKindleEmail] = useState('');
  const [deviceName, setDeviceName] = useState('My Kindle');
  const [saveDevice, setSaveDevice] = useState(true);
  const [format, setFormat] = useState(download.format);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Once devices load, determine initial state
  useEffect(() => {
    if (devicesLoading || state !== null) return;
    if (devices && devices.length > 0) {
      setState('device-select');
      setSelectedDeviceId(devices[0].id);
    } else {
      setState('step-find-email');
    }
  }, [devices, devicesLoading, state]);

  if (devicesLoading || state === null) {
    return (
      <ModalShell onClose={onClose} title="Send to Kindle">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-foreground/40" />
        </div>
      </ModalShell>
    );
  }

  const hasDevices = devices && devices.length > 0;

  const totalSteps = hasDevices ? 2 : 4;
  const currentStep =
    state === 'device-select' ? 1 :
    state === 'step-find-email' ? 1 :
    state === 'step-whitelist' ? 2 :
    state === 'step-name-device' ? 3 :
    state === 'step-confirm' ? (hasDevices ? 2 : 4) :
    null;

  const selectedDevice = devices?.find((d) => d.id === selectedDeviceId);

  // ── DONE ──────────────────────────────────────────────────────────────────
  if (state === 'done') {
    return (
      <ModalShell onClose={onClose} title="Send to Kindle">
        <div className="text-center py-10">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sent!</h3>
          <p className="text-foreground/60 text-sm mb-4">{successMsg}</p>
          <div className="text-sm bg-foreground/5 border border-foreground/10 rounded-lg px-4 py-3 text-foreground/70 text-left mb-6">
            <span className="font-medium text-foreground">Reminder:</span> On your Kindle, go to{' '}
            <span className="font-medium text-foreground">Settings → Sync</span> (or pull down on the home screen)
            to download your new book.
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>
      </ModalShell>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <ModalShell onClose={onClose} title="Send to Kindle">
        <div className="text-center py-10">
          <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Delivery failed</h3>
          <p className="text-foreground/60 text-sm mb-6">{errorMsg}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => setState(hasDevices ? 'device-select' : 'step-find-email')}>
              Try Again
            </Button>
          </div>
        </div>
      </ModalShell>
    );
  }

  // ── SENDING ───────────────────────────────────────────────────────────────
  if (state === 'sending') {
    return (
      <ModalShell onClose={onClose} title="Send to Kindle">
        <div className="text-center py-10">
          <Loader2 className="w-10 h-10 text-accent mx-auto mb-4 animate-spin" />
          <p className="text-foreground/60">Sending to your Kindle…</p>
        </div>
      </ModalShell>
    );
  }

  const doSend = async () => {
    setState('sending');
    try {
      let body: Record<string, unknown> = {
        downloadId: download.id,
        format,
      };

      if (state === 'step-confirm' && !hasDevices) {
        // New device flow
        if (saveDevice) {
          const deviceRes = await api.post<KindleDevice>('/kindle/devices', {
            friendlyName: deviceName,
            kindleEmail,
            isDefault: true,
          });
          body.kindleDeviceId = deviceRes.data.id;
        } else {
          body.kindleEmail = kindleEmail;
        }
      } else {
        // Device select flow
        if (selectedDeviceId === '__new__') {
          if (saveDevice) {
            const deviceRes = await api.post<KindleDevice>('/kindle/devices', {
              friendlyName: deviceName,
              kindleEmail,
              isDefault: false,
            });
            body.kindleDeviceId = deviceRes.data.id;
          } else {
            body.kindleEmail = kindleEmail;
          }
        } else {
          body.kindleDeviceId = selectedDeviceId;
        }
      }

      const res = await api.post<{ success: boolean; message: string }>('/kindle/send', body);
      if (res.data.success) {
        setSuccessMsg(res.data.message);
        setState('done');
      } else {
        setErrorMsg(res.data.message || 'Delivery failed.');
        setState('error');
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
      setState('error');
    }
  };

  // ── DEVICE SELECT (returning user) ───────────────────────────────────────
  if (state === 'device-select') {
    return (
      <ModalShell onClose={onClose} title="Send to Kindle" step={1} totalSteps={2}>
        <h3 className="font-semibold mb-1">Choose Your Device</h3>
        <p className="text-sm text-foreground/60 mb-4">Select the Kindle device you want to send to.</p>

        <div className="space-y-2 mb-4">
          {devices!.map((d) => (
            <label key={d.id} className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-foreground/5 transition-colors">
              <input
                type="radio"
                name="device"
                value={d.id}
                checked={selectedDeviceId === d.id}
                onChange={() => { setSelectedDeviceId(d.id); setKindleEmail(''); }}
                className="mt-1"
              />
              <div>
                <p className="font-medium text-sm">{d.friendlyName}</p>
                <p className="text-xs text-foreground/50">{d.kindleEmail}</p>
              </div>
            </label>
          ))}
          <label className="flex items-start gap-3 p-3 rounded-lg border border-dashed border-border cursor-pointer hover:bg-foreground/5 transition-colors">
            <input
              type="radio"
              name="device"
              value="__new__"
              checked={selectedDeviceId === '__new__'}
              onChange={() => setSelectedDeviceId('__new__')}
              className="mt-1"
            />
            <div>
              <p className="font-medium text-sm">Add new device</p>
              <p className="text-xs text-foreground/50">Enter a different Kindle email</p>
            </div>
          </label>
        </div>

        {selectedDeviceId === '__new__' && (
          <div className="space-y-3 mb-4 p-3 bg-foreground/5 rounded-lg">
            <Input
              label="Kindle email address"
              type="email"
              value={kindleEmail}
              onChange={(e) => setKindleEmail(e.target.value)}
              placeholder="yourname_123@kindle.com"
            />
            <Input
              label="Device name"
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="My Kindle Paperwhite"
            />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={saveDevice} onChange={(e) => setSaveDevice(e.target.checked)} className="rounded" />
              Save this device to my account
            </label>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-medium">Format:</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-foreground/20 bg-background"
          >
            <option value="epub">EPUB (recommended)</option>
            <option value="pdf">PDF</option>
          </select>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              if (selectedDeviceId && selectedDeviceId !== '__new__') {
                doSend();
              } else if (selectedDeviceId === '__new__' && kindleEmail) {
                doSend();
              }
            }}
            disabled={
              !selectedDeviceId ||
              (selectedDeviceId === '__new__' && !kindleEmail)
            }
          >
            <Send className="w-4 h-4 mr-2" />
            Send to Kindle
          </Button>
        </div>
      </ModalShell>
    );
  }

  // ── STEP 1 — FIND YOUR KINDLE EMAIL (new user) ──────────────────────────
  if (state === 'step-find-email') {
    return (
      <ModalShell onClose={onClose} title="Send to Kindle" step={1} totalSteps={4} accentColor="green">
        <ImageCarousel step={1} />
        <h3 className="font-semibold mb-3 text-green-600">Find Your Kindle Email</h3>
        <p className="text-sm text-foreground/70 mb-3">Your Kindle device has a unique email address.</p>
        <ol className="text-sm space-y-2 text-foreground/80 mb-5">
          <li>1. Go to <strong>amazon.com</strong> → <strong>Account</strong></li>
          <li>2. At the bottom, under &quot;Digital content and devices,&quot; click <G>Devices</G></li>
          <li>3. On the next page, click <G>Kindle</G></li>
          <li>4. Copy the device email address from this page, or click <G>Preferences</G> at the top to see the full list</li>
        </ol>
        <Input
          label="Enter the device email address"
          type="email"
          value={kindleEmail}
          onChange={(e) => setKindleEmail(e.target.value)}
          placeholder="yourname_123@kindle.com"
        />
        <div className="flex gap-3 justify-end pt-5 border-t border-border mt-5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => setState('step-whitelist')}
            disabled={!kindleEmail.toLowerCase().includes('@kindle')}
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </ModalShell>
    );
  }

  // ── STEP 2 — WHITELIST OUR EMAIL ────────────────────────────────────────
  if (state === 'step-whitelist') {
    return (
      <ModalShell onClose={onClose} title="Send to Kindle" step={2} totalSteps={4} accentColor="magenta">
        <ImageCarousel step={2} />
        <h3 className="font-semibold mb-3 text-pink-500">Whitelist Our Email</h3>
        <p className="text-sm text-foreground/70 mb-3">Amazon only accepts files from approved senders.</p>
        <ol className="text-sm space-y-2 text-foreground/80 mb-5">
          <li>1. Click <G>Preferences</G> if you have not already done so</li>
          <li>2. Scroll down to the &quot;Approved Personal Document E-mail List&quot;</li>
          <li>3. Click <M>Add a new e-mail address</M></li>
          <li>4. Enter:</li>
        </ol>
        <div className="flex items-center gap-2 mb-2">
          <code className="bg-foreground/10 text-sm px-3 py-1.5 rounded-lg font-mono select-all">
            {storeKindleEmail}
          </code>
          <button
            className="text-xs text-accent hover:underline"
            onClick={() => navigator.clipboard.writeText(storeKindleEmail)}
          >
            Copy
          </button>
        </div>
        <div className="flex gap-3 justify-end pt-5 border-t border-border mt-5">
          <Button variant="ghost" onClick={() => setState('step-find-email')}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button onClick={() => setState('step-name-device')}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </ModalShell>
    );
  }

  // ── STEP 3 — NAME THIS DEVICE ────────────────────────────────────────────
  if (state === 'step-name-device') {
    return (
      <ModalShell onClose={onClose} title="Send to Kindle" step={3} totalSteps={4}>
        <h3 className="font-semibold mb-3">Name This Device</h3>
        <p className="text-sm text-foreground/60 mb-4">
          Give this device a friendly name so you can find it later.
        </p>
        <Input
          label="Device name"
          type="text"
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          placeholder="My Kindle Paperwhite"
        />
        <label className="flex items-center gap-2 text-sm cursor-pointer mt-3">
          <input
            type="checkbox"
            checked={saveDevice}
            onChange={(e) => setSaveDevice(e.target.checked)}
            className="rounded"
          />
          Save this device to my account
        </label>
        <div className="flex gap-3 justify-end pt-5 border-t border-border mt-5">
          <Button variant="ghost" onClick={() => setState('step-whitelist')}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button onClick={() => setState('step-confirm')}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </ModalShell>
    );
  }

  // ── STEP 4 — CONFIRM & SEND ──────────────────────────────────────────────
  if (state === 'step-confirm') {
    const remaining = download.maxDownloads - download.downloadCount;
    return (
      <ModalShell onClose={onClose} title="Send to Kindle" step={4} totalSteps={4}>
        <h3 className="font-semibold mb-4">Ready to Send!</h3>

        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-medium">Format:</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="text-sm px-3 py-1.5 rounded-lg border border-foreground/20 bg-background"
          >
            <option value="epub">EPUB (recommended for Kindle)</option>
            <option value="pdf">PDF</option>
          </select>
        </div>

        <div className="bg-foreground/5 rounded-lg p-4 text-sm space-y-1 mb-4">
          <p className="text-foreground/60">We&apos;ll send <strong className="text-foreground">&ldquo;{download.productName}&rdquo;</strong> to:</p>
          <p className="font-mono text-foreground/80">{kindleEmail}</p>
          {saveDevice && <p className="text-foreground/50">({deviceName})</p>}
          <p className="text-foreground/50 mt-2 text-xs">
            This counts as 1 of your {remaining} remaining download{remaining !== 1 ? 's' : ''}.
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-border">
          <Button variant="ghost" onClick={() => setState('step-name-device')}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <Button onClick={doSend}>
            <Send className="w-4 h-4 mr-2" />
            Send to Kindle
          </Button>
        </div>
      </ModalShell>
    );
  }

  return null;
}

// ── SHARED MODAL SHELL ───────────────────────────────────────────────────────

interface ModalShellProps {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  step?: number;
  totalSteps?: number;
  accentColor?: 'green' | 'magenta' | 'default';
}

function ModalShell({ children, onClose, title, step, totalSteps, accentColor = 'default' }: ModalShellProps) {
  const stepColor =
    accentColor === 'green' ? 'text-green-500' :
    accentColor === 'magenta' ? 'text-pink-500' :
    'text-accent';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
          <div>
            <p className="text-xs text-foreground/40 font-medium uppercase tracking-wider">{title}</p>
            {step !== undefined && totalSteps !== undefined && (
              <p className={`text-sm font-semibold ${stepColor}`}>
                Step {step} of {totalSteps}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-foreground/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
