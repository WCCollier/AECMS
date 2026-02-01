'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ArticleForm } from '@/components/admin/ArticleForm';

export function NewArticleClient() {
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
        <h1 className="text-3xl font-bold">New Article</h1>
      </div>

      <ArticleForm />
    </div>
  );
}
