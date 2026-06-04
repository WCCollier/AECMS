'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ArticleForm } from '@/components/admin/ArticleForm';
import { VersionHistoryPanel } from '@/components/admin/VersionHistoryPanel';
import adminApi from '@/lib/adminApi';
import { getErrorMessage } from '@/lib/api';
import type { MediaItem } from '@/types';

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: 'draft' | 'published' | 'archived';
  visibility: 'public' | 'logged_in_only' | 'admin_only';
  meta_title: string;
  meta_description: string;
  media: MediaItem[];
}

export function EditArticleClient() {
  const params = useParams();
  const articleId = params?.id as string | undefined;

  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArticle() {
      try {
        const response = await adminApi.get(`/articles/${articleId}`);
        setArticle(response.data);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }

    if (articleId) {
      fetchArticle();
    }
  }, [articleId]);

  if (!articleId || isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-foreground/10 rounded w-1/4 mb-6" />
          <div className="h-64 bg-foreground/10 rounded" />
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg">
          {error || 'Article not found'}
        </div>
        <Link
          href="/admin/articles"
          className="inline-flex items-center text-foreground/60 hover:text-foreground mt-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Articles
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href="/admin/articles"
          className="inline-flex items-center text-foreground/60 hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Articles
        </Link>
        <h1 className="text-3xl font-bold">Edit Article</h1>
      </div>

      <ArticleForm articleId={articleId} initialData={article} />

      <div className="mt-6">
        <VersionHistoryPanel resourceType="articles" resourceId={articleId} />
      </div>
    </div>
  );
}
