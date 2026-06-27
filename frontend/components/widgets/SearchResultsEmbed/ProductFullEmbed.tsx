'use client';

import Link from 'next/link';
import { RichTextContent } from '@/components/editor/RichTextContent';
import type { Product } from '@/types';

interface ProductFullEmbedProps {
  product: Product;
  depth: number;
}

export function ProductFullEmbed({ product, depth }: ProductFullEmbedProps) {
  const price = typeof product.price === 'number'
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(product.price / 100)
    : null;

  return (
    <div className="py-8">
      <h2 className="text-2xl font-bold mb-1">
        <Link href={`/shop/${product.slug}`} className="hover:text-accent transition-colors">
          {product.title}
        </Link>
      </h2>

      {price && <p className="text-lg font-semibold text-accent mb-4">{price}</p>}

      {product.tags && product.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {product.tags.map((tag) => (
            <span key={tag.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-surface border border-border text-foreground/60">
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <RichTextContent
        content={product.description ?? ''}
        depth={depth + 1}
      />

      <div className="mt-6">
        <Link
          href={`/shop/${product.slug}`}
          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          View product →
        </Link>
      </div>

      <hr className="mt-8 border-border" />
    </div>
  );
}
