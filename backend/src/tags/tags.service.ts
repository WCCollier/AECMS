import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
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
          select: { articles: true },
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
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: {
        articles: true,
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Check if tag has articles
    if (tag.articles.length > 0) {
      throw new BadRequestException(
        'Cannot delete tag with associated articles. Remove articles from this tag first.',
      );
    }

    await this.prisma.tag.delete({
      where: { id },
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
