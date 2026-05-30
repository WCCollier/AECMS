import { PrismaClient, ProductType, StockStatus, ContentStatus, ContentVisibility } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';
import * as path from 'path';

config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // --- Media records for lesson images ---
  const imageMap: Record<string, string> = {};

  const images = [
    { filename: 'female-rifleshooter1-1.jpg', alt: 'Marksmanship lesson', mime: 'image/jpeg' },
    { filename: 'female-shotgun-shooter.jpg',  alt: 'Wing shooting lesson', mime: 'image/jpeg' },
    { filename: 'female-tac-pistol-1.jpg',    alt: 'Defensive shooting basics', mime: 'image/jpeg' },
    { filename: 'female-tac-rifle.jpg',        alt: 'Defensive shooting advanced', mime: 'image/jpeg' },
    { filename: 'Logo-base.png',              alt: 'Fantasy v Reality logo', mime: 'image/png' },
  ];

  for (const img of images) {
    const existing = await prisma.media.findFirst({ where: { filename: img.filename } });
    if (existing) {
      imageMap[img.filename] = existing.id;
      console.log(`Media exists: ${img.filename} → ${existing.id}`);
    } else {
      const media = await prisma.media.create({
        data: {
          filename: img.filename,
          original_name: img.filename,
          mime_type: img.mime,
          size: 0,
          file_path: `wp-import/${img.filename}`,
          alt_text: img.alt,
          uploaded_by: (await prisma.user.findFirstOrThrow({ where: { email: 'owner@aecms.local' } })).id,
        },
      });
      imageMap[img.filename] = media.id;
      console.log(`Created media: ${img.filename} → ${media.id}`);
    }
  }

  // image assignment by WP thumbnail logic
  const img = (f: string) => imageMap[f];
  const RIFLE   = img('female-rifleshooter1-1.jpg');
  const SHOTGUN = img('female-shotgun-shooter.jpg');
  const PISTOL  = img('female-tac-pistol-1.jpg');
  const TACRIFLE = img('female-tac-rifle.jpg');
  const LOGO    = img('Logo-base.png');

  const lessons = [
    {
      name: 'American Shooter Lesson 1: Marksmanship',
      slug: 'american-shooter-lesson-1-marksmanship',
      sku: 'AS-L1-MARKS',
      price: 324.00,
      short_description: 'The first course in the American Shooter curriculum. $324 for up to 4 students.',
      description: `<p>$324 for up to 4 students</p><p>The first course in the American Shooter curriculum, in which you will learn:</p><ul><li>Fundamentals of Safe Gun Ownership and Handling, including handling, maintaining, storing, and using a firearm safely and responsibly</li><li>Marksmanship fundamentals with pistol, rifle, and shotgun</li><li>Traditional Static Shooting with pistol, rifle, and shotgun</li></ul>`,
      image: RIFLE,
    },
    {
      name: 'American Shooter Lesson 2: Wing Shooting',
      slug: 'american-shooter-lesson-2-wing-shooting',
      sku: 'AS-L2-WING',
      price: 225.00,
      short_description: 'The second course in the American Shooter curriculum. $225 for up to 4 students.',
      description: `<p>$225 for up to 4 students</p><p>The second course in the American Shooter curriculum, in which you will learn:</p><ul><li>Basic Wing Shooting</li><li>Introduction to Dynamic Shooting (Traditional)</li></ul>`,
      image: SHOTGUN,
    },
    {
      name: 'American Shooter Lesson 3: Defensive Shooting Basics',
      slug: 'american-shooter-lesson-3-defensive-shooting-basics',
      sku: 'AS-L3-DEF-B',
      price: 425.00,
      short_description: 'The third course in the American Shooter curriculum. $425 for up to 4 students.',
      description: `<p>$425 for up to 4 students</p><p>The third course in the American Shooter curriculum, in which you will learn:</p><ul><li>Defensive Shooting with Pistol and Carbine</li><li>Dynamic and Static Shooting in a Defensive Context</li></ul>`,
      image: PISTOL,
    },
    {
      name: 'American Shooter Lesson 4: Defensive Shooting Additional Skills',
      slug: 'american-shooter-lesson-4-defensive-shooting-additional-skills',
      sku: 'AS-L4-DEF-A',
      price: 425.00,
      short_description: 'The fourth course in the American Shooter curriculum. $425 for up to 4 students.',
      description: `<p>$425 for up to 4 students</p><p>The fourth course in the American Shooter curriculum, in which you will learn:</p><ul><li>Malfunction Drills</li><li>Tactical Reloads</li><li>Barricade Shooting</li></ul>`,
      image: TACRIFLE,
    },
    {
      name: 'American Shooter Supplemental: Traditional Static Shooting',
      slug: 'american-shooter-supplemental-traditional-static-shooting',
      sku: 'AS-SUPP-TSS',
      price: 175.00,
      short_description: 'Supplemental course for students who began with defensive shooting. $175 for up to 4 students.',
      description: `<p>$175 for up to 4 students</p><p>If you skipped Lesson 1 and went directly to <em>Growing Up with a Shotgun</em> or <em>Direct to Defensive Shooting</em>, you can take this course later on to go back and learn the fundamentals of Traditional Static Shooting.</p>`,
      image: RIFLE,
    },
    {
      name: 'American Shooter Supplemental: Traditional Dynamic Shooting',
      slug: 'american-shooter-supplemental-traditional-dynamic-shooting',
      sku: 'AS-SUPP-TDS',
      price: 175.00,
      short_description: 'Supplemental course for students who skipped wing shooting. $175 for up to 4 students.',
      description: `<p>$175 for up to 4 students</p><p>If you skipped Lesson 2 and went <em>Direct to Defensive Shooting</em>, you can take this course later on to go back and learn the fundamentals of Traditional Dynamic Shooting.</p>`,
      image: SHOTGUN,
    },
    {
      name: 'American Shooter Alternative: Direct to Defensive Shooting',
      slug: 'american-shooter-alternative-direct-to-defensive-shooting',
      sku: 'AS-ALT-DDS',
      price: 654.00,
      short_description: 'Accelerated defensive shooting for those with urgent training needs. $654 for up to 4 students.',
      description: `<p>$654 for up to 4 students</p><p>If you do not have the resources to progress through the full American Shooter core curriculum, and you need training urgently in the safe and effective use of your defensive firearm, this alternative curriculum covers the essential content of Lessons 1, 3, and 4 in a single intensive session.</p>`,
      image: PISTOL,
    },
    {
      name: 'American Shooter: Strategies for Personal Protection',
      slug: 'american-shooter-strategies-for-personal-protection',
      sku: 'AS-STRAT-PP',
      price: 164.00,
      short_description: 'A course in the broader context of personal protection. $164 for up to 4 students.',
      description: `<p>$164 for up to four students</p><p>You have heard it said that a gun is a tool, not a talisman. It is not the solution to your self-defense needs, but just one component (if a pivotal one) of your overall personal protection strategy. This course addresses that broader context.</p>`,
      image: LOGO,
    },
    {
      name: 'American Shooter: Community Training Seminar',
      slug: 'american-shooter-community-training-seminar',
      sku: 'AS-COMM-SEM',
      price: 0.00,
      short_description: 'Contact American Shooter for pricing and scheduling.',
      description: `<p>Contact American Shooter for pricing and scheduling.</p><p>As the number of new gun-owners in the United States skyrockets, more and more communities and social organizations are discovering the need and desire for accessible, responsible firearms education. American Shooter offers community seminars tailored to your group's needs and concerns.</p>`,
      image: LOGO,
    },
    {
      name: 'NRA Basic Pistol',
      slug: 'nra-basic-pistol',
      sku: 'NRA-BP',
      price: 495.00,
      short_description: 'NRA Basic Pistol course. $495 for up to 4 students; price includes NRA course materials.',
      description: `<p>$495 for up to 4 students; price includes NRA course materials</p><p>NRA Basic Pistol is a comprehensive introduction to pistol shooting for new shooters, covering safety, fundamentals, and basic marksmanship.</p>`,
      image: LOGO,
    },
    {
      name: 'NRA Basic Rifle',
      slug: 'nra-basic-rifle',
      sku: 'NRA-BR',
      price: 495.00,
      short_description: 'NRA Basic Rifle course. $495 for up to 4 students; price includes NRA course materials.',
      description: `<p>$495 for up to 4 students; price includes NRA course materials</p><p>NRA Basic Rifle is a comprehensive introduction to rifle shooting covering safety, fundamentals, and basic marksmanship.</p>`,
      image: LOGO,
    },
    {
      name: 'NRA Personal Protection Inside the Home',
      slug: 'nra-personal-protection-inside-the-home',
      sku: 'NRA-PPIH',
      price: 495.00,
      short_description: 'NRA Personal Protection Inside the Home. $495 for up to 4 students.',
      description: `<p>$495 for up to 4 students</p><p>NRA Personal Protection Inside the Home covers the knowledge, skills, and attitude essential for using a firearm safely and effectively in a home-defense situation.</p>`,
      image: LOGO,
    },
    {
      name: 'NRA Personal Protection Outside the Home',
      slug: 'nra-personal-protection-outside-the-home',
      sku: 'NRA-PPOH',
      price: 495.00,
      short_description: 'NRA Personal Protection Outside the Home. $495 for up to 4 students; includes NRA materials.',
      description: `<p>$495 for up to 4 students; price includes NRA course materials</p><p>NRA Personal Protection Outside the Home addresses the knowledge, skills, and attitude needed to carry a concealed firearm responsibly for personal protection outside the home.</p>`,
      image: LOGO,
    },
    {
      name: 'American Shooter Supplemental: Classroom and Lab, Online',
      slug: 'american-shooter-supplemental-classroom-and-lab-online',
      sku: 'AS-SUPP-CAL-O',
      price: 224.00,
      short_description: 'Online classroom/lab portion of an applicable syllabus course. $224 for up to 4 students.',
      description: `<p>$224 for up to 4 students, covers the classroom/lab portion of an applicable syllabus course.</p><p>Can't make it to a lesson in person? American Shooter offers distance-learning (via Zoom or similar) for the classroom and lab portions of applicable courses.</p>`,
      image: LOGO,
    },
    {
      name: 'American Shooter: Hourly Lessons',
      slug: 'american-shooter-hourly-lessons',
      sku: 'AS-HOURLY',
      price: 94.00,
      short_description: 'Custom hourly lessons for any purpose. $94 per hour, up to 3 students.',
      description: `<p>$94 per hour up to 3 students</p><p>Custom hourly lessons can be used to serve any purpose you may have which is not covered by the standard curriculum courses. You may wish to continue after one of the standard courses, revisit skills from a previous course, or address specific needs not covered elsewhere.</p>`,
      image: LOGO,
    },
  ];

  const owner = await prisma.user.findFirstOrThrow({ where: { email: 'owner@aecms.local' } });

  for (const lesson of lessons) {
    const existing = await prisma.product.findFirst({ where: { slug: lesson.slug } });
    if (existing) {
      console.log(`Skipping existing: ${lesson.name}`);
      continue;
    }

    const product = await prisma.product.create({
      data: {
        name: lesson.name,
        slug: lesson.slug,
        sku: lesson.sku ?? null,
        description: lesson.description,
        short_description: lesson.short_description,
        price: lesson.price,
        product_type: ProductType.service,
        stock_status: StockStatus.available,
        stock_quantity: null,
        status: ContentStatus.published,
        visibility: ContentVisibility.public,
        guest_purchaseable: true,
        published_at: new Date(),
        ...(lesson.image && {
          media: {
            create: {
              media_id: lesson.image,
              is_primary: true,
              order: 0,
            },
          },
        }),
      },
    });
    console.log(`Created: ${product.name}`);
  }

  console.log('\nDone.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
