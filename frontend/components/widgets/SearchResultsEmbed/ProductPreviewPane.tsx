'use client';

import Link from 'next/link';
import { RichTextContent } from '@/components/editor/RichTextContent';
import type { Product } from '@/types';

interface ProductPreviewPaneProps {
  product: Product;
  depth: number;
}

export function ProductPreviewPane({ product, depth }: ProductPreviewPaneProps) {
  const price = typeof product.price === 'number'
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(product.price / 100)
    : null;

  return (
    <div className="relative overflow-hidden" style={{ height: '100dvh' }}>
      {/* Centered flex column — content + button share the same horizontal axis */}
      <div className="flex flex-col h-full overflow-hidden max-w-3xl mx-auto px-6 md:px-10">
        <div className="flex-1 overflow-hidden pt-8">
          <h2 className="text-2xl font-bold mb-1">{product.title}</h2>
          {price && <p className="text-lg font-semibold text-accent mb-4">{price}</p>}
          {/* max-w-none overrides the 68ch cap — outer column provides the width constraint */}
          <RichTextContent
            content={product.description ?? ''}
            className="prose-article max-w-none"
            depth={depth + 1}
          />
        </div>

        {/* Button lives in the same column so it aligns with the text */}
        <div className="py-6 flex justify-center relative z-10">
          <Link
            href={`/shop/${product.slug}`}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-accent text-sm font-medium hover:bg-accent/80 transition-colors"
            style={{ color: 'white', textDecoration: 'none' }}
          >
            View product →
          </Link>
        </div>
      </div>

      {/* Fade overlay — spans the full pane width; --color-background is the correct variable */}
      <div
        className="pointer-events-none absolute bottom-0 inset-x-0"
        style={{
          height: '40%',
          background: 'linear-gradient(to bottom, transparent, var(--color-background))',
        }}
      />
    </div>
  );
}
