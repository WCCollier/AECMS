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
import { TagField } from '@/components/admin/TagField';
import adminApi from '@/lib/adminApi';
import { getErrorMessage } from '@/lib/api';
import type { MediaItem } from '@/types';

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface ArticleFormData {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: 'draft' | 'published' | 'archived';
  visibility: 'public' | 'logged_in_only' | 'admin_only';
  meta_title: string;
  meta_description: string;
  og_image_url: string;
}

interface ArticleFormProps {
  articleId?: string;
  initialData?: Partial<ArticleFormData & { media?: MediaItem[]; tags?: Tag[] }>;
  onSaved?: () => void;
}

function toGalleryEntries(media?: MediaItem[]): GalleryEntry[] {
  if (!media?.length) return [];
  return [...media]
    .sort((a, b) => (a.is_primary === b.is_primary ? a.order - b.order : a.is_primary ? -1 : 1))
    .map((m) => ({ mediaId: m.id, url: m.url, isPrimary: m.is_primary }));
}

export function ArticleForm({ articleId, initialData, onSaved }: ArticleFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState(initialData?.content || '');
  const [gallery, setGallery] = useState<GalleryEntry[]>(() => toGalleryEntries(initialData?.media));
  const [tags, setTags] = useState<Tag[]>(() => initialData?.tags ?? []);
  const [isDirtyExtra, setIsDirtyExtra] = useState(false);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
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
      og_image_url: (initialData as any)?.og_image_url || '',
    },
  });

  const title = watch('title');
  const metaTitle = watch('meta_title');
  const metaDescription = watch('meta_description');
  const slugValue = watch('slug');
  const excerptValue = watch('excerpt');

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
        tag_ids: tags.map((t) => t.id),
      };

      if (articleId) {
        await adminApi.patch(`/articles/${articleId}`, payload);
        reset(data);
        setIsDirtyExtra(false);
        setSaved(true);
        onSaved?.();
        setTimeout(() => setSaved(false), 2500);
      } else {
        await adminApi.post('/articles', payload);
        router.push('/admin/articles');
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
                  onChange={(v) => { setContent(v); setIsDirtyExtra(true); }}
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
              <MediaGalleryField value={gallery} onChange={(v) => { setGallery(v); setIsDirtyExtra(true); }} />
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
                <Button
                  type="submit"
                  disabled={isLoading || saved || (!!articleId && !isDirty && !isDirtyExtra)}
                  className="flex-1"
                >
                  {isLoading ? 'Saving...' : saved ? 'Saved ✓' : articleId ? 'Save Changes' : 'Create'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-foreground/50 mb-3">
                Tags are used for filtering and categorisation. Select existing tags or type to create a new one.
              </p>
              <TagField
                value={tags}
                onChange={(t) => { setTags(t); setIsDirtyExtra(true); }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Google snippet preview */}
              <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-3 text-xs">
                <p className="text-[11px] text-foreground/40 mb-1 uppercase tracking-wide">Preview</p>
                <p className="text-blue-400 truncate">{slugValue ? `yoursite.com/articles/${slugValue}` : 'yoursite.com/articles/...'}</p>
                <p className="text-[15px] text-blue-300 font-medium mt-0.5 truncate">{metaTitle || title || 'Article title'}</p>
                <p className="text-foreground/60 mt-0.5 line-clamp-2">{metaDescription || excerptValue || 'Meta description will appear here'}</p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium">Meta Title</label>
                  <span className={`text-xs ${metaTitle.length > 60 ? 'text-red-400' : 'text-foreground/40'}`}>{metaTitle.length}/60</span>
                </div>
                <Input
                  {...register('meta_title')}
                  placeholder={title || 'SEO title (defaults to article title)'}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium">Meta Description</label>
                  <span className={`text-xs ${metaDescription.length > 160 ? 'text-red-400' : 'text-foreground/40'}`}>{metaDescription.length}/160</span>
                </div>
                <textarea
                  {...register('meta_description')}
                  placeholder={excerptValue || 'SEO description (defaults to excerpt)'}
                  rows={3}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">OG Image URL</label>
                <Input
                  {...register('og_image_url')}
                  placeholder="Override social sharing image (defaults to first article image)"
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
