import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) } as any);

const data: Array<{ wp_id: number; slug: string; content: string; featured_image: string | null }> =
  JSON.parse(fs.readFileSync('/tmp/fix_data.json', 'utf8'));

const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'wp-import');

async function getOrCreateMedia(filename: string, ownerId: string): Promise<string | null> {
  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠ Missing file: ${filename}`);
    return null;
  }

  // Check if media record already exists
  const existing = await prisma.media.findFirst({ where: { filename } });
  if (existing) return existing.id;

  // Get image dimensions
  const ext = path.extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp',
  };
  const mimeType = mimeMap[ext] || 'image/jpeg';
  const stat = fs.statSync(filePath);
  let width: number | undefined, height: number | undefined;
  try {
    const meta = await sharp(filePath).metadata();
    width = meta.width;
    height = meta.height;
  } catch { /* non-image or sharp error */ }

  const media = await prisma.media.create({
    data: {
      filename,
      original_name: filename,
      mime_type: mimeType,
      size: stat.size,
      width: width ?? null,
      height: height ?? null,
      file_path: filePath,
      uploaded_by: ownerId,
    },
  });
  return media.id;
}

async function main() {
  const owner = await prisma.user.findFirst({ where: { role_name: 'owner' } });
  if (!owner) throw new Error('No owner user found');

  let contentUpdated = 0, imageSet = 0, missing = 0;

  for (const post of data) {
    const article = await prisma.article.findFirst({ where: { slug: post.slug } });
    if (!article) {
      console.log(`  skip (not in DB): ${post.slug}`);
      missing++;
      continue;
    }

    // 1. Update content to proper HTML
    const updateData: any = { content: post.content };

    // 2. Set featured image
    if (post.featured_image) {
      const mediaId = await getOrCreateMedia(post.featured_image, owner.id);
      if (mediaId) {
        updateData.featured_image_id = mediaId;
        imageSet++;
      }
    }

    await prisma.article.update({ where: { id: article.id }, data: updateData });
    contentUpdated++;
  }

  console.log(`\nContent updated: ${contentUpdated}`);
  console.log(`Featured images set: ${imageSet}`);
  console.log(`Not in DB: ${missing}`);
}

main().catch(console.error).finally(() => pool.end());
