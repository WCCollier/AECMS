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
      title: 'American Shooter Lesson 1: Marksmanship',
      slug: 'american-shooter-lesson-1-marksmanship',
      sku: 'AS-L1-MARKS',
      price: 324.00,
      short_description: 'The first course in the American Shooter curriculum. $324 for up to 4 students.',
      description: `<p>$324 for up to 4 students</p>
<p>The first course in the American Shooter curriculum, in which you will learn:</p>
<ul>
 	<li>Fundamentals of Safe Gun Ownership and Handling, including handling, maintaining, storing, and transporting your firearm</li>
 	<li>Fundamentals For Accuracy (Basics of Traditional Static Shooting)</li>
 	<li>how to teach others to be safe around your firearm</li>
 	<li>how to go to the range and practice with your rifle</li>
</ul>
<p>This course teaches you the fundamentals of growing up with a gun, as if you had been given your first .22 rifle when you were just a child, running wild around the farm and countryside. You will become comfortable with your firearm as your companion, learning to care for it, to keep it secure from others, to use it responsibly and legally, and above all to shoot accurately with it.</p>
<p><strong>This course also lays the groundwork of your Traditional Static Shooting skills, which will come back to serve you if you later pursue Defensive/Combat shooting.</strong></p>
<p>You will need:</p>
<ul>
 	<li>A rifle, preferably chambered for .22 Long Rifle  (Your instructor can provide a rifle if you do not have one.)</li>
 	<li>A rifle case (soft or hard-shell)</li>
 	<li>Ammunition for your rifle (100 rounds), as well as .22 Long Rifle ammunition (100 rounds)  (That\\'s 200 rounds total .22 LR if you are borrowing or bringing your own .22 rifle.)</li>
 	<li>Eye protection  (Your instructor can provide loaner eye-pro if necessary)</li>
 	<li>Ear protection  (You may purchase foam earplugs if necessary)</li>
</ul>
<p>Aspiring Pistol/Defensive Shooters: If you are taking this class with the intent to work toward defensive/combat shooting with a handgun or carbine, AS encourages you to buy your own .22 rifle. You will never find a better tool for practicing, and later teaching, the fundamentals of good shooting. However, this is not required in order to take the class. You can use American Shooter\\'s .22 rifle; you need only provide ammunition.</p>
<p>Aspiring Shotgun/Wing-Shooters: Even if you are taking this class with the intent to move toward shooting clay pigeons or hunting birds on the wing or small game with a shotgun, AS encourages you to buy your own .22 rifle. You will never find a better tool for practicing, and later teaching, the fundamentals of good shooting. However, this is not required in order to take the class. You can use American Shooter\\'s .22 rifle; you need only provide ammunition. Alternatively, you may take <em>Growing Up with a Shotgun</em>, in which you will learn the Fundamentals of Safe Gun Ownership and Handling beginning immediately with your shotgun and proceeding to basic wing-shooting. If you go this route, AS encourages you to return as soon as possible for the Shooting for Accuracy add-on course, to learn the fundamentals of shooting for accuracy with a precision firearm.</p>`,
      image: RIFLE,
    },
    {
      title: 'American Shooter Lesson 2: Wing Shooting',
      slug: 'american-shooter-lesson-2-wing-shooting',
      sku: 'AS-L2-WING',
      price: 225.00,
      short_description: 'The second course in the American Shooter curriculum. $225 for up to 4 students.',
      description: `<p>$225 for up to 4 students</p>
<p>The second course in the American Shooter curriculum, in which you will learn:</p>
<ul>
 	<li>Basic Wing Shooting</li>
 	<li>Introduction to Dynamic Shooting (Traditional)</li>
</ul>
<p>This course assumes you have already taken Lesson 1: Marksmanship. This course teaches you the fundamentals of Dynamic Shooting through the art of Wing-Shooting<em>—</em>that is, shooting birds or clay pigeons in flight<em>—</em>using a shotgun.</p>
<p><strong>This course lays the groundwork for Traditional Dynamic Shooting skills, which will come back to serve you if you pursue defensive/combat shooting.</strong></p>
<p>You will need:</p>
<ul>
 	<li>A shotgun fitted to you, preferably chambered for 20-gauge shot-shells, with traditional rail-and-bead sight and cylinder, skeet, or trap choke.  (AS can provide a shotgun if you do not have one.)</li>
 	<li>A shotgun case (soft or hard-shell) if bringing your own shotgun</li>
 	<li>Ammunition for your shotgun (300 shotshells, #7½, #8, or #9 shot, 20 gauge if using AS\\'s shotgun)</li>
 	<li>Eye protection  (Your instructor can provide loaner eye-pro if necessary)</li>
 	<li>Ear protection  (You may purchase foam earplugs if necessary)</li>
</ul>
<p>Aspiring Pistol/Defensive Shooters: If you are taking this class with the intent to work toward defensive/combat shooting with a handgun or carbine, you can use AS\\'s shotgun, and you need only provide ammunition. However, be warned: shotgun sports are addictively fun and are far and away the best training for accurate tactical/defensive shooting (which is another form of Dynamic Shooting). You may be sorely tempted to buy a shotgun after taking this class.</p>`,
      image: SHOTGUN,
    },
    {
      title: 'American Shooter Lesson 3: Defensive Shooting Basics',
      slug: 'american-shooter-lesson-3-defensive-shooting-basics',
      sku: 'AS-L3-DEF-B',
      price: 425.00,
      short_description: 'The third course in the American Shooter curriculum. $425 for up to 4 students.',
      description: `<p>$425 for up to 4 students</p>
<p>The third course in the American Shooter curriculum, in which you will learn:</p>
<ul>
 	<li>Defensive Shooting with Pistol and Carbine</li>
 	<li>Dynamic and Static Shooting in Defense/Combat and action shooting sports</li>
 	<li>Up-Touch-Press Drill with Finishing Lateral Movement</li>
 	<li>Speed Reload</li>
</ul>
<p>This course assumes you have already taken Lesson 1: Marksmanship, and Lesson 2: Wing-Shooting. This course teaches you the fundamentals of defensive and combat shooting using a pistol and carbine, demonstrates the similarities and differences between the two, and <strong>shows you how the fundamentals of Traditional Static and Dynamic Shooting which you have already learned have prepared you for using a gun in defense of yourself and others</strong>.</p>
<p>You will need:</p>
<ul>
 	<li>A semi-automatic pistol, preferably striker fired, chambered for a cartridge you can shoot efficiently.  .22 Long Rifle is welcome and encouraged.  9x19mm is typical.</li>
 	<li>A carbine or modern sporting rifle, semi-automatic, chambered for a cartridge you can shoot efficiently.  .22 Long Rifle is welcome and encouraged.  5.56x45mm is typical.</li>
 	<li>Ammunition for your pistol (400 rounds)</li>
 	<li>Ammunition for your rifle (400 rounds)</li>
 	<li>Eye protection  (Your instructor can provide loaner eye-pro if necessary)</li>
 	<li>Ear protection  (You may purchase foam earplugs if necessary)</li>
</ul>`,
      image: PISTOL,
    },
    {
      title: 'American Shooter Lesson 4: Defensive Shooting Additional Skills',
      slug: 'american-shooter-lesson-4-defensive-shooting-additional-skills',
      sku: 'AS-L4-DEF-A',
      price: 425.00,
      short_description: 'The fourth course in the American Shooter curriculum. $425 for up to 4 students.',
      description: `<p>$425 for up to 4 students</p>
<p>The fourth course in the American Shooter curriculum, in which you will learn:</p>
<ul>
 	<li>Malfunction Drills</li>
 	<li>Tactical Reloads</li>
 	<li>Barricade Shooting</li>
 	<li>Carbine-to-Pistol Transitions</li>
 	<li>Unorthodox Shooting Positions</li>
</ul>
<p>This course assumes you have already taken Lesson 1: Marksmanship, and Lesson 2: Wing-Shooting. This course teaches you the fundamentals of defensive and combat shooting using a pistol and carbine, demonstrates the similarities and differences between the two, and <strong>shows you how the fundamentals of Traditional Static and Dynamic Shooting which you have already learned have prepared you for using a gun in defense of yourself and others</strong>.</p>
<p>You will need:</p>
<ul>
 	<li>A semi-automatic pistol, preferably striker fired, chambered for a cartridge you can shoot efficiently.</li>
 	<li>A carbine or modern sporting rifle, semi-automatic, chambered for a cartridge you can shoot efficiently.</li>
 	<li>Ammunition for your pistol (400 rounds)</li>
 	<li>Ammunition for your rifle (400 rounds)</li>
 	<li>An appropriate carry-strap or sling for your rifle</li>
 	<li>An appropriate holster for your pistol, strong-side carry</li>
 	<li>Eye protection  (Your instructor can provide loaner eye-pro if necessary)</li>
 	<li>Ear protection  (You may purchase foam earplugs if necessary)</li>
</ul>`,
      image: TACRIFLE,
    },
    {
      title: 'American Shooter Supplemental: Traditional Static Shooting',
      slug: 'american-shooter-supplemental-traditional-static-shooting',
      sku: 'AS-SUPP-TSS',
      price: 175.00,
      short_description: 'Supplemental course for students who began with defensive shooting. $175 for up to 4 students.',
      description: `<p>$175 for up to 4 students</p>
<p>If you skipped Lesson 1 and went directly to <em>Growing Up with a Shotgun</em> or <em>Direct to Defensive Shooting</em>, you can take this course later on to go back and learn the fundamentals of Traditional Static Shooting, so that you can improve your shooting skills and pass them down to your family and friends.</p>
<p>In this course, you will learn:</p>
<ul>
 	<li>Fundamentals For Accuracy (Basics of Traditional Static Shooting)</li>
</ul>
<p>You will need:</p>
<ul>
 	<li>A rifle, preferably chambered for .22 Long Rifle  (Your instructor can provide a rifle if you do not have one.)</li>
 	<li>A rifle case (soft or hard-shell)</li>
 	<li>Ammunition for your rifle (100 rounds), as well as .22 Long Rifle ammunition (100 rounds)  (That\\'s 200 rounds total .22 LR if you are borrowing or bringing your own .22 rifle.)</li>
 	<li>Eye protection  (Your instructor can provide loaner eye-pro if necessary)</li>
 	<li>Ear protection  (You may purchase foam earplugs if necessary)</li>
</ul>`,
      image: RIFLE,
    },
    {
      title: 'American Shooter Supplemental: Traditional Dynamic Shooting',
      slug: 'american-shooter-supplemental-traditional-dynamic-shooting',
      sku: 'AS-SUPP-TDS',
      price: 175.00,
      short_description: 'Supplemental course for students who skipped wing shooting. $175 for up to 4 students.',
      description: `<p>$175 for up to 4 students</p>
<p>If you skipped Lesson 2 and went <em>Direct to Defensive Shooting</em>, you can take this course later on to go back and learn the fundamentals of Traditional Dynamic Shooting, so that you can improve your shooting skills and pass them down to your family and friends, and so that you can explore the joys of wing-shooting sports</p>
<p>In this course, you will learn:</p>
<ul>
 	<li>Basic Wing Shooting (Basics of Traditional Dynamic Shooting)</li>
</ul>
<p>You will need:</p>
<ul>
 	<li>A shotgun fitted to you, preferably chambered for 20-gauge shot-shells, with traditional rail-and-bead sight and cylinder, skeet, or trap choke.  (AS can provide a shotgun if you do not have one.)</li>
 	<li>A shotgun case (soft or hard-shell) if bringing your own shotgun</li>
 	<li>Ammunition for your shotgun (300 shotshells, #7½, #8, or #9 shot, 20 gauge if using AS\\'s shotgun)</li>
 	<li>Eye protection  (Your instructor can provide loaner eye-pro if necessary)</li>
 	<li>Ear protection  (You may purchase foam earplugs if necessary)</li>
</ul>`,
      image: SHOTGUN,
    },
    {
      title: 'American Shooter Alternative: Direct to Defensive Shooting',
      slug: 'american-shooter-alternative-direct-to-defensive-shooting',
      sku: 'AS-ALT-DDS',
      price: 654.00,
      short_description: 'Accelerated defensive shooting for those with urgent training needs. $654 for up to 4 students.',
      description: `<p>$654 for up to 4 students</p>
<p>If you do not have the resources to progress through the full American Shooter core curriculum, and you need training urgently in the safe and effective use of your defensive weapon, AS can accommodate you. This is not ideal, of course, and it is always better to grow into your shooting skills and personal shooting culture naturally, along the path described by the full AS curriculum. Sometimes life is not ideal, though. Sometimes it comes at you fast. American Shooter can help you get up to speed, comfortable, and safe with your defensive firearm or a common defensive firearm, while ensuring that you avoid bad (or dangerous) habits and are prepared at your convenience to go back and learn a more traditional foundation.</p>
<p>In this course you will learn the Fundamentals of Safe Gun Ownership and Handling, the habits which will keep you safe and in control of your firearm, and the basics of defensive dynamic shooting with a focus on simple concepts and intuitive body movements.</p>
<p>You will need:</p>
<ul>
 	<li>A semi-automatic pistol, preferably striker fired, chambered for a cartridge you can shoot efficiently.  .22 Long Rifle is welcome and encouraged.  9x19mm is typical.  (AS can provide.)</li>
 	<li>A carbine or modern sporting rifle, semi-automatic, chambered for a cartridge you can shoot efficiently.  .22 Long Rifle is welcome and encouraged.  5.56x45mm is typical.  (AS can provide.)</li>
 	<li>.22 Long Rifle ammunition (400 rounds)</li>
 	<li>Ammunition for your pistol (100 rounds)  (9x19mm if using AS pistol)</li>
 	<li>Ammunition for your rifle (100 rounds)  (5.56x45mm if using AS rifle)</li>
 	<li>Eye protection  (Your instructor can provide loaner eye-pro if necessary)</li>
 	<li>Ear protection  (You may purchase foam earplugs if necessary)</li>
</ul>`,
      image: PISTOL,
    },
    {
      title: 'American Shooter: Strategies for Personal Protection',
      slug: 'american-shooter-strategies-for-personal-protection',
      sku: 'AS-STRAT-PP',
      price: 164.00,
      short_description: 'A course in the broader context of personal protection. $164 for up to 4 students.',
      description: `<p>$164 for up to four students</p>
<p>You have heard it said that a gun is a tool, not a talisman. It is not the solution to your self-defense needs, but just one component (if a pivotal one) of your overall strategy for personal protection. If you do not know how to move, how to communicate, how to assess risk and make risk-management decisions, and how to be in control of your life, a gun will not help you. If you do know these things, then the right gun, paired with the right shooting skills, will elevate your personal protection strategies to a higher level. This course is focused on that greater framework.</p>
<p>This is a non-shooting course which can be taken before, during, or after the AS core shooting curriculum. Strategies for Personal Protection focuses on all of the aspects of self-defense and personal protection, inside and outside your home, other than self-defense with a firearm. The course will cover topics such as home security and emergency action planning, awareness and decision-making in and out of the home, reactions to a threatening situation, and how to integrate self-defense tools, skills, and attitude into your daily life. If you have already taken any of American Shooter\\'s Defensive Shooting courses, then this course will integrate your shooting knowledge into your personal protection plan. If you are not trained in firearm use, this course will focus on your options for personal protection other than a firearm, as well as show you how a firearm and shooting skill fits into a complete personal protection strategy.</p>`,
      image: LOGO,
    },
    {
      title: 'American Shooter: Community Training Seminar',
      slug: 'american-shooter-community-training-seminar',
      sku: 'AS-COMM-SEM',
      price: 0.00,
      short_description: 'Contact American Shooter for pricing and scheduling.',
      description: `<p>Contact American Shooter for pricing and scheduling</p>
<p>As the number of new gun-owners in the United States skyrockets, more and more communities and social organizations are discovering the need and desire for education on guns and gun ownership. American Shooter offers this seminar to community groups, churches and religious congregations, and other large-group settings for those organizers who want to help their members learn about the American gun culture the right way. This is a hands-on classroom course, taught using realistic, functional firearm replicas to familiarize students with the basics of safe firearm handling and, along the way, the basics of being an American Shooter.</p>
<p>American Shooter offers this seminar nationwide. With enough planning and lead-time, your instructor can come to you and your organization, anywhere in the country. In this course, your students will learn the Fundamentals of Safe Gun Ownership and Handling, the foundations of a personal culture of gun safety and personal responsibility, and the Fundamentals of Static and Dynamic shooting with a handgun. Your students will also learn how to assess firearms training and information (including what they see on the Internet) so that they can choose wisely how they will further their education after this seminar.</p>`,
      image: LOGO,
    },
    {
      title: 'NRA Basic Pistol',
      slug: 'nra-basic-pistol',
      sku: 'NRA-BP',
      price: 495.00,
      short_description: 'NRA Basic Pistol course. $495 for up to 4 students; price includes NRA course materials.',
      description: `<p>$495 for up to 4 students; price includes NRA course materials</p><p>NRA Basic Pistol is a comprehensive introduction to pistol shooting for new shooters, covering safety, fundamentals, and basic marksmanship.</p>`,
      image: LOGO,
    },
    {
      title: 'NRA Basic Rifle',
      slug: 'nra-basic-rifle',
      sku: 'NRA-BR',
      price: 495.00,
      short_description: 'NRA Basic Rifle course. $495 for up to 4 students; price includes NRA course materials.',
      description: `<p>$495 for up to 4 students; price includes NRA course materials</p><p>NRA Basic Rifle is a comprehensive introduction to rifle shooting covering safety, fundamentals, and basic marksmanship.</p>`,
      image: LOGO,
    },
    {
      title: 'NRA Personal Protection Inside the Home',
      slug: 'nra-personal-protection-inside-the-home',
      sku: 'NRA-PPIH',
      price: 495.00,
      short_description: 'NRA Personal Protection Inside the Home. $495 for up to 4 students.',
      description: `<p>$495 for up to 4 students</p><p>NRA Personal Protection Inside the Home covers the knowledge, skills, and attitude essential for using a firearm safely and effectively in a home-defense situation.</p>`,
      image: LOGO,
    },
    {
      title: 'NRA Personal Protection Outside the Home',
      slug: 'nra-personal-protection-outside-the-home',
      sku: 'NRA-PPOH',
      price: 495.00,
      short_description: 'NRA Personal Protection Outside the Home. $495 for up to 4 students; includes NRA materials.',
      description: `<p>$495 for up to 4 students; price includes NRA course materials</p><p>NRA Personal Protection Outside the Home addresses the knowledge, skills, and attitude needed to carry a concealed firearm responsibly for personal protection outside the home.</p>`,
      image: LOGO,
    },
    {
      title: 'American Shooter Supplemental: Classroom and Lab, Online',
      slug: 'american-shooter-supplemental-classroom-and-lab-online',
      sku: 'AS-SUPP-CAL-O',
      price: 224.00,
      short_description: 'Online classroom/lab portion of an applicable syllabus course. $224 for up to 4 students.',
      description: `<p>$224 for up to 4 students, covers the classroom/lab portion of an applicable syllabus course.</p>
<p>Can\\'t make it to a lesson in person? American Shooter offers distance-learning (via Zoom, etc.) for the classroom portion of any of our American Shooter curriculum courses. Via online tutoring, you will learn how to safely keep and handle your firearm, how to store it, how to maintain it, and, in fact, how to practice with it at home and at the range, including how you will shoot it when you get the chance. This lesson will proceed all the way through your basic shooting drills, using dry fire or a training surrogate, to ensure that you are ready for your first day at the range and have quality drills to practice on your own or under the supervision of your chosen firearm mentor.</p>
<p>This course will be tailored to the firearm or firearm surrogate you provide. American Shooter recommends beginning with <em>Lesson 1: Marksmanship</em>, using a rifle or quality Airsoft rifle surrogate. If you go that route, then this course would cover everything in Lesson 1 up to but not including the live-fire range work. However, if you have an immediate need to learn to use a defensive pistol or rifle, then you can use this course to learn the off-the-range portions of <em>Direct to Defensive Shooting</em>.</p>
<p>You will need:</p>
<ul>
 	<li>Your firearm or firearm surrogate  (If using Airsoft, AS recommends accurately modeled gas-blow-back replicas which can be used to demonstrate proper gun handling and operation.  See <a href=\\"https://www.umarexusa.com/glock-g17-gen-4-177-black\\">this Glock replica</a> and <a href=\\"https://store.kwausa.com/?product=kwa-lm4-ris-ptr\\">this AR-15 replica</a> for good examples.)
<ul>
 	<li>Iron sights.  Optics are welcome, but initial training will be on iron sights.</li>
</ul>
<p></li> 	<li>A firearm cleaning kit.</li> </ul> Students who have used this method to take a portion of an American Shooter curriculum course will be eligible to complete that course in person at a discounted rate.</p>`,
      image: LOGO,
    },
    {
      title: 'American Shooter: Hourly Lessons',
      slug: 'american-shooter-hourly-lessons',
      sku: 'AS-HOURLY',
      price: 94.00,
      short_description: 'Custom hourly lessons for any purpose. $94 per hour, up to 3 students.',
      description: `<p>$94 per hour up to 3 students</p>
<p>Custom hourly lessons can be used to serve any purpose you may have which is not covered by the standard curriculum courses. You may wish to continue after one of the standard courses to work on some skill or technique you found challenging. You may wish for a refresher on the fundamentals or to learn the ins and outs of your particular firearm. Perhaps you\\'ve never been to a gun store and you\\'re nervous about gun shopping on your own the first time. Hourly lessons are not limited to the range or classroom. AS also offers hourly lessons online in lieu of a set curriculum.</p>`,
      image: LOGO,
    },
  ];

  const owner = await prisma.user.findFirstOrThrow({ where: { email: 'owner@aecms.local' } });

  for (const lesson of lessons) {
    const existing = await prisma.product.findFirst({ where: { slug: lesson.slug } });
    if (existing) {
      console.log(`Skipping existing: ${lesson.title}`);
      continue;
    }

    const product = await prisma.product.create({
      data: {
        title: lesson.title,
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
    console.log(`Created: ${product.title}`);
  }

  console.log('\nDone.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
