'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { TipTapEditor } from '@/components/editor';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { ImageField } from '@/components/admin/ImageField';
import api, { getErrorMessage } from '@/lib/api';

interface ProductFormData {
  name: string;
  slug: string;
  description: string;
  short_description: string;
  featured_image_url: string | null;
  price: number;
  compare_at_price?: number;
  sku: string;
  stock_quantity: number;
  track_inventory: boolean;
  is_digital: boolean;
  status: 'draft' | 'published' | 'archived';
  visibility: 'public' | 'logged_in_only' | 'admin_only';
  meta_title: string;
  meta_description: string;
}

interface ProductFormProps {
  productId?: string;
  initialData?: Partial<ProductFormData>;
}

export function ProductForm({ productId, initialData }: ProductFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState(initialData?.description || '');
  const [featuredImage, setFeaturedImage] = useState<string | null>(initialData?.featured_image_url || null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    defaultValues: {
      name: initialData?.name || '',
      slug: initialData?.slug || '',
      description: initialData?.description || '',
      short_description: initialData?.short_description || '',
      price: initialData?.price ? Number(initialData.price) : 0,
      compare_at_price: initialData?.compare_at_price ? Number(initialData.compare_at_price) : undefined,
      sku: initialData?.sku || '',
      stock_quantity: initialData?.stock_quantity || 0,
      track_inventory: initialData?.track_inventory ?? true,
      is_digital: initialData?.is_digital ?? false,
      status: initialData?.status || 'draft',
      visibility: initialData?.visibility || 'public',
      meta_title: initialData?.meta_title || '',
      meta_description: initialData?.meta_description || '',
    },
  });

  const name = watch('name');
  const trackInventory = watch('track_inventory');
  const isDigital = watch('is_digital');

  // Auto-generate slug from name
  useEffect(() => {
    if (!productId && name) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setValue('slug', slug);
    }
  }, [name, productId, setValue]);

  // Digital products don't track inventory
  useEffect(() => {
    if (isDigital) {
      setValue('track_inventory', false);
    }
  }, [isDigital, setValue]);

  const onSubmit = async (data: ProductFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        ...data,
        description,
        featured_image_url: featuredImage,
        price: data.price,
      };

      if (productId) {
        await api.patch(`/products/${productId}`, payload);
      } else {
        await api.post('/products', payload);
      }

      router.push('/admin/products');
      router.refresh();
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
                <label className="block text-sm font-medium mb-2">Name *</label>
                <Input
                  {...register('name', { required: 'Name is required' })}
                  placeholder="Product name"
                  className="w-full"
                />
                {errors.name && (
                  <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
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
                  onChange={setDescription}
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Image</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageField
                label=""
                value={featuredImage}
                onChange={setFeaturedImage}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Publish</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  {...register('status')}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
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

              <div className="pt-4 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? 'Saving...' : productId ? 'Update' : 'Create'}
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
                      min: { value: 0, message: 'Price must be positive' }
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
                      min: { value: 0, message: 'Must be positive' }
                    })}
                    placeholder="Original price (shown as strikethrough)"
                    className="w-full pl-7"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">SKU</label>
                <Input
                  {...register('sku')}
                  placeholder="Stock Keeping Unit"
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_digital"
                  {...register('is_digital')}
                  className="w-4 h-4 rounded border-foreground/20"
                />
                <label htmlFor="is_digital" className="text-sm">
                  Digital product
                </label>
              </div>

              {!isDigital && (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="track_inventory"
                      {...register('track_inventory')}
                      className="w-4 h-4 rounded border-foreground/20"
                    />
                    <label htmlFor="track_inventory" className="text-sm">
                      Track inventory
                    </label>
                  </div>

                  {trackInventory && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Stock Quantity</label>
                      <Input
                        type="number"
                        min="0"
                        {...register('stock_quantity', {
                          valueAsNumber: true,
                          min: { value: 0, message: 'Stock must be positive' }
                        })}
                        placeholder="0"
                        className="w-full"
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

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
