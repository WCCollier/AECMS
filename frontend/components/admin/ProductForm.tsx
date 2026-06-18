'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import dynamic from 'next/dynamic';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

const TipTapEditor = dynamic(
  () => import('@/components/editor').then((m) => m.TipTapEditor),
  { ssr: false, loading: () => <div className="h-48 bg-foreground/5 rounded-lg animate-pulse" /> },
);
import { MediaGalleryField } from '@/components/widgets';
import type { GalleryEntry } from '@/components/widgets';
import adminApi from '@/lib/adminApi';
import { getErrorMessage } from '@/lib/api';
import { slugToSku } from '@/lib/sku';
import type { MediaItem } from '@/types';

interface ProductFormData {
  title: string;
  slug: string;
  description: string;
  short_description: string;
  price: number;
  compare_at_price?: number;
  sku: string;
  stock_quantity: number;
  stock_status: 'in_stock' | 'out_of_stock' | 'back_ordered';
  product_type: 'physical' | 'digital' | 'service';
  status: 'draft' | 'published' | 'archived';
  visibility: 'public' | 'logged_in_only' | 'admin_only';
  guest_purchaseable: boolean;
  meta_title: string;
  meta_description: string;
}

interface ProductFormProps {
  productId?: string;
  initialData?: Partial<ProductFormData & { media?: MediaItem[] }>;
  mainExtra?: React.ReactNode;
  digitalFileCount?: number;
  onSaved?: () => void;
}

function toGalleryEntries(media?: MediaItem[]): GalleryEntry[] {
  if (!media?.length) return [];
  return [...media]
    .sort((a, b) => (a.is_primary === b.is_primary ? a.order - b.order : a.is_primary ? -1 : 1))
    .map((m) => ({ mediaId: m.id, url: m.url, isPrimary: m.is_primary }));
}

export function ProductForm({ productId, initialData, mainExtra, digitalFileCount = 0, onSaved }: ProductFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState(initialData?.description || '');
  const [gallery, setGallery] = useState<GalleryEntry[]>(() => toGalleryEntries(initialData?.media));
  const [isDirtyExtra, setIsDirtyExtra] = useState(false);
  const [saved, setSaved] = useState(false);
  // Tracks whether the SKU is still auto-managed (false once user manually edits)
  const [skuIsAuto, setSkuIsAuto] = useState(!productId && !initialData?.sku);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProductFormData>({
    defaultValues: {
      title: initialData?.title || '',
      slug: initialData?.slug || '',
      description: initialData?.description || '',
      short_description: initialData?.short_description || '',
      price: initialData?.price ? Number(initialData.price) : 0,
      compare_at_price: initialData?.compare_at_price ? Number(initialData.compare_at_price) : undefined,
      sku: initialData?.sku || '',
      stock_quantity: initialData?.stock_quantity || 0,
      stock_status: initialData?.stock_status || 'in_stock',
      product_type: initialData?.product_type || 'physical',
      status: initialData?.status || 'draft',
      visibility: initialData?.visibility || 'public',
      guest_purchaseable: initialData?.guest_purchaseable ?? true,
      meta_title: initialData?.meta_title || '',
      meta_description: initialData?.meta_description || '',
    },
  });

  const title = watch('title');
  const slug = watch('slug');
  const productType = watch('product_type');
  const currentStatus = watch('status');

  // Digital products cannot be published until at least one source file is attached
  const canPublish = productType !== 'digital' || digitalFileCount > 0;

  // Auto-reset to draft if the user switches to digital while status is published
  useEffect(() => {
    if (!canPublish && currentStatus === 'published') {
      setValue('status', 'draft');
    }
  }, [canPublish, currentStatus, setValue]);

  // Auto-derive slug from title on new products
  useEffect(() => {
    if (!productId && title) {
      const derived = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setValue('slug', derived);
    }
  }, [title, productId, setValue]);

  // Auto-derive SKU from slug + type on new products while not manually touched
  useEffect(() => {
    if (!productId && skuIsAuto && slug) {
      setValue('sku', slugToSku(slug, productType));
    }
  }, [slug, productType, productId, skuIsAuto, setValue]);

  // Split register for SKU so we can intercept onChange
  const { ref: skuRef, onChange: skuOnChange, ...skuRegisterRest } = register('sku');

  const onSubmit = async (data: ProductFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        title: data.title,
        slug: data.slug,
        description,
        short_description: data.short_description,
        price: data.price,
        compare_at_price: data.compare_at_price || undefined,
        sku: data.sku || undefined,
        product_type: data.product_type,
        status: data.status,
        visibility: data.visibility,
        guest_purchaseable: data.guest_purchaseable,
        meta_title: data.meta_title || undefined,
        meta_description: data.meta_description || undefined,
        media_ids: gallery.map((e) => e.mediaId),
      };

      if (data.product_type === 'physical') {
        payload.stock_quantity = data.stock_quantity;
        payload.stock_status = data.stock_status;
      }

      if (productId) {
        const res = await adminApi.patch(`/products/${productId}`, payload);
        if (res.data.warnings?.length) {
          alert(`Saved with notice:\n\n${(res.data.warnings as string[]).join('\n')}`);
        }
        reset(data);
        setIsDirtyExtra(false);
        setSaved(true);
        onSaved?.();
        setTimeout(() => setSaved(false), 2500);
      } else {
        const res = await adminApi.post('/products', payload);
        if (res.data.warnings?.length) {
          alert(`Product created with notice:\n\n${(res.data.warnings as string[]).join('\n')}`);
        }
        router.push(`/admin/products/${res.data.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title *</label>
                <Input
                  {...register('title', { required: 'Title is required' })}
                  placeholder="Product title"
                  className="w-full"
                />
                {errors.title && (
                  <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Slug *</label>
                <Input
                  {...register('slug', { required: 'Slug is required' })}
                  placeholder="product-slug"
                  className="w-full"
                />
                {errors.slug && (
                  <p className="text-red-500 text-sm mt-1">{errors.slug.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description *</label>
                <TipTapEditor
                  content={description}
                  onChange={(v) => { setDescription(v); setIsDirtyExtra(true); }}
                  placeholder="Describe your product..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Short Description</label>
                <textarea
                  {...register('short_description')}
                  placeholder="A brief summary for listings..."
                  rows={2}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
            </CardContent>
          </Card>

          {mainExtra}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-foreground/50 mb-3">
                First image is the primary listing image. Add more for a gallery on the product page.
              </p>
              <MediaGalleryField value={gallery} onChange={(v) => { setGallery(v); setIsDirtyExtra(true); }} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Product Type</label>
                <select
                  {...register('product_type')}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                >
                  <option value="physical">Physical</option>
                  <option value="digital">Digital</option>
                  <option value="service">Service</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  {...register('status')}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                >
                  <option value="draft">Draft</option>
                  {canPublish && <option value="published">Published</option>}
                  <option value="archived">Discontinued</option>
                </select>
                {productType === 'digital' && !canPublish && (
                  <p className="text-xs text-orange-500 mt-1.5">
                    Upload at least one source file to enable publishing.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Visibility</label>
                <select
                  {...register('visibility')}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                >
                  <option value="public">Public</option>
                  <option value="logged_in_only">Members Only</option>
                  <option value="admin_only">Admin Only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Purchase Access</label>
                <select
                  {...register('guest_purchaseable', { setValueAs: (v) => v === 'true' || v === true })}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                >
                  <option value="true">Open — guests may purchase</option>
                  <option value="false">Members only — login required</option>
                </select>
                <p className="text-xs text-foreground/50 mt-1">
                  Separate from visibility. Controls whether a login is required to buy.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || saved || (!!productId && !isDirty && !isDirtyExtra)}
                  className="flex-1"
                >
                  {isLoading ? 'Saving...' : saved ? 'Saved ✓' : productId ? 'Save Changes' : 'Create'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Price (USD) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('price', {
                      required: 'Price is required',
                      min: { value: 0, message: 'Price must be positive' },
                    })}
                    placeholder="0.00"
                    className="w-full pl-7"
                  />
                </div>
                {errors.price && (
                  <p className="text-red-500 text-sm mt-1">{errors.price.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Compare-at Price (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('compare_at_price', {
                      min: { value: 0, message: 'Must be positive' },
                    })}
                    placeholder="Original price (shown as strikethrough)"
                    className="w-full pl-7"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                  SKU
                  {skuIsAuto && (
                    <span className="text-xs font-normal text-foreground/40">auto-generated</span>
                  )}
                </label>
                <Input
                  ref={skuRef}
                  {...skuRegisterRest}
                  onChange={(e) => {
                    skuOnChange(e);
                    setSkuIsAuto(false);
                  }}
                  placeholder="e.g. P-AMER-SHOO-HAT"
                  className="w-full"
                />
                {skuIsAuto && (
                  <p className="text-xs text-foreground/40 mt-1">
                    Edit this field to override. Format: TYPE-WORD-WORD-WORD
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {productType === 'physical' && (
            <Card>
              <CardHeader>
                <CardTitle>Inventory</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Stock Quantity</label>
                  <Input
                    type="number"
                    min="0"
                    {...register('stock_quantity', {
                      valueAsNumber: true,
                      min: { value: 0, message: 'Stock must be positive' },
                    })}
                    placeholder="0"
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Stock Status</label>
                  <select
                    {...register('stock_status')}
                    className="w-full px-3 py-2 border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  >
                    <option value="in_stock">In Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                    <option value="back_ordered">Back Ordered</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Meta Title</label>
                <Input
                  {...register('meta_title')}
                  placeholder="SEO title (optional)"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Meta Description</label>
                <textarea
                  {...register('meta_description')}
                  placeholder="SEO description (optional)"
                  rows={3}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
