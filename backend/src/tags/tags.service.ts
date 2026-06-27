import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Tag } from '@prisma/client';
import { CreateTagDto, UpdateTagDto } from './dto';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new tag
   */
  async create(dto: CreateTagDto): Promise<Tag> {
    // Generate slug if not provided
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check if slug already exists
    const existing = await this.prisma.tag.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException('Tag with this slug already exists');
    }

    return this.prisma.tag.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
      },
    });
  }

  /**
   * Find all tags
   */
  async findAll(): Promise<Tag[]> {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: {
        articles: {
          select: { article_id: true },
        },
        _count: {
          select: { articles: true, products: true },
        },
      },
    });
  }

  /**
   * Find one tag by slug
   */
  async findBySlug(slug: string): Promise<Tag> {
    const tag = await this.prisma.tag.findUnique({
      where: { slug },
      include: {
        articles: {
          include: {
            article: {
              select: {
                id: true,
                title: true,
                slug: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: { articles: true },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return tag;
  }

  /**
   * Update a tag
   */
  async update(id: string, dto: UpdateTagDto): Promise<Tag> {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Check if slug is being changed and if it conflicts
    if (dto.slug && dto.slug !== tag.slug) {
      const existing = await this.prisma.tag.findUnique({
        where: { slug: dto.slug },
      });

      if (existing) {
        throw new ConflictException('Tag with this slug already exists');
      }
    }

    return this.prisma.tag.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
      },
    });
  }

  /**
   * Remove a tag
   */
  async remove(id: string): Promise<void> {
    const tag = await this.prisma.tag.findUnique({ where: { id } });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // DB cascade (onDelete: Cascade on ArticleTag + ProductTag) removes all associations.
    await this.prisma.tag.delete({ where: { id } });
  }

  async bulkAssign(tagId: string, articleIds: string[], productIds: string[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (articleIds.length) {
        await Promise.all(
          articleIds.map((aid) =>
            tx.articleTag.upsert({
              where: { article_id_tag_id: { article_id: aid, tag_id: tagId } },
              create: { article_id: aid, tag_id: tagId },
              update: {},
            }),
          ),
        );
      }
      if (productIds.length) {
        await Promise.all(
          productIds.map((pid) =>
            tx.productTag.upsert({
              where: { product_id_tag_id: { product_id: pid, tag_id: tagId } },
              create: { product_id: pid, tag_id: tagId },
              update: {},
            }),
          ),
        );
      }
    });
  }

  /**
   * Generate URL-friendly slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
