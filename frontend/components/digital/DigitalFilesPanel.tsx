'use client';

import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import { FileText, Upload, Trash2, FlaskConical, CheckCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui';
import adminApi from '@/lib/adminApi';
import { getErrorMessage } from '@/lib/api';
import type { DigitalProductFile } from '@/types';

const adminFetcher = (url: string) => adminApi.get(url).then((r) => r.data);

const FORMAT_LABELS: Record<string, string> = {
  epub: 'EPUB',
  pdf: 'PDF',
};

const MIME_TYPES: Record<string, string> = {
  epub: 'application/epub+zip,.epub',
  pdf: 'application/pdf,.pdf',
};

interface Props {
  productId: string;
}

export function DigitalFilesPanel({ productId }: Props) {
  const { data: files, isLoading, mutate } = useSWR<DigitalProductFile[]>(
    productId ? `/digital-products/products/${productId}/files` : null,
    adminFetcher,
  );

  const [uploadFormat, setUploadFormat] = useState<'epub' | 'pdf'>('epub');
  const [uploading, setUploading] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const newFileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const existingFormats = new Set(files?.map((f) => f.format) ?? []);
  const availableFormats = (['epub', 'pdf'] as const).filter((f) => !existingFormats.has(f));

  // Keep uploadFormat in sync with available formats
  useEffect(() => {
    if (availableFormats.length > 0 && !availableFormats.includes(uploadFormat as 'epub' | 'pdf')) {
      setUploadFormat(availableFormats[0]);
    }
  }, [availableFormats.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const doUpload = async (file: File, format: 'epub' | 'pdf', isReplace: boolean, existingId?: string) => {
    setUploadError('');
    if (isReplace && existingId) setReplacingId(existingId);
    else setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('productId', productId);
    formData.append('format', format);
    formData.append('personalizationEnabled', 'true');

    try {
      await adminApi.post('/digital-products/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      mutate();
      if (newFileInputRef.current) newFileInputRef.current.value = '';
      if (existingId && replaceInputRefs.current[existingId]) {
        replaceInputRefs.current[existingId]!.value = '';
      }
    } catch (err) {
      setUploadError(getErrorMessage(err));
    } finally {
      setUploading(false);
      setReplacingId(null);
    }
  };

  const handleNewUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) doUpload(file, uploadFormat, false);
  };

  const handleReplace = (e: React.ChangeEvent<HTMLInputElement>, existingFile: DigitalProductFile) => {
    const file = e.target.files?.[0];
    if (file) doUpload(file, existingFile.format as 'epub' | 'pdf', true, existingFile.id);
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    setDeleting(fileId);
    try {
      await adminApi.delete(`/digital-products/files/${fileId}`);
      mutate();
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  const handleTestPersonalization = async (file: DigitalProductFile) => {
    setTesting(file.id);
    try {
      const res = await adminApi.post(
        '/digital-products/files/test-personalization',
        { fileId: file.id },
        { responseType: 'blob' },
      );
      const blob = new Blob([res.data], { type: res.headers['content-type'] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TEST-${file.format}-personalized.${file.format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      mutate();
    } catch (err) {
      alert(`Test personalization failed: ${getErrorMessage(err)}`);
    } finally {
      setTesting(null);
    }
  };

  if (isLoading) return null;

  return (
    <div className="mt-6 border border-orange-500/50 rounded-xl p-5">
      <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
        <FileText className="w-4 h-4 text-orange-500" />
        Digital Files
      </h2>

      {/* Existing files */}
      {files && files.length > 0 ? (
        <div className="space-y-3 mb-5">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 bg-foreground/5 rounded-lg border border-border"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider bg-accent/10 text-accent px-2 py-0.5 rounded">
                  {FORMAT_LABELS[file.format] ?? file.format.toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground/80">
                    {file.fileId.split('/').pop() ?? 'File'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {file.personalizationEnabled ? (
                      file.personalizationTested ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Personalization tested
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Not yet tested
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-foreground/40">Personalization off</span>
                    )}
                    <span className="text-xs text-foreground/30">· max {file.maxDownloads} downloads</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {file.personalizationEnabled && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestPersonalization(file)}
                    isLoading={testing === file.id}
                    title="Download a personalized test copy"
                  >
                    {testing === file.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <FlaskConical className="w-3 h-3 mr-1" />
                    )}
                    Test
                  </Button>
                )}

                {/* Replace button — re-uploads to the same slot */}
                <label className="inline-flex cursor-pointer">
                  <input
                    ref={(el) => { replaceInputRefs.current[file.id] = el; }}
                    type="file"
                    accept={MIME_TYPES[file.format]}
                    className="hidden"
                    onChange={(e) => handleReplace(e, file)}
                    disabled={replacingId === file.id}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    isLoading={replacingId === file.id}
                    onClick={() => replaceInputRefs.current[file.id]?.click()}
                    title={`Replace ${FORMAT_LABELS[file.format]} file`}
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </label>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(file.id)}
                  isLoading={deleting === file.id}
                  className="text-red-500 hover:text-red-600 border-red-500/30 hover:border-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-foreground/50 mb-4">No files uploaded yet.</p>
      )}

      {/* Upload form — only shown when a format slot is still open */}
      {availableFormats.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={uploadFormat}
            onChange={(e) => setUploadFormat(e.target.value as 'epub' | 'pdf')}
            className="text-sm px-3 py-2 rounded-lg border border-foreground/20 bg-background"
          >
            {availableFormats.map((f) => (
              <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              ref={newFileInputRef}
              type="file"
              accept={MIME_TYPES[uploadFormat]}
              className="hidden"
              onChange={handleNewUpload}
              disabled={uploading}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              isLoading={uploading}
              onClick={() => newFileInputRef.current?.click()}
            >
              <Upload className="w-3 h-3 mr-1.5" />
              Upload {FORMAT_LABELS[uploadFormat] ?? uploadFormat.toUpperCase()}
            </Button>
          </label>

          {uploadError && (
            <p className="text-xs text-red-500 w-full">{uploadError}</p>
          )}
        </div>
      )}

      {availableFormats.length === 0 && (
        <p className="text-xs text-foreground/40">Both formats uploaded. Use the replace button to update a file.</p>
      )}
    </div>
  );
}
