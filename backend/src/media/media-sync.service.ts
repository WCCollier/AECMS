import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type EntityType = 'article' | 'product' | 'page';

interface TipTapNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
}

interface MediaItem {
  id: string;
  url?: string;
}

@Injectable()
export class MediaSyncService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Extract all media references from TipTap JSON content and write them to
   * the appropriate join table (ArticleMedia, ProductMedia, PageMedia).
   *
   * Handles two node types:
   *   - image: attrs.src is a URL string; resolved to a Media ID via filename lookup
   *   - mediaCarousel: attrs.media is a JSON array of { id, url, ... }; IDs used directly
   *
   * explicitMediaIds (gallery selections) are written first with is_primary/order semantics.
   * Inline-only IDs are appended after with is_primary = false.
   */
  async syncEntityMedia(
    entityType: EntityType,
    entityId: string,
    content: string,
    explicitMediaIds: string[],
  ): Promise<void> {
    const { imageUrls, carouselIds } = this.extractFromTipTap(content);

    const resolvedImageIds = await this.resolveImageUrls(imageUrls);

    // Merge: explicit gallery first, then inline-only (deduplicated)
    const explicitSet = new Set(explicitMediaIds);
    const inlineOnlyIds: string[] = [];
    for (const id of [...carouselIds, ...resolvedImageIds]) {
      if (!explicitSet.has(id) && !inlineOnlyIds.includes(id)) {
        inlineOnlyIds.push(id);
      }
    }

    const allIds = [...explicitMediaIds, ...inlineOnlyIds];

    switch (entityType) {
      case 'article':
        await this.prisma.articleMedia.deleteMany({ where: { article_id: entityId } });
        if (allIds.length > 0) {
          await this.prisma.articleMedia.createMany({
            data: allIds.map((mediaId, index) => ({
              article_id: entityId,
              media_id: mediaId,
              order: index,
              is_primary: index === 0 && explicitMediaIds.length > 0,
            })),
          });
        }
        break;

      case 'product':
        await this.prisma.productMedia.deleteMany({ where: { product_id: entityId } });
        if (allIds.length > 0) {
          await this.prisma.productMedia.createMany({
            data: allIds.map((mediaId, index) => ({
              product_id: entityId,
              media_id: mediaId,
              order: index,
              is_primary: index === 0 && explicitMediaIds.length > 0,
            })),
          });
        }
        break;

      case 'page':
        await this.prisma.pageMedia.deleteMany({ where: { page_id: entityId } });
        if (allIds.length > 0) {
          await this.prisma.pageMedia.createMany({
            data: allIds.map((mediaId, index) => ({
              page_id: entityId,
              media_id: mediaId,
              order: index,
              is_primary: false,
            })),
          });
        }
        break;
    }
  }

  private extractFromTipTap(content: string): { imageUrls: string[]; carouselIds: string[] } {
    const imageUrls: string[] = [];
    const carouselIds: string[] = [];

    let doc: TipTapNode;
    try {
      doc = JSON.parse(content);
    } catch {
      return { imageUrls, carouselIds };
    }

    this.walkNode(doc, imageUrls, carouselIds);
    return { imageUrls, carouselIds };
  }

  private walkNode(node: TipTapNode, imageUrls: string[], carouselIds: string[]): void {
    if (!node) return;

    if (node.type === 'image' && node.attrs?.src) {
      imageUrls.push(node.attrs.src as string);
    }

    if (node.type === 'mediaCarousel' && node.attrs?.media) {
      try {
        const items = JSON.parse(node.attrs.media as string) as MediaItem[];
        for (const item of items) {
          if (item.id && !carouselIds.includes(item.id)) {
            carouselIds.push(item.id);
          }
        }
      } catch {
        // malformed attrs — skip
      }
    }

    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        this.walkNode(child, imageUrls, carouselIds);
      }
    }
  }

  private async resolveImageUrls(urls: string[]): Promise<string[]> {
    if (urls.length === 0) return [];

    const basenames = urls.map((url) => {
      // Strip /uploads/ prefix for local, or take basename for cloud paths
      const withoutPrefix = url.replace(/^\/uploads\//, '');
      return withoutPrefix.split('/').pop() ?? withoutPrefix;
    });

    const records = await this.prisma.media.findMany({
      where: { filename: { in: basenames } },
      select: { id: true, filename: true },
    });

    const filenameToId = new Map(records.map((r) => [r.filename, r.id]));
    const ids: string[] = [];
    for (const basename of basenames) {
      const id = filenameToId.get(basename);
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }
}
