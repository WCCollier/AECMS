import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Category } from '@prisma/client';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new category
   */
  async create(dto: CreateCategoryDto): Promise<Category> {
    // Generate slug if not provided
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check if slug already exists
    const existing = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new ConflictException('Category with this slug already exists');
    }

    // Validate parent if provided
    if (dto.parent_id) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parent_id },
      });

      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        parent_id: dto.parent_id,
      },
    });
  }

  /**
   * Find all categories (hierarchical tree structure)
   */
  async findAll(): Promise<Category[]> {
    // Get all categories
    const categories = await this.prisma.category.findMany({
      orderBy: [{ parent_id: 'asc' }, { name: 'asc' }],
      include: {
        children: true,
        articles: {
          select: { article_id: true },
        },
      },
    });

    // Build tree structure (root categories with nested children)
    return this.buildTree(categories);
  }

  /**
   * Find one category by slug
   */
  async findBySlug(slug: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        parent: true,
        children: true,
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
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  /**
   * Update a category
   */
  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if slug is being changed and if it conflicts
    if (dto.slug && dto.slug !== category.slug) {
      const existing = await this.prisma.category.findUnique({
        where: { slug: dto.slug },
      });

      if (existing) {
        throw new ConflictException('Category with this slug already exists');
      }
    }

    // Prevent circular parent relationship
    if (dto.parent_id) {
      if (dto.parent_id === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }

      // Check if new parent exists
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parent_id },
      });

      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }

      // Check if new parent is a descendant (would create circular reference)
      const isDescendant = await this.isDescendant(id, dto.parent_id);
      if (isDescendant) {
        throw new BadRequestException(
          'Cannot set parent to a descendant category',
        );
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        parent_id: dto.parent_id,
      },
    });
  }

  /**
   * Remove a category
   */
  async remove(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        children: true,
        articles: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if category has children
    if (category.children.length > 0) {
      throw new BadRequestException(
        'Cannot delete category with child categories. Delete children first or reassign them.',
      );
    }

    // Check if category has articles
    if (category.articles.length > 0) {
      throw new BadRequestException(
        'Cannot delete category with associated articles. Remove articles from this category first.',
      );
    }

    await this.prisma.category.delete({
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

  /**
   * Build hierarchical tree structure from flat category list
   */
  private buildTree(categories: any[]): any[] {
    const categoryMap = new Map();
    const roots: any[] = [];

    // First pass: create map of all categories
    categories.forEach((cat) => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build tree
    categories.forEach((cat) => {
      const category = categoryMap.get(cat.id);
      if (cat.parent_id) {
        const parent = categoryMap.get(cat.parent_id);
        if (parent) {
          parent.children.push(category);
        } else {
          // Parent doesn't exist, treat as root
          roots.push(category);
        }
      } else {
        roots.push(category);
      }
    });

    return roots;
  }

  /**
   * Check if potentialDescendant is a descendant of categoryId
   */
  private async isDescendant(
    categoryId: string,
    potentialDescendantId: string,
  ): Promise<boolean> {
    let current = await this.prisma.category.findUnique({
      where: { id: potentialDescendantId },
      select: { id: true, parent_id: true },
    });

    while (current && current.parent_id) {
      if (current.parent_id === categoryId) {
        return true;
      }
      current = await this.prisma.category.findUnique({
        where: { id: current.parent_id },
        select: { id: true, parent_id: true },
      });
    }

    return false;
  }
}
