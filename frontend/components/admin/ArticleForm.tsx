'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { TipTapEditor } from '@/components/editor';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { MediaGalleryField } from '@/components/widgets';
import type { GalleryEntry } from '@/components/widgets';
import adminApi from '@/lib/adminApi';
import { getErrorMessage } from '@/lib/api';
import type { MediaItem } from '@/types';

interface ArticleFormData {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: 'draft' | 'published' | 'archived';
  visibility: 'public' | 'logged_in_only' | 'admin_only';
  meta_title: string;
  meta_description: string;
}

interface ArticleFormProps {
  articleId?: string;
  initialData?: Partial<ArticleFormData & { media?: MediaItem[] }>;
}

function toGalleryEntries(media?: MediaItem[]): GalleryEntry[] {
  if (!media?.length) return [];
  return [...media]
    .sort((a, b) => (a.is_primary === b.is_primary ? a.order - b.order : a.is_primary ? -1 : 1))
    .map((m) => ({ mediaId: m.id, url: m.url, isPrimary: m.is_primary }));
}

export function ArticleForm({ articleId, initialData }: ArticleFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState(initialData?.content || '');
  const [gallery, setGallery] = useState<GalleryEntry[]>(() => toGalleryEntries(initialData?.media));

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ArticleFormData>({
    defaultValues: {
      title: initialData?.title || '',
      slug: initialData?.slug || '',
      content: initialData?.content || '',
      excerpt: initialData?.excerpt || '',
      status: initialData?.status || 'draft',
      visibility: initialData?.visibility || 'public',
      meta_title: initialData?.meta_title || '',
      meta_description: initialData?.meta_description || '',
    },
  });

  const title = watch('title');

  useEffect(() => {
    if (!articleId && title) {
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setValue('slug', slug);
    }
  }, [title, articleId, setValue]);

  const onSubmit = async (data: ArticleFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        ...data,
        content,
        media_ids: gallery.map((e) => e.mediaId),
      };

      if (articleId) {
        await adminApi.patch(`/articles/${articleId}`, payload);
      } else {
        await adminApi.post('/articles', payload);
      }

      router.push('/admin/articles');
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
              <CardTitle>Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Title *</label>
                <Input
                  {...register('title', { required: 'Title is required' })}
                  placeholder="Article title"
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
                  placeholder="article-slug"
                  className="w-full"
                />
                {errors.slug && (
                  <p className="text-red-500 text-sm mt-1">{errors.slug.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Content *</label>
                <TipTapEditor
                  content={content}
                  onChange={setContent}
                  placeholder="Write your article content..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Excerpt</label>
                <textarea
                  {...register('excerpt')}
                  placeholder="A short summary of the article..."
                  rows={3}
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
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-foreground/50 mb-3">
                First image is used as the featured image on listing cards. Add more for a gallery on the article page.
              </p>
              <MediaGalleryField value={gallery} onChange={setGallery} />
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
                  {isLoading ? 'Saving...' : articleId ? 'Update' : 'Create'}
                </Button>
              </div>
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
