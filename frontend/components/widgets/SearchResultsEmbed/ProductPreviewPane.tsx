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
    <div
      className="relative overflow-hidden"
      style={{ height: '100dvh' }}
    >
      <div className="p-6 md:p-10 h-full overflow-hidden">
        <h2 className="text-2xl font-bold mb-1">{product.title}</h2>
        {price && <p className="text-lg font-semibold text-accent mb-4">{price}</p>}
        <RichTextContent
          content={product.description ?? ''}
          depth={depth + 1}
        />
      </div>

      {/* Fade overlay */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0"
        style={{
          height: '35%',
          background: 'linear-gradient(to bottom, transparent, var(--background))',
        }}
      />

      {/* View product link */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
        <Link
          href={`/shop/${product.slug}`}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          View product →
        </Link>
      </div>
    </div>
  );
}
