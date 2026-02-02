'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useDomainAliases,
  createDomainAlias,
  updateDomainAlias,
  deleteDomainAlias,
  verifyDomainAlias,
} from '@/hooks/useDomainAliases';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui';
import {
  Globe,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  X,
  Copy,
  ExternalLink,
  Power,
  PowerOff,
} from 'lucide-react';
import type { DomainAlias } from '@/types';

interface VerificationModalProps {
  domainAlias: DomainAlias;
  onClose: () => void;
  onVerify: () => void;
  isVerifying: boolean;
}

function VerificationModal({ domainAlias, onClose, onVerify, isVerifying }: VerificationModalProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const txtRecordName = `_aecms-verify.${domainAlias.domain}`;
  const txtRecordValue = domainAlias.verification_token;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-foreground/10">
          <h2 className="text-xl font-semibold">Verify Domain Ownership</h2>
          <button onClick={onClose} className="text-foreground/60 hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="font-medium mb-2">Domain</h3>
            <p className="text-foreground/70">{domainAlias.domain}</p>
          </div>

          <div>
            <h3 className="font-medium mb-3">DNS Configuration Instructions</h3>
            <div className="bg-foreground/5 rounded-lg p-4 space-y-4">
              <p className="text-sm text-foreground/70">
                Add the following TXT record to your DNS settings to verify domain ownership:
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-foreground/60 uppercase">Record Type</label>
                  <p className="font-mono bg-background px-3 py-2 rounded border border-foreground/10">TXT</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground/60 uppercase">Name / Host</label>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 font-mono bg-background px-3 py-2 rounded border border-foreground/10 text-sm break-all">
                      {txtRecordName}
                    </p>
                    <button
                      onClick={() => copyToClipboard(txtRecordName)}
                      className="p-2 hover:bg-foreground/10 rounded"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground/60 uppercase">Value / Content</label>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 font-mono bg-background px-3 py-2 rounded border border-foreground/10 text-sm break-all">
                      {txtRecordValue}
                    </p>
                    <button
                      onClick={() => copyToClipboard(txtRecordValue)}
                      className="p-2 hover:bg-foreground/10 rounded"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {copied && (
                <p className="text-sm text-green-600">Copied to clipboard!</p>
              )}
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-700">
                <p className="font-medium mb-1">DNS propagation may take time</p>
                <p>DNS changes can take up to 48 hours to propagate globally. If verification fails, please wait and try again later.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-foreground/10">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onVerify} isLoading={isVerifying}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Verify Now
          </Button>
        </div>
      </div>
    </div>
  );
}

interface CreateDomainModalProps {
  onClose: () => void;
  onSubmit: (domain: string, targetRoute: string) => void;
  isSubmitting: boolean;
  error: string | null;
}

function CreateDomainModal({ onClose, onSubmit, isSubmitting, error }: CreateDomainModalProps) {
  const [domain, setDomain] = useState('');
  const [targetRoute, setTargetRoute] = useState('/');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(domain, targetRoute);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-foreground/10">
          <h2 className="text-xl font-semibold">Add Domain Alias</h2>
          <button onClick={onClose} className="text-foreground/60 hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <Input
              label="Domain"
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              hint="Enter the domain without http:// or https://"
              required
            />

            <Input
              label="Target Route"
              placeholder="/"
              value={targetRoute}
              onChange={(e) => setTargetRoute(e.target.value)}
              hint="The route this domain should point to (e.g., / or /blog)"
              required
            />

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 p-6 border-t border-foreground/10">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <Plus className="w-4 h-4 mr-2" />
              Add Domain
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteConfirmModalProps {
  domain: string;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

function DeleteConfirmModal({ domain, onClose, onConfirm, isDeleting }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-red-500/10 rounded-full">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold">Delete Domain Alias</h2>
          </div>

          <p className="text-foreground/70 mb-6">
            Are you sure you want to delete <span className="font-medium text-foreground">{domain}</span>?
            This action cannot be undone.
          </p>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onConfirm} isLoading={isDeleting}>
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminDomainsClient() {
  const { user } = useAuth();
  const { domainAliases, isLoading, mutate } = useDomainAliases();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState<DomainAlias | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<DomainAlias | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Only owners can manage domain aliases
  const isOwner = user?.role === 'owner';

  if (!isOwner) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-foreground/60">
              Only site owners can manage domain aliases.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreate = async (domain: string, targetRoute: string) => {
    setCreateError(null);
    setIsSubmitting(true);
    try {
      await createDomainAlias({ domain, target_route: targetRoute });
      await mutate();
      setShowCreateModal(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create domain alias');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (domainAlias: DomainAlias) => {
    setIsVerifying(true);
    setActionError(null);
    try {
      await verifyDomainAlias(domainAlias.id);
      await mutate();
      setShowVerificationModal(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDelete = async (domainAlias: DomainAlias) => {
    setIsDeleting(true);
    setActionError(null);
    try {
      await deleteDomainAlias(domainAlias.id);
      await mutate();
      setShowDeleteModal(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to delete domain alias');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async (domainAlias: DomainAlias) => {
    setIsToggling(domainAlias.id);
    setActionError(null);
    try {
      await updateDomainAlias(domainAlias.id, { is_active: !domainAlias.is_active });
      await mutate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to update domain alias');
    } finally {
      setIsToggling(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Domain Aliases</h1>
          <p className="text-foreground/60 mt-1">Manage custom domains for your site</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Domain
        </Button>
      </div>

      {actionError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-600">{actionError}</p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground mx-auto" />
              <p className="mt-4 text-foreground/60">Loading domains...</p>
            </div>
          ) : domainAliases.length === 0 ? (
            <div className="p-12 text-center">
              <Globe className="w-12 h-12 mx-auto text-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">No domain aliases configured</h3>
              <p className="text-foreground/60 mb-6">
                Add a custom domain to make your site accessible from your own domain.
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Domain
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-foreground/5 border-b border-foreground/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Domain</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Target Route</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Status</th>
                    <th className="px-6 py-3 text-left text-sm font-medium text-foreground/70">Active</th>
                    <th className="px-6 py-3 text-right text-sm font-medium text-foreground/70">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {domainAliases.map((alias) => (
                    <tr key={alias.id} className="hover:bg-foreground/5">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-foreground/10 rounded flex items-center justify-center">
                            <Globe className="w-5 h-5 text-foreground/50" />
                          </div>
                          <div>
                            <span className="font-medium">{alias.domain}</span>
                            <a
                              href={`https://${alias.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-foreground/40 hover:text-foreground/60"
                            >
                              <ExternalLink className="w-3 h-3 inline" />
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-foreground/70 font-mono text-sm">
                        {alias.target_route}
                      </td>
                      <td className="px-6 py-4">
                        {alias.is_verified ? (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-500/10 text-green-600">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Verified
                          </span>
                        ) : (
                          <button
                            onClick={() => setShowVerificationModal(alias)}
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            Pending Verification
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleActive(alias)}
                          disabled={isToggling === alias.id || !alias.is_verified}
                          className={`
                            inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full
                            transition-colors
                            ${alias.is_active
                              ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20'
                              : 'bg-foreground/10 text-foreground/50 hover:bg-foreground/20'
                            }
                            ${(!alias.is_verified || isToggling === alias.id) ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                          title={!alias.is_verified ? 'Domain must be verified first' : undefined}
                        >
                          {isToggling === alias.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : alias.is_active ? (
                            <Power className="w-3.5 h-3.5" />
                          ) : (
                            <PowerOff className="w-3.5 h-3.5" />
                          )}
                          {alias.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!alias.is_verified && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowVerificationModal(alias)}
                              title="View verification instructions"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowDeleteModal(alias)}
                            title="Delete domain"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How Domain Aliases Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                1
              </div>
              <div>
                <h4 className="font-medium">Add Domain</h4>
                <p className="text-sm text-foreground/60">
                  Enter your custom domain and the route it should point to.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                2
              </div>
              <div>
                <h4 className="font-medium">Configure DNS</h4>
                <p className="text-sm text-foreground/60">
                  Add the TXT record to your DNS settings to verify ownership.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                3
              </div>
              <div>
                <h4 className="font-medium">Activate</h4>
                <p className="text-sm text-foreground/60">
                  Once verified, activate the domain to start using it.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      {showCreateModal && (
        <CreateDomainModal
          onClose={() => {
            setShowCreateModal(false);
            setCreateError(null);
          }}
          onSubmit={handleCreate}
          isSubmitting={isSubmitting}
          error={createError}
        />
      )}

      {showVerificationModal && (
        <VerificationModal
          domainAlias={showVerificationModal}
          onClose={() => setShowVerificationModal(null)}
          onVerify={() => handleVerify(showVerificationModal)}
          isVerifying={isVerifying}
        />
      )}

      {showDeleteModal && (
        <DeleteConfirmModal
          domain={showDeleteModal.domain}
          onClose={() => setShowDeleteModal(null)}
          onConfirm={() => handleDelete(showDeleteModal)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
