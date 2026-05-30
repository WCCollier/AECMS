import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient, ProductType, StockStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';

config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL env var required');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ============================================================================
// CONSTANTS
// ============================================================================

// Images live in the repo at backend/uploads/wp-import/ — no tar extraction needed.
// Seed creates Media records for every image file found in that directory.
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'wp-import');

const ARTICLE_TITLES: Record<number, string> = {
  381: 'How Writing Works',
  383: 'The Mission',
  385: 'Meeting the Parents',
  387: 'The Ride',
  465: 'Rule of Thumb: Rights',
  591: 'How to attack the Bible',
  733: 'Sample Chapter: Discoveries',
};

const ARTICLE_EXCERPTS: Record<number, string> = {
  381: 'A short(ish) explanation of why you were taught to write the way you were taught in English class, the art we call Rhetoric.',
  591: 'Always thought about reading the Bible, or maybe tried it once or twice, but it was just TOO MUCH?',
};

const ARTICLE_CATEGORIES: Record<number, string> = {
  383: 'Fiction',
  385: 'Fiction',
  387: 'Fiction',
  733: 'Fiction',
  381: 'Non-Fiction',
  465: 'Non-Fiction',
  591: 'Non-Fiction',
};

const ARTICLE_TAGS: Record<number, string[]> = {
  381: ['writing', 'rhetoric'],
  383: ['novel', 'fiction', 'outsiders'],
  385: ['novel', 'fiction', 'outsiders'],
  387: ['novel', 'fiction', 'outsiders'],
  465: ['guns', 'rights'],
  591: ['bible', 'reading'],
  733: ['discoveries', 'novel'],
};

const PRODUCTS = [
  {
    name: 'American Shooter: Safe Gun Ownership and Handling',
    slug: 'american-shooter-safe-gun-ownership',
    description: 'A comprehensive online course covering the fundamentals of safe gun ownership and handling. Includes classroom instruction and practical exercises.',
    short_description: 'Online course: Safe gun ownership fundamentals',
    price: 49.95,
    sku: 'AS-SGO-001',
    product_type: ProductType.service,
    stock_status: StockStatus.available,
    visibility: 'public' as const,
    status: 'published' as const,
  },
  {
    name: 'American Shooter Supplemental: Classroom and Lab',
    slug: 'american-shooter-classroom-lab',
    description: 'Supplemental coursework for the American Shooter curriculum. Covers classroom instruction and hands-on lab exercises for safe firearm handling.',
    short_description: 'Supplemental classroom and lab curriculum',
    price: 29.95,
    sku: 'AS-CL-001',
    product_type: ProductType.service,
    stock_status: StockStatus.available,
    visibility: 'public' as const,
    status: 'published' as const,
  },
  {
    name: 'American Shooter Alternative: Direct to Defensive Shooting',
    slug: 'american-shooter-defensive-shooting',
    description: 'An accelerated course taking students directly to defensive shooting techniques. Designed for those with prior firearm experience.',
    short_description: 'Accelerated defensive shooting curriculum',
    price: 89.95,
    sku: 'AS-DDS-001',
    product_type: ProductType.service,
    stock_status: StockStatus.available,
    visibility: 'public' as const,
    status: 'published' as const,
  },
];

const ARTICLES = [
  {
    wp_id: 381,
    slug: "how-writing-works",
    wp_date: "2021-04-29 15:26:13",
    excerpt: "A short(ish) explanation of why you were taught to write the way you were taught in English class, the art we call Rhetoric...",
    content: `
<h2>A short(ish) explanation of why you were taught to write the way you were taught, the art we call Rhetoric...</h2>



<p>This is an essay not about the fact that modern professional writing, especially on the Internet, is terrible, not detailing all the compositional sins of the modern journalist or blogger. Rather, this is an essay exploring why the writing fundamentals of previous generations were superior, why they work better—which, if you understand it, will be to your benefit in ways you don’t expect. Let’s leave behind, for a moment, all the existential threats to freedom, the battle for our national soul.&nbsp; Let’s stipulate that a new Dark Age is upon us, Western Civilization already beyond the point of no return, and let us turn for a few minutes to the skills we will need, you and I, in order to preserve wisdom for some future generation, centuries hence, who, having clawed their way back from this abyss, will need to inherit our legacy if they are to have any hope of beginning the world’s next iterative experiment in liberty.&nbsp; Plus, if you’re curious to know what bits and neurology and physics have to do with compositional style, you’re going to love this.</p>



<p>You have probably read many a complaint, on this site and others and especially in the hallowed digital halls of such institutions as National Review, on the decline of writing in modern American or English-speaking culture. You probably share these concerns. Open any random news article on the Associated Press website and witness the style of it: a barrage of one- or two-sentence statement-blocks, separated by paragraph breaks, which purport to constitute an “article.” This, to say nothing of the horrid baby-talk of Axios and similar. Reading it hurts your brain, though you might not be able to put your finger on why. “Time was,” National Review will tell us, “when journalists and other professional writers knew how to write.” When the quality of their prose was much greater. And the National Review columnist will wax long and eloquent on the subject, citing many very scholarly examples of how things used to be and drawing the parallel between this decline and the decline of our culture and society generally. (These are the writers, particularly at National Review, who make sure to write in a much higher voice—who, for instance, make sure to work in the word “shibboleth” at least once so that you know they are true intellectuals, to establish their literary <em>fides</em> if you will. “<em>Fides</em>” is another word they adore, along with any other Latin they can invoke. The longer and more obscure the aphorism, the better.&nbsp; <em>Fortasse sapientiam et exclusivam confundant.</em>) But they never quite get around to explaining why, mechanically, the old way was better. It was. We know it was; we can feel in our bones that it was; but knowing that a thing was better, without knowing why or how, does not help us reclaim it. Were those long paragraphs and elegant sentences better just because they are artifacts of “Western culture” or “the Classics?” Or is it that the practices of classic Western culture were successful for objective underlying reasons? Do we love the writers of old because they invented something beautiful, but which was ultimately an arbitrary stylistic fad, doomed to pass away with time? Or had they, in fact, discovered something beautiful, something which is actually fundamental, universal, and timeless?&nbsp; Something… correct, from the foundations of our universe, regardless of culture or era? Here is a primer on why writing evolved into that form which we had, and celebrated, and lost, and the absence of which we now lament.&nbsp; It is explanation of why good writing is good and correct regardless of who uses it or lauds it and who doesn’t. Those choppy pseudoparagraphs of a typical Medium.com post or AP or Axios news story are our jumping-off point, and we’ll come back to them in a bit, but first we must get down to basics.</p>



<p>It is commonly asserted in information sciences that the most basic unit of information is the bit (short for “binary digit,” a single 1 or 0 in a binary number), but this is not quite correct.&nbsp; It might be better to say that a bit is the most basic unit of data, but data and information are not quite the same. Rather, data are the stuff of which information are made.</p>



<p>A datum (singular of data) would be something like a number, or a word, or even a sentence or a color. A single something which can be represented using an alphabet or character set. A character is a single unit of an alphabet, and the simplest alphabet possible is binary, an alphabet of only two characters, which we conventionally call ‘0’ and ‘1’. Any more complex character-set I can represent using binary. For instance, I any number I can invent in the decimal system (an alphabet of ten characters) I can convert to binary.&nbsp; 116 in decimal would be 1110100 in binary. To any letter or other symbol in English I can simply assign a number—‘t’ we will say is letter 116 on our list of possible letters and symbols—and thus I can represent any letter or symbol in binary.&nbsp; As long as you know you’re looking for English letters and symbols from that list, if you come across 01110100, you know that represents the letter ‘t’. (There’s the rub, but hold on for just a moment.) Even colors, if I just use a color-value table, can be represented in numbers, and therefore in binary numbers. Anything I can represent as a number I can represent with a binary number.</p>



<p>The one thing I cannot do is represent binary values by some even simpler system. The only thing simpler than binary would be unary, only a single symbol.&nbsp; We imagine this would be a system of counting by making scratch marks.&nbsp; Instead of counting 0, 1, 2, 3, 4, or 0, 1, 10, 11, 100, I would just make marks equal to the number, as earliest man might have done: |||| to represent four of whatever, four chickens, four slain enemies. But, this is not actually a unary alphabet. In fact, in practice, it becomes simply a more ungainly form of binary, because it still requires two symbols: my scratch mark, ‘|’, and blank space, so I know where my number begins and ends. A blank space is as much a character in your alphabet as the spacebar is a key on your keyboard. Without a blank space, I would just have an endless string of scratch marks, and you would never be able to derive any meaning from it. (There’s the rub again, but hold on….)</p>



<p>So, binary is the minimum requirement for a language of data, and any datum can be represented by some chunk of binary digits. Indeed, we can define data as anything which can be represented by a number, or a sequence of numbers, and therefore we can further define data as anything that can be represented as a sequence of bits. But, is data the same as information?</p>



<p>Yellow.</p>



<p>That’s a datum. You’ve just been given a unit of data. Have you been given any information, though? Have you gained an answer, or have you only gained questions? “Yellow what? What’s yellow? Is something yellow? Something about yellow? Do you want something yellow? Why are you saying yellow to me?”</p>



<p>16776960.</p>



<p>Same problem again. I have given you some data, but have I given you information?&nbsp; Just shouting a number at you is the same as just shouting “Nee!” at you, or barking at you.&nbsp; It’s just a sound—until you can place it in a context.&nbsp; Until it answers some question you already had. Either that, or I must provide you the question and the answer at the same time.</p>



<p>16776960 is the color code, in decimal, for Yellow. (Not that I would ever give it to you as a single decimal value. I would give you 255-255-0, or FFFF00, but that’s another story.)</p>



<p>Here I have actually passed you some information, because I have given you one datum in th context of another. With context, you are able to assign meaning to the datum, and with meaning, a datum becomes information. Thus we get the true definition of information. A data scientist would say information is “a non-random sequence of bits,” but ask him what he means by that, and he might struggle to answer, so I shall answer for him. He means “a sequence of bits with meaning,” such that if you change any of the bits, you change the meaning. Another word for a sequence of bits is a datum, so information is data with meaning.</p>



<p>That’s the rub. When you say, “with meaning,” it’s like saying, “the universe,” a small phrase with big implications. In fact, the phrase “with meaning” is actually bigger than “the universe.” The difference between “a sequence of bits” and “a sequence of bits with meaning” is the difference between dust and a person, between no universe and a complete universe, between smudged paper and Shakespeare.&nbsp; It is the difference between nothing and everything. As an aside, you will run into naturalists who say things like, “A thought is just a sequence of electrochemical discharges across the brain.”&nbsp; You say, “No, a thought is a sequence of electrochemical discharges across the brain that has meaning.”&nbsp; And they’ll say, “Well, sure,” as if that’s a trivial distinction, and you must reply, “No, no ‘well, sure.’ That’s everything. The ‘with meaning’ is the most important part of the sentence. Discounting that is like discounting the difference between a regular housecat and a housecat with an entire living galaxy hanging from its collar. The most important part of that sentence, the alpha and omega of all science and philosophy, is that phrase ‘with meaning.’” &nbsp;Remember that, next time you’re talking to a naturalist.</p>



<p>So, information is data with meaning. But this means that information can never be comprised of a single datum. For me to give you information, I can give you a single datum only if you already have at least one other datum of context. For instance, I can say, “Table!” to you, but I’m only giving you information when I do that because I saw you hunting around the kitchen muttering, “Keys… keys… keys….” You already have a question, “Where are my keys?” which amounts to at least one datum, and I supply an answer, “On the table.” If you don’t already have at least one datum of context, then for me to give you any information, I must give you at least two data, one referring to the other.&nbsp; “Keys → table.”&nbsp; That’s enough for you to have some hope of gleaning some meaning from the data I passed, and therefore to have some hope of receiving the information it represents.&nbsp; And even that much requires that we already share a common presumption that you might be looking for your keys, and that if I link the one datum, “keys” to the other datum, “table,” I’m making a statement about the spatial relationship of the two. The less information we already hold in common, the more data I’m going to have to send to you in order to communicate actual information, but the minimum number is two.&nbsp; “Car!” or “Red!” in isolation are just barks, just noises, but “Car → Red!” at least has a chance to be information. You know, at a minimum, by this statement, that “car” and “red” have some relationship, and the more other data you have, the more you can guess at the nature of that relationship.&nbsp; Information thus can be defined as the relationship between at least two data.</p>



<p>Now, that has a name, that conceptual structure we create when we link one datum to another datum. It’s called a “map.” You probably thought a map was the thing you pinch and swipe on your phone to see exactly where your Uber driver has been delayed, but that’s… not what you think it is.&nbsp; A map is, in fact, just a list of connections between data, from one datum to at least one other datum.&nbsp; The most basic map is a list of a single connection (or “link” if you prefer) between one datum and one other datum.</p>



<p>A → 1</p>



<p>More commonly, we tend to run into maps which are lists of linked pairs:</p>



<figure class="wp-block-table"><table><tbody><tr><td>A → 1</td></tr><tr><td>B → 2</td></tr><tr><td>C → 3</td></tr></tbody></table></figure>



<p>These are very common…</p>



<figure class="wp-block-table"><table><tbody><tr><td>Car → Red</td></tr><tr><td>Truck → Blue</td></tr></tbody></table></figure>



<figure class="wp-block-table"><table><tbody><tr><td>Carla → 555-1212</td></tr><tr><td>Bob → 555-8725</td></tr></tbody></table></figure>



<p>But the point is, it is this linking process, linking a datum to another datum, which begins to build information out of data, and the minimum unit of information is, thus, a map of at least one link: between the datum you’re thinking about and the datum representing what you’re thinking about the first datum. That’s a confusing way to say it, so let’s put down some labels:&nbsp; The definition of information, restated, is a map, and the minimum unit of information is a single-row, single-link map, mapping a single subject datum to a single predicate datum.</p>



<p>Subject → action</p>



<figure class="wp-block-table"><table><tbody><tr><td>John → shouts</td></tr><tr><td>Spot → runs</td></tr><tr><td>I → am</td></tr></tbody></table></figure>



<p>I said earlier that the more data you include, the more likely you are to have encapsulated genuine information, and you can begin to see where this is going.&nbsp; “John → shouts” is enough.&nbsp; You have made a meaningful statement, in a way wholly and qualitatively different from if you just stood there barking “John!” over and over, with nothing else, or “Shouts!” over and over, with nothing else.&nbsp; But if you give me a more complex map, “John → shouts → profanity,” now I’m really starting to build an image in my mind something like the image that you have in your mind. Now we’re building a complex predicate. We’re not just linking the subject to a single datum, but to sub-maps of multiple data. This is essential for passing information on state-of-being.&nbsp; “Car → red” is barely information.&nbsp; “Car → [being verb] → red,” though, is getting somewhere.&nbsp; “The car <em>is</em> red.”&nbsp; And you can add as many links as you like, complicating your subject, complicating your predicate.&nbsp; “(John → [conjunction] ← Judy) → lock → lips ← [preposition] ← (seat ← back).”&nbsp; If a list of maps of different subjects to different predicates, such as we had above, is a compound map, then this map with multiple links in a single row we might call a complex map. Compound and complex maps each contain greater quantities of information than a simple map, but each in a different way.&nbsp; A compound map contains many instances or examples of one (usually fairly simple) kind of relationship, such as many instances of as simple “has” relationship.&nbsp; Each [person] has [phone number].&nbsp; Each [car] has [color]. A complex map, by contrast, describes a complex relationship between many data, as in the complex relationship between John, Judy, a kiss, a car seat, and the various actions and states of being involving these.</p>



<p>Okay, so, the basic unit of data is a bit, sure, but the basic unit of information is a map of at least one subject datum to at least one predicate datum.&nbsp; Yes, you are correct; we’ve invented the sentence.&nbsp; Or, rather, we’ve discovered the sentence, and that is really my point, here, today.&nbsp; This is not something we created. We did not decide that the basic unit of information would be a map of at least two data. It is what it is. It is a fundamental truth of our reality, built into the fabric of our universe. Sentence structure is not arbitrary. The “sentence” is just the verbal representation of the basic unit of information as information exists in our universe. A compound map, with multiple rows, would be multiple sentences, or a compound sentence.&nbsp; “The truck is blue, but the car is red.”&nbsp; (Your paper or digital road map, by the way, is actually a very long compound map of simple relationships. It’s a list of points/pixels in a picture each linked to a single point/location in the real world.)&nbsp; A complex map would make a complex sentence. &nbsp;“John and Judy lock lips in the back seat.” When you learned in grammar school to write proper, complete sentences (and to diagram them, if you were lucky enough to get a good education), you were learning to handle and keep track of the links in a complex map.</p>



<p>Now, obviously, a single sentence, even an elegant, very complex sentence, is not going to get us very far.&nbsp; Likewise, a simple compound map, even a very large one, will only serve to communicate a limited class of information.&nbsp; Think about the examples above, of lists of customers and their phone numbers or cars and their colors.&nbsp; These are the maps you typically encounter at work, usually on a computer as a database or spreadsheet or, in the old days, stored in a filing cabinet in the form of reams of customer records.&nbsp; We have determined that all information can be represented as maps of various kinds, but what kind of map represents it, what form it takes if you visualize it as a map, will depend on the kind of information and your purpose in storing and conveying it.&nbsp; We are concerned here not with the ability to store and convey ten thousand customer records, but rather with the ability to store and convey a single complex map—really, a single row map, but one which goes beyond linking one subject to one predicate, even if both are quite complex, as in our kissing example.&nbsp; We’re talking about building a subject and predicate, and linking that entire thing to the next subject, and linking that to a predicate, and linking the results of that link to yet another subject and predicate, and so on, to create an ever increasingly complex train of logically-connected information.&nbsp; We’re talking about a map that might only have a single row, but that row contains thousands or tens of thousands of links, far beyond the basic subject-predicate structure, nesting links within links and relationships within relationships.</p>



<p>If the proper name for long tables of relatively simple maps (as in customer records) is “database,” then the proper name for this data structure, a single but extremely extensive, extremely complex multi-sentence map, is “idea.”&nbsp; Whether I am trying to explain something (to you or to myself, so that I know I fully understand it), or to convince you to believe what I believe, or to build a static image in your mind, or to convey to you (or to myself for better understanding) how a system changes over time, the common thread is that I am trying to encapsulate, in language, a complete idea, no matter how complex that idea.&nbsp; I am trying to build an extremely complex map, a train of countless links between data, each building logically on the last, until the idea is complete.&nbsp; If you have ever had an idea, you have contained such a map in your head, even if you did not recognize it.&nbsp; And to the extent that you were able to bring your idea into focus, make it detailed and, ultimately, useful, something you could put into practice, is the extent to which you were able to map out that idea, usually by means of language.&nbsp; Colloquially we call this process, “Thinking it through.”&nbsp; In order to implement your idea, or communicate your idea, or even to be sure you really, completely had the idea at all, you had to think it through, completing the map from datum to datum, link by link.</p>



<p>Some ideas, it’s true, are not mapped out verbally.&nbsp; Rembrandt mapped out his ideas as color on canvas, and Mozart as notes on musical staves.&nbsp; (Mozart is a peculiar example. Uniquely among composers, he did not “sketch out” his compositions as rough notes and then go back and work out the details, but rather wrote out, in a single pass, entire complete orchestrations in their final form. His mind was such that it could contain the complete map, fully realized as notes on staves, and all he had to do was “copy” it onto staff paper as fast as he could move a pen.) Most ideas, though, held by most of us mortals, are of the kind best represented by the medium of verbal language. &nbsp;That, too, has a name, that rendering of the idea-map into words of English (or Japanese or French or Latin).&nbsp; Whereas in music we call it composing and in the visual arts we call it painting or sculpting or rendering, in language we call it rhetoric. To “think through” an idea using words, i.e. to fully map it out using words, is the definition of rhetoric.</p>



<p>(The philosophers of old recognized only four possible rhetorical purposes, which I mentioned earlier and which may have rung a bell in your memory.&nbsp; We might better or more fundamentally call them the four types of rhetorical maps, but there remain only the four:&nbsp; Description, to render the appearance of a system to the senses of an observer; Narration, to render how a system changes over time; Exposition, to explain the nature or underpinning logic of a system; and Persuasion, to render argument in favor of a proposition. Any time you engage in rhetoric, you will be mapping out an idea of one of these four kinds, and never more than one at a time.&nbsp; You may perform one in service to another—for instance, describing a thing visually so that you may then describe how it changes over time—as part of a larger, overarching idea, but your rhetoric at any given moment will be to one, and only one, of these four purposes.)</p>



<p>Because an idea can be so complex, a single unit of information, a single sentence, may not suffice.&nbsp; I may not have a single subject (even if it is a compound or complex subject) linked to a single predicate (even a compound or complex predicate).&nbsp; Instead, I may have a subject linked to a predicate, and that whole linked to another subject, which links to another predicate, and several of those linked together in some way, and so on. I need to convey a lot of related information, each unit of information building on the last, toward one of those four goals.&nbsp; So, I am going to need multiple sentences, but I am going to have to organize them in a way which preserves the links between them and supports the ever-expanding train of logical connection.</p>



<p>Here, I come to the necessaries of biology and neurology. The brain, the conscious mind, addresses ideas a certain way. First, it must orient toward or focus on the task at hand.&nbsp; Then, so prepared, it can take in individual units of information, store them, and process them as related to one another and to the problem itself.&nbsp; If they are meaningful and relevant to the problem, hopefully, the brain can synthesize from them a solution, a coherent new “understanding,” what we call a complete idea.&nbsp; The minimum unit of information is a sentence, so we supply sentences to a brain (or the brain forms sentences for its own purposes) in this same format: one sentence to orient the mind, a few sentences to develop the idea, and a final sentence to synthesize a new understanding of a complete idea—or at least to let the mind know that the idea is complete, that that particular segment of communication has ended, and some synthesis should have occurred.&nbsp; In a conversation or lecture (rhetoric as communication of an idea), this is typically where we pause for feedback.&nbsp; Look for a nod of understanding, an “I get it” from the audience, as they achieve synthesis of the appropriate conclusion, the completed idea.</p>



<p>This structure, friends, is a paragraph.&nbsp; A paragraph is not an arbitrary block of text, it is not however much you happen to say until you run out of gas.&nbsp; It is not something you are supposed to write because your teacher told you to, but from which you are liberated once you are out of school.&nbsp; A paragraph is one idea unit, transmitted through the medium of language, and it is absolutely vital to the communication of an idea to another person.&nbsp; You are not psychic, so you can’t just move an idea into another person’s brain as a whole thing.&nbsp; Like a Star Trek transporter bay, you have to break the idea down into atoms, convert those atoms into language, and send them one atom at a time, in hopes that the recipient will be able to rebuild the structure piece by piece, particle by particle. &nbsp;One sentence to orient the target brain to the incoming transmission, several more to deliver the relevant atoms of information, and then one last to signal the end of the transmission and to guiding the target brain to synthesize the information into a complete idea—ideally, the idea as it looked in your mind, the idea you intended to convey.&nbsp; Paragraphs are the lowest level of complete idea transmissible between brains—not because we choose it to be so, but because that’s how information works, and how brains work.&nbsp; When your English teacher told you to write a proper topic sentence, supporting or developing sentences, and a concluding sentence, she was not just telling you what the old masters prefer, she was telling you how your universe works.&nbsp; There’s no fighting it, any more than you can deny the reality of gravity or electromagnetism or genetics.&nbsp; If you leave off any piece of this structure, you are in effect hoping that your recipient will be able to fill in the gaps, either to figure out for himself what the hell you are talking about (if you omitted a topic sentence to orient his mind), to interpolate your missing logical steps (if you omitted one of your supporting sentences), or to realize that you are done talking and to come to the correct conclusion (if you just trailed off without any kind of concluding/synthesis sentence).</p>



<p>The paragraph is the lowest level, the most basic unit of a complete transmissible idea, such that if you have not sent a full paragraph, you have not sent a whole idea, but only pieces of an idea and a fool’s hope.&nbsp; Let us say that you do transmit complete paragraphs, though.&nbsp; The paragraph is the minimum unit of idea, but it is not the upper limit on an idea.&nbsp; Once the target brain has received a few paragraphs of information, a few discrete ideas, it can potentially synthesize those into a higher-level idea.&nbsp; After building several higher-level ideas, it might even be able to synthesize those into a very-high-level understanding.</p>



<p>This process, too, reflects the format of information in our universe. Our universe has certain minimum elements which can’t be broken down any farther. I used the word “atom” earlier, and that is a better metaphor than you might think. The Ancient Greeks coined it to describe exactly that: the minimum element into which a thing can be broken down, but which itself cannot be broken down any further.&nbsp; “Atom,” from “a- tomos,” literally means “not divisible.” An atom is the minimum component of everything else.&nbsp; Once you have your atoms, everything else is built out of them level by level.&nbsp; Combine atoms into molecules.&nbsp; Combine molecules into substances.&nbsp; Combine substances into objects.&nbsp; Combine objects into systems.&nbsp; You can break a house down into furniture, walls, floors, foundation.&nbsp; You can break a wall down into bricks and mortar.&nbsp; You can break a brick down into minerals, and break a mineral down into its constituent atoms.&nbsp; The atoms, though, cannot be broken down into anything else.</p>



<p>“But wait!” you complain.&nbsp; The atoms, we have since discovered, can be divided into subatomic particles.&nbsp; Yes, that’s true, but there are only three subatomic particles of matter.&nbsp; Any given atom can only be broken into a simple map of protons linked to neutrons and electrons.&nbsp; As many different kinds of atoms as there are, they are only divisible into protons, neutrons, and electrons, and if you break an atom into its protons, neutrons, and electrons, you retain no information about the atom.&nbsp; Protons, neutrons, and electrons by themselves don’t tell you anything about the atoms they were once a part of.&nbsp; One proton is like any other and does not imply the myriad properties of the elements. Likewise, the basic unit of information, the simplest sentence or map, is divisible, but only into units of data which by themselves have no meaning.&nbsp; As we discussed at the beginning of this analysis, if I break a sentence down into its subatomic particles, the individual words, and just give you one of those words, or even all of those words but without the links between them, I have given you no information.&nbsp; To have information at all, you must start with that indivisible minimum of information, the sentence.&nbsp; Once you have that, though, the rest is a process of building grander structures out of lesser structures.&nbsp; You use a collection of sentences which convey an idea according to the way the brain handles an idea, the orient-develop-synthesize process we discussed above.&nbsp; That’s a paragraph.&nbsp; To convey a higher-level idea, you’ll use several paragraphs to send the component ideas.&nbsp; However, you don’t want to just attack the audience with supporting paragraph-ideas, any more than you can just attack them with supporting sentences without first orienting them to what idea you are developing or later helping them synthesize the complete idea from those supporting sentences.&nbsp; So, if your intent is to provide multiple paragraphs of information all of which support some grander idea, what will you do first?&nbsp; You’ll create a whole orienting paragraph:</p>



<p>“Friends, I’m about to convey to you a complex idea called George.”—orienting sentence.&nbsp; “It will be comprised of several smaller ideas conveyed as paragraphs.&nbsp; First, there will be a paragraph for idea A, then a paragraph for idea B, then a paragraph for idea C.&nbsp; Once I’ve conveyed all of those component ideas, I’ll show you how they combine into this overarching complex idea.”—developing sentences.&nbsp; “If there are no questions, I’ll begin transmitting component idea A by moving on to that paragraph.”—concluding/synthesizing sentence.</p>



<p>Then you’ll send paragraphs for each of your component ideas, orienting the audience to each, developing each, synthesizing each and signaling the transition to the next.&nbsp; Finally, you’ll wrap up your transmission with a whole paragraph designed to help your audience synthesize the lesser ideas into the greater:</p>



<p>“So, you have all three component ideas.&nbsp; Let’s synthesize them into a complete understanding of the problem.”—orienting the audience to the problem of overall synthesis.&nbsp; “You can see that idea A supports idea B, and you can see that idea B supports idea C.”—supporting sentences, calling back to the component ideas.&nbsp; “Well, George must be true if C is true, and A and B are known to be true, and A and B together imply C; <em>ergo</em>, George!”</p>



<p>“By George, I think he’s got it!” they all cry, as the light of greater understanding dawns.</p>



<p>An essay is a collection of paragraphs which has this structure.&nbsp; As a paragraph has a topic sentence, developing sentences, and a synthesizing sentence, so an essay has a topic paragraph, developing paragraphs, and a synthesizing paragraph, like the examples given above, or the example which follows.&nbsp; In this one, you are a computer science professor, and you have assigned your students to write a simple mathematical program for a very simple computer processor which you helped them design and prototype.&nbsp; One of your students comes to you for help.</p>



<p>“Professor,” says he, “I’m trying to write this program to solve this problem you assigned on our prototype computer processor, but our processor only performs adding, and I’ve thought it through every possible way, but this problem requires that we perform a division operation.&nbsp; I don’t see how it can be done.”</p>



<p>“Okay, well, consider this,” you say, orienting the target brain, your student’s brain, to a new idea. “1 + 1 = 2.&nbsp; And 2 + 2 = 4.&nbsp; 3 + 3 = 6.&nbsp; 4 + 4 = 8.”&nbsp; You thus convey several units of information, several sentences. “You see?&nbsp; The doubles of your counting numbers are your even numbers. 1, 2, 3, 4; 2, 4, 6, 8.”&nbsp; Synthesis, for a very simple idea.</p>



<p>“Yeah, okay, that’s great,” says the target brain, “but why do I care?”</p>



<p>“Because, check this out.” Orienting. “If I want to divide any number by two, all I have to do is count my evens, and see how long it takes me to get there. &nbsp;So, sixteen divided by two: 2, 4, 6, 8, 10, 12, 14, 16.&nbsp; It took me eight numbers, eight increments of two, to get there.&nbsp; So, sixteen divided by two is eight!”&nbsp; Development, through another example, and synthesis, the relation of counting by twos to division by two.</p>



<p>“Huh.&nbsp; Okay,” he says. “I never thought of it that way, but I get it.&nbsp; I still don’t see how this helps me, though. This problem isn’t limited to even numbers.&nbsp; I need a generic solution.”</p>



<p>“Well, let’s try the same thing with a different increment.” Orient.&nbsp; “Can you count by threes?&nbsp; 3, 6, 9, 12?” Developing.</p>



<p>“Yeah.”</p>



<p>“So how many was that?&nbsp; To get to 12?” Developing.</p>



<p>“Four… Oh.&nbsp; Twelve divided by three is four. I get it.”&nbsp; Synthesis.</p>



<p>“So, can you, in fact, perform any division of any number by any other number, using nothing but addition operations?”&nbsp; Orient the student to the final idea--</p>



<p>“Ooooh,” says your student.&nbsp; “Yes!&nbsp; You can!&nbsp; You just increment by the divisor and count the increments!&nbsp; It’s just a loop, with two separate addition operations.&nbsp; The increment, and the counter.&nbsp; Oh, man, that’s wild.&nbsp; Thanks, prof!”</p>



<p>Did you see the process playing out?&nbsp; Where was the introductory paragraph in this essay?&nbsp; It was, in fact, provided by the student.&nbsp; He orients the conversation to the problem, develops the problem, and synthesizes a thesis: the problem cannot be solved—unless the professor can offer some secret new knowledge.&nbsp; The professor responds with developing paragraphs, which I labeled for you.&nbsp; At the end, the professor begins the concluding paragraph, orienting the conversation toward the task of synthesizing the overarching, higher-level idea, using a rhetorical question, and the student takes over the concluding paragraph from there, as understanding comes to him. He describes the generic solution with developing sentences and then concludes that paragraph with an expression of gratitude.</p>



<p>(Actually, if you’re interested, division is probably better described as a series of subtractions, but I’ll let you think about that on your own.)</p>



<p>If you are developing an even grander idea, then you might have multiple essays over the course of a chapter of your book, and the chapter of your book might begin with a short essay of several paragraphs explaining what the purpose of the chapter is and what specific sub-sections will be developed in it, and that chapter will probably conclude with an essay of several paragraphs synthesizing everything that chapter covered.&nbsp; Your book, meanwhile, will have a prologue or introductory essay, maybe even a complete introductory chapter, and a concluding essay or chapter as well.</p>



<p>I want to draw your attention to a peculiar thing that is happening here.&nbsp; Let us say I simply labeled parts as, “Orientation,” “Development,” “Synthesis.”&nbsp; And I told you, “Here is an idea with an orientation, a development, and a synthesis,” could you guess, from that description, whether I was talking about a paragraph, an essay, a chapter, or the whole book?&nbsp; Nope.&nbsp; Each level has exactly the same structure.&nbsp; My third development chapter breaks into an orientation essay, seven development essays, and a synthesis essay, and each of those essays contains orientation, development, and synthesis paragraphs, and each of those contains orientation, development, and synthesis sentences.&nbsp; If I just describe the structure, the shape of it, and nothing else, you have no idea how “zoomed in” we are, whether we’re zoomed in on a single paragraph or zoomed out looking at the whole book, or some level in between.&nbsp; It’s a bit like a tree.&nbsp; If all you could see was a piece of its shape, without any of the details of texture or foliage, could you tell if you were looking at the trunk dividing into main boughs, or a small branch dividing into twigs and stems?&nbsp; There’s a word for this, folks, this concept that a pattern repeats not in sequence but in subdivision.&nbsp; It’s called a fractal, and it is one of the dominant mathematical phenomena in nature.&nbsp; From trees branches and tree roots, to snowflakes, to coastal fjords, to watershed or river-delta topography, to the golden ratio, systems in nature compound fractally from their atomic components to their upper bound of growth.&nbsp; There is an atomic unit of water runoff, a certain minimum of water necessary on a given earthen surface before it joins and forms into a rivulet, but from there rivulets join into rills, rills into brooks, brooks into streams, streams into rivers, rivers into greater rivers (the White Nile and Blue Nile into the Nile proper), a pattern repeating not in sequence but by multiplicative expansion until the river falls off the edge of a continent and runs into the sea.</p>



<p>Communicated information, being a natural thing, has this same structure. &nbsp;As a branched structure has its atomic unit (the line segment) and the fractal pattern by which it grows (segments branching into other segments), so rhetoric has its atomic unit, the sentence, and then the fractal pattern by which it grows out of its atomic units: orient section, development section, synthesis section.&nbsp; Fractal expansion is, again, as fundamental to our universe as gravity, electromagnetism, genetics, and the dual nature of man.&nbsp; When your English teacher taught you about introductions and developments and conclusions, she was not just describing The Way It’s Properly Done, according to some admittedly brilliant but now dead and no longer authoritative old British or Greek writers.&nbsp; She was describing The Way It Is, such that you can embrace it, and convey your ideas, or you can ignore it, and never communicate (or even understand) your ideas quite as well as you would like.</p>



<p>Now, there are ways to play with the structure.&nbsp; A fractal pattern of this kind has a rhythm to it.&nbsp; It is musical.&nbsp; If I build it and build it and build it, so that you are accustomed to it, then when I suddenly interrupt it, you will feel that interruption of rhythm, and it will draw your attention, just as if I had hit a sudden all-piece rest in a song, and then a singular, staccato chord.</p>



<p>Here’s an example.</p>



<p>You notice that one-sentence paragraph, do you not? It’s not complete.&nbsp; It’s not, technically, a paragraph at all, at least on paper. It serves its purpose, though.&nbsp; It even conveys a paragraph’s worth of meaning. &nbsp;The next component idea I wanted to convey to you was an example.&nbsp; I wanted to orient you that I was about to present an example, demonstrate the example, and then let know that the example was complete and synthesize the properties it demonstrates.&nbsp; I could have said, “Let me give you an example of an interrupted rhythm.&nbsp; Imagine if, after the previous paragraph, I had simply typed, ‘Here’s an example,’ with a paragraph break before and after. It’s one sentence. Not in any meaningful sense a paragraph at all. By marking it out as a paragraph but leaving it incomplete, I have broken the paragraph rhythm.”&nbsp; I could have said that, but it seemed to me much more effective simply to demonstrate, without any wrapping.&nbsp; Does it not have more impact that way?&nbsp; And it still serves the purpose of a complete paragraph about an example.&nbsp; You don’t need an orienting sentence, you don’t need me to explain the example or tell you that I’m done giving the example.&nbsp; The example is enough by itself.&nbsp; Why?</p>



<p>Because you’re not an idiot.&nbsp; If I slam on the brakes just there and simply type, “Here’s an example,” with a paragraph boundary before and after, you’re intelligent enough to know that it is self-referential, to figure out from the context of the moment what it is an example of, and to pick up in the next real paragraph that I am discussing that example, without the need for a transition sentence.&nbsp; I can be incomplete because I can rely on our already-shared knowledge, our already-shared perspective.</p>



<p>This is the only way it works, folks.&nbsp; If I do not give you complete paragraphs at the paragraph level, and complete essays at the essay level (with orienting, developing, and synthesizing paragraphs), and complete chapters at the chapter level (with orienting, developing, and synthesizing essays), and so on—if I do not make the fractal pattern complete at each level of the work in question, then I am not conveying complete ideas.&nbsp; There’s no getting around it.&nbsp; I can deviate, occasionally, playfully, in situations where I know we already have enough shared knowledge that you will be able to fill in the gaps, but aside from that, I must honor the natural structure of information as God has made it, or I will fail in my rhetorical goal.&nbsp; I can do everything right up to the level of the chapter, but if my book does not have a good intro and conclusion, you will come away feeling like I was trying to make a point but you’re not sure which one.&nbsp; I can have a good opening and conclusion to my book, but if the individual essays do not orient you to their subjects, develop their subjects, and help you to synthesize those subjects into coherent supporting ideas, then you will get to the conclusion of my book and ask, “Wait, when did he say that? Was that supposed to be somewhere in the jumble of the previous 500 pages?”</p>



<p>It’s worth mentioning at this point that most intercourse (you there, get your mind out of the gutter) is not rhetoric.&nbsp; Most intercourse in the daily life of man or woman does not and is not intended to convey ideas.&nbsp; Most intercourse takes a form which might be exemplified by this example:</p>



<p>Me: “Man, those liberals, am I right?”</p>



<p>You: “Yeah, man, you know it.”</p>



<p>Orientation: “Man, those liberals…”&nbsp; Synthesis: “…am I right?”</p>



<p>Synthesis: “Yeah, man, you know it.”</p>



<p>There are no ideas here. There is no communication of information. The initiator did not even send a complete sentence.&nbsp; What’s happening, here?&nbsp; My earlier example of an interrupted rhythm, I said, depended on pre-shared knowledge.&nbsp; This is that taken to the highest degree.&nbsp; That was me relying on pre-shared knowledge to create a (hopefully) artistic and illustrative interruption of rhythm in an otherwise complete rhetorical piece which (hopefully) enhances its rhetorical effect.&nbsp; This is… nothing.&nbsp; There’s no context except what we already share, our presumedly common regard for “those liberals.”&nbsp; There is no proposed mission of rhetoric, no intent at all to transmit ideas.&nbsp; Why did we even, biologically, spend energy on this exchange?</p>



<p>This is what transactional psychologists would call a transaction, probably worth about three strokes each.&nbsp; I call it barking, or in this case maybe nose-sniffing.&nbsp; Our intent is not to communicate but to acknowledge one another and reinforce tribal bonds.&nbsp; It has the form of human words, but it is a purely animal interaction, equivalent to two dogs who know each other passing one another on their respective daily walks.&nbsp; We aren’t strangers, so we don’t need to go through that whole ritual of tentative anal sniffing or aggressive snarls and other challenges, but neither are we of the same household, so we haven’t seen each other since yesterday or the day before, and some greeting is demanded to ensure our mutual nonaggression and neighbor status.&nbsp; The appropriate interaction, then, is a quick nose-to-nose sniff between neighbor-dogs before each of us is dragged away by our respective owners. Most of what comes out of the mouths of human beings is this.&nbsp; Yes, again, it has the form of language.&nbsp; I know, sometimes it even comes in complete sentences.&nbsp; Between you and your besty, it might go on for hours, neither of you shutting up but long enough to breathe on occasion.&nbsp; Even so, most of it could be replaced with dog sounds and dog behaviors and it would lose none of its content.</p>



<p>(The other possibility, since it’s me and you in this example, and I know you’ve read this article, is that I’m using a bark about liberals to imply a bark about barking, as a kind of self-referential inside metajoke which I know you will get because you have read this article. If you got the shibboleth joke way back at the beginning, then you’re probably down for that sort of thing. If not, then we may think we’re barking about the same thing when in fact we’re barking about two entirely different things, each laughing at an entirely different joke.)</p>



<p>To reiterate, then, these are your options:&nbsp; either you are engaged in rhetoric, transmitting ideas properly formatted, or you are engaged in barking, transmitting no information but only transactional strokes dependent entirely on common tribal membership.</p>



<p>Actually, there is one other possibility: that you think you’re doing one thing, but actually you’re doing the other. And that brings us back to the example I used to kick off this adventure, that specific literary crime of modern journalism in which an “article” is comprised of nothing more than a machinegunning of stubby pseudoparagraphs containing isolated declarative statements. Each of these pseudoparagraphs contains only one or two declarative sentences, with no orientation or synthesis, so none of them is actually a paragraph.&nbsp; So, what’s going on in these articles?&nbsp; Charitably, we might theorize that this person just doesn’t know when to hit the Return key (that’s the Enter key except when you’re writing) and when not to, and so has put in extra, specious paragraph breaks.&nbsp; By this theory, there is a paragraph there; there is an orienting sentence, followed by several developmental sentences, followed by a sentence of synthesis.&nbsp; All we need to do is remove the extra whitespace, pack the appropriate sentences back together spatially, and there the proper paragraph will be.&nbsp; Is that what’s going on?&nbsp; Let’s take another look at one of those AP articles.</p>



<p>Nope.</p>



<p>There is, at best, something like an orienting sentence at the beginning of the article, but usually not even that.&nbsp; You get instead just the article title or headline, which seems to be trying to do that job, and you might get section titles as well, as in an Axios piece.&nbsp; “What it all means.”&nbsp; “Why it’s important.”&nbsp; Followed, inevitably, by more isolated declarations.&nbsp; No, there is definitely no paragraph structure here at all, nor any corresponding organizational structure at the higher fractal levels of the composition.</p>



<p>Yet this is not just a friendly, informal barking exercise, or at least it does not seem to think of itself that way.&nbsp; This person clearly thinks he or she is engaged in expository or persuasive writing, or, in the case of a reporter, a narrative account of events.&nbsp; Otherwise, why bludgeon us repeatedly with these declarative statements?&nbsp; These are clearly units of information (even if most of them later turn out to be false) which might have been used to develop an idea, but, with no orientation or synthesis to bind them, they just sit there on the page. &nbsp;It’s a bit like a small, preverbal child who has walked up to you and set his toys down in front of you.&nbsp; Here are the pieces.&nbsp; He has an intent for you.&nbsp; He’s going to stare at you and hope you figure it out.&nbsp; It’s a bit like your dog, dropping a ball at your feet and then staring at you, maybe bouncing in circles a few times, and then staring at you again.</p>



<p>This is the only conclusion we can draw from what’s before us. This person thinks he is engaged in rhetoric, but he has no understanding of rhetoric, so he is making a brutish, grunting imitation of it, spewing statements onto a page and hoping, by the end of it, that people who are already members of his tribe will glean some vague semblance of the idea that was in his head, and that people who are not members of his tribe will go die in a fire. It is unfortunate, but it is also somewhat inevitable.&nbsp; It is inevitable that a person who believes nonsensical things should write this way.&nbsp; And this is the surprise twist, here at the end.&nbsp; Let me explain:</p>



<p>A person who writes this way does not write this way because he never learned to write.&nbsp; He writes this way because he never learned to think.&nbsp; Proper composition is not the product of a classical Western education; it is a product of the nature of, and natural structure of information in, this universe which God has made, which Western classicists observed, illuminated, and harnessed.&nbsp; All of the above is not just a way to write well but the only way to write well, because it’s the only way to think well.&nbsp; It is the only method by which your conscious mind can grapple with and organize complex ideas and synthesize them into even more complex ideas.&nbsp; If you can’t do this on paper, it’s because you can’t do it in your head, and if you can’t do it in your head, then complex ideas will never be within your grasp.&nbsp; They will always escape you.&nbsp; Likewise, if you practice doing this on paper, you are practicing doing it in your mind.&nbsp; By writing complex ideas (or speaking them) correctly, by properly representing their structure in rhetorical form, you are teaching yourself to think through complex ideas correctly, to grasp them and incorporate them.</p>



<p>The machinegunning of stubby pseudoparagraphs is just one prominent example of the decline of composition and the decline of thinking which it reflects.&nbsp; There are other sins, and if you think back to your English classes, you’ll probably be able to identify them.&nbsp; (For instance, being not well-trained in composition, the dangling participle is another common mistake of the typical Internet columnist.)&nbsp; But your task is not to go out and identify all the basic grammar and composition mistakes they are making.&nbsp; Your task is to go back to the basics yourself, hopefully inspired by this article, and review your High School English lessons, and think about how they were not teaching you to write, but teaching you to think.&nbsp; If you can think, if you can lay forth complete ideas rhetorically, then you can preserve them for posterity, not as incomplete sketches which rely for understanding on common cultural reference and shared inheritance, but as complete, self-contained records which a future generation, born of another lineage and another culture entirely disconnected from yours, may discover and reconstruct into useful wisdom.&nbsp; This was the gift of the Greek philosophers to the students of the Medieval age, that these descendants of Gaulish and Germanic barbarians, on the far side of a Dark Age in which all communication from progenitor to posterity was interrupted, who inherited nothing from their fathers and from their cultures but rare access to the Latin vulgate, were able to rediscover the works of Plato and Aristotle, whole, complete, ready for use, and to from these rebuild civilization and resume the progress of Western Civilization.&nbsp; With the same skill, hopefully, you and I can leave behind artifacts which will outlast not just ourselves and our generations but our very civilization which is now in its death throes, carrying complete ideas down through time to whatever new civilization grows up in the ruins, providing those people, so long as they can at least decode the English language, not just hints of what came before, but a recipe for how to go ahead, greater and wiser than we were.</p>
`,
  },
  {
    wp_id: 383,
    slug: "the-mission",
    wp_date: "2021-04-29 15:33:33",
    excerpt: "",
    content: `
<h2>An excerpt from the new novel, <span style="text-decoration: underline;">Outsiders</span>, by William Collier</h2>



<p class="has-drop-cap">Bulbous, faceted eyes, blown wildly out of proportion, huge, reflecting an oily rainbow of green, orange, and brown hues, leaving room only for the tiniest bit of head to support them—just enough head to attach also what it had in place of a mouth: this jointed arm, reaching down out of grotesque unfolding mechanisms to dab the table with a bristly sponge of flesh. How bizarre, he thought, that something so alien would have a taste for cheap beer. It dabbed at the puddle, and he watched it, fascinated, because he did not really want to be here.</p>



<p>The fly, fastidious beggar, took a moment’s pause to clean its face and those monstrous eyes, and then Constantine set his mug down, scaring it away. This left him with nothing to do but turn his attention back to his job. The package was nothing much to behold; a man, but scrawny, unkempt, his button-down shirt partially untucked, wrinkled, discolored with several days’ worth of accumulated sweat, his hair greasy from an equal time without a wash. The fly was cleaner than this weaselish creature. He sat at a table on the next patio over, the neighboring café, if a word like “café” could be applied to these dirty, foul-smelling… “shit-hole” was the word in Constantine’s mind. He had never been a man of high rhetoric.</p>



<p>He fancied himself a man of action, but look how far that had brought him. This was the most exciting mission he’d been assigned in years, and he was lucky to have it, given everything going on— That train of thought he put aside. If he had two disciplines in life, they were his ability to exercise religiously and his ability to put off thinking about problems like those, unpleasant situations that made his chest clutch and his breath flow more forcefully and loudly through his nose, in a way the anticipation of combat or stepping off the ramp of an aircraft never did. Instead, he turned his thoughts back to the complaint of the moment: This place, hot, smelly, stupid. The sweat was enough to drive one mad.</p>



<p>Constantine, like all his kind, hardly shied from a good sweat. A good workout, a good fight, a good…. But this? This sweat was greasy, laden with the oils of his skin and the dust and dirt of a third-world trash-heap of a town, and, more than anything, it never stopped. There was no way to get cool, here. Even the “cold water” tap in his hotel room produced only a gurgling stream of tepid, slightly yellow fluid. He had several pimples already, and the one to the right of his nose now tempted his finger. It was growing hard and painful, but no matter how he pinched it, it was not yet ready to burst.</p>



<p>The spook arrived, and he thanked God. She was the only redeeming feature of this mission. Her presence here made perfect sense, now that he had laid eyes on the weasel of a man they would be collecting. Of course he would not be one of those enticed by principle or patriotism or even greed, but by simple sex-appeal. Just look at him; even through his terror, his eyes leered at her as she sat down at his table. Sex-appeal she had, and she knew how to use it. (And the Agency knew how to use it.) Constantine only had the hind-aspect view, from his current vantage, but that was sufficient for his purposes. Her tube-top left shoulders and arms bear and exposed a good portion of her midriff all the way around, down to her cut-off denim shorts. She was sweaty too, and her hair greasy—Constantine suspected deliberately so, in keeping with the hygiene habits of the local culture—but she made it all work, kept it all balanced on the fine middle ground between blending in and making a man think about the things he might do with that hair she now flipped back behind her bare shoulder.</p>



<p>Fantasy was as far as it could go for Constantine. He was married, and while that alone might not have stopped him, he more importantly was already in enough trouble, and under enough scrutiny. He could not afford any further complications at the moment. In any case, he was pretty certain she was already having her way with one or two of the younger men on his team. The truth was that he was no longer the young stud; he was the old man, and the baton had passed on from him whether he had cared to pass it or not.</p>



<p>Constantine glanced away from the meeting, across the road toward the hotel, such as it was. All of its windows were open, most of the curtains drawn closed, which meant that the rooms they had secured for overwatch looked no different from any other, from the outside. There the curtains were just sufficiently parted that a marksman, set up on a makeshift platform inside each room, could aim through the gap at an angle, covering the meeting place and some distance up the narrow street. They had two such positions, at opposite ends of the block, giving them overlapping coverage of the cafés plus good reach in both directions. The rifles were configured with suppressors and subsonic ammunition. In the confines of this street, no engagement would reach even a hundred yards, and heavily armored opposition was unlikely. Even at a mere thirteen hundred feet per second, a heavy, spire-pointed bullet would have no trouble across those distances doing lethal work to soft flesh and bone, and would do that work almost silently.</p>



<p>For his part, Constantine had a submachinegun tucked into a messenger bag of the sort favored by foreigners on travel to this region. No suppressor. If his gun came out, down here, in the crowd, it would be because all hope of stealth and deception had been lost. Not that any of this would be necessary. No trouble was anticipated. Every indication by the intel folks was that the package had made a clean escape, and that he was of no particular value to anyone, so no one would be looking for him. All of this security, Constantine’s team, was a joke, unnecessary, perfunctory, and perhaps more for show than for anything else. Constantine suspected that it was a proof-of-concept. Their parent command had lobbied to put them on this detail just to demonstrate that white-side special operations could execute this mission set. A push for relevance, and as such a glorified, expensive, sweaty pile of bullsh—But Constantine was not a man of politics any more than he was a man of rhetoric. At least they were on an “op,” and the exfil would be interesting. And it was real, rather than training, rather than another very expensive make-believe play. There was a real package. And there was a real spook with a real fine—</p>



<p>“Fuck you, Kato,” muttered Constantine under his breath. “Ethnic mother fucker.” Kato, whose actual ethnicity remained a perpetual mystery, had a complexion and features which allowed him to look at home in almost any third world country where they might operate. That was why he was seated at a table just beyond the package, playing the innocent local and enjoying a full, up-close, frontal view of the spook’s assets, while Constantine maintained close security from the neighboring patio, with his man-purse full of steel and lead and his inferior perspective on the only action going. Kato was leaning over, now, shaking hands with the package, who’s surprise, at the discovering that one of his escorts had been sitting at the adjacent table all along, was evident. The spook stood up, her hair tumbling down her back just about to the lower hem of her tube-top, and Constantine lamented that he had not partaken of the local night-time entertainment scene. (There was certainly no “action” waiting for him at home.) But that chance had passed. By nightfall they would be out of this God-forsaken country and on their way back. At least the exfil would be interesting.</p>



<p>The spook departed on foot, taking her purse and making her way up the street. (Hate to see you leave; love to watch you go, he thought.) She would be heading back to her day job, her official cover, mission complete. The rest was up to his team. Again Constantine glanced at the window across the street on the second floor. There was nothing to see there. It was unchanged, and nothing was visible beyond its partially open curtain; he looked because he lacked discipline, because he was not a professional spook and this was all a bit of a sham anyway. Behind that curtain, the detachment commander (a commissioned captain) would be on a line to higher, announcing that they had the package and would now be consolidating, the first step toward egress.</p>



<p>The sooner the better, thought Constantine, since there were to be no prostitutes in his future. The package paid his bill, stood up, and crossed the street to the entrance of the hotel, entering in. Some minutes later, Constantine’s phone buzzed. An innocuous text message asked if he would be home on time. The most fun aspect of preparing for this mission had been coming up with coded text messages once they had realized that the best means of communication in country would be simply to buy some pre-paid cell phones. “Sure thing,” he typed. “Love you.” After another twenty minutes, Kato paid his bill and departed, and Constantine gave it another ten before making his own exit. He took a round-about route to the rear of the hotel that stood across the street from the meeting point. It was a two-block walk to reach a destination not fifty feet from where he had started, and he felt silly the entire time, but there was no sense in doing it poorly if it had to be done. By the time he reached the correct room on its second floor, the rest of the squad was already present.</p>



<p>“Good to go?” asked the captain.</p>



<p>“Yep.”</p>



<p>“All right. Calling our ride.” The captain pressed “send” on his phone and then resumed making sure all of his gear was squared away. Constantine stepped past him to the window, looking down at the café where the exchange had taken place. There was nothing to see. There would be nothing to see. No one cared, about them or the package. All of this spooky tactical nonsense was for show, a lot of highspeed, low-drag masturbation, as far as he could tell. Constantine could feel himself becoming more irritable the closer they came to departure.</p>



<p>The detachment commander’s phone buzzed. “Truck’s here,” he said after glancing at its message. He, Constantine, and the others hefted their bags and made their way downstairs and out the rear exit, where a truck and a car sat idling. Kato was at the wheel of the car, with others of Bravo Squad divided evenly between the two vehicles. Constantine climbed into its back seat, next to the package. The captain went to the truck. The rest of Alpha Squad squeezed in where they could. Thus reconstituted, the team rolled out.</p>



<p>Outside the city, they met four more trucks which joined with theirs. The entire company was now in convoy. This was nonsense, by Constantine’s estimation. One person in a compact could have picked up the package and driven him to the coast just as easily, but risk-averse leaders up and down the chain, determined to see a success for white-side with no problems, had insisted on overmanning the operation to an absurd degree, not least because there would be no ISR—no intelligence, surveillance, and reconnaissance, no eyes in the sky—overhead. HQ hated nothing more than being blind, leaving the team to operate on their own without Dad looking over their shoulder, as if they were a bunch of grown men.</p>



<p>Constantine’s irritation continued to wind higher and tighter.</p>



<p>Still, it was a bit of a strange feeling to be out here on a real op with no ISR coverage, so contrary to the normal SOPs—Is that redundant? he wondered. “Normal SOPs?” In any case, if the lack of air meant they had to roll in three full teams, over thirty men strong, it could be worse. At least this way local crime was a non-factor. Bandit gangs setting up roadblocks to prey on isolated travelers were not unheard-of in this area, and Constantine quietly prayed for such an encounter before they reached the beach. It would almost make this whole farce worthwhile if they could slaughter some pissant gangsters on their way out. As the convoy headed into the countryside, he unpacked his weapon and then sat back, leaning his forehead against his window and watching the fields and woods slip past. It took considerable willpower not to smell the rest of his team, much less the odor of the weaselish, terrified man seated next to him.</p>



<p>Time passed, and miles passed. Five-Four-Four and Five-Six-One had plenty of fuel in reserve tanks. The convoy stopped to fill up and then continued on its way. They were traveling generally west, and the sun sank before them, painting an orange blaze across the countryside ahead. There was something particularly forlorn about the farms they passed, some abandoned, some which only looked abandoned, littered with the ruins of defunct equipment, old cars, leaning sheds, and piles of plain trash. There was something forlorn in the eyes of the indigenous folk, as they rattled by in the few, ancient, barely-functional vehicles they possessed, staring openly at the convoy of vehicles packed with strange, clearly foreign men going the other way. The trucks and car were “locally sourced,” their passengers dressed in civilian garb and displaying no military hardware, but all of them going along at such a clip together, all of them filled to the brim with grim-looking alien faces, was a certainly bizarre and probably unsettling sight. What would the locals think? A foreign military unit? Or would they be more likely to presume Constantine and his fellows a band of cartel soldiers, bound for another battle in the local, perennial mob wars? Who knew how savvy they were, or what they could guess. They could, at a minimum, guess that it was all well above their heads, that this convoy was but a foot of one of the many gods ever striding across their world, under which they did their best simply not to be crushed. Better not even to see them.</p>



<p>“Fuck,” muttered Constantine as the tension in his chest became unbearable. The coast was growing nearer, mile by mile, and beyond that the ship, and beyond that home. Even talking to the weasel-man was preferable to this silence. “So what’s your deal, anyway? Just couldn’t take it anymore? Working for a government of ass-holes?”</p>



<p>The weaselish one looked at him with wide eyes, no doubt caught aback by Constantine’s address after hours of terse silence. He sat sandwiched tightly in the middle seat between Constantine and another operator, and he had been doing his best so far to shrink himself into the narrowest form possible, to draw no one’s attention. Now, unsure of what to make of Constantine’s sudden attention, he glanced at the other passengers for clues, but they continued to ignore him.</p>



<p>“Well?”</p>



<p>&nbsp;“I have to deliver information to your government,” he said, his accent thick but his grasp of the language sound.</p>



<p>“Yeah? What sort of information?”</p>



<p>The package again looked at Constantine with wide eyes. “I cannot say. It is very important.”</p>



<p>“Yeah?”</p>



<p>He nodded.</p>



<p>Constantine sniffed, turning his gaze to the window again. “I got news for you, bro: the fact that it’s us picking you up means it can’t be all that important. How’d you even convince ‘em to extract you, anyway? What are you? Politician’s aide? Science type?”</p>



<p>“I do communications. I work for your country for many years. Now…” He trailed off.</p>



<p>Constantine, despite himself, glanced at the man, and saw on his face that continuing look of terror. It was as if he lived constantly in the state of a rabbit, hearing rustles in the bushes around him, but with no safe hole into which he might scurry. Yes, thought Constantine. More rabbit than weasel. Scared, all the time. Constantine had presumed him to be frightened by the irrevocable and risky step he was taking with this escape, but if he had been a source, a spy, for so many years as he said, then such fear was probably a way of life for him now. Constantine wondered if the man could remember how not to be scared.</p>



<p>“What’s your name?”</p>



<p>That wide-eyed stare again. “George,” said the package.</p>



<p>“‘Now,’ what, George? You’ve been spying for us for years, and getting away with it. What changed? They get onto you?”</p>



<p>He shook his head vigorously. “No. They don’t know. We must reach the shore before they know. I was very careful. They would kill me if they knew that I know what I know. What I learned. Your government needs to know. Everyone needs to know. The world.”</p>



<p>Constantine’s eyebrows were up a bit, now, and a couple of the other men were also throwing sidelong glances toward the aft middle seat, but George seemed not to notice. His eyes were suddenly fixed on something in his own mind, something he obviously believed to be as dire as his rhetoric indicated.</p>



<p>With another nasal snort, Constantine turned away again. He prodded at the stubborn pimple on his face. “Well, we’ll be on the boat soon enough. You got papers or something? Thumb drive? Anything we need to take care of?”</p>



<p>George was still for a moment, and then he shifted his weight to liberate a side pocket of his trousers in the vehicle’s tight confines, leaning against Constantine in the process. Too close, bro, thought Constantine, as his nose took an unwelcome gulp of George’s several-days-fermented aroma. The odious man fished out a smart phone. “It is here. The proof. I will show this to your government.”</p>



<p>“Chark, you got a bag for this?”</p>



<p>“Yeah,” said the soldier in the front passenger’s seat. He dug into his kit and came back with a zip-lock-style bag, one of the puncture-resistant, air-tight, chemical-proof kind favored by people in their line of work. Designed for the Space Program, the brand advertised.&nbsp; More often used to keep cell phones dry in the rain, or in their case a damp ride through the surf. “Put your phone in this, sir. This will keep it dry until we get to the boat.”</p>



<p>“Thank you,” said George, taking the bag and sealing his phone inside it.</p>



<p>“Touch screen should still work.”</p>



<p>George noted with some small delight—a dim stirring under the canopy of his constant fear—that Chark was correct: the phone’s screen registered his fingertips even through the bag’s tough plastic. “So what’s on there? What is it that the world just has to know?”</p>



<p>“I can’t say,” repeated George.</p>



<p>Constantine rolled his eyes. “The whole world needs to know, but you can’t tell us.”</p>



<p>“Get me to the ship,” said George, and then he met Constantine’s gaze again, and Constantine saw that his fear had returned in full.</p>



<p>“Suit yourself, man. We’ll be there before you know it. Does the Agency know? My government?”</p>



<p>George pressed his lips together for a moment. “They think they know. They do not. They… would not have believe me if I had told all. I get out. Then I tell all, after they can not kill me.” His accent was thickening, his grammar becoming less precise.</p>



<p>“How the hell did you convince them to make this extract, then? You never did say.”</p>



<p>“I paid. Everything I have. They owed me. She said, I work for your government, I get out when time comes. I say, time is now. I pay money. All my money, for you to take me to your country.”</p>



<p>Constantine was stunned. “You paid?” he asked, his incredulity sharpening the word to a fine, hard point.</p>



<p>“Yes. Everything I have. The world must know.” George’s hands had closed now, tight around his bagged phone.</p>



<p>“God damn,” muttered Constantine. He felt more than a little insulted that this entire operation, his men, at risk in a foreign land, had been bought by some sleaze-bag low-level spy who wanted out early, but another piece of him could not help but wonder at the conviction, or desperation, of a man who would risk his life for years, only then to give his life savings to buy his way out. This guy was, to say the least, not fitting well into the spy stereotypes one reads about in novels or in the mandatory annual insider-threat training presentations. Constantine began to wonder, as he once again turned his attention to the world outside, if George really did have something special, some revelation, that might retroactively justify all the song and dance. That would be a nice middle finger to tier-one.</p>



<p>“What the fuck?” snapped Constantine. Such was his tone of surprise that everyone but the driver looked at him.</p>



<p>“Chief?” asked one of them.</p>



<p>“Drone,” Constantine replied.</p>



<p>“Say what?”</p>



<p>“RPA.”</p>



<p>“Are you serious?”</p>



<p>“I swear to fucking God, I just saw it, paralleling us, just past the tree-line.”</p>



<p>“What the fuck?”</p>



<p>Constantine already had his phone out, but he changed his mind. “Comms. Everyone on comms, now.” He began pulling his headset and radio from his bag and powering them on. As he settled the cups onto his ears, he leaned forward over the center console, between the two front seats. “Honk,” he said.</p>



<p>His driver did not hesitate but gave the car’s horn a couple of pulses. In the truck ahead of them, they saw a couple of faces look back, and Constantine motioned to his headset. The faces turned forward again. After a moment, Constantine and his companions could see them donning comm gear. Constantine turned around, making eye-contact with the folks in the truck behind his and again motioning to his headset. He could see the looks of confusion in their eyes, but they too began digging into their kit.</p>



<p>“Two-Two, radio check,” said the captain’s voice in his ear.</p>



<p>Constantine squeezed his push-to-talk. “Good check.”</p>



<p>“What’s up, Rob?”</p>



<p>“RPA, nine o’clock, low altitude, running parallel to us,” said Constantine.</p>



<p>There was a moment’s pause, and then the captain’s voice said, “Are you sure?”</p>



<p>“Yes, I’m God-damned sure.” Easy, Rob, he counseled himself. Calm breeds calm.</p>



<p>“What type?”</p>



<p>“Not sure,” replied Constantine, and grimaced as soon as he said it. “Fixed wing,” he added. “Small, low-altitude. Not any kind I’ve seen before. I only caught a glimpse of it.”</p>



<p>Another pause, and then, “Okay. Will relay. Keep everyone up comms and eyes out.”</p>



<p>Constantine looked around at the others in the car, the staring eyes, George’s wider than ever with a sudden crescendo of his fear, the others calm, narrow, professional, waiting for more information.</p>



<p>“I am not hallucinating, I swear to God,” remarked Constantine. “Eyes out. See if you can spot it, or anything else.” They turned their gazes to the scrolling tree-lines and warm sunset without. Constantine looked over at George. George averted his gaze, turning his attention once more to that specter only his mind’s eye could see. Finally, Constantine directed his attention to the world, fixing his watch on the patchy woodland and trying with all his might to penetrate into it for any hint of the untoward, and beyond it, above it, for any corroboration of his claim which even he was beginning to doubt.</p>



<p>“Fuck y’all,” he muttered. He had seen it. Small, fixed-wing, strange for its compact shape. Drones tended to be lanky, slender things, especially the small ones, with long, thin wings fit for efficient gliding and tiny bodies just sufficient to house a low-power, long-winded motor, a few bits of electronics, and what amounted to a digital camera. This had not been of that shape; he remembered it so clearly—at least its outline, its silhouette against the sky in that bare moment when a break in the trees had revealed it. It had been more like a squat fighter jet or a hawk. Could it have been a hawk? Could he, in some fit of paranoia, have mistaken an actual raptor for an enemy drone?</p>



<p>“Saber is putting up a chickenhawk, see if they can spot this thing,” said his captain’s voice in his ear. Five-Six-One, callsign “Saber,” occupied the two trucks bringing up the rear of the convoy. Constantine rolled down his window and leaned out, looking back toward the trucks to watch. It took a minute, but eventually a head and torso appeared over the roof of the nearer truck, holding a man-portable remotely-piloted aircraft, or “RPA” in the vernacular. (Theirs was a profession rich in vernacular.) He had somehow wrangled himself half-way out the tailgate window, probably with a buddy holding onto his legs, and was now holding up their toy airplane with its nose into the wind and activating its motor. The launch was more graceful than Constantine had expected, but he had never seen anyone attempt it from the back of a rolling vehicle before. No need for a toss. He held it up, and after a moment gently released it. It floated in the wind, seemingly stationary over the truck but for a little wobble, and then it tipped up and separated from them, falling behind and climbing into the sky. The drone operator would be inside the truck, on the control console.</p>



<p>“VDL is up,” said the captain’s voice into their ears. “Four seven one seven if you have a rover.” More vernacular. Video down-link. Tactical remote video receiver (RVR, or “rover”). Endless acronyms and short-hand names. Unfortunately for Constantine, his car did not have a rover kit. His team possessed only one, and it was with the captain in the truck ahead of them. The captain continued: “Word from HQ is no intel on any kind of elevated threat. My intent is to keep eyes out and press on. Report any sign of aircraft or RPAs, any people or vehicles on the ground, but keep your weapons out of sight. Headsets off, too, for now. Put a radio on speaker. We’re going to continue to keep a low profile until we’re blown for sure.”</p>



<p>With a sigh, Constantine removed his headset, set it in his lap, and disconnected the headset’s push-to-talk connector from his radio. The radio would automatically revert to its internal speaker. His companions were doing likewise, and he saw a couple of them turn their radios off to preserve battery. There remained several hours of driving between them and the coast.</p>



<p>The mood in the car had shifted, from boredom to a moment of heightened alert, and now to a sense of anticlimax. Maintain a low profile, the captain had said. It was probably nothing. Continue on course. Constantine could feel his irritation returning as his own adrenaline subsided.</p>



<p>“Contact unknown RPA, break,” said the captain’s voice, now thinner and more mechanical from the tiny speakers of their two operating radios.</p>



<p>“I fuckin’ told you,” said Constantine—to those in his car, not over the Squad Command net. Instantly his adrenaline was back.</p>



<p>“We’ve got it on VDL,” the captain continued. “It’s… fuckin’ weird all right. Got to be military, but—” His transmission fell silent.</p>



<p>The men in the car traded glances. The sounds of their rickety third-world conveyance bumping along the rough third-world road filled the pregnant pause in radio chatter.</p>



<p>“Well, it’s gone,” said the captain.</p>



<p>Constantine snatched his radio to his mouth and squeezed the transmit button. “Gone how?” he asked, with more bite than he had intended.</p>



<p>“Took off. Don’t know if it realized we were following it with the chickenhawk or just decided to bug out, but it took off like a rocket. Way too fast for a prop drone. It’s gotta be some kind of miniature jet.”</p>



<p>“Who has something like that?” asked one of Constantine’s companions. More importantly, thought Constantine, why would it be here, following them? Part of the sales pitch for this op had been that this country was essentially a permissive environment. Not a friendly nation, per se, but not an environment in which a near-peer power would try to interfere with them even if they were detected.</p>



<p>Constantine found himself looking sidelong at George again.</p>



<p>“From One-One, forget about low-profile,” said the captain’s voice, emanating from the two radios. “Gear up.”</p>



<p>“Vik four copies,” replied Constantine.</p>



<p>“Gonna need you to move, George,” said Mills, the operator opposite Constantine in the back seat. George looked confused, and then even more confused when Mills unbuckled George’s seatbelt and Constantine pulled George onto his lap. They had prepared for this eventuality, not because it was expected, but because preparing for it was fun. You pay three dozen men to sneak into another country and play spy with a government budget, they’re going to get your money’s worth out of the experience. They had removed all of the solid paneling between the trunk and the rear seat within a day of purchasing this car—giggling as they had done it, like a bunch of school-boys—so that now all that remained was to chop through the upholstery and seat cushion of the middle seat, which took no time at all with George out of the way. Mills began hauling bags into the tight confines of the car and passing them around. That done, Constantine put George back in his place, the now backless middle seat.</p>



<p>The new gear consisted primarily of compact plate-bearing vests, their vest-mounted tablet computers, and magazines loaded with extra ammo for their submachineguns. Five-Eight’s rifles were in “vik three” with the captain and the other members of their team, but even those were configured for quiet work in town against mostly unarmored opponents. Four-Four and Six-One had the full-power weapons. This was not to say that, should they encounter a serious adversary, Constantine and his team would sit idly by. After all, if your enemy is wearing body armor and all you have is a pistol, you just have to shoot him in the face. So it was said.</p>



<p>Constantine wormed his way into his vest, donned his headset and reattached it to his radio, and then began settling the radio and other accoutrements onto the vest’s webbing in their respective places. As he worked with one hand, he keyed his push-to-talk module with the other. “Matt, Rob. We need to figure out how they DF’d us, whoever they are. We’d have noticed a tail out of the city.”</p>



<p>“Yeah. Maybe a call in from the locals. And looking at that drone, I think we can guess who it is, which means peer adversary. Kill the phones. I’ll talk to HQ.”</p>



<p>The others in the car were listening. They looked to Constantine, who nodded. “Batteries out.”</p>



<p>Each man cracked open his locally purchased cell phone and pulled the battery. Constantine looked to George, who clutched his phone to his chest as if it were his dead mother’s pearls.</p>



<p>“The battery does not remove,” he said.</p>



<p>Mills took it from his hands, extracted it from its plastic bag, and he was about to set at it with the same knife he had used to cut his way through the seat cushion a moment earlier, when he paused, staring at it. He looked up at Constantine.</p>



<p>“Seriously?” asked Constantine.</p>



<p>“Oh yeah,” said Mills.</p>



<p>“God fucking damn it, George.” But in his mind he cursed also the spook and her people. Where was this in the intel?</p>



<p>Once Mills had the screen off, he prised out the battery and dumped all the pieces back in the bag.</p>



<p>He sealed it and tucked it into a pouch on his vest.</p>



<p>George looked heartbroken. “Once we get it home, they’ll be able to repair it no problem,” said Constantine. For now, it goes with Mills. How the fuck did no one suspect they’d be tracking your phone? Why didn’t anyone mention a phone from the get-go?”</p>



<p>The terrified man had no answer. Perhaps he was wondering the same thing himself, or perhaps he had kept the phone a secret even from his handler. Constantine did not press the issue; there was no point, and no point in further prejudicing his men against the package they were ordered to deliver safely.</p>



<p>“Chief?” prompted Chark.</p>



<p>“It’s done. Eyes out. If they’re going hot on his phone, it means they’re serious.”</p>



<p>They were quiet for a moment, and then Chark voiced the real question on everyone’s mind:</p>



<p>“Are we really going to—”</p>



<p>“You let the GFCs worry about ROE,” Constantine barked, cutting him off. “All of you. I doubt anyone wants to make a big international incident here, no matter what this guy has. But if they do, self-defense still applies. If someone shoots at you, you put ‘em down. If you have a good reason to think they’re about to shoot at you, you fuckin’ put ‘em down.”</p>



<p>Mills donned his sunglasses. They were the cool-guy wrap-around shades so stereotypical of the operator community (and operator wannabe communities), but they had a purpose, which Constantine knew well, beyond their industry-standardized ballistic protection rating: You dress the part, it helps you act the part. Cool-guy shades and a cool-guy beard, and all this high-speed kit, helped a young operator with relatively little actual combat experience feel like a “bad-ass mother-fucker,” and if he felt like such, if he believed he was such, there was a greater chance he would act the part when rounds flew. Constantine did not begrudge the young ones a few stereotypical embellishments. Far from it: He had been wearing his cool-guy shades since they left town.</p>



<p>“From One-One, weapons hold,” the captain relayed over the team net. “If we do run into anyone.”</p>



<p>&nbsp;“Copy,” Constantine transmitted back, and then released his PTT. He looked again at the men in his car. “Self-defense still applies.”</p>



<p>They drove on. The blazing sunset light was fading and would soon be too dim to justify their sunglasses. Once again, they were back to only the sound of the wheels and the wind and the rattling of their vehicles, just enough to drown out the pounding of their own hearts. This was like the ride in on a helo, except worse. On the helo, you knew you were going in because circumstances were in your favor.</p>



<p>The big, open secret of special forces was that they didn’t take on a fight they weren’t relatively certain to win. Superior manpower, superior equipment, the element of surprise. The infil was always nerve-wracking, but one could feel justified confidence, because the mission was carefully planned after being carefully chosen. This mission had been chosen and planned the same way. Within its original parameters, there was no reason to expect it to be much more than a very realistic drill. It was those original parameters which were now shot to hell. Cell-phone surveillance. Advanced jet-powered RPAs no one had ever seen before. All the indications of a peer-state adversary who were taking George’s treachery a lot more seriously than anyone had anticipated. The parameters of advantage, shot to hell.</p>



<p>The car slowed precipitously, just as their radios announced, “Contact on rover. Road-block, one mile. Stop stop stop. Reverse in place. Vik six is now point. We’re working on a—” Chatter in the background, and the captain paused. “Saber just lost the chickenhawk. MANPAD.” (Technically, MANPADS, for man-portable air defense system.) Constantine rolled his window down again, and the others were doing likewise. He leaned out and looked ahead into the setting sun, but he could not find over the trees what he sought, the telltale steep smoke trail of a shoulder-launched surface-to-air missile.</p>



<p>Within seconds the drivers had reversed course, and the convoy was rolling back the way it had come.</p>



<p>“Cutlass is putting up their drone. Hang tight. One-One is working on a route.” Speed had become the order of the moment. Create time and distance between themselves and the ambush point now behind them, and find another route before the enemy could react and reposition. The drivers had transitioned from highway mentality to rally mentality, and Constantine gripped the top of his window’s frame with his left hand to steady himself while with his right hand he laid the muzzle of his submachinegun out the window. The wind whipped and roared through the car, now. No one said a word. In his mind, Constantine reviewed the highway they had been traveling. It had been miles since they had last seen a crossroad of any sort. He vaguely recalled an unpaved (“unimproved,” in the parlance) road, but he could not remember how far back that had been.</p>



<p>Chark was on his tablet, scrolling through satellite imagery of the route, giving their driver forewarning of upcoming bends. “Left five. Straight three hundred, then right six.” Mainly he did it out of habit, and good practice, but even at these speeds—fast for an old rust-bucket, if slow compared to the speeds at which they had trained—it was worthwhile to have the commentary, as the driver’s view ahead was limited by the two SUVs preceding them. “One hundred, then right two—”</p>



<p>A chopping screech of tires cut him off. The lead vehicles swerved and slowed, their drivers working for maximum brakes without locking the wheels and only partially succeeding. “Contact front,” the captain was saying over the radio. “Barricade.” Suddenly, a thunderous clatter of automatic weapons filled the air ahead. Constantine tightened his grip on his door frame as his car swerved first one way and then the other, sliding to a hand-brake stop sideways in the road just short of Six-One’s SUVs and the men piling out the near side of them.</p>



<p>“Saber, dismount!” ordered the captain over the radio. “Vik three is going to barricade left. Go for the woods. Flank left.”</p>



<p>Constantine pushed open his door and slipped out, and then he reached back in and grabbed George, hauling him bodily from the car. Constantine was a man of wiry frame, but his size belied his strength. He had always held his own in the gym and in the field, and scrawny George may as well have been a paper mannequin. As Constantine pushed “the package” down behind the rear wheel of the car, he watched vik three, Five-Eight’s SUV, roll past them into the shallow ditch to the left of Six-One’s two trucks, bridging the gap between them and the tree-line. Its near-side doors were already ajar, and the rest of Five-Eight piled out even as it came to a stop, with their driver exiting last but only by a fraction of a second. It was still rocking on its suspension as they began to lay down fire under and around it, toward an enemy upon which Constantine still had not laid eyes.</p>



<p>“Chief, stand by to move,” transmitted the captain.</p>



<p>Four-Four’s trucks had already blasted past him on the right-hand side of the road, filling in that gap and, under Six-One’s withering covering fire, pressing a few yards closer. The roar of assault rifles was constant, a symphony of staccato bursts from all around, but Constantine could hear the enemy’s fire, even louder and more constant just beyond the hasty barricade, punctuated by heavy machinegun notes.</p>



<p>Technicals. He could also hear the singing timpani of bullets shredding his team’s vehicles. “And no fucking air support,” he could not help but note. Someone from Four-Four lit up an AW, a light machinegun, on the right side to counter the enemy’s heavy guns. That was something, at least.</p>



<p>“Smoke’s out. Chief, press left. My intent is to capture the technicals.”</p>



<p>“Capture?” Constantine transmitted back, incredulous.</p>



<p>“Capture. The main force is coming up behind us.”</p>



<p>“Fuck,” Constantine said but did not transmit. He had not yet fired a shot. Instead, he focused on keeping his left hand locked in a vice grip on George’s collar and the SMG in his right hand pointed in a safe direction. He used his feet to kick his men. “Left! Move!”</p>



<p>As he dragged George to the left, past the captain and their quickly disintegrating SUV, he could see thick white smoke billowing about the noses of several big military trucks on the road some fifty meters away. Someone had a good arm.</p>



<p>He slung his weapon and squeezed his push-to-talk. “Rapier, peel—"</p>



<p>“Grenade!” he heard someone shout through the din. A dull thump followed.</p>



<p>Constantine moved into the trees, shoved George down, and tried his transmission again.</p>



<p>“Rapier, on the run, left flank. Stay quiet and get behind that convoy. Snipers, we need to take those technicals in one piece. Report set.”</p>



<p>The rest of Five-Eight was going past him now at a sprint through the woods. He could see the two with their suppressed rifles bounding ahead, racing for a quartering angle not obstructed by smoke but also not so far aft that they would be firing back toward their own company’s vehicles.</p>



<p>The captain came up behind him. “I’ll take him. Go get those trucks, Rob.”</p>



<p>“Yes, sir. You got it. Mills has his phone.”</p>



<p>The captain stared at him for an extra half second and then said, “Roger. Go to it.” Constantine nodded and took off after the rest of the team.</p>



<p>“One four, set.”</p>



<p>“One five, set.”</p>



<p>He caught up to the two sharpshooters and knelt down behind them just as they announced their readiness over the team’s internal radio channel. “Stand by,” he said. Each had set up against the side of a tree, bracing his rifle’s handguard against the trunk. They had already divided the targets between them.</p>



<p>There came a wooden crackle around them, and another tree, off to their right, shed a burst of splinters. “Taking fire,” said someone on the net.</p>



<p>“Roger,” said the captain’s voice. “Suppressed weapons, suppressed weapons only, open fire.”</p>



<p>The two sharpshooters began firing. Their rifles coughed, making more noise with the clatter of their bolts than with the reports at the muzzles of their silencers. The tremendous racket of the firefight on the road continued, and even here next to them, Constantine could hardly discern the sounds of the suppressed weapons. The two enemy machinegunners went down quickly, the heavy machineguns falling silent. Their note subtracted from the overall cacophony was to Constantine like the lifting of a physical weight from his body.</p>



<p>“Technicals neutralized,” he transmitted.</p>



<p>“Suppressed weapons only, continue to engage,” replied the captain.</p>



<p>The two riflemen continued prosecuting targets. The one who had fired in their direction was down now as well, and most of the enemy still had not identified Five-Eight’s flanking position in all the chaos. Constantine could seem them clearly, now. Two open-bed trucks, each with a pintle-mounted machinegun in the bed (earning them the “technical” moniker), and one five-ton troop carrier, open-topped. The enemy force was comprised of some twenty men, most of whom were now taking cover to the rear of the trucks and firing toward the Six-One’s and Four-Four’s barricade positions fifty meters up the road. The smoke screen was thinning out quickly, becoming more of a white haze drifting toward the friendly barricade on what little breeze the warm evening offered. It was already getting dark enough to limit Constantine’s vision—</p>



<p>He cursed himself and threw down his shades. Much better. The enemy was figuring it out, now, that there was a flanking element to their right. Advantages lasted only seconds. It was vital to continue shifting, changing the situation, keeping hold of the initiative. Enemy soldiers were moving around to the far sides of their vehicles and more and more were firing back at Constantine and his men in the trees.</p>



<p>“We’re blown,” he reported.</p>



<p>“All weapons, fire.”</p>



<p>The rest of Five-Eight opened up. Most of their weapons were in pistol calibers, but they made their share of noise and put out a lot of lead. The enemy recoiled as a group, completing in a hurry the process of taking cover out of sight on the far sides of their vehicles and returning fire as best they could. They were losing, now. Five-Eight and the rest of the company had them in a text-book ninety-degree crossfire. Now, for the company, it was a matter of completing the victory before they ran out of ammunition and time.</p>



<p>“Five-Eight, keep your fires aft of the technicals. Four-Four is moving up.” It was the captain again. He was coordinating with the Company Commander and the other Detachment Commanders on another net. The great challenge of an overmanned evolution was always to stay organized and out of conflict with one another. Most of the time Constantine, and many like him, complained about the risk-aversion-born overmanning of operations, arguing that the excess personnel added more risk than they mitigated. Today, though, they were not overmanned. Today they had too many people, but also too many enemies. Today they were in a much, much bigger battle than any SF unit like theirs had faced, perhaps in their history.</p>



<p>Constantine was on his hands and knees, moving from shooter to shooter, making sure each of them had heard the restriction on fires and was anticipating a check-fire call, which Constantine knew could come at any moment.</p>



<p>“Alpha, stand by to advance.”</p>



<p>“Alpha standing by.”</p>



<p>Constantine slid down next to Alpha squad’s leader. “If you go in, keep right. Expect our covering fire down your left side until you reach the truck.”</p>



<p>“Got it.”</p>



<p>“Alpha, move up,” ordered the captain almost immediately. Four-Four must have stalled out. That was fine. Alpha squad was up and sprinting, their squad leader taking the left-most position and checking his men from accidentally running into the line of the covering fire that continued to stream through the air just to their left. Even weighed down by their gear, they covered the distance in only a few seconds.</p>



<p>“Bravo, move up! Alpha, take ‘em!” Constantine heard the captain’s voice through the air as well as the airwaves and looked around to see him catching up again at a run, waving at Constantine to go with the rest of the team. “Go!”</p>



<p>Constantine nodded and took off through the trees. Bravo was vaulting the ditch, and Alpha was rounding both ends of the big five-ton, a few in each direction, leading with a couple of their precious grenades. Constantine could not see what happened on the other side of that truck, but he could hear it, and he could imagine it, and it made his chest swell with excitement. One of Bravo’s men ahead of him took a running slide onto his side under the truck and joined in the carnage from there. Constantine grabbed another by the shoulder and shoved him toward one of the technicals. The latter took the hint instantly and vaulted into the bed of the truck.</p>



<p>“HOLD AT THE TRUCKS!” shouted the captain in their ears. “Do not pursue!”</p>



<p>One of Alpha’s operators backed into view off to the right, between the five-ton and the nearer technical, tracking an unseen target and firing repeatedly. Constantine joined him in time to see an enemy soldier going for the heavy machinegun mounted on the farther truck. It was a desperate and futile effort in the midst of a slaughter. Meanwhile, Bravo’s man took the near gun and had it up and running in a few seconds, adding its roar to the fray. It was obvious to all players why the captain did not want his men to pursue the now routed enemy survivors. Four-Four had come down the road from the right, and they had indeed stalled, but it left them in a perfect position to reap a horrid harvest of the fleeing enemy as they made for the woods on the far side of the road. Only a few enemy fighters managed to reach the trees, chased all the while by fire from almost two dozen small arms and one truck-mounted machinegun. “Cease fire!” shouted Constantine. “Cease fire! Drivers, get these trucks online! And someone get that other machinegun online! You!—” He grabbed one of Alpha’s operators and shoved him toward the second technical. “Get on that gun!”</p>



<p>“Company, consolidating from the west,” said the captain in their ears. “Get a head-count and get these vehicles working. Cutlass has security.”</p>



<p>“On it, sir.”</p>



<p>“Rob!” Constantine heard the captain calling his name as he came to rejoin the group. “Can I give this back to you?” He all but threw George into Constantine’s grasp.</p>



<p>“Yeah, I got ‘im.”</p>



<p>“And this?” He indicated the situation more broadly. “I’m gonna go talk to zero-one real quick.”</p>



<p>&nbsp;“Yeah, we’re on it.”</p>



<p>One of the company’s original SUVs came rolling past the captured trucks to park behind them, followed by another, both riddled with holes but, miraculously, functional—notwithstanding the steady trickle of steam escaping from under the hood of the second.</p>



<p>“Fuel leak,” shouted a voice from under the five-ton.</p>



<p>“I got’cha,” said another man, diving under with a roll of all-purpose tape. The ideal repair? Perhaps not. But these trucks only had to carry them a few hours farther.</p>



<p>There was a sudden buzz, and Constantine looked to see Four-Four’s drone launching into the air.</p>



<p>He passed his gaze over the local battlefield and took a few deep breaths. Focus. “Squad leaders, headcount,” he shouted. “And everybody fuckin’ check yourself for holes.”</p>



<p>“Chief, Rosa’s hit!”</p>



<p>There was the unwelcome shiver for which he had been waiting. Constantine hurried over to find the wounded man seated on the tailgate of one of the technicals while a second man provided first-aid.</p>



<p>“I’m fine, chief. Arm wound.”</p>



<p>“Extremity bleed,” said the other operator, even now cranking down the tourniquet’s windlass just below Rosa’s shoulder.</p>



<p>“Turn him over to the medic and get back to work loading up,” ordered Constantine.</p>



<p>“I’m here,” said the squad’s medical specialist as he arrived. “I got ‘im. Go,” he added, slapping his comrade on the shoulder.</p>



<p>Constantine turned his attention to the pile of dead bodies in the lee of the five-ton. What a mess, but they seemed to be “indigs,” indigenous local soldiers, rather than enemy foreign operators as he had earlier feared.</p>



<p>With a roar, two more trucks rounded into view from the west, followed by several others in trail.</p>



<p>“CONTACT!” bellowed someone, but the two heavy machineguns spoke louder, greeting the newcomers with long streams of deafening fire.</p>



<p>They received for every round they delivered. A terrifying hail of machinegun fire pelted the captured vehicles, driving the entire company into cover behind them or into the trees.</p>



<p>“Rapier, we gotta get these viks going!” shouted the captain into his radio. “Company will cover us! Rob, take care of the package!”</p>



<p>“RPG!” someone howled. Constantine tackled George to the ground and heard the hiss of the rocket. Sometimes, tachypsychia blessed a man with a slow-motion perception in moments like these, but not this time. This time, it all seemed to happen too quickly. He heard the hiss of the rocket, and less than a heartbeat later its warhead struck the nearer technical with a concussion that made Constantine’s ears ring. There was no fireball, and the truck did not fly into the air or do anything else so dramatic. It simply burst with a singular crash like a five-hundred-mile-per-hour car wreck.</p>



<p>Constantine cleared his head and looked around just in time to see two of the enemy’s heavy trucks lurch into the weeds on his side of the road, blowing past the ruined technical and coming to a stop only a few yards away. Now came the sense of time dilation. He saw with exquisite detail, as if over a span of minutes, the trucks grinding to a stop, their wheels sliding the last few inches. The bulk of each rocked backward as it settled on its suspension, expending its momentum, and the people inside did likewise. More than any of that, though, he saw the barrels of the guns training down at him, including the half-inch bore of yet another mounted machinegun. It seemed forever had elapsed by the time he was able to throw his body under the half-ton and pulled George with him. He felt as though he could have counted the shots fired by the machinegun behind him.</p>



<p>“Go!” he shouted, continuing to pull his hapless charge after him as he crawled out from under the far side of the five-ton over the bodies of the dead which his own team had made there. This was still a killing field, only now inhabited by his own people, fighting desperately to prevent the enemy from enclosing them amongst these trucks and wiping them out. Aggression was their only hope, and it was a slender hope indeed, in the face of superior numbers and superior firepower. Constantine could see his men, and those of Four-Four and Six-One, draining their rifles, refusing to duck down even as the return fire literally consumed their cover. He could see them dropping. He had to get the package out of here.</p>



<p>That was the mission.</p>



<p>Pushing himself across the dead and pulling George along with him like a sack, he reached the far side of the road. With the field of battle now reversed, the south side of the road was the company’s left flank, and it was mercifully still defended. Some clever soul had delivered another grenade, this time a frag grenade, into the attacking vehicles on this side, wrecking one and stalling the rest, preventing them from rushing and collapsing this flank like they had the right.</p>



<p>“Right side! Right side!” Constantine roared, grabbing all who came within his reach to capture their attention. On the other side of the dead five-ton, two trucks’ worth of enemy infantry were pouring forth. More grenades flew—from friendly hands—and skittered under the five-ton, detonating by the newly-arrived enemy. That would learn ‘em. He crossed the ditch and with one hand threw George into the woods, following after him like a bulldozer for several seconds more until they were out of the maelstrom.</p>



<p>The chatter on his radio headset was telling. Chaos. Calls for help. Transmissions cut off by cries of pain. And that just on one team’s net. Constantine understood this sound, knew it for what it was: a defeat in progress. For all their aggression, they were too few, and too poorly armed to handle… God, what? A hundred man opposing force? And fully equipped, to boot. His men were all going to die.</p>



<p>They would never quit, but that would not save them from the inevitable.</p>



<p>Constantine let loose a stream of profanity that did not accomplish much, and then he began pulling his kit apart. “George—George!” he shouted, grabbing the man and shaking him to bring him back to the moment.</p>



<p>George stared at him from the depths of shell-shock.</p>



<p>“George, listen to me: you’re going to have to go on your own. I’m going to give you a radio and my tablet—look!” He took George’s head and forced him to look at the tablet he had detached from his chest. “You just have to go west. Follow this line. Stay away from the main roads and people, go through the woods—”</p>



<p>“I can’t go alone!”</p>



<p>“You fucking can,” replied Constantine, cuffing him hard across the face. “You fucking can and you will. You’ll follow this line until you reach this spot on the coast. When you get close—within twenty miles—you turn this radio to channel three and you call for help. They will come and get you, I promise.”</p>



<p>“You must come with me! You must protect me!”</p>



<p>Constantine took him by the throat, now, and pulled him close, nose to nose. “I am not going to leave my men to die,” he growled. “You can go to the ship alone, or you can take your chances with the people hunting you. Clear?”</p>



<p>It was all perfectly clear. Unacceptable. Unthinkable, even. But perfectly clear.</p>



<p>Constantine threw him down. “Go!” He turned then and waded back into the firefight.</p>



<p>Not stupidly, though. He could hear shooting from the epicenter on the road, but he could hear more shooting in the trees off to the west. Hopefully that was one of the other friendly fire-teams, in an outside position. If it was, he would join them and start a push on the enemy convoy. If it was not—if that was enemy fire—then he would attack them from behind.</p>



<p>The trees did not tear at him. Trees were generally forgiving. It was the brambles, the low thorny underbrush, that clawed at his legs as he ran. He ignored them, plowing through, double-checking the status of his weapon as he ran. He had not yet fired a shot. “Fucking George,” he thought.</p>



<p>Friendlies. Six-One. “Coming up on your six!” he called as he approached. “Chris!”</p>



<p>“Rob? What the fuck?” replied Six-One’s senior warrant officer upon seeing him.</p>



<p>“My guys are getting eaten alive in there, Chris.”</p>



<p>“My guys are getting eaten alive out here. There’s too fuckin’ many of these guys.”</p>



<p>Constantine could see the killing field now from the outside perspective. Trucks littered the road, several stalled nearby, the rest in a cluster where his team had originally taken the five-ton and the two technicals. A couple were on fire. Trucks littered the road, but bodies littered the road and the grass and the woods around him.</p>



<p>“We have to charge ‘em.”</p>



<p>“What?”</p>



<p>“We gotta rush ‘em,” Constantine insisted. “We gotta take those trucks now or we’re all dead.”</p>



<p>“I got maybe six guys left!”</p>



<p>“Seven with me! Chris, we gotta do this now!”</p>



<p>“RPG!” screamed a nearby voice.</p>



<p>It came right in amongst them and laid all the world to silence.</p>



<p>For a long time Constantine was still. At least, he thought it a long time. He wondered if he was dead. There was no pain, and he felt very disconnected from himself, as if he was floating over his own body, or viewing the world as from behind a clear veil.</p>



<p>He was out of the trees, at the edge of the road. That was a change. Had he been thrown out? How long had he been here? Was the battle over? Off to his right were the trucks. Another five-ton, this one covered, and an armored 4x4 with a machinegun turret. There were people there. They seemed to be shooting, occasionally, but no one seemed to be in a hurry. They were all very serene—or else he was very serene, way over here, on the other side of this veil. He watched as the armored truck’s turret rotated toward him. If his body was not dead, that would certainly finish him off in a moment. He found himself looking at the sky. Perhaps he did not want to see it coming, or perhaps it just struck him as strange, that something like this would happen on a beautiful, warm evening, by the last light of the setting sun. Sure, he had been a bit bitter about this place, but now that all of his troubles were about to be behind him forever, what was the point in holding a grudge? It was going to be a nice night.</p>



<p>The other possibility was that he was distracted by that drone again, hovering over the battle. Something struck the enemy machinegunner and caused several fine, red clouds to spring from him. The turret stalled. More invisible projectiles peppered the covered truck and the men around it. AP rounds. Constantine could see them—well, not them, not the projectiles, but he could see their effects as they penetrated completely through people and vehicles in perfectly straight lines. Where they passed through metal, showers of sparks exited the far side. He had never seen spark trails like that, so long and straight in the air.</p>



<p>It was amazing to watch, and Constantine realized he was on his feet, staring in wonder. He looked for the source. Had Four-Four managed to swing all the way around the north side? Did they have an automatic with AP? He searched into the woods across the road with his eyes, but he saw no one and no muzzle flash.</p>



<p>An indistinct shape moved in the twilight, against the backdrop of the trees, and Constantine became convinced he was dead, for it surely was a ghost, or a devil. Then a flash of light knocked him off his feet again.</p>



<p>The impact served to bring him back to his senses. “Holy fuck!” he observed, lifting his head just in time to see the covered five-ton—the new one, the enemy-occupied one—crashing to the ground like a felled tree after having stood for a moment on its nose. A great portion of its rear end was caved in and twisted into wreckage. The people who had been taking shelter by it were no longer visible.</p>



<p>Constantine pushed himself up. There was the armored truck, and its turret. He sprinted toward it. There were people inside, but one of the doors was ajar. He pulled it open and fired a burst from his submachinegun into each of its occupants. Then he clambered atop it, grabbed the dead man in the turret, and deadlifted him free, tossing him off the hull of the vehicle. The gun looked to be in working order. He slid himself down into the firing position and swung the gun around, searching for targets. He found them.</p>



<p>“Fuck all ‘y’all,” he said to himself as he mowed them down.</p>



<p>That made the difference, that and his share of luck. A lot of rounds were fired his way, but most of them hit the armor plates that surrounded the gun, and when he finally ran out of targets, Constantine discovered that he was still alive after all. At that point, with no one left to shoot, and the sound of gunfire reduced to a few sporadic bursts, he sagged back against the turret frame and let himself look to the sky again. It was fully night, now.</p>



<p>“Rob? That you?”</p>



<p>“Yeah,” he said as best he could to the stars above.</p>



<p>“Fuckin’ A, Rob. Nice work.”</p>



<p>“Did we win?” He looked down. It was Six-One’s captain. He looked up at the sky again.</p>



<p>“Well, we’re alive. They ain’t.”</p>



<p>“How many’d we lose?”</p>



<p>“We’re still getting a count. Get down from there. You need to get a medic to look you over, and your team is going to need you.”</p>



<p>That drew Constantine’s attention. He locked eyes with the young officer and made the connection. “All right,” he said, and he began the laborious journey back to earth. “Fuck.”</p>



<p>The captain helped him down, steadied him, and looked him over. “You’re wounded.”</p>



<p>&nbsp;“Great.”</p>



<p>“Get patched up and get to your boys.”</p>



<p>“Yeah.”</p>



<p>He eventually reunited with what was left of Five-Eight. They numbered five in all, of the original twelve, and he was now their ranking officer. Constantine’s wounds were serious but not immediately life-threatening, according to the medic. He had first- and second-degree burns on the exposed skin of his face, neck, and hands (“Looks like you got some sun, there, Chief,” joked the medic), and some puncture wounds from frag, including a needle-fine one through his gut, but his plate had caught the few that would have gone through his heart and lungs. His men put him on the back of a truck and made him lie still while he directed their work.</p>



<p>In all, they managed to recover one five-ton and the armored gun-truck. It was more than enough for those who remained. They loaded up the dead and then then the wounded, and then those who could still walk climbed aboard. The two vehicles set forth, heading west once more toward their promised extraction. In the back of the five-ton, where the only living were the wounded and the medics, no one spoke. It did not seem the time, outnumbered as they were by their own losses. Constantine was shaking and beginning to feel cold. That would be shock, the symptoms of insufficient blood in his veins. He had a bleed somewhere, probably in his gut. He thought about letting the docs know, but they were busy trying to keep stable a man who was missing much of his face, and that seemed to him a more pressing concern.</p>



<p>The truck lurched to a stop, brakes squealing. “Now what?” snapped Constantine aloud. Everything was still for a little while, and someone called for a medic. In due time, several figures appeared at the back of the truck and hoisted a new body in. Constantine recognized his clothing. “What the fuck? George?”</p>



<p>“Found him lying in the road. Almost ran him the fuck over.”</p>



<p>“Is he alive?”</p>



<p>“Yeah, but he’s not going to make it.”</p>



<p>“George,” said Constantine, sliding himself down to the floor of the truck next to his erstwhile charge. “George, can you hear me? What the fuck happened? I told you to run.”</p>



<p>His efforts at conversation were in vain. George was not lucid. The wound was a bad one. When had that happened? After Constantine had left him? Or had he been wounded during their first escape, and had Constantine simply failed to notice in his rage?</p>



<p>“Did you see them?” George managed suddenly, in little more than a whisper. Constantine looked to find the man staring at him with those wide, fearful eyes.</p>



<p>Visions of a wraith returned to Constantine’s mind, crystal clear yet nonsensical. “I saw something,” he admitted. George was breathing hard, now, and took hold of Constantine’s arm with his hand. “What are they?” Constantine asked.</p>



<p>“From the stars,” said George. Of course, thought Constantine. George’s grip tightened, and he lifted his head off the bed of the truck. “They are enemy!” he whispered. “They are making—” He coughed. “—alliance.”</p>



<p>“George, you can’t expect me to believe that.” Visions of a white hot flash, and of ten tons of steel standing on end, returned to his mind’s eye, also crystal clear, also nonsensical. “Fuckin’ aliens?”</p>



<p>George groaned, straining harder, pulling Constantine down to him. “Stop them. Tell the world.”</p>



<p>That was all the strength he had. He did not collapse and give up the mortal coil right then, but he sank down to the floor, rasping, struggling to breathe. And Constantine had little left to offer of his own.</p>



<p>“He say anything useful, Chief?” one of the docs was asking. Constantine wanted to answer, but he found that he was very tired, and it would have to wait.</p>



<p>He became aware of the sea breeze, and that the truck had stopped. Several hours had evidently passed away from him, but the breeze was good. That was good news. He became conscious again on the boat. The steady, galloping bounce of the inflatable over the waves, and the noise of its engine, made sleep impossible. He would later recall vaguely being hoisted up the curved side of the submarine, but he could not claim to have been really conscious for it. His next genuine experience of the living world was in a sick-bay deep inside the ship. That was where he learned that his surgery had been successful, and that he could expect not only to survive but to enjoy a quick recovery to full fitness, as long as he was careful for a week or two about the stitches in his stomach. That was also where he learned that George had died a full hour before they had reached the beach, and where he learned the final count of the dead, and of those so wounded that they would never fight again. Ordinarily, an Army team aboard the undersea home of a Naval special operations unit could expect plenty of testosterone-fueled rivalry, but this voyage was quiet. There was nothing to say, and nothing Constantine wanted to share.</p>
`,
  },
  {
    wp_id: 385,
    slug: "meeting-the-parents",
    wp_date: "2021-04-29 15:36:04",
    excerpt: "",
    content: `
<h2>An excerpt from the new novel, <span style="text-decoration: underline;">Outsiders</span>, by William Collier</h2>



<p class="has-drop-cap">Doran had offered to drive, which meant that he would be picking her up. They had been dating now for several months, and the thought of him still made a very girlish part of her go giggly. Waiting for him now only exacerbated it. That inner girly girl felt flush with excitement, wanted to simultaneously jump up and down and also curl up into a little ball of infatuation. The rest of Melody, the part that was twenty-five years old, rather than sixteen, and the part that was a little more reflective, kept telling the sixteen-year-old girly girl to chill out. It was hard to say what made a man “cute,” or “handsome,” or “sexy”—well, no, sexy was easy enough to define. Six percent body fat. Nearly six feet of height—towering above her five feet and five inches. A better-than-ten-second 100-meter dash. (She had seen him on the podium twice just in the time she had known him.) That athletic butt. And his brain was nothing to sneeze at. He was a good student, which she had decided early on would be a primary criterion for her. Truth be told, that was the starting criterion. She was a nerd, in a nerdy degree, surrounded by nerds. Why and how she had come to be dating an athletic star were questions that still boggled her mind. More than that, why was he dating her? Every sport had groupies. He might not have a gold medal—yet—but a silver medal was still silver; he could flash it and have more than a few co-eds draping themselves over him.</p>



<p>So why her? That was what made his sexiness a double-edged sword, a source of as much worry and doubt as excitement. Sexy she was not. Cute, maybe. She could look in a mirror and see cute, especially relative to most of her peers in the college of computer sciences, but… there were shortcomings.</p>



<p>His truck pulled up. He drove a pick-up truck. It was a bit old, a bit uncomfortable and noisy on the highway, a bit unnecessarily loud, and more than a bit unnecessarily high—It made her inner sixteen-year-old go giggly all over again, which it should not have done. A silly, oversized truck was supposed to be an eye-roller, a bit of that juvenile masculine posturing which women tolerated but could not take seriously. In any other context she would have scoffed at it, and had it been her first impression of him it probably also would have been her last. Yet, here she stood, watching it come to a stop and feeling like a blob of jelly. Perhaps it was because he had never drawn attention to it, never tried to show it off. He had this truck, with its high suspension and loud muffler, but he had never explained why, never made a thing of it. Or, perhaps, she responded to it solely because it was his, and she was in love with him. If that was the case, then to be woman was to be weak indeed, she thought. To be silly, as silly in their own way as boys and their trucks were silly.</p>



<p>She started toward the bed of the truck as he parked, towing her luggage. On the far side, the driver’s door opened and closed. As she was struggling to get her suitcase up to head height, he came around the tail, and then the suitcase became weightless and floated out of her grasp, and he set it down over the bulkhead, out of sight.</p>



<p>“Can I get your backpack, too?”</p>



<p>“No,” she said. “I’ll carry it up front. It’s got my computer in it and stuff.”</p>



<p>He had her gently by her elbow, now, and was smiling down at her. Teeth. Teeth were important. Isn’t that funny, that teeth would be important? His teeth were pretty nice, with just one that was a little out of place—They were kissing. She stood on the tips of her toes, feeling his lips, feeling his hand so gently cupping her cheek, his other hand sliding around her back to hold her up to him, and his body, hard and slender and much bigger than hers. He was a good kisser, nicely reserved. He did not try to devour her face, nor locate her pancreas with his tongue. Farthest from it: usually, it was as if his lips were just enjoying the moment, just lingering, enjoying the softness of her lips—and that made her feel like her lips were soft, and something to be enjoyed. It made her want to linger, too.</p>



<p>“God, I’m so easy,” she said in her mind as he let her go. When he kissed her like that, those sensations drove the rest of the world right out of existence. No one else had ever kissed her like that. She had had in the past one other boyfriend and a couple of unsuccessful dates over the years. Far less romantic experience than media and social media led her to believe everyone else was having, and she had only herself to blame, for being a shy, awkward girl, cute at best, and far too interested in computers, programming, higher mathematics, and the like to attract any but two types of guys: creeps who saw her as easy prey, and nerds of the opposite sex. The latter tended to be honest enough, but… there was no getting around it: they were just as insecure and dysfunctional as she was, and that was unattractive. It made her a horrible person, she knew, to hold a standard higher than she could meet, but she knew deep down that two needy, coping people together was not a recipe for a healthy relationship. Perhaps more than that, it was not a pathway to getting better, to becoming a better person.</p>



<p>Highschool thus had been miserable, and undergraduate school had been pretty much useless. The one boyfriend had forever soured her on dating other gamer/nerd types. He had proven her theory regarding dating within her own community, and kissing him had been an exercise in perfunctory performance of an obligation. The one-off dates had proven her theory about guys who thought her nerdiness would make her easy and were just looking for easy. What a mess.</p>



<p>She was still a virgin. The popular attitude amongst her peers—and of course on television and in movies—was that being a virgin at her age implied she couldn’t get laid; that there was something fundamentally wrong with her, something fundamentally outside the norm. That she was a virgin she kept a carefully guarded secret. But she was glad; she had held back, and all of those past experiences had borne out according to her worst expectations. She frankly thanked God she had not gone to bed with any of those guys, even the boyfriend, as earnest and well-meaning as he had been.</p>



<p>Two weeks ago, she had confided in Doran that she was still a virgin, and that she wanted to wait until marriage. It still blew her mind that she had done so, that she could trust him that deeply. Their relationship had been in a good place, comfortable, and he had been pressuring her—gently, she had admitted. Not begging, not whining, not too aggressive. In the heat of making out, his fingers would start to wander a little, in a way not at all unpleasant, and when she would tell him to stop, he would stop, but then he would say to her something like, “I do want you,” or “I think we’d be really good together,” or, perhaps the line that cut her closest to the quick: “I’m not going to force you, babe, but you don’t have anything to worry about. You’re safe with me.” It was one of the hardest things she had ever done, not giving in that night. That was when she had told him, had confided in him a synopsis of her dating history and her resolution to wait.</p>



<p>Since then he had stopped pressuring her, and, more miraculously, had continued to date her.</p>



<p>That was when she began to wonder if he could be the one. Was it possible? Could a man be that good?</p>



<p>“It’s good to see you,” he said, still holding her with a hand around her back, still looking down at her from way up there. “Are you ready to go?”</p>



<p>“Yes,” she breathed.</p>



<p>“May I get your door for you?” he asked, releasing her and not waiting for her answer but stepping past her to open the passenger-side door.</p>



<p>“Yeah…” she replied belatedly.</p>



<p>“M’laaaaaady,” he said, grinning and offering her a hand.</p>



<p>“You’re really laying it on thick,” she observed.</p>



<p>“I’m going to meet your parents! That’s kind of a big deal.”</p>



<p>“Yeah…” She took his hand and used it to help push herself up into his pointlessly tall truck. It was all so silly, and she felt so silly, and she felt so good. That only left the question of whether she felt too good. Was feeling this good a sign of trouble? Was it all too good to be true? There was the sixteen-year-old giggler inside her, and then there was the much bigger inner monster that said, yes, it was too good to be true. Real life is never this good.</p>



<p>Doran made certain she was entirely in and then closed her door and headed around the front. She waited, so lost in her own thoughts that when he finally climbed in, she failed to notice.</p>



<p>“Everything all right?” he asked.</p>



<p>“Hmm?” She looked over at him, and then came to her senses. “Yeah! Yeah, I’m good. Just thinking about things.”</p>



<p>“That’s one of the things I like about you,” he said. “You think about things. Most people don’t do a lot of thinking about anything.”</p>



<p>She chuckled. His flattery was nice, but it pushed her further into her reverie.</p>



<p>“You want to talk about it?”</p>



<p>Melody closed her eyes, thinking about his question for a moment, and then she said, “Not yet.”</p>



<p>In TV shows, they always said, “I don’t want to talk about it,” or “it’s nothing,” or “I’m fine, don’t worry about me,” and it was always a cheap ploy by the writers to keep the drama going. Drama through protagonist stupidity. Melody had determined long ago that she would never utter those words. If she ever had a real relationship, she would talk about it, whatever “it” was. At most, she would allow herself some time to think about it first. She had delivered the same requirement to Doran when they had begun dating. Never, ever, ever say anything that a character in a direct-to-Internet-TV show would say. Not permitted. She looked over at him again. “You’re doing everything right,” she said.</p>



<p>He raised his eyebrows. “Okay.”</p>



<p>“I’m just saying, you’re doing everything right. Don’t change. My parents are going to love you. I’m just… I’m thinking about myself, not you.”</p>



<p>“You know I love you just the way you are, right?”</p>



<p>“You know you sound like a bad TV character when you say that, right?”</p>



<p>He pursed his lips. “Yeah, but it’s true.”</p>



<p>“Is it?”</p>



<p>“Of course!” he said, and she could hear the pitch and timber of his voice winding up. She was upsetting him, on the cusp of what was surely already a somewhat stressful venture for him. A big deal, as he had said. She held up a hand.</p>



<p>“I’m saying, should you? Should you love me just the way I am?”</p>



<p>“Yes! Why not?”</p>



<p>“That’s what I’m thinking about.”</p>



<p>He sat back against his seat, looking out at the road ahead. “I don’t know what you want from me, right now.”</p>



<p>Another line from a TV show. She took a deep breath. In the show, the girl would respond, “I don’t want anything from you! Why can’t you just listen? You don’t understand me!” Melody could hear the whole exchange in her mind, because she’d heard it in every show she’d ever watched, or so it seemed to her.</p>



<p>“I want you to wait,” she said quietly. “Just… trust me that you’re doing good, and I want you to wait while I think about this. When I know what I think, I’ll talk to you about it, and you can tell me what you think. Okay? But I want to come to my own ideas first. Will you wait?”</p>



<p>Doran rapped on the steering wheel for a moment, and then he smiled. “You know I’ll wait for you.”</p>



<p>Right to the quick. She reached out and took his hand in hers, and then somewhat to her own surprise she kissed his fingers.</p>



<p>“Wow,” he said.</p>



<p>“Just drive, mister.”</p>



<p>“Yes, ma’am.”</p>



<p>He put the truck in gear and pulled away. She held onto his hand, and he made no move to reclaim it.</p>



<p>After a few miles, he asked, “What’s the alternative?”</p>



<p>“What?” she said, again breaking out of her inner world.</p>



<p>“I mean, if you don’t love a person for who they are, then what do you love them for?”</p>



<p>&nbsp;“That’s what I’m trying to figure out. If you come up with a good answer, I’d love to hear it.”</p>



<p>“Okay…” he said.</p>



<p>They drove on in peace. If he was not accustomed before the trip to her introversion, he had a good sense of it by the time they arrived. It was the better part of an eight-hour drive, and she took her share of it behind the wheel, and all the while she volunteered but a few sentences, most of them some variation on, “Do you want anything from the convenience store?” What he could hardly guess was that her inner voice, her mental monologue, was going all the while. They were just her thoughts, her private thoughts, and it never even occurred to her to share them. Sharing was not what they were for.</p>



<p>Well after sundown they arrived, and her parents’ home was a beacon of warm light in the dark. The sight of it shot pangs of nostalgia through her. She rarely felt as homesick as she did in the first moments of arriving here. This was not even the home in which she had grown up, for her parents had moved here since she had gone to college. Even so, this was a place of comfort, a place where schoolwork and her personal struggles could not seem quite to reach her. It was a place of safety.</p>



<p>Her father’s silhouette emerged from the front door even as they were taking their luggage out of the bed of Doran’s truck, and as they walked up he stood on the porch, waiting to hug her and to shake Doran’s hand.</p>



<p>“Dad, this is Doran. Doran, my father.”</p>



<p>“Mister Ritter,” said Doran, offering his hand.</p>



<p>“Good to meet you, Doran. Come on in—Can I help you carry anything?”</p>



<p>“If you’d like to get Melody’s bag—”</p>



<p>“I’m fine,” she interjected. “Am I upstairs?”</p>



<p>“Yup.”</p>



<p>“There’s my baby!” chirped her mother, just then arriving in the foyer.</p>



<p>“Hi, Mom!”</p>



<p>“Hiiiiiiiiii! Oooooh, it’s so good to see you! How are you?”</p>



<p>There was much hugging and smooching that needed reciprocation, and by the time that was done, Melody found that Doran and her father were already half-way up the stairs with all of the luggage, including hers.</p>



<p>“I’m coming.”</p>



<p>“We’re fine!” said her father. “I’ll show Doran where he’s sleeping.”</p>



<p>“I put you in your room—” said her mother. It was not really her room, but the spare room they always gave to her when she visited. It was decorated in a feminine fashion and with mementos of her childhood, like a tacit commandment: Thou shalt visit thy mother and thy father, regularly. “—and him across the hall. I have to admit,” she added more quietly as the men disappeared into the upper floor, “I was surprised when you said two rooms. I kind of assumed…”</p>



<p>Melody was staring at the upper landing, whither they had gone. She drew her gaze to her mother and found her mother gazing at her. “He’s a good guy. If I was any other girl, we’d be sleeping together. But he…” She shrugged. “So far he hasn’t given up on me.”</p>



<p>“Oh, baby!” Melody’s mother embraced her again, squeezing her hard. “You’re a good girl, and don’t ever let anyone tell you different. You’re making a good choice, and if he’s okay with it, then he’s probably the good man you think he is.”</p>



<p>“Thanks, Mom. I think so too.”</p>



<p>“Oh, sweetie, you’re crying!” she said, wiping a tear away from Melody’s cheek of which Melody had only just that moment become aware. “Is everything okay?”</p>



<p>“Yeah! Yeah,” said Melody quietly, nodding her head and wiping her face with both hands. “Super good. School is good, and Doran is great, and I’m just… really happy to be here.”</p>



<p>“Oh!” Another hug. It was good to have a Mom. “Well! You go get settled in, and freshen up. There’s cookies. Or wine. Or both.”</p>



<p>“Both!”</p>



<p>“Okay! It’ll be here when you’re ready.”</p>



<p>“Okay.”</p>



<p>Melody let her mother go and proceeded up the stairs, musing on the origin of her tears. They surprised her. Her emotion surprised her. What was its source? Was she really just overwhelmed by the good things in her life? Was it the inner sixteen-year-old, crying tears of girlish joy? Or was it more likely that she was troubled by those good things? Was it that pessimistic, cynical inner monster, fatted on eight hours of critical introspection, and now as ever waiting for the other shoe to drop?</p>



<p>Doran went over with her parents swimmingly. That had never been in doubt. He was by all accounts the catch of a lifetime. If he had any serious faults, she had not yet identified them, so it was hardly likely that her parents would ferret them out in a few days.</p>



<p>“So, Doran, I understand you’re pursuing your undergraduate degree.” The test.</p>



<p>“Yes, sir. I took a few years off after high school to work. I knew I wasn’t ready for college. Wasn’t sure what I wanted to do, you know?”</p>



<p>“What’d you do? After high school, I mean?”</p>



<p>“Odd jobs, actually. Believe it or not, I mowed lawns for a while. Worked a package distribution center.”</p>



<p>“What made you decide to go back to school?”</p>



<p>“Working in a package distribution center, honestly.” Laughter. “Seriously, I’d rather mow lawns than do that again. But lawn-care doesn’t really pay the bills, unless you own the company, and it’s successful.”</p>



<p>“Is that what pushed you to major in business?”</p>



<p>“She mentioned that, did she? Yeah, I guess. That and… I guess I’m still not sure what kind of business I want to do. I just know I don’t want to be at the bottom of it, whatever it is. If an MBA gets me a shot at, y’know, being in charge some day, then I figure that’s the way to go.”</p>



<p>“That’s a good start, for sure. So how are you paying for your education? Student loans?”</p>



<p>“Dad!” interjected Melody, but Doran laughed it off. This was all part of the ritual.</p>



<p>“Some loans, some scholarship. Turns out, I’m still eligible to run for the school track team.”</p>



<p>“No kidding! Mel said you were a runner.”</p>



<p>“Runner, long jump, high jump, and pole vault. I’m scrawny and quick.” More laughter.</p>



<p>“That’s great. How did you get picked up for the team?”</p>



<p>“Walked on, believe it or not. I ran all these events in high school, and was pretty good. I tried out, got accepted, and won a scholarship the next year.”</p>



<p>“That’s incredible fortune.”</p>



<p>“Believe me, sir, I know it. Second only to meeting your daughter.” Bam. Melody felt herself turning red. “But seriously, I probably would not have passed Calculus without her. That’s how we met, you know.”</p>



<p>“She mentioned you asked her to tutor you, but we didn’t really get the details.”</p>



<p>“Oh, yeah. So, I was doing okay in business math, and was kind of enjoying it, right? And my advisor says, ‘Hey, if you really like this, higher math will look good on your resume. You could go into Calc I next semester.’ And I’m like, that sounds hard, but if you say so. It turned out to be a terrible decision.”</p>



<p>“You just had a terrible professor,” said Melody. And it was true. That professor had been truly awful. Anyone would hate math after taking a class with him.</p>



<p>“Yeah, you’re right about that. But still, I had no idea what was going on. No idea what anybody was talking about. So there I am, the one struggling adult in this class full of math wiz-kids, going to the library after class and literally, like, trying to sweat my way through the course. I realized I was not going to make it out alive, right? And I was going to have to get some tutoring. And wouldn’t you know it, that same night, there’s this really cute girl working at another table, and she’s got all kinds of math books around her, and she’s just tapping away at her computer like it’s no big deal. So I asked her if she knew anything about calculus. She gave me a pretty funny look when I did, but she said yes.”</p>



<p>“I did?”</p>



<p>“Oh yeah. You looked at me like I was from another planet. Like I was something you found in a test tube in somebody’s laboratory.”</p>



<p>“Oh, come on.”</p>



<p>“Dead serious.”</p>



<p>“But she agreed to help you,” prompted Melody’s mother.</p>



<p>“She did. And the rest is history. I barely passed Calculus I, and I met your genius daughter.”</p>



<p>“So,” interjected her father, raising a hand, “you just walked up to a girl you thought was cute and asked her to tutor you in math, out of the blue?”</p>



<p>Doran shrugged. “Look, Mister Ritter, I’m not going to tell you I’ve got no experience with girls. I did a lot of dating in high school, and after. I’ve always been a lot better with girls than, y’know, math and science. But… Mel is different.”</p>



<p>“How so?”</p>



<p>“I’m right here!” Melody wanted to shout, but, again, this was the ritual. Plus, she wanted to hear his answer.</p>



<p>“Melody—Your daughter… Well, she’s different from the girls I always dated before. She’s serious. She studies. She’s kind of a nerd, but in a good way. And, well, she makes me want to be a better man.”</p>



<p>Melody shot him a sharp look.</p>



<p>“Mm, sorry,” he said.</p>



<p>“What?” asked her father, glancing from the one to the other.</p>



<p>“She has this rule, I’m not allowed to say anything that a TV character would say.”</p>



<p>“Neither of us, is, because TV characters are stupid.”</p>



<p>“Yeah. So… let me rephrase. Melody has high standards. She’s the first girl I ever dated who had really, like, genuinely high standards. I’m sure she gets that from you. You’re still together. My parents didn’t have high standards, and they’re divorced.” He shrugged a little. “I don’t want to end up that way. So I guess I figure a woman with high standards is a good place to start.”</p>



<p>“Well said.”</p>



<p>Yes, well said, you devil. But then again, Melody could not honestly accuse him of dissembling. Every indication was that the things he said he genuinely believed. Every guy said he was trying to be a better man. Every guy said his girl made him want to be a better man. What was the difference? Why did it feel truthful with Doran? Why did he not feel like a rescue case, if his story and rhetoric were so stereotypical of a rescue case? Was she just blinded by girlish infatuation? Was that the other shoe? Was it just a matter of time before his professions of wanting to be a better man proved hollow, before she realized he had some deep fault that would never improve, and before it became clear that all he really wanted was to be loved by a surrogate mother, “just the way he is?”</p>



<p>Why did Melody keep coming back to the idea that seeking to be loved “just the way one is” was not the right answer? That was the crux of the matter.</p>



<p>Her lungs screamed at her, ached, sucked air desperately. Her feet pounded the pavement, but her thighs had no more strength to drive her any faster. She all but stumbled to a stop and doubled over, putting her hands on her knees, gasping.</p>



<p>“No no,” he said. “Stand up straight.”</p>



<p>She winced but obeyed, straightening up.</p>



<p>“Belly breathe. In deep, out slow. Here.” Doran took her hands and held them over her head. “Breathe. Nice run. You’re getting better. How does it feel?”</p>



<p>“Awful,” she said.</p>



<p>This was the crux of the matter. It was their third day here. Her parents occupied a nice two-story house along a sparsely-populated highway about thirty minutes outside of town, just far enough to be too far to be called suburban, but not quite so far as to be called the countryside. A home here usually came with five or six acres of lawn and woods. A few of the neighbors kept horses. The road was long, straight, moderately rolling in the vertical, and generally devoid of traffic. As far as Doran was concerned, it made for a great running road.</p>



<p>“It feels awful. I don’t feel like I’m getting better. I feel like every time I run, I just find out all over again how bad I am at it. I can’t breathe!” she snapped, not at him but at herself, or perhaps at the world. She took her hands back and put them on her hips, looking around. Her mind took her back to her bedroom, pulling on the track top and matching shorts she had bought because he had encouraged her to get some proper running gear. In the store, she had managed to convince herself to buy them, but as she had put them on today, she had hated herself in them. The stretchy, moisture-wicking material, so flattering as it hugged the form of a female athlete or a mannequin, only accentuated her excess flesh. The fat around her midriff bunched up over the waistband in what she could only describe as a muffin-top. “Fuck,” she had said quietly, aloud, to her mirror, and then she had put on a t-shirt and a pair of shorts over the running garments.</p>



<p>“Nobody starts out good at something, Mel. You’ll get better.”</p>



<p>“Will I?”</p>



<p>“Of course. If you stick with it. If you keep running, and eat healthy, your body can’t help but get stronger.”</p>



<p>“And lose weight.”</p>



<p>“And lose weight.” Doran was being careful. He knew he was on dangerous ground, though he had a sneaking suspicion that the danger with Melody was not quite the same as the danger would be with any other girl.</p>



<p>Melody closed her eyes and took several more deep breaths. “And what if I don’t? What if I can’t?” She let her arms hang down and her hands ball into fists. “What if I just can’t do it? Will you still love me, just the way I am?”</p>



<p>“Well, yeah,” he said, in the manner of a man picking his way through a minefield. “Of course.”</p>



<p>“But you’d love me a little less than if I had been able to. If I’d stuck with it, and ate right, and lost the weight. You’d love me more if you could have me be me, but also that.”</p>



<p>“Melody, stop.”</p>



<p>“No, this is important. And you’re not wrong. It’s not wrong. That’s what I’m saying. It’s the same for me. What made me interested in you was because you were a jock, but you actually seemed to want to do good at math. You were actually trying in that calculus class.”</p>



<p>“Is that what you want? Would you like me to keep taking math classes?”</p>



<p>“Yes! Or, I mean, sure, math. Or computer stuff. Whatever. Stuff that’s not just jock stuff. I want you to be the jock that’s also got the brains and the good character. And you want me to be the cute nerdy girl who’s also a runner and has ten percent body fat or whatever, and you’re not wrong to want that!”</p>



<p>“Healthy body fat on a woman is more like fifteen to twenty-five percent.”</p>



<p>“Okay, whatever. The point is, you’re not wrong to want more of a person. Of me. And—” She hit each word as if with a sledgehammer, to drive it home as much to herself as to him. “—I want to be that.” Melody looked up at him. “I don’t want to be stuck just being the nerdy girl. Why can’t I be fit and skinny, too? People can be athletes and still play videogames.”</p>



<p>“Yes!” said Doran. “Absolutely. I am for this.”</p>



<p>“But it’s hard,” Melody concluded. “I mean, I seriously… You talk about feeling good after a run. Runner’s high? I don’t feel high when I run. I feel like I’m dying. And when I get done, I just feel weak. Weak and like I’m dying.”</p>



<p>“Sweetheart, I don’t know what to tell you except you just have to stick with it. It’s going to be hard, if you’ve never tried it before. It’s a lifestyle. You have to reshape your body and mind—but do you really think it’s any harder than me learning calculus?”</p>



<p>“You realize there’s a calculus-two, right? And three?”</p>



<p>“So we’re back to this. You want me to keep taking math classes.”</p>



<p>“I don’t know… kinda? I just… don’t want you to give up on it. If you don’t want me to give up on running, then I don’t want you to give up on technical things. Math, science, programming— something. If you love me the way I am, you should love me more if I keep trying to be an athlete, and if I love you, I should love you more if you try to be everything you are and also learn about intellectual subjects.”</p>



<p>“So you’re saying I’m not intellectual. I’m just a dumb jock.”</p>



<p>Melody’s head snapped around, and she stared at him wide-eyed. Was that what she had said? Was that what he had heard? Had she just—</p>



<p>He grinned. “I’m sorry, that was mean. Look, I know what you’re trying to say. You realize you’re a weird-ass girl, right?”</p>



<p>She opened her mouth, but she had no response to say with it quite yet.</p>



<p>“Is this what you were thinking about all the way down here in the truck?”</p>



<p>“Yeah, I guess. Some of it.”</p>



<p>He began to walk back toward the house, and she followed. “So, basically, what you’re saying is that love’s not blind, and also not unconditional. You’re saying you love me proportionately—that’s a math word—to how good I am at things, and what things I’m good at.”</p>



<p>“Well… what if I am?”</p>



<p>“I’m not gonna lie: it’s a bit…”</p>



<p>“Heretical.”</p>



<p>“Yeah.”</p>



<p>“Well, am I wrong? If you could have me, but also I had the body of a cheerleader, wouldn’t you want that?”</p>



<p>He was quiet for a few paces. “You know, one of the things that made me start to be really interested in you was when you agreed to go running with me. And when you kept going running with me. I would love for you to become an athlete. But I wouldn’t want that if it meant you stopped being you. The things I like about you.”</p>



<p>“But it doesn’t mean that! If I could be an athlete, it wouldn’t make me any less me, except maybe I’d be less of the bad parts of me. I’d have more discipline.”</p>



<p>“And more confidence.”</p>



<p>That caught her off guard, but it was true. “Yeah,” she said. “Yeah. More confidence.”</p>



<p>&nbsp;“You can do it.”</p>



<p>“That’s what you keep saying.”</p>



<p>“Because it’s true.”</p>



<p>“Well, you can learn math, or science, or computers, or whatever you put your mind to. I believe that. You’re a smart man.”</p>



<p>“Well, thank you. I’ll tell you what: let me give it some thought. ‘Kay? You asked me, in the truck, to let you give it some thought, so let me give it some thought, and I’ll get back to you.”</p>



<p>“That’s fair. I’m sorry if I hurt your feelings.”</p>



<p>He waved a hand. “You only hurt my feelings with your high standards. And I think you hurt your own feelings more than mine, so I figure I should probably man up about it.”</p>



<p>“Oh, God. I’m not sure that’s… I mean…”</p>



<p>He took hold of her hand, and hand-in-hand they walked, while she gave up trying to complete her thought.</p>



<p>“So,” he said after a minute or so of silence.</p>



<p>She looked up at him.</p>



<p>“You love me, eh?” Her mouth must have made a “What?” shape, even though no sound escaped her, because he followed with, “That’s what you said. You totally said you loved me.”</p>



<p>&nbsp;“I’m not sure I did.”</p>



<p>“You did.”</p>



<p>“Okay, well, let me just say I’m happy you haven’t run away screaming, yet. That’s worth a lot.”</p>



<p>They made it back to her parents’ house and put their conversation, if her mad ravings and his desperate attempts to keep up could be called a conversation, on hold. That night (blessedly not until dessert was concluding) her father asked the big one:</p>



<p>“So, Doran. What are your intentions toward my daughter?”</p>



<p>“Okay!” said Melody. “I’ll be on the porch.”</p>



<p>“You go right ahead, Mel,” said her mother.</p>



<p>Melody retreated from the proving grounds. Poor Doran, she thought. He was such a goodhearted boy, and not only was he getting it from her father, as was to be expected, but he was bearing the full brunt of her crazies as well. What was it that she really wanted? Was she, in fact, crazy? And even if she was not, was she asking the impossible—of him, and of herself?</p>



<p>It was a dark night, cool and crisp with the lateness of the season. Melody sat on the back porch with the porch light off, so that only the glow from the windows behind her illuminated her surroundings, reaching not very far into the spacious, sparsely wooded back yard. She sipped her coffee, enjoying the contrast of hot and cold, light and dark. She had always liked the dark, since she was old enough to be Emo. Overt Gothicism had never been her style, but she certainly identified with that subculture. Perhaps that was her cynical inner monster, or maybe the intersection of her two inner creatures, the cynical monster and the innocent teenager. The overlap of the two circles in the diagram. “With your powers combined, I am Emo Goth Girl!” she thought. “I am very sad, and no one understands me!”</p>



<p>She sipped her coffee. “I’m not very sad, but I’m pretty sure no one understands me. I’m not even sure I understand me.” The trouble was—Well, really, there were two troubles. The immediate trouble was her discontent with herself, and her dissatisfaction with settling for who she was at this moment in her life. Why couldn’t she be everything she was, and also the things she wasn’t yet? A sexy, slender, cat-like athlete, and, hell, while she was at it, socially adept as well, and a leader among men (and women). They’re just skills, right? Sure, talent makes a prodigy, but anyone could at least get the basics. What obstacle was there?—except it’s Really Hard. That was it. The only thing between the her of the moment and the her she wished she was was that getting there was Really Hard.</p>



<p>The other, greater trouble was that it was very easy to identify what was wrong with other people’s ideas (Case in point, “love me just the way I am.” Obviously weak-sauce), but coming up with correct ideas to replace them was much harder. It was easy to prove someone else’s answer was wrong, but hard to come up with a right answer. And being someone who only pointed out the flaws in the ideas and arguments of others, who could only tear down idols but not build monuments, who only “asked hard questions” but could not provide any answers, was similarly weak-sauce. “Love me as I am” was wrong, or at least not as universal as people thought, but if so, what was the correct way to love? Where did unconditional love fit in? What sorts of love were supposed to be conditional, and if they were conditional, were they less of love? She let her eyes gaze into the flat black of the night while her mind wandered through these philosophical groves.</p>



<p>The door opened, and Doran put his head out. “May I join you?”</p>



<p>“Yeah,” she said. He stepped out and closed the door. “Did you survive the interrogation?”</p>



<p>“I think so,” he answered as he took a seat next to her. “I told your dad I intend to date you casually until you get bored with my dumb ass and throw me back.”</p>



<p>“You did not!”</p>



<p>“Okay, not really. I told him I planned to respect your choices and not pressure you to do anything you don’t want to do, but I think you’re really special and… well… we’re kind of waiting and seeing.”</p>



<p>She looked at him for a long moment, blinked a couple of times, and then turned to the night again. “Yeah,” she said.</p>



<p>After a pause, he added, “It kind of makes me think, though, that maybe we should figure out where this is going. Yes, I know that sounds dangerously close to TV talk, but after our talk today…”</p>



<p>“Yeah,” she said. She looked down at her coffee. “So what are your intentions toward me?”</p>



<p>“Well, I kinda think I should be asking you that,” said Doran. “What are your intentions toward me?”</p>



<p>“I guess that depends.”</p>



<p>“On?”</p>



<p>“Your answer to what we were talking about earlier. You said you wanted to give it some thought. Are you ready to tell me what you think?”</p>



<p>“Huh,” he replied. “Well, actually, I did have an idea about that.”</p>



<p>He had her attention.</p>



<p>“Well, I was thinking, maybe each of us trying to get the other into our thing is not really the right answer. So I was thinking, maybe, for fitness, we could both join one of those power-workout gyms. I’ve never done anything like that, or any lifting, so it would be new for me, too. We’d both be pretty much starting from scratch. And if there’s something you want to try on the technical side you haven’t done before, we could both get into that, too.”</p>



<p>“Robotics.”</p>



<p>“Robotics?”</p>



<p>“Drones. I always wanted to try flying a drone.”</p>



<p>He considered it. “Drones are pretty cool. So what do you think? We start new things, as a couple, that force us both out of our comfort zones.”</p>



<p>“I think it’s sweet,” she said. “I like it. Is this… are you willing to give this a try?”</p>



<p>“Of course. I’ve still got some elective credits to spend, too. I could do, like, an engineering course. I think it would be interesting. And I’ve always wanted to see if I could get bigger.”</p>



<p>“Not necessary, but I’m not opposed,” she said in her mind. Out loud: “This is the nicest thing anyone has ever done for me. You’re… you’re really good to me. I really do worry I don’t deserve it.”</p>



<p>“Well, that’s what you were talking about before, right? If we’re not going to just love each other as we are, then we should both work to be the kind of people who deserve each other.”</p>



<p>“I like that.”</p>



<p>“So now can you tell me what your intentions are toward me?” he asked.</p>



<p>She giggled. “Okay, well… I think let’s see how this plan goes, and if we both enjoy, uh, getting out of our comfort zones together, as a couple.”</p>



<p>“And if we do?”</p>



<p>“Then, you know, I could see us talking about… future plans….”</p>



<p>He exhaled. They were quiet for a while. “It is hard to put the name to it, isn’t it,” he said.</p>



<p>“What?”</p>



<p>“The ‘future plans.’”</p>



<p>“Yeah.”</p>



<p>“Well…” He hesitated for another long moment, and she could tell he was making sure of himself. “If we do, y’know—if this plan does work out, then I would also be okay with talking about ‘future plans.’”</p>



<p>Her heart made its way into her throat. “Really?” she all but choked.</p>



<p>“Yeah,” he said.</p>



<p>Melody stood up, her heart pounding. She stepped over to him, settled down into his lap, and kissed him on the mouth. He kissed her back, in a way that again made the whole chilly autumn night flutter away, so that she was very surprised when all of the porch lights suddenly came on.</p>



<p>“Oh, my God, I am so sorry!” said her mother from the door. “I didn’t—the lights were off, and I just—should I turn them back off? I could—”</p>



<p>Doran was chuckling through his nose, and Melody found herself laughing uncontrollably. “No, no, just leave it on. You can come out and sit with us if you want. We were about done making out.”</p>



<p>“We were?” asked Doran, sounding a little disappointed.</p>



<p>“We were,” she said, standing up again.</p>



<p>“Oh.”</p>



<p>“Oh, you!” said her mother. “No, I was actually getting ready to go to bed. I just wanted to say good night. Your father is still up, though.” She lowered her voice a little. “If you keep smooching, maybe he’ll come out and you can scandalize him, too.”</p>



<p>“Okay, Mom, we’ll keep that in mind.”</p>



<p>“Just an idea. Good night, sweetie. Doran.”</p>



<p>“Night, Mom.”</p>



<p>“Good night, Mrs. Ritter.”</p>



<p>As Mrs. Ritter closed the door and retired, Melody moved back to her chair and sat down, giving Doran a lingering smile which he reciprocated. Maybe the monster was wrong, or at least its perspective was wrong. Maybe an imperfect life could still go this well, if one simply tried. Melody took up her mug of coffee and sipped it as she resumed her contemplative gazing into the night.</p>



<p>Melody narrowed her eyes.</p>



<p>Melody shot to her feet so quickly that her chair fell against the window behind her and her coffee spilled over her hands, fortunately now only warm rather than hot. She did not notice.</p>



<p>“Are you all right?” exclaimed Doran, staring at her.</p>



<p>“Do you see that?” she whispered. Melody felt herself shaking. She had never experienced this kind of cold, clutching sensation inside her.</p>



<p>“What?” he asked, rising as well and looking where she was looking.</p>



<p>“Right there. That tree. Is that—Is that a person?” With the porch lights on, the overall glow of the porch reached further into the yard, illuminating a few of the nearer trees and just revealing a few more at the edge of vision. Melody had had the opportunity to spend holidays here several times over the past few years, and she knew the trees well enough—not with photographic recall, but well enough to know that none had a branch like that, hanging down like the arm of a man in silhouette, but a little too long, and too high, and shaped not quite right to be a human arm.</p>



<p>It was more than that, though, more than just an errant feature of a silhouette that might give the impression of a person. She could feel it. Every nerve in her body shivered in absolute conviction of a presence, like a man but—she knew in her heart—not a man. Right there, not twenty yards away.</p>



<p>“What is that?” asked Doran, now almost whispering as well. “Hey!” he shouted. “Who’s there?”</p>



<p>“Dad!” called Melody. “Dad, there’s someone in the yard!” It had to be a someone. The clutching feeling in the pit of her stomach could not be right.</p>



<p>“What?”</p>



<p>“Get a flashlight! I think there’s someone in the yard!”</p>



<p>A shifting of nearby shadows told of her father moving about inside the house, and then the door opened and a cold flashlight beam accentuated the warm glow of the porch and interior lights, a little brighter, but not as bright as Melody and Doran would have liked. The beam flicked about, playing over the tree trunks. “Where?” asked her father, taking a place next to Doran. The weak, white cone passed across the tree, and Melody’s heart skipped a beat. It came back instantly, even as Doran snapped, “There.”</p>



<p>Her father fixed the beam on the tree. He had seen it too, and now they all stared. The tree was as it was supposed to be, a pale trunk of bark texture, crisp and cold where the electric torch light fell upon it. But there was something else there, something suggested by the shape of the tree, or perhaps by some subliminally detected distortion of the dull glint of her father’s beam. They couldn’t see it, but they could all feel it.</p>



<p>“Who’s there?” her father demanded, as Doran had done. None of them dared heed the animal instincts which told them it could not be a “who.” “Hold this,” he ordered, handing Doran the flashlight. Its beam bounced.</p>



<p>“Oh my God,” squeaked Melody, covering her mouth with one hand. It was gone. By the time the beam returned to the tree, it was gone. And that proved to her senses beyond a shadow of a doubt that it had been real. Melody felt cold throughout her body. She felt herself shaking uncontrollably.</p>



<p>“Mel, get inside,” said her father. “Get inside and call the police. Who’s out there?” he shouted. “We’re calling the police!” To Doran, he said, “I’m going to get my shotgun. Keep that light on, see if you can find it. Him.”</p>



<p>“Yes, sir.”</p>



<p>Her father ushered her inside, almost shoving her through the door. “Go. Call ‘em.” He, meanwhile, hurried toward his study. Melody’s mother appeared from the first-floor master bedroom in her nightgown. “What’s going on?”</p>



<p>“There’s… someone in the back yard,” said Melody. “Dad’s going to get his shotgun just in case. It’s probably nothing, but we’re calling the police.” It’s probably nothing. Someone in the back yard. Getting the shotgun.</p>



<p>Melody found she could barely find the right buttons on the telephone’s keypad. Her hands were shaking violently. It had not been a person. It had not been physical. There were no such things as ghosts, but that was not a ghost. That was something more. A presence. This was what terror felt like.</p>



<p>“…your emergency?” the voice on the other end of the line was asking. At some point the call had connected. “Can you hear me?”</p>



<p>“There’s someone in our back yard!” Melody burst out. She had never experienced her own voice quivering like this.</p>



<p>“Okay, ma’am, I understand. Tell me your address.”</p>



<p>“Eleven twenty-one Pikeville Road.”</p>



<p>“That’s one one two one Pikeville Road?”</p>



<p>“Yes.”</p>



<p>“Is that Royston? Four-four-two-two-one?”</p>



<p>“Yes!”</p>



<p>“All right. Did you see the person in the yard?”</p>



<p>“Yes! Kind—” Kind of? What sense did that make? “—of. He was by a tree. Please hurry.”</p>



<p>Her father went past her, shoving shells into his shotgun while his wife looked on in shock. As he stepped outside, she turned her wide eyes on Melody.</p>



<p>“I understand,” the dispatcher was saying. “I’m sending a police unit now. Are you safe right now, ma’am?”</p>



<p>“Yes.” Quivering and quavering. “I’m inside. My dad and mom are here, and my boyfriend.”</p>



<p>“Okay, I want you to stay inside. Do not go outside or look for the person. Can you describe the person you saw?”</p>



<p>“No, we just…” What could she say? “It was too dark. We couldn’t see him very well, even with the flashlight.”</p>



<p>“But you’re sure it was a man?”</p>



<p>No. “Yes.”</p>



<p>“Race?”</p>



<p>“I’m not sure. He seemed really tall.”</p>



<p>“I understand. Just one individual?”</p>



<p>She froze and stared in abject horror at the back windows, and the backs of the two men on the porch, and the black night beyond. The idea that there might be more than one made her unable to breathe.</p>



<p>“Ma’am? Did you see just one, or more than one?”</p>



<p>“Just one,” she managed through a choking throat.</p>



<p>“Okay. It’s going to be okay, ma’am. Stay inside. The police will be there in just a few minutes.</p>



<p>Can you describe the house?”</p>



<p>It took Melody a moment to understand the question. “The house?”</p>



<p>“Yes, ma’am. Is it a two-story house, or one story? Is the yard large? Is there any gate or access code the officers will need?”</p>



<p>“There’s a gate.”</p>



<p>“At the entrance to the driveway?”</p>



<p>“Yes.”</p>



<p>“Can you see if the gate is open? Are you able to open it without going outside?”</p>



<p>“There’s a remote.”</p>



<p>Her mother grabbed the remote from the dish of odds and ends on the kitchen counter and ran to the front of the house.</p>



<p>“Okay, if you can open it without going outside, go ahead and open the gate.”</p>



<p>“Okay,” said Melody. “We’re opening it.”</p>



<p>“Good. Can you describe the house, and the back yard?”</p>



<p>“Um, two story? There’s a garage on the left—I guess that’s, I don’t know, the west side? I don’t know.”</p>



<p>“That’s okay. And the back yard? Small? Large? More than an acre?”</p>



<p>“I think it’s, like, four or five acres? There’s some trees, and then the way-back is more like woods—Oh my God—No! Dad!” She could no longer see their backs in the light of the porch. The flashlight beam was out in the yard, flicking this way and that. “Hold on!” she said to the phone, and then threw it down. “Dad! Doran! Don’t!”</p>



<p>She reached the back door. “Dad, the police are coming! We need to stay inside!” She could see the two of them, now. Doran had the light, still, and was sweeping it across the yard, while her father stood next to him with the shotgun held in both hands, not quite shouldered but ready.</p>



<p>“You stay there, Mel!” her father called back to her.</p>



<p>“Dad! Doran, please!”</p>



<p>She could not hear from the house what they were saying to one another, but she could see her father gesture, and Doran point the light at his direction.</p>



<p>“Just hold on, Mel.”</p>



<p>Even as he said it, the beam flicked, and they all glimpsed, as if in a snapshot, as if caught in the blink of a camera’s flash, a silhouette between two trees, distorted, too tall to be a man, too hulking, and with arms too long, with the impression of points like horns at its shoulders and upon its crown.</p>



<p>“Oh!” cried her father, and “Fuck!” shouted Doran, in unison. Once again, by the time the light came back to it, it was gone. “Where is it?” Her father had the shotgun up. Doran searched with his light—and found it—and lost it again, a streaking shadow in the perfect black of the night. They heard a crackle of leaves and twigs. His beam caught up to the sound, to find only a low tree limb swaying at the edge of the deeper woods beyond the back yard.</p>



<p>“God damn. Get back inside. Get back inside!” shouted her father, grabbing Doran by the shirt and shoving him back while he covered their retreat with his shotgun. They backed up together, Doran on the light and he on the gun, until they reached the porch and its blessed glow.</p>



<p>“Mel, I told you to get inside!” her father snapped. “Where’s your mother?”</p>



<p>“Mom!” she shouted, dashing toward the front—but met her mother coming the other way.</p>



<p>“What’s going on?”</p>



<p>“I don’t know! There’s—There’s something out there.”</p>



<p>“Something?” Her mother took hold of her as the men slipped inside, slammed the door shut, and threw the bolt.</p>



<p>“Everyone stay together,” said her father. “Where are the police?”</p>



<p>“Oh my God!” squeaked Melody, breaking free from her mother and running to the phone. “Hello? Are you still there?”</p>



<p>“I’m still here, ma’am. Is everyone all right? What happened?”</p>



<p>“We saw it! It ran into the woods!”</p>



<p>“You saw the person?”</p>



<p>“It’s not a person!” shouted Melody, and then realized what she had said. Everyone stared at her. If she could have, she would have been staring at herself. However, it was the fact that none of them disagreed which so shocked them all.</p>



<p>“What do you mean, ma’am? Is it an animal?”</p>



<p>“No—Oh, God, I don’t know. We don’t know what it is. It’s big. Taller than a person. All black, or—I don’t know. It’s hard to see.”</p>



<p>“And fucking fast,” said Doran.</p>



<p>“How far out are the cops?”</p>



<p>“My dad wants to know how far away the police are. When will they get here?”</p>



<p>“The patrol unit is about six minutes away, now, ma’am. Just hang tight, dear.”</p>



<p>“Six minutes, she says.”</p>



<p>“Ma’am, just stay indoors. Are you armed? Does anyone in the house have a weapon?”</p>



<p>“Yeah, my dad has a shotgun.”</p>



<p>“Okay, I recommend you go into one room together and close the door. Do you have a room you can all go to that has a phone?”</p>



<p>“Yeah.”</p>



<p>“Okay, I want you to go ahead and hang up this call, and barricade in that room. Is it the same number as this? Same phone number? One two one four?”</p>



<p>“We’ll take this phone.”</p>



<p>“Okay, it’s a cordless phone?”</p>



<p>“Yeah.”</p>



<p>“Okay. I want you to go ahead and hang up, now, and barricade in there. Once the police are there and have made sure it’s safe, I’ll call you back, okay?”</p>



<p>“Okay.” Melody relayed to the rest: “She wants us to barricade, like in your room or your study or something.”</p>



<p>“That’s fine. Come on.”</p>



<p>“Okay, I’m hanging up now?”</p>



<p>“Yes, that’s fine. Stay safe and wait for my call. This will all be over in a few minutes.”</p>



<p>“Okay. Okay, thank you. Good bye. Thank you!”</p>



<p>“You’re welcome, ma’am.” Melody hung up the phone.</p>



<p>They proceeded to her parents’ bedroom and closed and locked the door. Doran checked each of the windows, first testing its security and then pressing the flashlight to the window-pane and cupping his hands around it so as to show its beam onto the grounds outside. He found nothing.</p>



<p>They all stood about. None of them wanted to sit. Her father held her mother, and Melody felt Doran take her in arm as well. She realized she was still shaking, hard.</p>



<p>It seemed that in no time, though, they heard the sound of a siren approaching, and heard it cut off as it reached their mailbox. They saw through the window red and white lights flashing as the patrol car proceeded up the driveway, and they saw the greater white glare of its searchlight probing about. It passed out of view as it drew near the house, for their view from this room was limited. They continued to wait in silence.</p>



<p>The phone rang. Melody nearly jumped out of her skin and grabbed hold of Doran’s shirt. He chuckled at her expense. It rang again. “You going to answer that?” he asked.</p>



<p>She pushed the button. “Hello?”</p>



<p>“Ma’am, this is the emergency dispatcher. The patrol unit is at your house now. They’ve searched around and found no one. You’re safe to come out of your room.”</p>



<p>“Okay.”</p>



<p>“Do you still have the shotgun?”</p>



<p>“Yeah.”</p>



<p>“Please unload the shotgun safely and leave it in the room, all right? For the safety of the officers, please leave the shotgun in the room.”</p>



<p>“Okay—Dad, she says to leave the shotgun here. The police are outside.”</p>



<p>“Okay,” he said, putting it on safe and leaning it in a corner.</p>



<p>“All right, ma’am, you can hang up, now. The officers should be knocking on your back door now.”</p>



<p>Sure enough, there came a rapping at the back door, and a call of, “Police!”</p>



<p>“Okay. We can hear them. Thank you. Thank you so much! Thank you.”</p>



<p>“It’s my pleasure, ma’am.”</p>



<p>She hung up. When she went out to the great room, her father had already admitted the two patrolmen, and they were conversing.</p>



<p>“…sure it was a man,” her father was saying. “Maybe some kind of costume, or maybe the light just played funny with the shadows, but it was definitely a man. I can show you right where he went.”</p>



<p>&nbsp;“All right, sir, if you can show us that, we’ll look around a bit more.”</p>



<p>“Yeah. Right this way.”</p>



<p>Melody felt much better, now. She felt much better about her father going out there with the two uniformed policemen at his side. Having the police here made things normal, which meant that what they had seen almost certainly was something normal. They were not dreaming; this was not a fantasy. The police were here, and this was reality, and what they had seen was some terrible illusion that had sparked deep, primordial fears inside the most animal parts of her. It had been the sort of illusion, the sort of circumstance, that inspired ghost stories and monster myths in ancient eons before humanity knew any better, but she could believe now that an illusion was all it was.</p>



<p>Her father returned. The police were out for a while, searching about. Occasionally she caught glimpses of their much more powerful flashlights glinting through the woods. Her mother made a pot of coffee, and no one turned down a cup. No one dared converse while they waited. None of them wanted to speak, because none of them wanted to describe what they had seen, as it surely could not have been. Instead they sat together as couples, sipping at their mugs in silence.</p>



<p>Eventually the two policemen returned. They had found nothing significant, they said. Whoever it was, he had almost certainly been frightened off at this point, but they would continue to send patrol cars through the area over the course of the night, just to make sure. “Try to get some rest,” one of the officers recommended.</p>



<p>They departed.</p>



<p>“Well! That was scary,” said Mrs. Ritter. “I’m just glad it turned out to be nothing.”</p>



<p>“Yeah, you and me both, hon’. I don’t know how I’m going to get back to sleep tonight,” said Mr. Ritter.</p>



<p>“I bet you’ll be asleep before your head hits the pillow,” said Mrs. Ritter.</p>



<p>“Well, I’m not shaking anymore,” said Doran, “so I’m going to lie down and hope for the best. You heading to bed?” he asked Melody. She nodded.</p>



<p>“All right, then. Mr. Ritter, Mrs. Ritter. Uh… Mr. Ritter, I’m sure whoever it was is long gone, but I’ll feel better knowing that shotgun is still loaded and you’ve got it close.”</p>



<p>“Oh, there’s no question. Don’t you worry.”</p>



<p>“All right. Sir, ma’am, good night. See you in the morning.”</p>



<p>“Good night, Doran. And good night, sweetie. Try to sleep, okay?”</p>



<p>“And Doran,” added her father, “good work, tonight. You’ve got courage. That’s good.”</p>



<p>Doran laughed, a sound more of skepticism than of humor. “Thanks, Mr. Ritter. I’ll just be upstairs changing my shorts.”</p>



<p>Her father laughed as well. Doran held out a hand to Melody. She exhaled and took it, and he led her upstairs. They separated, he observing that the whole incident had left him with enough of a sweat that he needed a shower.</p>



<p>A strong part of Melody did not want to let him out of her sight, and for a fleeting instant she even considered following him into the shower, but no, that was silly. That was something a character in a TV show would do. She was not that needy.</p>



<p>When he came out, she was in her pajamas, holding her pillow and blanket, standing in his room.</p>



<p>“Can I sleep with you, tonight?” she asked.</p>



<p>His mouth fell ajar. “Uh, yeah. Absolutely! Of course.” There he stood in the door, in his boxers and a t-shirt, towel in hand, like a deer in the headlights.</p>



<p>“I don’t mean, like…”</p>



<p>“No no, I know. I know the drill. It’s okay. I want you to stay. It’s fine.”</p>



<p>“Okay.”</p>



<p>He turned out the light, and she settled in with him, keeping a blanket between them. She could only imagine what he thought of her, taking advantage of him like this. &nbsp;Like some kind of religious puritan from the days of yore. It probably would be impossible for him to understand, and to understand what a concession this was.</p>



<p>She had never spent the night with a man before. He immediately put one arm under her, cradling her head on his shoulder, and the other over her, holding her close. His body was hard, and sort of angular and lumpy, but it was warm, and it smelled good, and she felt safe.</p>



<p>“Thank you,” she said.</p>



<p>“Don’t mention it,” he said. If she was aware of what was going on in his nether regions, she never let on. They eventually fell asleep.</p>
`,
  },
  {
    wp_id: 387,
    slug: "the-ride",
    wp_date: "2021-04-29 15:39:15",
    excerpt: "",
    content: `
<h2>An excerpt from the new novel, <span style="text-decoration: underline;">Outsiders</span>, by William Collier</h2>



<p class="has-drop-cap">It is one of those peculiarities of military air travel that, in a cargo aircraft, one often sits with one’s back to the side bulkhead, facing perpendicular to the aircraft’s direction of travel, such that as it accelerates or decelerates, one is thrown sideways into one’s neighbor. It was one of the peculiarities of Melody’s life that she had first experienced that phenomenon in an alien vessel, and at least that aspect of her first ride in a domestic military cargo plane was not so novel. The pilots applied the brakes, and she grabbed the seat netting over her shoulder as the aircraft’s deceleration shoved her against Lars’s shoulder.</p>



<p>There had been no conversation during the flight. The cargo bay of the plane was much too loud, such that they had advised her to wear earplugs. Thus had Melody passed the several hours’ flight in this eerie, empty belly, lined along both sides with a jumble of nets, folded structures, ladders, tools, and mysterious markings and numbers, all lit in a dim, pale green light and filled with the drowning drone of engines made distant by the foam plugs filling her ears. Her experience of it was surreal and ghostly, as if she was riding along in someone else’s body. At least she was warm enough. During the flight, the air in the bay had grown cold and crisp, but all of them were dressed in dry-suits over thermal long underwear.</p>



<p>The dry-suit was a thoroughly new experience for her, a rugged jumpsuit made of something like vinyl, complete with integrated booties, strong rubber cuffs which sealed around her wrists, and a similar rubber collar so narrow that she had only managed with help to get her head through it, and which thereafter clung about her neck so tightly that for the first little while it had felt as if it was threatening to choke her, though it never did. By now, she had forgotten about it. The thermal underwear they had provided was warm enough inside this air-tight plastic bag that just the process of boarding the plane with her luggage had been enough to make her break out in a sweat. (Where they were going, she had been told, the weather was warm, but the water was still quite chilly.) Once the air in the plane had cooled, though, she had found herself comfortable overall, and particularly grateful for the warm gloves and socks they had given her for her extremities. The worst part of being cold, to her mind, was that rubbery, icy feeling of frozen fingers and toes.</p>



<p>As it was, her greatest discomfort by the time they had landed was the pain in her legs from sitting on a seat that was little more than a nylon net stretched across an aluminum frame. She desperately wanted to stand up and relieve her muscles, and it seemed to take a very long time for the aircraft to taxi to a stop. &nbsp;While it was still rolling, the lights went out and she saw the rear ramp crack open and begin to lower, revealing the pitch-black night outside. Warm air flooded in, relieving the chill of her face. As the ramp opened, the roar of the engines swelled a little, but that was still well-muted by her earplugs. Around her, the others began donning their helmets and lowering their night-vision devices and ear-cups, so she did the same. Her NODs rendered the world in bright shades of gray to which she now was well-accustomed after her forced march across the countryside of only a week prior. So much of this had become familiar so quickly, out of necessity, that it made her feel all the more like a ghost in a stranger’s body, a stranger’s life.</p>



<p>When they stood, she stood—before the aircraft had completely stopped rolling, which also felt very strange after a lifetime of commercial flights and their attendant instructions to the contrary. While she was picking up her bags, the aircraft made a very sharp turn, seemingly pivoting about one of its wheels, and she grabbed the netting again to steady herself until it straightened out and stopped with a bump of seizing brakes. The men shouldered their bags and Lars—she was beginning to be able to tell them apart, even in all this kit and with their faces hidden behind the projecting tubes of their night-vision goggles—watched her, making sure she had everything and was steady before giving her a thumbs-up. She returned the gesture, and he waved for her to follow the others, who were already walking toward the rear ramp. There was still no point in trying to talk over the loud hum of the engines.</p>



<p>The ramp finished lowering and they marched down onto the dark tarmac—or rather, the tarmac which would have been dark to the unaided eye. To her vision, the whole airport was laid out before her, a gray lot of asphalt and beyond that a black field bespangled with lights small and large, under a sky filled with ten times or a hundred times the normal density of stars. Melody saw another soldier standing off to one side, in more traditional military dress, rifle in hand, keeping watch through his own NODs, and aircrew pulling a few trunks of cargo off the ramp behind her. Ahead, not very far away, was a helicopter, its dark form squatting low on the tarmac. She could not see its spinning rotors, but the paths of its blade tips appeared to her to be traced in white fire. A thin ring of light outlined the invisible disk of the main rotor, and another, smaller ring stood vertical beside the helicopter’s tail fin. Melody stared at the sight, so taken aback that for a moment she forgot to walk, until Lars gave her a gentle bump from behind. She started forward again, hurrying after Yates and Pete, who were marching like silent figures through this wild lightscape. The droning roar of the cargo plane melded into the very different but just as overwhelming droning roar of the helicopter.</p>



<p>Melody glanced back. The cargo plane towered behind her, a dark silhouette blotting out the lights of the airfield in that direction.</p>



<p>That was the other thing that made it all so strange, she realized: there were lights everywhere except on the aircraft themselves. There were no lights on the wingtips, no lights on the tail, and certainly no bright landing or taxi lights illuminating the tarmac in front of its nose. Likewise, there were no running lights of any kind on the helicopter. The only light it made was by the seemingly supernatural blaze tracing the flight of its blade tips. She tilted her head away, looking past the rim of her NODs to see if that fire was visible to the naked eye, and it was, but so very faintly that she might not have noticed it had she not known to look for it. Through her goggles, meanwhile, it was stunning.</p>



<p>Another man stood just outside the rotor arc and gestured for them to proceed to him and then, from him, toward the helicopter. Perpendicular, she noted, just like the Penguin. Approach from the side. The aircrewman directing them was wearing armor and night-vision goggles of his own, though his helmet was of that classic flight-helmet design, more round and covering the whole of the head. He had a microphone at his mouth, and she saw a cable trailing from him all the way to the helicopter’s open side door. He was saying something, though she could not hear what. He looked down at her and gave her a nod and a wave to continue. Melody ducked her head and passed under the rim of sizzling white light, jogging to the open door. As she went, she glanced to the left and saw through a window the silhouette of the pilot on the near side of the helicopter cockpit. He too was wearing a large flight helmet with night-vision mounted. He glanced over at her and then went back to whatever he was doing. Ahead, Pete and Yates were already aboard and strapping themselves into seats, and another aircrewman there took her bag and pulled her by the arm up into the helicopter’s interior, such as it was. There was only enough vertical space for her to stand bent over, her head-gear knocking against the ceiling and against a tubular metal bar mounted to the ceiling across the width of the cabin. With the sliding door wide open, and forward of that the windows open with a machinegun mounted on the sill of each, the interior of the helicopter felt even more than the cargo bay of the airplane as though it were but a thin shell or frame, a minimal structure just sufficient to stow cargo, even if the cargo was people. The seats were minimal, too, and in a similar style to that of the plane, being in this case thin fabric stretched taught over metal bars. The aircrewman directed her to hers, and once she was seated he took the liberty of pulling out the straps of her restraint harness, plugging them into the round hub of the buckle in front of her, and then pulling out their slack so that the buckle rested tight against her chest.</p>



<p>It took only a few seconds more for Lars to board and find his seat, while the aircrewmen convened and secured the last of the cargo, including the hard plastic cases which had come off the plane with them. The last of the crew climbed in, and a moment later the helicopter began to roll. She had never really thought of a helicopter rolling, but of course it would, if it had wheels, as this one did. She saw the asphalt and lights outside the still wide-open door begin to slide past, and then to swing around them quickly as the helicopter made a turn on the ground and proceeded out toward the runways. At last the aircrewman by the door slid it shut and latched it, and then he moved past her, through the tight confines of the compartment, to his seat at his window and its machinegun. Melody looked out through the windows at the bright (to her goggles) rows of lights marking the runways, and something in her must have made the assumption that a helicopter taxiing on its wheels would taxi to a runway for take-off, like an airplane, because she was very surprised when at that moment the aircraft, only just reaching the taxiway, leapt off the ground, pressing her into her seat as it did and the lights outside dropped away. Then the world tilted, the helicopter dipping its nose and accelerating, and it occurred to her that she was facing backwards, and that facing aft in an aircraft was just as strange in its way as facing sideways, though not so awkward. The force of acceleration pressed her against her harness, as though trying to throw her out of her chair, but it did not pile her onto her neighbor. Then came a shudder which rattled the whole airframe as if something had come unbalanced in the rotors, causing her to grab hold of her seat in fright, but the shudder passed, the roar of the rotors faded a little, and the world of lights fell away as her chariot climbed into the night sky.</p>



<p>Melody took a deep breath and exhaled, trying to release her jitters. What a strange symphony of new sights, sounds, and sensations, such as she would never in a million years have imagined, much less have expected herself ever to experience. The helicopter raced across the dark landscape, and as it settled into its cruise, the aircrewman by the window near her turned and began sorting through some cables hanging from the very low ceiling. He reached over to her, fished out a lead hanging from her headset, checked the end, and then retrieved an adapter and connected her to the helicopter’s intercom system.</p>



<p>“ICS check,” she heard his voice say in her ear, thin and compressed. “Give me a thumbs-up if you can hear.”</p>



<p>She gave him the sign.</p>



<p>He held up the connector by which he had hooked her into his system and showed her the button on it. “Squeeze that to talk.”</p>



<p>Melody pulled down her microphone and squeezed the button. “Test test.”</p>



<p>“You’re going to have to kiss your mic,” he said, pressing his own microphone to his lips in demonstration. She did the same and tried again.</p>



<p>“Test test. Comms check.” Her voice sounded mechanical in her ears, like someone else’s voice, coming through digital radio.</p>



<p>“Loud and clear. Miss Ritter, right?”</p>



<p>She nodded. Squeezed the button. “Yes.”</p>



<p>“Welcome aboard. I’m Tech Sergeant Kline. I just need to brief you on a few things. Normally we’d do this before you boarded, but we were going for minimum time on deck. You’re already briefed on the flight plan, right?”</p>



<p>“Yeah.”</p>



<p>“Okay, then this is just your safety brief by exception. Have you flown in one of these before?”</p>



<p>She shook her head.</p>



<p>“No problem. You’re already in and strapped in. In case of emergency, stay strapped in, feet flat on the floor, and sit back with your head against your seat back. You can hold onto your harness straps if you want. If we land hard, your seat will stroke down to absorb the impact. Once all violent motion stops, you can release your harness. Just twist that knob on the front there, and then make a circling motion like this.” He pantomimed with his hands, twisting an imaginary knob with his fingers and then moving the imaginary knob around his stomach in a tight circle, as if rubbing his belly. “All the buckles should pop right out. Your exit in an emergency is that window there.” He pointed to the big window embedded in the sliding door by which she had entered. “Don’t try to open the door. Grab this lever—” He put his hand on a lever set into a recess in the door. “—and swing it to the other side, and then push the window out. It’ll come right out. Then climb clear. Watch for the rotors. If the helicopter is rolled, so this side is closer to the ground, go out the high side instead. Got it?”</p>



<p>None of this could she say was making her more comfortable, but she understood and indicated as much.</p>



<p>“Roger. In the case of a water ditch, make sure you stay strapped in until all violent motion has stopped. Hold your breath and let the cabin fill with water. Once violent motion stops, unstrap, then go for that window, push it out, pull yourself out, and swim to the surface. And remember the helicopter will roll over as it sinks, and everything will be upside down, so the handle will be on top, above the window.&nbsp; When you unstrap, hold onto your seat with one hand and go hand-over-hand to the window, and feel above it for the handle. It should be illuminated, which will make it easier to find. Once you get to the surface, inflate your LPU like you were taught. Any questions?”</p>



<p>Discomfort had given way to genuine fear. She fumbled a little with the button. “No questions,” she said, through a slightly dry throat.</p>



<p>“Of course we’re not expecting anything to go wrong, but just in case. Anyway, as far as when we get there, they briefed you on hoisting ops, right?”</p>



<p>She nodded. To her newfound fear of flying in a helicopter was added an acute clutching in her stomach at the thought of how it was to deliver her. They had explained to her how it would go, but there had been no opportunity for proper demonstrations or practice.</p>



<p>“Okay. Once we get into a hover, I will come get you and hook you up to the hoist, and I’ll help you out. Once you’re hooked up, just hang onto your vest and settle into your harness. It’s a piece of cake.”</p>



<p>Melody nodded again.</p>



<p>“All right. We’ve got about an hour en route, so relax. Feel free to get some sleep. I’m going to disconnect you, but if you need anything, just give me a slap on the arm.”</p>



<p>“Thank you,” she said.</p>



<p>He gave her another thumbs-up and then disconnected her comms lead from the aircraft’s ICS cable, stowed it, and settled into his seat behind his gun.</p>



<p>Melody looked out the window again, but there was nothing there to see, now. Only darkness, as if they had left space itself behind and were flying outside the universe. She leaned her head back against the canvas seat—which was much too vertical to be a comfortable back- or head-rest—and closed her eyes. There would be no sleeping. The helicopter struck some kind of swirl in the air and jolted, and she felt a shock of adrenaline go through her. His “safety brief” had entirely ruined the helicopter experience for her. She could only ride along in the dark and try not to think of what awaited her at the far end of the transit. The air flowing in through the open windows began to cool, and she realized she had been sweating again. Once again, the chill was welcome.</p>



<p>Visions rolled in and out of her mind’s eye of what lay ahead, along with ideas about the mission and what might be coming. She tried to focus on the objective, on Tom and on the process of rendezvousing with him, securing the information in his possession, and how she might deliver it to the rest of the team and to the Internet at large. She thought through various contingencies—hacking into a local WiFi network, using a stolen computer, having to defeat a local or national firewall in order to reach the Internet—and the tools she had brought with her for each. This was the realm of problems with which she was equipped to deal, and it was useful to distract her from her present circumstances.</p>



<p>What seemed a very long time later, she heard the sound of the helicopter change again, and she felt it ever so slightly drop out from under her, beginning a descent. The air became warm and filled with a new aroma. This was the scent of the sea, but it was different from that she remembered of visits to the beach in her youth. There was in it no note of the shore, no tidal rot, no seaweed, no marsh grass. There was only the smell of salty ocean air.</p>



<p>Someone shouted something, though she could not make out what. She glanced around and saw her companions looking to the aircrewman in the other gunner’s seat, on the far side of the cabin and out of her view. To whatever he was saying or whatever signals he was giving they nodded.</p>



<p>The helicopter’s roar grew louder, and louder, and she felt a very slight press into her seat back, and then the helicopter began to shudder, at first gently but then with more and more violence over the span of a few seconds. She gripped her harness tight and watched the others, but they seemed to be taking it all in stride. Indeed, Lars, Pete, and Yates were unbuckling their harnesses and making final checks of their gear.</p>



<p>It felt like an earthquake, or like the whole machine was coming apart.&nbsp; How could they just ignore it?</p>



<p>Suddenly, the shuffling shudder of the helicopter fell away, replaced by a steady, sharper vibration. Melody looked out her window, but still all she could see, even with her goggles, was a black void. She kept her harness firmly fastened.</p>



<p>The aircrewmen released themselves from their gunner seats and crawled past their passengers to crouch by the doors and begin making various preparations. Then, much to her dismay, on the opposite side of the helicopter, the crewman there unlatched the door and slid it open wide, revealing more of the blackness of empty space beyond. There was no sign of the sea or sky out there. The roar of the rotors poured in, considerable even through the double barrier of her headset and foam ear plugs. She watched as the crewman, heedless of the precipice inches from his feet, reached up to the metal bar on the ceiling and began fiddling with it. After bumping her helmeted crown on it once during boarding, she had forgotten all about it. He attached a large rope to it, unlatched something, and then stood and threw the end of it out, and it extended itself out the door of the helicopter, taking the rope with it. The crewman stood, then, bent under the low ceiling, one hand on the bar, his other hand held out to one of her companions—Yates or Pete, she could not tell which at this point. His gesture was a “stay” signal, and he held it for a moment. He seemed to be looking out the door and down at something she could not see.</p>



<p>A shift in the forces around her told her the helicopter was maneuvering. She felt herself pressed sideways, first one way and then the other, very gently, and then the aircraft stabilized, still rattling and vibrating.</p>



<p>The aircrewman kicked with his foot the coiled remainder of the rope, pushing it out the door and off the edge, so that it fell away into the dark and hung down from the end of the metal tube. He looked down a little longer, this way and that, and then waved a “come on” command to the first of her teammates. As she watched, astonished, the latter reached out, took hold of the rope, stepped out of the helicopter, and dropped out of sight. Only seconds behind him went the next, and then Lars, departing his seat next to Melody, swinging out the door, and sliding down. Suddenly they were all three gone, and she was alone in the helicopter aside from its flight crew.</p>



<p>She had seen this sort of thing in movies, of course, and videogames, but to see it now, for real, in this pitch-black void, was so disturbing that it made her queasy. The aircrewman by the rope pulled a release of some sort, and the rope disconnected and fell away.</p>



<p>Just then, the other crewman pulled open the door on her side—only a couple of feet away—and then clambered over toward her. Melody felt the knot in her stomach go critical. He gave her a thumbs up.</p>



<p>She replied with a nod, against every screaming instinct inside her, as her eyes fixed on the edge of the cabin deck and the empty outer space beyond. He reached out to her and unfastened her harness, and she gripped her seat hard with her hand. When he beckoned for her to stand up and move toward him, it took her several seconds and a considerable act of will to obey. To move toward that opening, toward that fall, was as unnatural a thing as she had ever done.</p>



<p>He took firm hold of her, though, as soon as she was on her feet, and kept that hold as he ushered her toward the door and stood her still by his side. The other aircrewman moved up behind her and took hold of a control module hanging from the ceiling by the door. She saw the one in front of her reach out for something and pull it in. A hook. He took hold of the hoisting ring which formed the central link of her harness over her chest and connected the hook to it.</p>



<p>Melody felt ill. Her entire body was shaking.</p>



<p>He leaned in toward her. “Ready?” he shouted in her ear.</p>



<p>She shook her head quickly, and heard him laugh.</p>



<p>“You’re fine,” he shouted. His voice was so small and far away, through all those layers of hearing protection and the cacophonous roar of the aircraft. “Go ahead and sit. Sit down into your harness.”</p>



<p>Gingerly, Melody bent her knees, settling herself down into her harness, and felt it support her as the slack went out of the cable attached to her chest. Of course, that cable was anchored at its other end to the hoist outside, and as soon as she settled her weight into the seat straps under her buttocks, she began to swing toward the door. Before she could stop them, her hands had reached out to snatch for the crewman.</p>



<p>He peeled one of her hands away and placed it forcefully across her chest, by her armpit. Melody remembered what they had told her and complied, forcing her other hand to release him and then hugging her chest with both arms as tightly as she could, while he turned her around and pushed her out the door.</p>



<p>Suddenly she was dangling in space, battered by the gale of the rotors above, and terror and exhilaration swelled through her, overwhelming everything else. She must have yelped, but she could not even hear herself in the moment.</p>



<p>There was a sudden jerk, and then she felt herself begin to descend. She hugged the chest straps of her vest with hands which gripped so tight they might have been petrified, and she looked down. Below her, like a leviathan, inconceivable in its size, stretched a vast dim hull, low and flat, curving down into the black water to either side. The place where she would land was lit as by a bright spotlight, though only through her NODs could she see it. She could also see the partial circle of white spray kicking off the water to one side of the submarine. She rotated slowly in space as she descended, and the massive conning tower came into view, rose up, loomed over her, and then passed away behind her as she continued to turn at the end of the hoisting cable.</p>



<p>Below her, the deck of the submarine rose, spread, became solid to her vision in some way she could hardly comprehend, and she saw people there, reaching up for her. The hands grabbed her legs and then her harness, stopped her slow spin, and lowered her all the way down, until she was sitting and then lying on her back on the ship’s metal surface. They disconnected the cable from her, and above her she saw only a singular bright, blazing light, the helicopter’s infrared spotlight, hovering in space, as the hook snaked up and disappeared in the glare. Hands lifted her to her feet, and then one of the men began physically ushering her across the great steel deck to an open hatch. The last thing she saw of the exterior, as she began very carefully climbing down the ladder there—one shaking hand, one unsteady foot, one trembling limb at a time—was the submarine’s conning tower again, rising high over her in the dark like a curved, black, steel, windowless, faceless sky-scraper, like something out of science fiction. Then she was inside, all the noise was gone, and the tight confines of the ship’s belly were closed around her.</p>
`,
  },
  {
    wp_id: 465,
    slug: "rule-of-thumb-rights",
    wp_date: "2021-06-27 08:24:00",
    excerpt: "",
    content: `
<p>If you want a rule of thumb to determine whether or not a proposed right is really a right, here is a simple test:  If it requires anything of anyone else, requires any other person to give or do something, then it is not your right.  To live is a right.  To make other people keep you alive is not a right.  To choose your own behavior and thoughts is a right.  To choose the behavior and thoughts of others is not.  To own property is a right.  To make other people give you property is not a right.  To work to secure your own safety, or prosperity, or fulfilment, as best you can, is a right.  To make other people contribute to your fulfilment, or your prosperity, or even your safety, is not.</p>



<p>This is crucial.  You have a right to seek safety, to the extent that your search for safety involves actions and decisions within yourself.  You do not have a right to safety, because to be perfectly safe, you would have to control the actions of others, and that is not a right.  (And it’s a good thing, too.  Nothing is quiet as disastrous for one’s health as being perfectly safe.)</p>
`,
  },
  {
    wp_id: 591,
    slug: "how-to-read-the-bible",
    wp_date: "2022-05-23 15:12:46",
    excerpt: "Always thought about reading the Bible, or maybe tried it once or twice, but it was just TOO MUCH?  You just couldn't find a way to get your arms around it?  Allow this article to help you take another look at it.",
    content: `
<h3>Road Trip</h3>



<p>In the words of a friend, "It's a lot," this Bible.  It's a big book, a big bite to get one's mouth around.  However, if you are brand new to the Bible, you do not have to sit down and try to read it cover to cover.  If you understand what the Bible is, and what it contains, you can target certain portions for your first reading, and it will be a much less intimidating, much more approachable challenge.  Perhaps, even, enticing.  To help you do that, I'm going to approach reading it a bit like taking a road trip across the United States.  Ours is a huge country, with more to see than you could see in a lifetime.  So, how do you plan your first road-trip?  What are the important highlights, the main sights to see, on your first coast-to-coast drive?  In short, the ones that give you the best sense of what America is and how she is laid out from East to West, so that by the end you have a good feel for her, and you can go back in the future to see the places you missed, and you will know where they fit in the overall geography and history of the nation.  We're going to do the same thing with the Bible.</p>



<p>This article is for a person who is new to Christianity, or who is not new to Christianity but is new to the idea, the challenge, of personally consuming and understanding the Bible, or for a person who is looking for a way to help such a newcomer.</p>



<h2>Overview</h2>



<h3>What are we calling the Bible?</h3>



<p>First, let's talk about what the Bible is, and how it is organized.  The Bible--a proper, reputable version of it--is a collection of ancient works which together form the "canon" of two religions: Judaism and Christianity.  Here, we are concerned ultimately with Christianity, but the relationship between the latter and the former is not what most people think it is.  More on that in a moment.  For now, think of the two really as a single faith system, with the older part, Judaism, feeding into the newer part, Christianity, in an absolutely vital way.  For this reason, the Jewish canon cannot be separated from the Christian canon.  It is a vital subcomponent, a vital preface.</p>



<p>When we say "canon," we mean those texts which are regarded as authoritative and defining the core orthodoxy, the core tenets, of the religion.  There are a great many conspiracy theories about how the canonical works were selected, and by whom, but do not fear; they are conspiracy theories only.  Generally, you may regard the canonical works as having come to be so regarded organically, properly, justifiably, and without any nefarious manipulation by shadowy cabals or secret councils.  No, the early Catholic church did not just arbitrarily or for political reasons "decide" which books would be included in the Bible.  The books that form your Bible are the ones that circulated because they were known to be true by the people who were there, very early after the events they describe, or which had proven themselves over centuries (in the case of the Old Testament).  Of these there are 39 books in the Old Testament and 27 books in the New Testament, for a total of 66 which make up the one and only Christian Bible.</p>



<p>And this brings us to an important point: the book precedes the religion, for our purposes.&nbsp; Yes, the theology of Christianity was spreading orally before these works were penned, but it was the same content, and the content, the same accounts recorded in these books, defined the religion even for those earliest faithful. &nbsp;Christianity, for them and for us, is defined as the religion you get if you study the Bible.  So, you have the works that were known to the early Christians to be true, and these works encapsulated and propagated the doctrine which became known as Christianity--as opposed to the idea that there was a Christianity and a Christian church which then selected the works.  The Bible first; and then Christianity is the religion you get from the Bible.  By this definition, certain sects or cults, including such outliers as Jehovah's Witnesses and Mormons and such mainstream organizations as Roman Catholicism, are not Christianity.  They are organizations which came into existence and then established their canon by decree, selecting books to include and not include.  As a result, they have expanded collections, going so far as to canonize recognizably false translations of the 66 core books, to include additional books into the Bible (as the Roman Catholic Church does), or to canonize entirely new and recognizably outlandish volumes such as the Book of Mormon.  You can study these if you want, but study the Bible first, the 66, and really learn them.  Learn why they are regarded as true, how they are verified in terms of textual criticism, historical criticism, and theological criticism, so that you can bring the same critical eye to other works.  If you do, I am confident you will see why the core 66 so quickly became accepted in an egalitarian way by the earliest Christians under a spirit of skepticism and testing, while the rest, the apocryphal and heretical texts, had to be forced into use amongst their respective sects by religious authority figures who forbade criticism and questioning.</p>



<p>So, a globally and historically recognized list of 66 specific books make up the Bible.  But what are these 66 books?  Is it the supposed direct Word of God, like the Quran claims to be?  Or a history book?  Are these 66 books like 66 chapters?</p>



<p>In fact, if I had to liken the Bible to something else in literature, I would liken it to a NATOPS manual.  Naval Aviators will know what I'm talking about, and other aviators will know it as a Flight Manual or Pilot's/Owner's Handbook (POH).  In the world of aviation, such a manual is the be-all, end-all, one-stop-shop for information about a particular aircraft, and includes a variety of sections with different functions.  It has a section describing the history and overall design and purpose of the aircraft, another section with in-depth descriptions of its mechanical and electronic systems, another section describing its specific limitations (such as how much fuel it can carry per tank, or what the proper pressure should be in the hydraulic system, or how long the engine can operate at a certain temperature), a section describing normal flight procedures for takeoff, en-route flight, and landing, and yet another section listing specific step-by-step procedures for each of various emergency situations which might arise while flying.  Some of these sections are meant to be read through like a narrative, for general understanding and background knowledge.  Others, such as the EPs (emergency procedures) and limits, the pilot should or must memorize, perhaps even verbatim.</p>



<p>The Bible is like this.  The 66 books are a collection of individual works written over a period of nearly two thousand years.  Some of them recount historical events (as understood by the descendants of those who lived them), some record laws and practices or significant genealogies, some represent the testimony of the religious experiences of their authors (sometimes even in the first person), some collect songs and sayings which people deemed of religious importance, and some record first-hand, eye-witness accounts of religiously significant events.  Across these genres, you will find a variety of voices, including prose, poetry, and even lists.  Some books are meant to be read through, as a story.  Some are meant to be consulted at need for nuggets of wisdom.  Some passages are meant to be memorized and recited.  And others are simply there for the deep scholarship of posterity, as supporting information for very detailed theological analysis.</p>



<p>What this means for you is that, on your first go through the Bible, you don't have to read it all, just like you don't have to visit every town in the United States on one road trip, nor every battle site of the Civil War to understand its basic arc and import.  As I said before, what we're going to do here is lay out the highlights, the important sights to see, on your first journey through it, which will give you what you need to know to understand in a thorough and accurate way this "Christianity" people keep talking about, and give you enough knowledge then to go back and target any specific book which you had previously passed over, when you have a purpose for doing so.  In this guide, I'm going to walk you through the books of the Bible and tell you what most of them do, which ones you should check out on your first pass, and most importantly how they relate to each other to form a coherent picture.</p>



<h3>The Old Testament and the New, a Summary</h3>



<p>Now we get to your first practical guidance: what's up with this "Old Testament, New Testament" business?  To describe this, let me describe in brief the religion of Yahweh:</p>



<p>A very, very long time ago, according to a very, very old book, a man--a cave man, essentially--realized that there was something more going on in the world than just eat, sleep, defecate, repeat.  At the same time, God created that man.  ("Wait, did God create him, or did he discover God?  Which was it?"  Yes.  It's complicated.  This here is not the book.  This is just a guide for reading the book.  You can read the book and see what you want to think about what it is saying, and then you can read many great, scholarly explorations of its content, analyzing original language in historical context, to see what its authors most likely intended.)  In that moment, higher thought and language began amongst human beings, and from that moment forth, God had a special relationship with that particular man and his offspring, his lineage.  That relationship took the form of, or was characterized by, a series of "covenants"--agreements of the form, "I am your sovereign God, and if you do x, y, and z which I command you, I will make sure that a, b, and c happen for you," where a, b, and c are specific, desirable things--and the repeated utter failure of the humans to live up to the covenants after agreeing to them.  The first such covenant was very simple (Adam and Eve in the garden), the next (Noah) and the next (Abraham) progressively more sophisticated, with more sophisticated and specific rewards promised in each case as well (and progressively more terribly betrayed by the humans involved), and the last, the covenant with Moses, being the most sophisticated and "final" covenant, intended to last for the remainder of the human story (at least as it was understood by Moses and those with him at the time).  Note, in each case, that the covenant is made not with all mankind, but with a specific man and his family line, or in the case of Moses, a new covenant with him and the descendants of his forefather, Abraham.  Until you get to the New Testament, the covenant is always specific to a certain bloodline of people.</p>



<p>All this while, God is working on a secret plan which he does not make obvious to the men with whom he is making his agreements.  While they focus on what they will get from God in terms of land, prosperity, and progeny, and He is happy to provide them their promised reward when they earn it, His focus is on a longer-term goal at which he only hints to them in their dreams.  As the supposed final covenant, the Mosaic covenant, plays out over hundreds of years, the people of that covenant, Moses's people and their descendants, gather more and more clues from their dreams about that long-term plan and God's long-term promise to them.  Very early on they are promised a land of their own to call home, and in fact very early on they receive it, only to lose it, regain it, and lose it again, as they keep the Mosaic covenant with more or less fidelity in cycles.  But in their struggles, they also come to recognize a second, hinted dimension of God's promise to them: that some day he will cause to be born among them a leader who will help them put an end to their struggle to keep their covenant.  This leader will rise up from their bloodline, unite the people of God, perfect them in their ability to keep the covenant of God, lead them to regain their promised land once and for all, and establish in that land the seat of a final kingdom, from which God's rule will spread across the whole world, ushering in a final age of everlasting peace and joy.  In other words, they come to realize that what God is telling them in their dreams is that they will have not only a homeland and a future, but eventually a savior who will help them make that homeland and future permanent and perfect, and make it a destination not just for them but for all people.  Heaven on Earth.</p>



<p>The Old Testament is everything I said above.  Very quickly it tells the story of the creation of the universe, the Earth, and that first man, and zips through the first few covenants, all in the first book, Genesis.  It gets down to detail with the life and times of Moses and how Moses comes to be God's chosen leader for his people in the second book, Exodus, and then gets into extreme nitty-gritty minutia with respect to the final covenant made with Moses, interspersed with anecdotes from their travels, all of which takes up the next three books: Leviticus, Numbers, and Deuteronomy.  At the end of these five books, God's people finally come to their promised land.  What follows, the entirety of the rest of the Old Testament, is the thousand-year story of that people-group struggling to live in and out of the promised land and in and out of obedience to the covenant which God made with Moses on their behalf.  Over that span, from about 1400 B.C. to about 400 B.C., throughout their tortured relationship, God continues to speak to His people in dreams and by other means, building in their collective consciousness a growing understanding of the second, hidden dimension of his promise.  Then, about 400 years B.C., He goes silent.</p>



<p>He goes silent, and they are left alone, living in their promised land for now, but with prophecies to tell them that it won't last, that history is coming at them like the waves of the sea, great empires that will wash over them and eventually overwhelm their nation and scatter them.  Among these prophecies, though, remain the hints of that future savior, and especially one very specific timetable, a countdown to the savior's arrival.</p>



<p>We Christians called it the Old Testament, but it is also called the Hebrew Bible, or Tanakh, and it contains all of the sacred canon of the Jewish faith.  The Christian Old Testament and Jewish Bible are nothing more than the same collected 39 works, just printed in a different order.  The critical first five, which I mentioned above, what you might call the Pentateuch, are what the Jewish tradition calls the Torah.  Original Judaism is, truly is, this story of the relationship between God and the people with whom he made the Mosaic covenant, and their struggle to live according to His law and to have faith in His promises to them.  And it ends, does the Tanakh, as I described above: fading out to silence, and a pause, and a held breath, like a phone line that goes dead, a radio channel that falls silent.  There you sit, listening, after the last word fades, holding the headphone to your ear, and all you hear is that faint hiss of the carrier wave, a pile of promises and unfulfilled prophecies in your notebook, and the silence stretches out, and out, and out.  But the book is done.  No grand finale, no climax.  It is closed, and you are waiting for the next thing, but there is no next thing.</p>



<p>Until one day, four hundred years later, just as all the prophetic timers are running out, just as the years calculated by the wisest rabbis from deep analysis of the prophetic texts are about to expire, and the Jews are about to give up listening for any more sound on that frequency and turn off the radio forever, there comes, very quietly, a voice crying in the wilderness.</p>



<p>So begin the strange, wonderful, and utterly divisive events of the life of Joshua of Nazareth, which change the course of the future not just for the expectant Jews but for the entire human species.  So wild is this three year period that it is captured not in the sweeping style of the ancient Hebrew narratives but in a collection of eye-witness accounts, taken from letters and journal entries of the day.  So Earth-shattering and revolutionary are the events and their implications that they are simply called "the good news."  (In Greek, something like "euangelion;" in Latin, "evangelium;" in Old English, "godspel" or "gospel," meaning literally good-speak; and in modern English, "good news.")   The three most complete and reliable observer-accounts of this gospel, respected for their mutual consistency and authenticity, come to be known as the synoptic gospels, synoptic meaning they have the "same view," they agree with each other and tell the same story.  A fourth also makes the rounds, though, a few years later, written by a close personal friend of the the infamous preacher and providing unique, almost mystical insight into his teachings, along with additional authoritative detail.</p>



<p>The preaching of Jesus of Nazareth--which is to say, Joshua of Nazareth.  He was a Jew, but a Roman Jew born and raised in Roman Palestine, so his parents gave him the Romanized (Latin) version of the traditional Jewish name "Joshua."  In either form it is the same name, literally meaning "God saves" or "God rescues."  The preaching of Jesus struck the Jewish community of that area around the Sea of Galilee like a hammer and chisel.  In three years, he amassed a tremendous following and reputation, expectations that he was the One, that he was fulfilling all of the Messianic prophecies in the Tanukh, and that he might be about to usher in the promised age.  Heaven, they thought, was coming to Earth.  It was happening.  If a few things he did gave them pause, if a few things he said reminded them of some of the more challenging elements in the old Messianic verses--conflicting implications that the savior would lead and reign forever yet also would come and be rejected and suffer and die--they convinced themselves not to worry about it.  God's kingdom was nigh.</p>



<p>Then, just as suddenly as he had arisen, he died.  Which is to say, he gave himself up suddenly to the Jewish authorities whom he had steadily and ever more directly offended with his teachings, and they turned him over to the Roman government to suffer the most torturous and degrading death sentence the Empire had devised, suitable not just to punish a man with unbearable torments but to ensure that amongst all who knew him he would be utterly humiliated.  It was a sentence and method of execution reserved for the lowest of the low, rebels and rapists, people not only guilty but gross, people to be mocked to the extent they would be remembered at all.  It was meant not just to torture you to death but to turn you into a symbol of nothingness, less than nothing in death, your tattered body left aloft as an ironic banner of the Empire's invincible might and your inevitable insignificance.  It was meant to kill your memory and legacy along with your person.  So he hung on this cross (literally, in Roman vernacular, a "post" or "tree," though his probably did include the cross-member affixed as we commonly depict it today) and died, and so utter was his defeat at the hands of the Jewish leadership and the Roman government that every one of his followers abandoned him that very night.  To the last man, his closest disciples renounced him and fled from the sight of his execution, devastated, broken, and empty.</p>



<p>His body had to be taken down that night by a stranger, a wealthy Jewish man who had heard his teachings, and who still had some respect for him and for the ancient law that a Jew should not hang dead on a tree overnight.  This random stranger had the preacher's body temporarily entombed on his own property until he could see to it that the appropriate embalming rituals could be done two days later, after the Sabbath had passed.  (Jews did not perform work, even embalming, on the Sabbath.)  Hopefully, once that was done, someone who knew him might come forward to provide the customary long-term resting places (a year for the body to lie and be mourned, followed by a permanent ossuary for the bones that remained).</p>



<p>A funny thing happened in the meantime, though.  The preacher's body disappeared.</p>



<p>No one believed it, at first.  The ones who discovered the absence were women--at that time, it would have been said, "mere women," not considered in that culture reliable witnesses, and these women were reporting not just that his body had vanished, but other things besides.  Crazy things.  They were telling his disciples (the ones who had abandoned him as yet another failed, false messiah) that they had been given a message: Jesus would meet them in Galilee.</p>



<p>A little while later, he did just that.</p>



<p>Scholars to this day are at a loss to explain it, but the historical record is clear.  Jesus of Nazareth preached for three years in a small region in Roman Palestine, and then was executed by crucifixion by Roman governor Pontias Pilate at the behest of the Jewish leadership of that area.  He absolutely died, and was buried in a tomb owned by a wealthy Jewish gentleman by the name of Joseph of Arimathea.  And then, several days later, the tomb was found empty, and several days after that, Jesus began appearing to people.  At first it was just a few of his followers, here and there, but then he appeared to entire groups at once.  In once instance, a crowd of over five hundred.  And these were not just a few isolated sightings.  For days and weeks he appeared, over and over, mingling closely with his followers for extended periods.  Finally, as a seeming last straw, he appeared to a select few even of those who had despised him and fought against him in his ministry, and these men, once revilers of Christianity, were so affected by his visitation that they joined the ranks of his most devoted followers, sacrificing in some cases great wealth, privilege, societal standing, or even their lives to do so.</p>



<p>All of this, of course, beginning with John the Baptizer, is recounted in what we call the New Testament, the story of the life of Jesus of Nazareth and the immediate aftermath of his death and resurrection.  It begins with the three synoptic gospels and the fourth, the Gospel of John, and continues with accounts and letters of everything that happened after, including lessons for the new followers of Jesus and a final set of prophecies about the end of the world, the famous book of Revelations.</p>



<p>Was Jesus of Nazareth the fulfilment of the Tanakh's Messianic hints and promises?  Was he the Messiah, and if the Messiah, was he truly the Son of God, the Incarnate Word of God, "God With Us?"  While he preached they began to hope as much.  When he died, they were convinced it had all be a lie.  And when he returned, they became utterly convinced, even unto their own deaths, and the world changed.  Read their accounts, and see what you think.</p>



<h2>Roadmap</h2>



<p>All of that is a pretty good summary of the story, if I may say so.  To use the modern parlance, it gives you a sense of the "arc" of the tome, from beginning to end, and helps you understand whence comes this sense of the Bible being two books, and Old and a New.  Understand, though, that you cannot have the New Testament without the Old.  A lot of people like to think of the New Testament and Christianity as a New Religion, wiping away the fire-and-brimstone, sword-and-storm God of the Old Testament with the love-and-harmony God of Jesus.  This is wrong, quite wrong, as you will see when you really study it.  The question of Jesus, the one most important and central question, is a question of the Old Testament: Is Jesus the One who was foretold?  If he is not, then everything else is moot.  If he is, then the entire history of the Jews, the tribes of Israel, was about him the entire time.  This is the fundamental claim which you must investigate by reading the canon for yourself.</p>



<p>So, let's get to it!  All you need now is a basic guide through the individual books, and that's what follows.</p>



<p>Now, there's no law that says you have to attack the story in chronological order.  There is a strong case to be made that you don't have to start with the Bible at all.  The strongest attestation to the identity of Jesus is his proposed resurrection, so many people actually begin there.  They investigate the truth of that claim, often from extra-biblical angles.  They perform textual criticism on the New Testament, assessing the veracity of the writer Paul, and using his writings along with non-Christian and non-Jewish histories to verify the accounts of the gospels.  (See the works of Drs. Gary Habermas, Lydia McGrew, and Johnathan McLatchie among others on this subject.)  Once satisfied that Jesus did live, was crucified, did die on the cross, was buried, and must have, unimaginable as it sounds, come back from the dead, they take that as verification that this remarkable book is true.  Then they read the rest of the New Testament, and then they read the Old Testament to put the New in context (and to get the references; the Apostles of Jesus and Jesus himself were scholars of the Tanukh, and their preaching is littered with quotes from and references to the Hebrew bible, such that you can't fully understand their messages unless you can listen from a Jewish religious framework). </p>



<p>However, starting from the beginning is a sensible place to start for purposes of a map, so that's what we'll do.  What follows is NOT necessarily the path you should take through the Bible, but rather an outline which you can use to plan your path.  Since the Bible is words and not lands, my map will be given in words as well, a kind of user-friendly description.  I will begin at the beginning and work my way through to the end, so that by the time you have read through this, you'll be able to look at the table of contents of your Bible and know exactly what you're looking at, what's to be gained by reading any particular book, and which ones you want to read for your purposes.</p>



<h4>Two notes about Translation</h4>



<p>Most modern mainstream English translations are pretty darn good.  ESV, NASB, New King James.  For those fearing that they would have to read Ye Olde King James to get the real deal, that's just not true.  In fact, the new translations benefit from another hundred years or more of improvement in scholarly work and recently discovered ancient manuscripts, which have improved our understanding of ancient languages, so the New King James, in addition to being much more legible to a modern reader than the original King James, is actually a <em>more</em> accurate translation, better in the details, and others like the ESV and NASB are just as good or better.  In fact, the flagship translations are so good that, not only are they accurate enough for study, but they're accurate to a nitpicky, detailed linguistic level. If there is something to be gleaned from a particular choice of word, or tense, or choice of plural vs singular, or to which object a modifier applies in a complex sentence, you may rest assured that the English of these translations accurately reflects the same fine distinctions in the original Hebrew or Greek.  (For instance, in Genesis 3:15, is God speaking of Eve's offspring collectively, or of a singular descendent?  "He shall bruise your head" is translated in the singular to reflect that the subject of this clause is singular in the original, implying a single, particular descendant.)  So, pick your favorite from among these flagship translations and run with it.  Only at one point in the summary below will I direct you away from one of those translations, the ESV, as it misses a critical mark in translating a particular prophecy of Daniel.  For that, the NKJV, NIV, and the NASB all do it right.  I like <a rel="noreferrer noopener" href="https://www.stepbible.org/?q=reference=Dan.9|version=NIV|version=ESV&amp;options=HVGUN&amp;display=COLUMN" target="_blank">stepbible.org</a> for my Bible study, as it allows me to compare multiple translations side-by-side and see translation notes in-line, but <a rel="noreferrer noopener" href="https://www.biblegateway.com/passage/?search=daniel+9&amp;version=NASB" target="_blank">biblegateway.com</a> is better suited to simply reading, and it includes some translations that the STEP Bible site does not.</p>



<p>You may also look at something like the <em>New Living Translation</em>, which borders on being a paraphrase rather than a translation.  It is focused on making the text very approachable and legible to a non-scholar, while still conveying the doctrinal points, if not the grammatical details, correctly.  Something like that is only for a first pass, though.  My suggestion would be to use a flagship translation for the Old Testament, use <em>NLT</em> for the New Testament on your first pass only, and then return to the flagship translations for any further study of the New Testament.  The only thing you must avoid, in all of this, are versions which go off the doctrinal reservation.  Plenty of people have written "translations" which sound good and feel good but aren't actually translations in any true sense, and end up teach things that aren't in the Bible at all.  Actual heresy or just silliness.  The "Passion Translation" is an example of this kind of fraud.  If you're not sure, the translations I've mentioned above are the place to start.</p>



<p>(I say "avoid them," but I don't mean forever, really.  I direct you to the flagship translations, or a reputable paraphrase such as the NLT, because the scholarship behind these is available for you to verify.  You can confirm, using available scholarly resources or even just an interlinear resource like the STEP Bible, that these accurately reflect the ancient texts, and you can compare between them to see how consistently they do so.  Read them, familiarize yourself with the doctrines and canon, and then, by all means, check out the heretical documents and the shoddy snake-oil which passes for scholarship underpinning them.  Prepare to be astounded.  People will believe anything.)</p>



<p>One last thing: The name of God is YHWH, which most people today pronounce "Yahweh."  Among the Ten Commandments is a commandment not to use God's name "in vain," meaning "in an empty way," and ancient Jewish tradition took that so far as to mean that the name of God should not be spoken at all, if it could be helped.  (That's a human interpretation of the commandment, not the commandment itself.)  The result of this tradition was that in recitations of the Hebrew Bible, especially the Pentateuch, wherever the original text of the Bible from which they were reading contained the word YHWH, they would, instead of pronouncing "Yahweh," rather say, "Adonai," meaning in English "THE LORD."  So, even if the text said, "I am YHWH your God," they would recite it as, "I am Adonai your God," or "I am THE LORD your God."  Honoring this tradition, English written translations would, wherever the original Hebrew contained the letters YHWH, replace them with an all-caps "THE LORD" in English.  You can see an illustrative example of this in Psalm 110, in the first line which says, "THE LORD says to my Lord..."  Hover your mouse over the various words of this text <a rel="noreferrer noopener" href="https://www.stepbible.org/?q=reference=Ps.110|version=ESV&amp;options=VNHGU" target="_blank">at the STEP Bible site</a>, and you can see the original Hebrew words:  "<em>Yahweh</em> says to my <em>adon</em>...."  So, in your English translation, wherever you see that all-caps "THE LORD," you should mentally (or verbally, if reading aloud) replace that with "Yahweh" if you want to have a real sense of how the original Hebrew read.  (Don't worry, Jewish tradition aside, there is no <em>Biblical</em> proscription on reading the Bible accurately, with God's name included, as long as you're not being disrespectful.  The actual rule is against doing what you probably do every day: exclaiming or texting "Oh my God!" just because you're excited about something.  That would be an empty use of the name of God.)</p>



<p>Now, let's begin.</p>



<h3>Old Testament, Narrative</h3>



<h4>Genesis - Creation, and the beginning of Covenant</h4>



<p><strong>The beginning of the relationship between Man and God, the advance of the covenants, and the story of the first Patriarch, Abraham</strong></p>



<p>Begin in the beginning, with the story of the world's creation and the beginning of God's relationship with mankind, covenant by covenant, down to Abraham, his son Isaac, and his grandson Jacob, who was called "Israel," and the children of Jacob who end up fleeing the Fertile Crescent during a famine and seeking refuge in Egypt.  Read it like an impossibly ancient, possibly somewhat mythical or poetic, narrative.</p>



<p>Note, here, that it is <em>not</em> a story about Jews.  It is one of the foundational works of the Jewish faith, but Jews ancient and modern will be clear with you that the men and women described in Genesis were ancient forebears of the Jews and did not practice Judaism at all.  What we call Judaism is that way of life defined by the Law of Moses and the covenant with Moses, which does not appear until the second book, Exodus, thousands of years after the events of Genesis.  Jewish tradition recognizes that the earlier patriarchs were men who made earlier covenants with the same singular God, before they even knew His proper name, and who lived by many very ancient practices which would not even be allowed under the Law of Moses.  Nor does anyone claim they were good men.  Better than others, in some cases, but all fell short of expectations, and their progeny likewise.  Genesis, like the later books, is meant to be a Jewish historical account, warts and all, of the progenitors without whom Judaism (the Mosaic covenant and everything that came after) could not have come about.</p>



<p>Note also that I say "possibly mythical."  While elements of Genesis read and feel like myth, certain internal textual clues, in combination with very recent archaeological and paleontological evidence, suggest that it may be more historically accurate than we commonly believe today, if read the way a very ancient Sumerian or Egyptian would have read it, with proper fidelity to their language and cultural context in the Middle Bronze Age or earlier.</p>



<h4>Exodus - Out of Egypt</h4>



<p><strong>The greatest of all Jewish prophets, Moses, the plagues of Egypt, the final and everlasting covenant between God and the people, and the birth of the Hebrew nation</strong></p>



<p>After Genesis, we pick up the story 400 years later, around 1500 B.C.  The descendants of the twelve sons of Jacob (Israel) are now a nation of people living in bondage, and one among them, a descendant of Jacob's third son (Levi), abandons a life of privilege amongst the Egyptian royal house, flees, and takes up a humble life as a shepherd in the Sinai wilderness.  As an old man, he is called back to Egypt by God to lead the tribes of Israel to freedom.  Moses is his name, and Exodus is his story.  Read it like a story.  It ends with the whole nation of Israel, the Hebrew people, freed from Egypt and left wandering in the wilderness of Sinai, homeless.</p>



<h4>Leviticus, Numbers, and Deuteronomy - the Struggle with Law, and the Journey to the Promised Land</h4>



<p><strong>The Ten Commandments, the first struggles of the people against the law (the Golden Calf and other incidents), the prophecies of Moses, and his death</strong></p>



<p>The next three books are pretty dense, and I won't ask you to read them word for word.  God hands down to the tribes of Israel, through Moses, His law and His structure for their new society under the Mosaic covenant.  Part of that structure is that the third tribe, the descendants of Levi (thus called the Levites) would be a tribe of priests.  While the other eleven tribes lived normal, working lives as ancient Hebrews, the sons of the tribe of Levi would be destined to live and work as priests, at least one for every community of Hebrews once the nation comes to be established in the promised land.  In this they follow their forefather, Aaron, Moses's brother. who will become the first High Priest.  The covenant and law for which the Levitic priests would be responsible, which they would carry and teach to the rest of the Israelites, would be called the Levitic law, and it is laid out in the book of the same name.  (For our purposes, Levitic law is synonymous with Mosaic law.  "Levitic" refers to the book of Leviticus in which the law is laid out, but that book is held traditionally to have been recorded by Moses himself.)  Skim through the law, checking out a few of the highlights given below to challenge your brain.  Does this mean you will never study Leviticus in detail?  No.  I'm just saying you don't have to do so right now, on your first journey through the bible.  Do check out these few chapters, though.</p>



<ul><li>10: death of Nadab and Abihu</li><li>11: unclean animals</li><li>13-14: leprosy</li><li>17: the blood is the life, God has given it</li><li>18: sex</li><li>19: love your neighbor</li><li>20: child sacrifice and sexual immorality</li><li>25: jubilee</li><li>27: insurance values</li></ul>



<p>Numbers, meanwhile, gives precise accounting of the twelve tribes, with what they came away from Egypt, and what becomes of them, and especially of Moses's brother Aaron and sister Miriam in their priestly roles during those first few years in the wilderness.  Again, you may skim, and I have recommended a few highlights.  Some of these events are pretty cryptic, so don't expect to understand them yet.  Some symbols make sense only once you can see what they are symbolizing.</p>



<ul><li>9: smoke and fire lead them</li><li>11: manna getting boring</li><li>12: Miriam and Aaron oppose moses</li><li>14: people lose faith, rebel, are defeated in battle</li><li>20: lack of water, Moses strikes the rock twice (refer to Exodus 17)</li><li>21: bronze serpent</li><li>33: journey's account</li></ul>



<p>Deuteronomy is the final book of the Pentateuch, the Torah.  It is, essentially, Moses's final sermon to his beloved Hebrew people, for whom he has given his entire life.  We learn in Numbers that, due to one very small but apparently significant mistake, Moses and his generation are cursed never to set foot into the promised land.  Having given his life to lead his people there, he must die on its doorstep.  He knows this, and he knows his time is coming, so he gives one final sermon.  Most of it is a reiteration of the law and a deepening of the same, but a few important passages are highlighted below, including Moses's hints as to the future of God's plan, including the first explicit Messianic prophecy.  So dies Moses, alone with the Lord he served, on a mountain overlooking the land which he will never enter.</p>



<ul><li>5 - 10: The commandments reiterated, morality vs law</li><li>6: the greatest commandment</li><li>14: unclean food</li><li>15: jubilee reiterated</li><li>17: levitical judges, aided by priests</li><li>17: how to have a king, if you must</li><li>18: abominable practices</li><li>18: <strong>a new prophet like Moses</strong> (M), and testing prophets</li><li>19: cities of refuge and witnesses</li><li>21: marrying female captives</li><li>21: hanging a man on a tree</li><li>22: more laws on sex and rape</li><li>23: saving the runaway slave</li><li>24: divorce, collecting loans, not punishing one for another's sin</li><li>24: leaving some for the poor</li><li>31: Joshua succeeds Moses</li><li>32: Song of Moses</li><li>34: Death of Moses, <strong>and none like him has arisen</strong></li></ul>



<h4>Joshua - Establishing Israel in the Promised Land</h4>



<p>According to God's prescription, the Hebrew people were to be ruled by a system of Judges and Priests.  The Priests would be the Levitic Priests, interpreting the law and teaching it to the people, and assisting the Judge.  At any one time there would be a single Judge, anointed by God, sitting in judgement over the entire Hebrew nation.  This Judge was not a king.  The only sovereign King of these people would be God himself.  The Judge would have no special house, no special privileges, no special wealth.  The Judge would have two special responsibilities, though: He would lead the Hebrew people in battle when necessary, and otherwise would "judge" (make rulings or final decisions, with advice and input from the priesthood) in those disputes which could not be settled at a lower level, by village or tribal leadership.  Joshua, Moses's assistant, though not a Levite himself, is appointed by God as Moses's successor in leadership and becomes a model for future Judges.  With the Levitic priests to assist him, he leads the Hebrew people into the holy land and struggles with them to establish their new nation according to all the dictates of the Levitic law.  He also leads them in their conquest of their new home and the driving out or destruction of other peoples from the land.  Read his story to learn of the Conquest of Joshua, and of the formative years of the Hebrew people in their new home and their new marriage to their God.</p>



<h4>Judges - the Age of Israel under the rule of the Judges</h4>



<p>Exactly what you might expect: the book of Judges tells the story of the Judges after Joshua, until the last of them, when the system of Judges is finally (as foretold by Moses) rejected by an unwise people, who demand to have a king as other nations have.  Skim the stories of the various Judges, including such famous stories as Samson and Delilah, and note the pattern: the people are wicked, they become oppressed by foreign forces, they repent, God gives them a Judge to lead them back to him, after which they immediately, in their newfound safety, become wicked again.</p>



<h4>Ruth - the Grandmother of Israel's most famous King</h4>



<p>This short book tells the interesting story of Ruth, a girl not of Hebrew ancestry who shows great devotion to her mistress and adopts a Hebrew identity, finds love, gets married, and eventually becomes the revered grandmother of David.</p>



<h4>1st and 2nd Samuel - the Story of King David</h4>



<p><strong>The first (disastrous) king of Israel, and the life under King Saul of the One Who Should Have Been King, a young shepherd named David</strong></p>



<p>In the 1st Book of Samuel, having rejected God's mandated system of government by Judges, the Israelites demand a king, and God gives them what they're asking for, kingship in all its flaws, in the person of King Saul.  Initially brilliant, Saul quickly loses his luster and God's favor and descends into paranoia.  Meanwhile, a boy named David wins renown and Saul's favor, followed by Saul's jealousy.  Anointed in secret as the true king of Israel, David eventually goes on the run from Saul with his loyal men, traveling the countryside, staying a step ahead of Saul's army while defending the innocent from bandits and invaders, and all the while demonstrating his steadfast love for God.  In case you're wondering, the "Samuel" in the book's title is the prophet Samuel, Saul's chief advisor.  Samuel dies early on in the story, but these two books remain named after him.</p>



<p>In the 2nd Book of Samuel, David is finally, officially coronated after the death of Saul, and his reign begins.  His term is a mix of zealous religious devotion, heroic acts, and terrible crimes as the temptations of royalty overcome him.  Despite his admitted flaws, David remains to this day the quintessential king of Israel, and the Messiah is referred to as the coming Son of David.</p>



<p>Read 1st and 2nd Samuel like a story, and then continue into 1st and 2nd Kings.</p>



<h4>1st and 2nd Kings - the Age of Israel under the rule of the Kings</h4>



<p><strong>The story of King Solomon (third King of Israel and David's son) followed by the remaining kings, ending in the destruction of Jerusalem and eviction of Israel from the promised land</strong></p>



<p>David's successor and known to posterity as the wisest of all kings, King Solomon has a long and profitable rule, acquires great wealth (and a lot of women) and begins construction of the first Temple, the first permanent structure to replace the Tabernacle as the center of Jewish worship.  Solomon's story is the story of a man with enough wisdom to know the right answer, but often not enough strength to live according to the right answer.  Like so many before and after, he starts off well but ends tragically.</p>



<p>After Solomon, these books tell the stories of the remaining kings of Israel until the last comes under siege by the competing empire of Babylon and is finally overthrown.  Babylon takes Jerusalem, destroys the Temple, and scatters the people of Israel.  So ends the time of God's people in their promised land with the first "Babylonian Exile," which will last 70 years, until Babylon is overthrown by the Medo-Persian Empire.</p>



<h4>1st and 2nd Chronicles - Another take on the Age of Kings</h4>



<p><strong>Another perspective on the events of the books of Samuel and Kings, ending in the victory of Babylon over the Jews, the 70 years' Babylonian Exile, and the eventual return to Jerusalem</strong></p>



<p>1st and 2nd Chronicles are records of many of the same events told in 1st Samuel through 2nd Kings, as compiled by a different author.  They add some detail, but aren't crucial for a first reading through the Bible.</p>



<h4>Daniel - a Prophet among strangers</h4>



<p><strong>The story of Daniel and his companions under the Babylonian emperor, and Daniel's mind-boggling prophecies</strong></p>



<p>During the first Babylonian Exile, Daniel and his companions come into the service of the king of Babylon when Daniel proves that he is able to interpret prophetic dreams (his own and others').  He and his companions escape numerous attempts on their lives while he continues to give powerful people very bad news about their futures.  Read this book to see the archetypical example of Biblical prophecy (specifically, telling of the future), and compare Daniel's visions of the kings and empires to come to the actual history of Babylon, the Medo-Persian Empire, and the Greek Empire of Alexander the Great.</p>



<p>Then check out Daniel's prediction of the 70 weeks in Daniel chapter 9.  In it, he describes a timeline.  (For this, I recommend against the ESV translation.  Look to the NIV, NASB, or New King James for the best English renderings of this prophecy.)  It begins with an order to rebuild the city of Jerusalem (specifically an effective order which leads to the city, not just the Temple, actually being rebuilt), after which "seven weeks" and "sixty-two weeks" will pass, and then the Messiah will come, and he will also be "cut off," a Jewish idiom for a judicial death penalty.  The word we translate as "week" was, in their language, a more general word for any set of seven, and is acknowledged in this context to mean a set of seven years.  Specifically, the ancient Jews interpreted this prophecy to mean they could expect the Messiah about 483 years after an effective order goes out to rebuild the city of Jerusalem.  In the years after the return from Babylon, Jewish scholars observe the rebuilding of the city (which apparently took about 49 years), and they make calculations from the best-matching royal decree which began the process (issued by Artaxerxes Longimanus in 444 B.C.), and this leads to a very tense feeling of expectation among Jewish communities and the Jewish diaspora, about the years A.D. 30 to 40 by our modern reckoning, of the imminent appearance of Messiah.</p>



<ul><li>(M) 2:36 (and 2:44)</li><li>(M) 7:13: the Son of Man</li><li>7: the vision of the four beasts</li><li>8: more visions of the coming empires</li><li>(M) 9: 70 weeks (7+62+1)</li></ul>



<h4>Ezra, Nehemiah, Esther</h4>



<p><strong>The return to Israel, the rebuilding of the Temple, the rebuilding of Jerusalem</strong></p>



<p>Stories of the Jewish people once again established in their land under the authority of the Medo-Persian empire.  These books essentially comprise the end of the Old Testament's narrative.  During this period, the last of the prophecies are given, and then... there's just nothing more.</p>



<h3>Old Testament, Other</h3>



<h4>Psalms</h4>



<p>Psalms are songs, like hymns, those songs collected by the ancient Jews as being of particular religious significance.  Half of them were written by King David.  He was a prolific musician.  The story of David's adultery with Bathsheba, his attempt to buy the silence of her husband, and his eventual murder of her husband, go by quickly, and little is told of how David regards these events in the books of Samuel.  Read Psalm 51 to see the song he wrote as a prayer begging God for forgiveness after this particular transgression.  You can also read Psalm 32 for further insight into his feelings about guilt, repentance, and forgiveness.</p>



<ul><li>(M) 22</li><li>32: Repentance</li><li>51: David's repentance for Bathsheba and Uriah</li><li>(M) 110: David's Messianic inferences in the prediction of 2 Samuel 7 (David believed that a part of the prediction was about his son Solomon, but that part of it was about a more distant descendant who would be Messiah; he writes as much in this song.)</li></ul>



<h4>Proverbs</h4>



<p>These are collected wise sayings, most of them regarded as the Proverbs of Solomon--i.e., proverbs which King Solomon, in his wisdom, either wrote down or collected.  Read this book if you want plenty of bite-sized nuggets of real wisdom (specifically as opposed to modern pop bumper-sticker "wisdom").  Also famous in Proverbs are the wise sayings of the <em>mother</em> of one "King Lemuel," captured in chapter 31.</p>



<ul><li>1 - 9: Solomon's messages to his sons</li><li>10 - 30: Collected proverbs</li><li>31: "Lemuel's" message from his mother, including a description of the perfect wife</li></ul>



<h4>Ecclesiastes</h4>



<p>This is a book of philosophical sermons traditionally also attributed to King Solomon, though there is some debate on its authorship.  Read this if you are into philosophy and the philosophy of morality.</p>



<h4>Song of Solomon, also called the Song of Songs</h4>



<p>King Solomon addresses, through rather explicit poetry probably inspired by a dream, the proper shape of sexual activity within marriage.  (Contrary to attempts by the early church to desexualize this chapter, modern scholarship shows that it is <em>exactly</em> what it seems to be.)</p>



<h4>Job</h4>



<p>This book is not what you probably think it is.  The story of Satan's challenge and Job's suffering is summarized briefly at the beginning.  The vast majority of this book comprises intense philosophical poetry about the nature of suffering, its origin, and the proper response to it.  Like Ecclesiastes, this is for readers who are into the philosophy of morality and suffering and ready to do some deep thinking.</p>



<p>An interesting note here: The Pentateuch are regarded as the oldest texts of Judaism, penned by Moses himself, and there is some linguistic evidence within the text to suggest this is not a far-fetched claim.  They are written basically in Ancient Egyptian, by an educated Egyptian who clearly came from an Egyptian educational and literary background, using Egyptian literary forms and techniques of the late Middle Bronze Age, specifically the Hyksos or post-Hyksos era, and betraying detailed knowledge of Egyptian systems of government and high society.  Yet, as Egyptian as they are in form, they bear the unity of a single author and are decidedly anti-Egyptian in message, declaring the supremacy of Yahweh over all the false gods of Egypt.  That makes the Pentateuch as old as the Egyptian hieroglyphs on the tombs of Pharaoh Ramses the Second.</p>



<p>The book of Job (and possibly Jonah as well) is even older.  Internal evidence suggests that Job is the oldest book of the Bible, possibly maintained from the protohistorical era of early Sumer as an oral tradition and then faithfully recorded in written form later.  Now, there are older stories in the Bible.  Some of the accounts in Genesis of Eden and Noah's ark contain details suggesting staggeringly ancient events, on the order of 6,000 to 8,000 B.C., but these details are retained and recorded in Moses's Egyptian style.  By contrast, the story of Job, while probably depicting events of a Sumerian period sometime between Noah's flood and Abraham's wanderings, seem to do so in the preserved style and composition of that same era, which is mind-boggling.</p>



<h4>Jonah</h4>



<p>Another legendary story, and again not what you probably think it is.  This is a fable about a man who refused the charge given him by God and was condemned to die for three days.  Yes, he is swallowed by a large sea creature, and at the end brought back and "vomited up" by the same, and later references to this story refer to him being in the belly of the beast for that time.  But look at the poetry regarding his experience.  It describes not being eaten, but being dragged down in the dark, cold, and crushing depths of the sea, likely as a metaphor for being dead.  ("Sheol" is the Jewish "realm of the dead.")  Jonah is eventually redeemed from death by God and sent back on his mission, but he has not learned his lesson and the story ultimately ends in an unsatisfying way that demands further analysis by the reader of Jonah's petulance and God's relationship to him and the rest of humanity.  Its peculiar ending suggests authenticity and perhaps even a measure of historicity.</p>



<h4>The rest: major and minor prophets, and the closing of the book</h4>



<p>The remaining books of the Old Testament you need not read in any detail for now.  These are collections of prophecies by various Jewish prophets during the period of the Kings, the Babylonian Exile, and the restoration in Jerusalem up until the final prophecies of Malachi, given about 400 B.C.  You might get into these prophecies later, but for now, let me point out a few that the ancient Jews (the Jews of the B.C. years) regarded as referring to and describing Messiah.  By the time the voice of God goes silent with the end of Malachi, all of Jewish religious expectation is focused on theories of the Messiah's coming.</p>



<p>I have marked some of the highlights above with a little (M).  Those are references that are specifically Messianic, according to <em>pre</em>-Christian Hebrew scholars.  (It is important that they be regarded as Messianic to pre-Christian Jewish rabbis because, if a man comes along and claims to be the Jewish Messiah, we must judge by comparing his life to what objective Rabbis before his time predicted, rather than to passages which his devoted followers later declared to be Messianic prophecies.)  Here are a few more, so that you know what they were working with, what they were reading and reciting to each other, as the prophesied time approached.  These were regarded as indicators of the Messiah in the years before Jesus of Nazareth was born:</p>



<ul><li>(M) Genesis 3:15, her seed shall bruise your head</li><li>(M) Genesis 22:9-14, it shall be provided</li><li>(M) Genesis 22:18, in Abraham's seed all nations will be blessed</li><li>(M) Deuteronomy 18:15, a new prophet like Moses</li></ul>



<ul><li>(M) Zechariah 9:9, riding a donkey</li><li>(M) Zechariah 11, thirty pieces of silver, potter's field</li><li>(M) Zechariah 12:10, whom they have pierced</li><li>(M) Zechariah 13</li><li>(M) Isaiah 7:14, born of a virgin, named God With Us</li><li>(M) Isaiah 11, shoot from Jesse</li><li>(M) Isaiah 42</li><li>(M) Isaiah 49:6</li><li>(M) Isaiah 52-53</li><li>(M) Micah 5:2, born in Bethlehem</li><li>(M) Jeremiah 23:5-6</li></ul>



<h3>Old Testament, recap</h3>



<p>So, to review: Genesis and Exodus tell how the Jewish people (the ancient Israelites) came to be, and the rest of the Pentateuch describes the law and their arrival in the Promised Land.  Once they're in the Land, they live for several hundred years under the Judges, and Joshua and the book of Judges recount this period.  Eventually they reject the system of Judges and demand a king.  Ruth, Samuel, Kings, and Chronicles recounts the next few hundred years of Israel, under the rule of various kings, including the first three who are most important: Saul, David, and Solomon.  During this period, the first Temple is built.</p>



<p>The age of kings ends with Babylon overthrowing Israel and razing Jerusalem and the Temple.  Daniel is a Jewish prophet in exile who delivers a number of critical prophecies.  The exile ends when the Persians overthrow the Babylonians and a Persian king gives the Jews permission to return home and rebuild their Temple.  Eventually they also rebuild the rest of the city.  Ezra, Nehemiah, and Esther cover this period.</p>



<p>The remaining books are collections of material important to the Jews: Psalms (songs), Proverbs (proverbs), Ecclesiastes (philosophical tracts), the Song of Songs, and various prophecies and fables (Job and Jonah).</p>



<p>For your first passage through the Old Testament, follow the roadmap above.  Read Genesis and Exodus, check out the highlights through Leviticus, Numbers, and Deuteronomy, skim Joshua and Judges.  Read Ruth, 1st Samuel, and 2nd Samuel.  Read 1st Kings through the story of Solomon, and skim the rest.  Skim Chronicles if you like, to see how it parallels what you have already read.</p>



<p>Read Daniel.  It will be challenging, but read it anyway.</p>



<p>Hit the highlights, for now, in Psalms and Proverbs, but come back to these wells often as sources of wisdom.  Check out Song of Solomon if you are or plan to be married.  Read Jonah, Ecclesiastes, and Job when your mind is ready for some philosophical deep thinking.</p>



<p>Finally (and I may anger some people by saying this), don't bother with the rest (Ezra, Nehemiah, Esther, and the prophets) for now, except for the prophetic highlights given above.</p>



<h4>Conclusion of the Old Testament</h4>



<p>It's interesting, isn't it?  It's like the opposite of a normal book.  All the epic stuff happens at the beginning, and the story becomes steadily more mundane and depressing, through the age of Judges, and Kings, until the Jewish nation finally loses its freedom, is temporarily scattered, and returns, only to keep their Temple and city by the pleasure of foreign rulers.  And the relationship with God just sort of... tapers off to nothing.  The voice of God goes silent.  All that build-up.  All that talk of the promised future, reclaiming their land, and the coming savior, Heaven on Earth, the permanent Israel, and the resurrection of the dead, left unfulfilled.  But there is that timeline, that countdown.  There is good reason--at least good Biblical reason--for Jews of about 30 A.D. to think they might witness the End of Days in their lifetime, after 400 years of silence.</p>



<p>The conclusion of everything will begin with the coming of their Jewish Messiah.  What do they know about Him, according to the prophecies?  He will be of the line of David.  He will be born in Bethlehem, and will be come from nowhere important, the sticks, a poor place of no renown.  He will come riding on a colt or donkey.  He will defeat the enemies of Israel and bring God's glory and blessing to all nations of the world.  And he will also be rejected by the people of Israel, tormented, and killed.  He will be dehydrated, his bones pulled out of joint but not broken, he will be lashed and pierced, and he will be cursed, or will become a curse.  This last bit is, admittedly, troubling.  As the Hebrew Bible is closed out, and translated (especially into Greek, creating the Septuagint), and spread around the Jewish world, scholars of it debate how reconcile the conflicting predictions.  Messiah will reign, but he will also be rejected.  He will be victorious, but he will also be tortured and executed.  What does it mean?  Will there be two messiahs?  As the countdown winds down, they still have no good answers.</p>



<h3>The New Testament</h3>



<p>Then comes that voice, crying in the wilderness.  A man named John, regarded as a new prophet in his time, baptizing Jews with water, telling them they must repent of their sins and be washed clean, telling them that he is washing them to make them ready for another who is coming after him, who will be the Lamb of God, will baptize the faithful with the Holy Spirit, and will take away the sins of the world.</p>



<h4>Matthew, Mark, and Luke - the Synoptic Gospels</h4>



<p>Synoptic meaning they all tell the same story.  These are the three eye-witness accounts which the earliest Christians regarded as the most authoritative and accurate, and best written.  Contrary to some now outdated claims, these were written within the first century A.D., meaning before the year 100, meaning they were put to paper while people who directly encountered Jesus were still alive.  They are not the earliest Christian writings, but they are very, very early, and were circulating through Christian communities almost as soon as there were Christian communities.  Each represents eye-witness observations, recorded by a dedicated researcher (or, in the case of Matthew, an eyewitness himself), probably written down with the help of scribal assistants, as was the custom of that era.</p>



<p>If you're new to the Bible, and ancient ways of speaking are a little impenetrable for you, then try the New Living Translation for your first foray into the Gospels.  If you want to get into deep nitty gritty detail, then most modern translations for high reading levels (New King James, ESV, NASB, even NIV) will be fine.  The earliest of these accounts is probably the Gospel of Mark, but Mark also has the least detail, so you may as well read them in order.  Read them like eye-witness testimony, and remember that, while they were written in Greek, they were written by Greek-speaking Jews for a Jewish audience.  They are filled with references and allusions to the Old Testament.  If you took a good trip through the Old Testament such as described above, you might get some of these references.  If not, that's fine, but understand that much of what is being said by the people in these Gospel accounts has meanings that will expand for you dramatically when you later study the Old Testament and discover that they are quoting the prophets and songs and stories with which they grew up as Jews.  Linguistically, note that any dialogue they record, though they record it in Greek, was probably originally a mix of Aramaic and Greek, depending on the time and place of the conversation.  (It is likely that Jesus gave the Sermon on the Mount in Aramaic, probably repeatedly in a number of locations, at two of which he performed the feeding miracles.  It is likely that he conversed with Nicodemus in Greek, though.)</p>



<h4>John - the Gospel of John</h4>



<p>The synoptic gospels describe the events from an observer's perspective.  Read John's Gospel once you have a sense of the events as relayed in at least one of the synoptic Gospels.  This is the same story, but as told by John, the closest friend and confidant of Jesus, who is able to interpret and describe the events of Jesus's life through a higher theological framework.  His is the story of Jesus's life told with a focus on the <em>meaning</em> of Jesus's life.  Here you will see such statements as, "In the beginning was the Word, and the Word was with God, and the Word was God," and, "For God so loved the world that He gave His only Son, that whoever believes in Him shall not perish but have everlasting life."</p>



<h4>A note about what's <em>not</em> part of the gospel:</h4>



<p>If you grew up with the King James version or some other older version, there are two passages from the Gospels which more recent scholarship has indicated <em>potentially</em> were not part of these books as they first were written and circulated.  They are as follows:</p>



<p><a rel="noreferrer noopener" href="https://www.stepbible.org/?q=version=ESV|reference=John.7&amp;options=VGUVNH&amp;display=INTERLEAVED" target="_blank">John 7:53 through 8:11</a>:  You know this story.  A woman is about to be stoned, and Jesus says, "Let he who is without sin cast the first stone."  The crowd disperses, and then he tells the woman to go free and sin no more.  I'm sorry to say, this probably was not in the original Gospel of John, as John wrote it.  Note, as you follow my link above, the double-brackets that enclose the beginning and ending of this passage.  Modern Bible translations include it, but with the note that it is not original.  Do not be completely discouraged, though.  A number of scholars who have studied the origin of this passage, while they agree it is not original to John's Gospel, are of the opinion that it is historical, i.e. that it is a true anecdote from the ministry of Jesus that was floating around with some fame until a well-meaning scribe gave it an anachronistic home in John's work.  So, you shouldn't consider it to be part of the Bible, but you are safe in believing it is probably a true story.  Not everything that Christ said and did was included in just these four accounts.</p>



<p><a rel="noreferrer noopener" href="https://www.stepbible.org/?q=reference=Mark.16|version=ESV&amp;options=VNHGU" target="_blank">Mark 16:9 through 16:20</a>:  This is called "the longer ending of Mark."  The oldest manuscripts we have today do not include these verses, but simply end with verse 8:  "...and they told no one, for they were afraid."  Did Mark write the longer ending?  Did he write it later?  Was he considering writing it, but never finished it, and one of his scribes added it later?  Did someone else add it later because they couldn't countenance his story ending on such an ellipsis?  We're not sure.  However, this instance is not like the previous, the addition to the Gospel of John.  Whether the longer ending of Mark was or was not part of the book does not change the theology of the Bible, by any stretch, and moreover it began to be widely included in circulated copies of Mark within a century or so, meaning that the earliest believers considered it canon.</p>



<p>Nonetheless, its addition raises an interesting question.  With the longer ending, Mark's record reads more like the other two synoptic Gospels, as a complete account.  Without that ending, Mark's account either is truncated or... artistic.  It's hard for a lot of scholars to imagine an ancient writer taking an artistic, dramatic approach to something like his eye-witness account of the life of Jesus Christ, but there are plenty of others who say, "Why not?"  And the way Mark reads in other parts of his story, it really does fit his style, in a certain way.  Matthew and Luke just want to tell you what happened and why.  Mark is different.  He likes to tell you what people saw, and then let you draw the conclusions.  He likes to narratively set up scenarios that beg a question, and then leave you with an ellipsis...  ...and let you figure it out.  So, if you decide to read this without the long ending, imagine it this way: The women have discovered the empty tomb and received the bidding of the angel, and the last we see of them they are hastening away from the gravesite, refusing to talk to anyone else on the road as they rush to find the Apostles and inform them that the impossible has happened.  Fade to black.  Roll credits.  It's like a cliff-hanger ending, setting up Season 2 of the series, or a pilot episode begging for the rest of the series to be made.  Or, you may consider the epilogue of the longer ending to be part of the text, as most of the early church did, which is a little less interesting but just fine.</p>



<p>While we're on this subject, there's one more passage that probably isn't original.  It's in the First Epistle of John, though, so I'll mention it later.  Meanwhile, what does all of this mean for the reliability of your Bible?  If these passages were included in English Bibles for so many years in error, maybe all the rest of the New Testament is suspect.  Maybe it's all made up!  How do we know we can trust any of it?</p>



<p>Actually, rather the opposite is true.  The same process which has eventually revealed these three passages to be later additions has so vetted and validated the rest, so that the New Testament, as we have it today, is by several orders of magnitude the most thoroughly verified ancient text still extant.  Your Bible, in one of the flagship translations, is word for word, down to fine detail, the very collection of letters and accounts that was being circulated among the first Christians, within the very lives of the people who walked with Jesus in his ministry.</p>



<h4>Acts - the Rest of the Story</h4>



<p>The Gospel accounts end with Jesus dying on the cross, being buried, and then witnesses finding the tomb empty.  They then go on to describe Jesus appearing (as a physical, bodily person, resurrected from the dead) to various people who knew him in life, including his family and followers.  Then, he disappears again, leaving his followers to carry on his mission and spread his teachings.  The book of Acts is the denoument, in which Mark (author of the Gospel of Mark) tells the stories of what became of the Apostles and other followers in the following years, as they began the founding of the Christian faith and church around the ancient world.  Once you've read one or two of the synoptic Gospels and the Gospel of John, you can read this as the rest of the story of those same people.  However, if you are more philosophically-minded, you may prefer to read the Book of Romans before you worry about Acts.</p>



<h4>Romans - Paul's Magnum Opus</h4>



<p>There was, in those early days of the church (the days of Acts, after the departure of Jesus) a considered effort by the leadership of the Jewish faith (led by the Jewish scholarly priesthood, known as the Pharisees), to exterminate these messianic heretics before their faith could take root.  A number of Pharisees, scholarly experts in the Hebrew Bible and the Jewish faith and fervently devout in their devotion to the Old Testament Law, made it their personal mission to see the Christians killed and their heresy extirpated.  Among these was a young Pharisee of particular zeal named Saul, who traveled about hunting Christians, bringing them to trial, and supervising their torture and execution.</p>



<p>Then, one day, while traveling to Damascus to kill him some more Christians, he met Jesus.  The encounter was, he reports, overwhelming, and it left him blind for several days.  When he finally regained his faculties, he had a new name, Paul, and a new mission.  He was utterly converted, and he lived the rest of his life, and went to his death, in service to Jesus, whom he now believed to be the Christ, the Messiah of the Old Testament prophecy in which he was so expert.</p>



<p>In his new mission to shepherd and spread the Christian church, he wrote a number of letters which were so renowned for their scholarship, erudition, and deep understanding of the teachings of Jesus, that they came to be regarded (even by Jesus's own apostles, while they still lived) as Scripture, divinely inspired explanations of what it means to be Christian and practice Christianity.  These are the Epistles (letters) of Paul.</p>



<p>Perhaps the greatest of all of these is the Book of Romans, written to a newly-created Christian church in Rome when Paul realized he simply would not be able to find time to visit them in person.  In the book of Romans, because he is speaking to new believers with essentially no background except the basic Gospel story, he makes no assumptions but starts at the beginning.  In one massive, philosophically titanic work, Paul describes from top to bottom and front to back the entire theology of Christianity.  Once you have read one or two of the Gospels, if you then want to know how to apply it, what it means respecting how you should live as a Christian, this is the book you go to.  This is the next book to study after the Gospels and Acts.  Just understand that in places it is quite challenging, so don't expect to understand everything he says on an easy first read.  Here, a paraphrase like the New Living Translation might make your first reading easier, but it will not capture the full nuance of his language.  Ultimately, you will have to study it word-for-word, using a careful word-for-word translation.</p>



<h4>Hebrews - Christianity in an Old Testament Context</h4>



<p>While Paul's Epistle to the Romans is as complete a theological explication as you could ask for, you will not fully and completely understand the Christian message and teachings unless you understand them in the context of the Hebrew Bible, as one who studied it or grew up with it as a religious text.  Indeed, part of the Christian teaching is that God created His relationship with the ancient Israelites and led them through everything He led them through, wove their story through the tapestry of world history, so that we would have that as a framework to understand Christianity when He revealed it.  In other words, He not so much sent Messiah for the Jews, but created the Jews so that he could eventually send Messiah, and the world would have the Jewish history as a means of recognizing and fully understanding the Messiah's nature and mission.  The book of Hebrews, believed to have been originally a sermon (by an author now unknown to us), focuses on putting Christian teachings into that Old Testament context, helping new Christians understand the message through the necessary Jewish lens to fully grasp its meaning.  It is essential reading, along with Acts and Romans, after the Gospels themselves.</p>



<h4>The remaining Epistles</h4>



<p>Some written by Paul, others by other authors, these remaining books of the New Testament (other than Revelations) are various collected letters by leaders and Apostles of the early church to new Christians around the world, with the purpose of making sure that, wherever they were, Christians received a consistent and accurate account of the life, teachings, and theology of Jesus the Messiah.  They knew that a story like that of Jesus was ripe for legendary development and the false teachings of charlatans trying to get in on the action, so the ones who could speak with authority, the original Apostles and those who has personally witnessed Jesus's preaching, traveled without rest, visiting each new church when they heard of it to ensure that the message being spread was true and accurate.  And where they could not go in person, they sent trusted messengers with very detailed letters addressing either general theology or the specific concerns or problems of that new church.  Paul's letters to the Galatians and Thessalonians are agreed to be the very earliest Christian writings now canonized in the New Testament--that is, of all the Books of your New Testament, these are the earliest, written by Paul less than 15 years after the death of Christ, while most of the Apostles and even Jesus's siblings were still alive and active in the church.  This is important because, for a long time, skeptics would argue that the resurrection and deity of Jesus were myths added by other writers hundreds of years after Jesus.  Modern scholarship on the reliability and age of Paul's writings shows that within a couple of years after Jesus's death, common Christian worship included these elements, and that they were from the beginning foundational of the understanding of Jesus according to those who followed him.</p>



<p>Also, I mentioned that there's one more passage in some New Testament translations that probably was not original and should not be included.  Here it is:  <a rel="noreferrer noopener" href="https://www.stepbible.org/?q=version=ESV|version=NIV|version=KJVA|reference=1John.5&amp;options=VGUVNH&amp;display=COLUMN" target="_blank">1st John 5:7</a>.  Older English translations included here a phrase about the Father, the Word, and the Holy Ghost, as an affirmation of the trinity in heaven, then to be compared to three earthly symbols mentioned in verse 8. This apparently was text added by some well-meaning scribe in the Middle Ages, and the original epistle reads more like modern translations render it, with those words excluded. You can see a comparison in the link I have provided. The shorter modern translations are more accurate to the text. Don't worry, though. The Trinity still comes up in plenty of other places in the New Testament, including the Gospels.</p>



<h4>Revelations</h4>



<p>What can we say about Revelations?--except perhaps that it is a book not meant for human understanding.  It is regarded as authoritative prophecy from God, but it defies interpretation.  Of all the books of the Old and New Testament, Revelations will probably tell you the least that is important or useful for your life today.  It is fascinating, so feel free to read it.  Just don't try to apply it to what you see around you today.  These are not the end times.  These are just times.  Your guidance is not Revelations, but Romans, and John, and Mark, and Hebrews, and the Old Testament.  Focus on living your life.  The Apocalypse will take care of itself.</p>



<h2>Your Journey</h2>



<p>So, where do you want to start?  In the New Testament, or the Old?  With the story of Christ, or the theology of Christ?  With Biblical wisdom, songs that give you hope, or an inspiring story from ancient times?  Or will you attack chronologically, trying to lay for yourself all the Old Testament groundwork so you can approach the New Testament with some facsimile of a Jewish mindset and experience?  Hopefully, even if you want to undertake that most comprehensive approach, the guide above gives you an idea of what the Bible contains, how it's laid out, and where to focus your work.  Here's my point: <em>you don't have to read it all</em>, at least not on the first pass.  Even if you want a thorough reading for your first journey, that still doesn't mean you have to scour every word.  You have a lifetime to come back for details, and for those books that aren't important to your purpose at this moment.</p>



<p>I'm not saying there is irrelevant material in the Bible; not at all.  What I'm saying is that you have a specific purpose at this moment.  What I'm saying is that each book has its purpose, and your first purpose, upon a first reading, should be to grasp the overall narrative of the nation of Israel and the relationship of that nation to God, so that you can understand the story, and controversy, of Jesus Christ.  The work I've given you here will accomplish that, to a higher level than most people ever accomplish, without driving you crazy or making the whole task impossible.  Later, when there are elements of the Bible which you want to understand to a deeper level, you'll be able to come back to the rest of its content with an agenda.</p>



<p>So, in whatever mission you have given yourself, proceed, and Godspeed.  And, whatever that mission may be, may I recommend that your next stop be <a rel="noreferrer noopener" href="https://biblethinker.org/" target="_blank">biblethinker.org</a>, hands down the best resource on the planet for sheer bible study.  I would recommend Mike Winger's educational videos to anyone who is trying to figure out how to actually study and learn from the Bible.  Consider starting with his series, "<a rel="noreferrer noopener" href="https://biblethinker.org/mark/" target="_blank">Verse by verse through the Gospel of Mark</a>."  I've already mentioned three PhDs who have pioneered work on the historicity of the New Testament.  For tidy (and thoroughly referenced) video summaries of some of the latest work on the historicity of the Old Testament, consider the relevant playlists on <a href="https://www.youtube.com/c/InspiringPhilosophy/playlists" data-type="URL" data-id="https://www.youtube.com/c/InspiringPhilosophy/playlists" target="_blank" rel="noreferrer noopener">this YouTube channel</a>.</p>
`,
  },
  {
    wp_id: 733,
    slug: "discoveries",
    wp_date: "2024-11-20 05:59:50",
    excerpt: "",
    content: `
<p>The next morning, they both braced themselves for awkward questions, challenges about their precipitous exit, but they encountered none, principally because the rest of the household slept late into the morning and emerged, when they finally emerged, in slight and fragile capacity. The day after the ball was as quiet in the manor as they had ever heard it. Most of the residents and proper guests took their repast in their quarters, with the curtains drawn, and went back to sleep that night without ever having seen the sun.</p>



<p>Josheb and Doris, realizing their window, spent the day out in pursuit of the mission, taking the car beyond the wall to the slums and remaining there until well after dark. As usual, Josheb did not engage with her contacts here, nor involve himself in her interviews. He kept his eyes on their surroundings, catalogued those who took notice or lingered nearby. Doris had built a working relationship with several powerful figures here, and she visited each in turn, ready with her list of questions that still needed answering. They observed a ritual for appeasing a god of provisions, attended a wedding of a pregnant girl to a young man in rags, and sought audience in a priest’s company with an underground lord who held sway over several quarters of the slum by the force of his strong men and their clubs and guns. They observed his comparative affluence, the ease with which he occupied his makeshift throne, and spoke to his lieutenants and his servants and the girls he kept for his pleasure. Doris offered no interference with any of it, and Josheb recognized in her a new degree of clinical detachment, a grim resolve to observe the dark and let it be.</p>



<p>On the following day, as the rest of the manor resumed living proper, Josheb prepared to drive Doris to the geriatric hospital and then to undertake his own, secret mission. The first thing he did was burn the letter. He memorized the address and instructions on it, and then he put a candle to it and put it in a tray, until it was gone to the last shred. Obliterated. Then he checked his bag, ensuring that his weapons were properly packed, along with his long coat and hood, and several tools which were useful for infiltrating. Mercenaries sometimes did such work. Never alone, as he was about to attempt, but in small teams sometimes when the mission was kidnap or murder, or to sneak into a gatehouse by means unavailable to the average conscript, so as to open the way for an invasion. Josheb remembered a few of those arts.</p>



<p>When all was ready, he left his room and went to fetch the Princess. He met Tess in the corridor on the servants’ floor, and while her maid’s uniform was in good order, she looked in her face drawn and weary. The ball had taken a toll on her, he surmised. Such revelry could be a shock to those not accustomed to it.</p>



<p>“Master,” she said as he approached.</p>



<p>“Tess.”</p>



<p>“You go out?”</p>



<p>“Yes.”</p>



<p>“With lady?”</p>



<p>“Yes. Do you need something?”</p>



<p>She lowered her gaze. “No,” she said.</p>



<p>Josheb nodded. “If you need anything, find me later.”</p>



<p>Tess nodded back, not meeting his eyes, and Josheb pressed on. Behind him, though, she said again, “Master…”</p>



<p>He stopped and looked back at her.</p>



<p>“I… need to talk to you. There is something.”</p>



<p>“It will have to wait, Tess. I will be back late tonight. Find me in the morning.”</p>



<p>Josheb saw her throat tighten, but again she nodded to him and bowed.</p>



<p>So he went, finding Doris ready at her door, and escorted her to the carriage they had been using since they had damaged Barad’s open coach. This closed carriage, one of several belonging to Lilani, had proved in some ways better for their mission. It offered more privacy, more anonymity, as they motored about.</p>



<p>It was a hospital in the <em>Insubli</em> which had her attention today. She explained to Josheb that the upper classes tended to care for their elderly at home, but the working class had fewer resources for that, so concentrated the care for theirs in communal facilities. Doris was bent this day on what she called a quest for figures, counting all of the residents of such a facility, noting their ages, their ailments, how long they had been in such care, and at what ages they died, insisting to him that she could divine from these sums, by some magic of numbers, greater wisdom about Mazastar’s people. All of this was of academic interest to Josheb, but they coordinated nonetheless because he had explained to her that he needed time, and she had proposed this as a way to spend all of the day and into the night at a hospital without drawing suspicion.</p>



<p>Once he had deposited her there, he went his way. That way took him back up one of the switching roads to the Heights, where he then parked the car and continued on foot, carrying his bag. He was dressed well, properly for a personal servant of one of the elite wealthy of the Heights on a professional errand. Josheb made a show of some shopping, and consulted with a few artisans, before taking lunch in a café near the place of his interest. From his table, thanks to the prevalence of modern glass windows in Mazastar, he could observe that place while he ate. He could see its people coming and going, note who were the working class of it, who were its administrators, and how the entry of each was vetted. Having taken the measure of its people, he could guess the extent of it, that it occupied not just the building he could see, but a greater space that must lie below, like the terminals and hangars of the airships, under the feet of the Heights, behind the bluff walls that separated the Upper Ward from the general city. Over it, behind it, near the Upper Ward’s outer wall, the two chimneys reached toward the clouds, emitting gray clouds of their own, and he suspected they were part of the underground complex, which indicated that it extended far back from its obvious entrances on the surface. This led him after lunch to spy out the surrounding areas for other paths of access, until he was creeping in the weed- and ivy-covered alleys near the outer wall, an untraveled recess similar to that near the Píes’ home where he and Doris had found the vestigial temple.</p>



<p>He did not find what he hoped for, a good door forgotten, but he was not put out. The idea of going in by one of its main entrances did not intimidate him. He waited through evening, through the exodus of those who worked inside the facility, until their flow at the main entrance had slowed to a trickle and the peripheral doors had been closed and locked by the guards. When the sun was down, and there were good shadows between the streetlamps, then he approached one of those doors, drawing out his collection of skeleton keys. Mazastran locks would no doubt have the most intricate of ward patterns, but if they used any of the common formats, one of his skeleton keys should fit well enough. In the worst case, he had a file with him and would be able to trim the outer bit….</p>



<p>Josheb stared at the lock in front of him, with its strange, narrow, warped slot. He had never seen anything like it. He looked down at his useless key collection, then sighed and packed it away. So be it. He drew forth his pry-bar, stabbed it between the door and the jamb, and gave it a swift kick. After another minute of prying, he had the door open and was in. It was not elegant, but he could not afford to hesitate tonight. Doris would only be able to keep herself busy for another hour or two, he feared.</p>



<p>Knowing he had made some noise, Josheb pushed the door to and then fled into the interior of the building. He had been right: very quickly his way led to a downward staircase and to levels beneath the Heights. Josheb worked his way down, and he found the corridors and staircases abandoned. Electric lights hummed at the joints between the walls and the low ceiling, and the air was heavy, cool, and damp. The first doors he found, on the first level below the street, opened to what seemed to be changing rooms, lined floor, walls, and ceiling with porcelain tiles. They had on one end metal cabinets, each with a hook from which hung a white apron—waxed canvas, he noted, as he examined one—and on the other end dripping shower heads on the walls and drains in the floors. The cabinets contained, as best he could tell, each a few personal odds and ends belonging to individuals who worked here.</p>



<p>On the second floor downward, his discoveries became more interesting. He opened a door into a black space and noted immediately that it was larger, more echoing. It also smelled strongly of chemicals that stung his nose. &nbsp;After listening for several minutes for any sound of movement and hearing only the telltale scuttle of rats and the dripping of water, he used a flint to light a small hooded lantern. (He thought about the magic torch-rod which Doris had demonstrated to the Council. What a boon that would have been.) His light he shone into the space: It was wide and sprawling as he had suspected. Like the kitchens and messes under the Píe manor, it had a sepulchral feel, thanks to its low, looming ceiling. Here, though, as in the changing rooms above, the walls, floor, and ceiling were covered in slick, hard tiles. By his light, he saw that the chamber was filled with long tables covered in strange alchemical equipment. Glass beakers and tubes, metal stills, pipes, and bowls. Ovens and stoves, also, and sinks, hoses, nozzles, and drains. Here every station seemed to be unique, and there were devices and implements which he could not even classify, mechanical things the function of which he could not guess. He looked through it for a while, but there was little wisdom to be gleaned here. It was unintelligible to him.</p>



<p>Another of these large chambers, while still mysterious, seemed more regular to his eye. It contained several identical trains of equipment, pipes running from metal tanks, through stills and boilers, and then into larger tanks with more copper pipes from the ceiling to the floor, and then to large enclosed vats. Where the previous room seemed to be configured for various alchemical explorations, this chamber seemed to be arranged for production, according to some established formula. Confirming this theory, he found nearby a storeroom containing rack upon rack of glass jars, empty, clean, and ready for use.</p>



<p>He continued on, and found another staircase going down. As he entered it, his ear detected a faint sound of people speaking, but it did not sound as though there were many. He crept down the staircase, silent on soft leather boots, and found a long, lit corridor. At the end of it stood two figures resting and conversing. In the same glance, he noted a doorway along one side of the corridor not far away. Josheb retreated up, crouched down until he could just see the feet of the two men, and waited. After a while, they turned away from him. He took his chance, descending to the corridor, walking to the door, and going through it before the two men glanced his way again. Very quietly, he closed the door behind himself.</p>



<p>Josheb turned, beheld, and felt his legs weaken under him.</p>



<p>It was a long time before he moved again. What drove him up was the sound of more voices in the corridor on the other side of the door behind him. They had an aspect of authority, speaking of something urgent, and he knew some Faenish by now. He could recognize words like “door” and “broken.” Josheb realized that he could not stay here, and he could not go back. He had to find another way out, so he gathered his senses and pressed on, moving through the charnel chamber until he found another door.</p>



<p>It took a while for him to find a way that did not take him toward people. Eventually he discovered, in a dark and little-used portion of the facility, a ladder, probably meant for evacuation only in an emergency. It was a long climb, three stories up, and at the top he found a hatch locked from the inside. He was able to force the lock with some effort and open the hatch, and that admitted him into some sort of catacomb or sewer. Shining about with his light, he saw a metal grate nearby. Josheb dragged himself up through the hatch, lowered it silently, and went to the grate. It was another portal, a gate, hinged on one side and locked with a padlock. Ivy covered it, and but he reached through the bars and pulled the ivy aside, and he could smell fresh air and hear the sounds of the outdoors. Again, he forced the lock as quietly as he could and let himself out, slipping through the vines as best he could without disturbing them. Here, at last, he found himself in a back alley of the Heights, near the outer wall and the chimneys. He had escaped.</p>



<p>Josheb was grim as he drove to collect Doris. He had never felt such a blackness in his heart. Everything he knew about the world was true, and everything Doris feared did not begin to capture the truth. He did not want to show her this, but he knew he must, and that she had to see it with her own eyes.</p>



<p>At the hospital, he found her in heated conversation with the physician, Yodwi. “…you don’t understand,” she was saying, with some passion. “There are—You don’t understand what’s in it, because you can’t see.”</p>



<p>“What’s in it, then?”</p>



<p>Josheb put his head in the door and caught her eye, but then retreated and stood outside in the hallway to wait while she finished her work.</p>



<p>“They’re… It’s hard to explain. Small, very small things, broken, that can cause problems. We call them <em>prions</em>, but you don’t have a word. You can’t see them with a microscope, but—”</p>



<p>“My lady, this benefits are known. The work has been done. You can’t tell us that we have not observed what we have observed.”</p>



<p>“I understand you’ve observed benefits! But long term—”</p>



<p>“My lady, please! This is a dangerous line of inquiry, and it is unfounded. There no—absolutely no—concerns about this. We would know. And saying there are will cause needless chaos—not to mention harm.”</p>



<p>“But—”</p>



<p>“The conversation is finished.”</p>



<p>When she came out, he fell in beside her but said nothing as they walked back to the car, and she said nothing either. He could tell she was fuming, but the matter was well beyond his learning, so he had nothing to contribute. Only once they were on their way home, she driving and he riding beside her, did she look over at him and ask, “What did you find?”</p>



<p>For a while, he did not answer. She drove, watching the road but glancing at him while he decided what to say. Finally, he replied, “You will see it. Not now. I had to break a door. There will be too much activity tonight. We need to go and wait a while.”</p>



<p>“Okay.”</p>



<p>“And that with the doctor?”</p>



<p>“A problem. I can’t convince them of what they don’t want to see.”</p>



<p>“Naturally, Mistress.”</p>



<p>She smirked. “And I’m not expert enough in this field to explain it. Medicine and… Eh! I don’t have the words in these languages. But it’s not my specialty.”</p>



<p>“You do very well, Mistress. If they won’t listen, you can’t take that blame on yourself.”</p>



<p>“I know. But…” She sighed. “I know.” For a little while she was silent, and then she said, “You’re not taking their tonic, are you?”</p>



<p>“No, Mistress.”</p>



<p>“Good. Don’t.”</p>



<p>They reached the manor without incident, and without any further discussion, for which he was thankful. She did not further press him on what he had found, and he was not yet ready to describe it. He returned Doris to her chamber unseen and then retired to his, and there he sat in the dark, by the window, staring out, unable to sleep, thinking of the gods. Here was a city of people who had forgotten the gods, he thought, and yet they served still, fed the appetites of the insatiable ancient principalities. Fed them as no worshippers before.</p>



<p>The next morning, there came knocking at his door a servant girl, not one of Lilani’s but one of Doris’s, saying, “Lady Doris requires you, sir. She says to say she is going out and you are needed.”</p>



<p>“Understood,” he replied. “Thank you.” As soon as the girl departed and he had closed the door, he sought out the magic speaking box which Doris had given him and found it in his coat, which he had cast aside carelessly the night before. On the surface of it were written several new messages from her, telling him, “We need to talk,” and, “We will go somewhere discreet,” and “Are you receiving this?” Josheb cursed his thoughtlessness and raced to dress himself again. He had not bathed since their outing, and he and his clothes still smelled of chemicals. The odor made him feel sick. Those garments could not go to the maids for laundering, so he tucked them away and donned a fresh uniform suitable for another day out. How much, he wondered, had he spent on clothing since he had come to this city, just to look the part for his lady?</p>



<p>As he was on his way to Doris’s chamber, Tess caught him in the corridor again. She was stalking him. “Master…” she said.</p>



<p>“I can’t, now, Tess. Our Mistress requires me immediately.” He left her there in the hallway, staring after him, and he saw her tears. Something had happened to her, he felt certain. As soon as he could, he would address it. Tonight, while Doris was at supper with the family. “Tonight at supper, Tess,” he said as he parted from her. “Tonight.”</p>



<p>He reached Doris’s chamber, and when he knocked, she opened the door for him almost immediately. She was already ready to go out. “I wondered if something had happened to the speaking box,” she said.</p>



<p>“No, Mistress, it is my own fault. I set it aside last night without thinking.”</p>



<p>“It’s fine,” she replied, cutting with her hand. “Nothing to worry about. I want to go out, though. Too many questions, here, and I need to know what you saw.” She took up her bag and her hooded coat as she spoke, and started past him out the door.</p>



<p>“Mistress… if you will allow it, I think it is best that I show you.”</p>



<p>Doris slowed, looked back at him, and then glanced up and down the hallway. “That bad?” she asked him.</p>



<p>“Yes, it’s bad.”</p>



<p>For several seconds she stood in thought, and inwardly he thanked her for that, for giving him her consideration. However, she then shook her head. “No,” she said. “I understand, and I appreciate, but I need to know what’s going on. Forgive me, Josh, for calling it a game, but I can’t play. I need to do this right. Come with me. We will go to a quiet place without ears, and we will talk.”</p>



<p>Josheb bowed and obeyed. Doris led, and he followed her out, taking her handbag for her, as was their custom now. To reach the carriage barn by the main stair, though, they had to pass through the foyer, and as they did, they encountered several of the residents and proper guests. Groga and Rorish were there, and Myram, and Lilani.</p>



<p>“Oh, hello!” said Lilani to them, raising her hand. “Going out again?”</p>



<p>“Yes. More to study, as always,” replied Doris, feigning graciousness.</p>



<p>“Of course, of course. I’ve missed you since the party, though. Dinner tonight?”</p>



<p>“Of course, Lily. With the family?”</p>



<p>“Quite so,” said Myram.</p>



<p>“Sir Josheb, you should come, too,” added Lilani. “We’ve not had you at our table in some time. I consider that a failing on my part.”</p>



<p>“If my lady will have it,” replied Josheb, eyeing Lilani. She had something in her mind, but she was beyond his power to read. Too much a sorceress. He glanced at Rorish and saw that the young captain was staring daggers at him.</p>



<p>“Of course,” said Doris. “We will both be there.”</p>



<p>“Wonderful!” said Lilani. “Off you go, then. I don’t mean to make you late for your work.”</p>



<p>Doris curtseyed, and Josheb bowed, and they made their escape to the carriage barn where the fine Lauburnum carriages were stored. Josheb noted that he would have to get word to Tess, when he could.</p>



<p>They drove out, making a few turns to show a false direction, and then at Doris’s request they parked in an out-of-the-way place and walked into the back alleys together, Josheb’s eye ever over their shoulders for a tail but finding none. Eventually, they came to the little temple that had become their private sanctuary.</p>



<p>While Josheb continued to watch their path of approach for another minute, Doris found the bench where they had sat before and cleared herself a space on it. Josheb satisfied himself that no one was interested to follow their progress, and then at last he turned to her.</p>



<p>“Is Barad’s car still out behind us?” she asked.</p>



<p>“It is.”</p>



<p>“Hm,” she said. She took a deep breath and then looked up at him. “So, tell me.”</p>



<p>Josheb turned, seated himself beside her on the ancient stone bench, and then related to her the important elements of his observations. Doris’s eyes widened, and she covered her mouth.</p>



<p>“Is this… true?” she asked.</p>



<p>“Yes, Mistress.”</p>



<p>For a while she was quiet. Finally, she said, “I need to talk to Mori.”</p>



<p>“Is that wise, Mistress?”</p>



<p>“I don’t know. But I have to give her a choice.”</p>



<p>Josheb nodded. “Whatever you require, Mistress.”</p>



<p>Doris took a little while longer to gather her thoughts, and then she asked, “Does the car still run? The one here?”</p>



<p>“It does, Mistress.”</p>



<p>“Keep it ready. In case we need it.”</p>



<p>He stared at her. “Yes, Mistress. I think that’s wise,” he answered, and he could not restrain a small smile.</p>



<p>Doris tilted her head, and then she blushed and said, “You’ve already thought of it, haven’t you.” She looked away. “You’ve been arranging to keep it here. Delaying.”</p>



<p>“Only in the past few days, since this business with the Saboteurs. You are thinking like a mercenary, Mistress.”</p>



<p>That made her smile, but the business at hand was too grim for the levity to last. “We need to go,” she said. “I need to go back to the hospitals today for more figures.”</p>



<p>“I don’t understand these figures, Mistress. You mean numbers? How does this serve our mission?”</p>



<p>“I will tell you, Josh, but you may not understand. Even so, you must trust me that it’s important.”</p>



<p>“Of course, Mistress.”</p>



<p>Doris took a moment to gather her thoughts, and then she said, “This place has medicines that the rest of the world does not have. But how do we know if they work?”</p>



<p>“I suppose take it, and see if it cures the disease, Mistress.”</p>



<p>“If only it was that simple. What medicine do you take for a head-cold, Josh?”</p>



<p>“Salted goat’s-root tea.”</p>



<p>“Does it work? Does it cure the disease?”</p>



<p>“I suppose I don’t know, Mistress. I take it, and I get better, so it must.”</p>



<p>“But you say you’re not sure. Maybe you would have healed without it. Indeed, I suspect you know you would survive most colds.”</p>



<p>“Of course.”</p>



<p>“Do you heal any faster with this tea? Does it seem to you that you do?”</p>



<p>“Sometimes.”</p>



<p>“But how can you know for sure? Maybe that was just a weaker disease.”</p>



<p>“Can’t know, Mistress. You just do what you can do.”</p>



<p>“Yes. But I can find out. I can take the number of people, the number of people who get sick, the number who take the tea, how long they have the disease, the number who don’t, how long they have the disease, and I can use this study of large numbers of people to learn the truth. With mathematics.”</p>



<p>“All right. I don’t know how you find your answer with mathematics, but I believe you, Mistress. Whatever you need, we will do.”</p>



<p>“You’re a loyal friend, Josh. Thank you.”</p>



<p>“You’re welcome, Mistress. I have a request, though.”</p>



<p>“Whatever you need, Josh.”</p>



<p>“I have been thinking about something I asked you, and I think… I think the world must be condemned. All of it. When you leave this land, this world, take me with you. Let me go back with you and live in your realm. Better to be the lowest slave there, I think, than to be a king in this world of evil.”</p>



<p>Doris shot to her feet as he spoke, and by the time he had finished, she had taken both of his hands in hers. “Oh, Josh!” she said. “Of course! You will be welcome there! And you won’t be a slave, I promise. You will have a good life.”</p>



<p>“It will be good enough to spend my remaining years far from all of this… death.”</p>



<p>She leaned over him, then, and planted a kiss on his forehead, and that made him choke a little.</p>



<p>“Come,” she said, righting herself. “Let’s get some work done before dinner.”</p>



<p>They did what she needed done, and were home in time to bathe and prepare for dinner. Of course she dined with their hosts regularly, but as Lilani had rightly pointed out, Josheb had not been invited back to that table in a couple of weeks, since the novelty of him had worn off. He had to find his fancies again and make sure he was properly attired and made up, in time to make the bell. He did well enough, arriving while the rest of the party were still standing about enjoying pre-prandial cocktails.</p>



<p>Small-talk was rendered until the serving of the meal, and then they took their seats. That was when Josheb began to suspect that someone at the table had an agenda, for a servant directed him to sit beside Lilani, and Rorish was on her other hand. Meanwhile, Doris was seated on the opposite side. Josheb watched Doris carefully as she lowered herself into her chair, watched her eyes dart, and was satisfied that she, too, suspected intention behind the arrangement. He wondered how they had seated her at meals between this one and the last time he was here. Was this a dramatic change for her?</p>



<p>The other change, Josheb noted immediately, was that there were fewer guests this evening, and they were all seated much nearer to the head of the table.</p>



<p>For a while, the conversation remained small, and Josheb sat mostly in silence, participating when he was called upon but otherwise focusing on his meal and waiting for Lilani to reveal her agenda. When it came, though, it came not from her but from Rorish. He said, “So, Lady Doris, I understand you did not enjoy Master Píe’s ball the other day. It was not to your tastes?”</p>



<p>“Not particularly,” said Doris. “In my culture, we do not celebrate in that fashion.”</p>



<p>“I’m sorry to hea—”</p>



<p>“I should add,” Doris continued, interrupting him, “that I do not mean any offense toward Master Píe or his house. I could not be more grateful for your hospitality,” she said directly to Lilani. “It was simply not the kind of celebration in which I can participate.”</p>



<p>“Of course, dear,” said Lilani. “May I ask what it was that disturbed you?”</p>



<p>Josheb saw Doris’s eyes glance at him fleetingly before looking down at her food. She wanted his help, his guidance, but she was on her own for this. She took a bite, chewed, swallowed, and dabbed her lips with her napkin, and then she answered, “It is part of my role, my mission, to remain detached, to observe each new people whom I encounter without judgement. I should not say a thing is good or bad, only that it is, and record it faithfully for my people. However, in some ways my culture is very different from yours, and some things which are normal to you are very shocking to my heart. Some things I cannot observe without hurt. When this happens, I ask your indulgence if I… go out from it. This of course is my private struggle, and I would never interfere with your practices.”</p>



<p>“I think there is some nobility in that,” said Commandant Groga, seated to Doris’s right. “But if that is the sentiment of your people, does it make sense? Is it not the responsibility of the wiser nation to bring civilization and wisdom to the lesser? We do this—judiciously, I admit, but we do it as we think wise, to bring light to the barbarian nations who still war and murder and make sacrifices to pagan gods. What good would it be to the world if we concealed our learning or hoarded it? And likewise your people—whom, to my knowledge, you still have not named—you have proved have wisdom and light which surpasses even ours. Yet your people do not share their wisdom? If you have it to offer, should you not?”</p>



<p>“Perhaps,” said Doris. “But that is not my mission. My role is to learn your ways, learn the shape of your civilization and your culture. Wiser men than I will decide with which kingdoms to make alliances and share knowledge. I am authorized only to offer a few tokens, as proof of my people’s learning.”</p>



<p>“You’ll pardon us if that answer, while reasonable, does not entirely satisfy,” replied Groga.</p>



<p>“But what has upset, dear friend?” asked Lilani. “Our ball is supposed to be a night of joy and revelry, and togetherness. It hurts my heart that you did not feel you could partake, that you were not one of us. My father has only ever wanted you to be welcome, and I likewise.”</p>



<p>“I know, Lily. And I feel welcome. I don’t want anyone to think that I don’t.”</p>



<p>“Then what was it? I must know.”</p>



<p>Doris pursed her lips. For a few long seconds she looked down at the table, with all its beautiful setting and succulent foods, and said nothing. Finally, she ventured, “In my culture, it is not common to see the sexual act on public display.” The others did not know her well, but Josheb did, and he could see her hesitating even as she said it, as if she was not convinced of her own truthfulness. He knew her to be sheltered, like a virgin priestess, yet she had hinted to him that her experience was not the general experience of her society. He wondered what nuance might be now on her mind.</p>



<p>“Is it not a natural part of the human experience?” asked Lilani. “Does your people find it evil, that they hide it in secret? How do they make new generations?”</p>



<p>“No, not at all!” said Doris. “We… Look, there is debate. No culture is unanimous on any subject. Some among my people are more strict than others. But we generally agree on some things. That it is an intimate and private matter, that it is part of a loving relationship and… I will say this, and I hope you will not take offense, but we—many of my people, I will say—believe that the act is cheapened when it is shared widely.”</p>



<p>“You speak as if a man’s seed, his lineage, can be cheapened,” replied Groga. “If a man makes many offspring, it does not detract from the inheritance of his elected heir. It only affirms his potency, and makes his inheritance more precious.”</p>



<p>“We—” Doris began to respond, but she stopped herself. She looked over at Groga and instead said, “Please, share with me. Does your culture generally regard the sexual act as a means of generating offspring?”</p>



<p>“The consequence of the act can’t be separated from it, of course, but I would not go so far. We recognize pleasure, and the joy of union, and practice the sharing of both.”</p>



<p>“And how do you view the sanctity of the woman?” Doris asked.</p>



<p>Josheb was observing Doris and Groga, not Lilani, but out of the corner of his eye he saw Lilani’s head come up. He glanced at her and saw her watching intently.</p>



<p>“I’m not sure I understand,” said Groga.</p>



<p>“The sanctity of the woman,” repeated Doris. “Her will, her free choice, in these matters? How do you ensure that her value as a person is preserved?”</p>



<p>“My lady, the value of a person lies in his—or her—ability and willingness to fulfill the role for which she was made. What value have I, if I am a poor soldier, a poor officer? What value the cobbler, if he cannot make a shoe? Our fullness comes from fulfilling what we are. So it is between man and woman. What could a woman desire other than what she naturally desires as a woman? What could satisfy her other than to receive what a woman is made to receive?”</p>



<p>“Do you make a point of asking?” said Doris.</p>



<p>Groga set his cup down rather forcefully. “No, I do not make a point of asking!” he snapped. “These questions do not need to be asked; the answers are known! Lady Doris—” And then Groga reverted to Faenish as his voice continued to rise. Josheb could not follow it; he caught only a few words. “…culture… natural forms… man’s claim… duty….”</p>



<p>“<em>Zuyedt,</em>” interjected the voice of Aiham Píe, harsh and final. All eyes turned to him. He continued in Eledrin. “Lady Doris is my guest, and royalty of her people. She will be treated gently at my table, Commandant.”</p>



<p>Groga closed his eyes, took a deep breath, and set his hand on the tabletop as he exhaled. “I apologize, my friend. I have sullied your company.”</p>



<p>“It is forgotten. Lady Doris,” said Aiham, “Please share the ideas of your people freely, here. You will not be so treated again.”</p>



<p>Doris nodded her head. “Many thanks, sir. I take no offense. I am grateful to the Commandant for his honesty.”</p>



<p>Aiham nodded in return.</p>



<p>“Sir Josheb, tell me:” said Lilani, resting her hand on his. “The Lady seems to find us barbaric, by the standards of her kingdom. How do you find us? What have you seen in the world, in the matter of sexual relations?”</p>



<p>Josheb hummed. “I am certain most here are familiar with Eledring. It is assumed that a man may take a woman if she is his slave or if she is of lower status and in his power. This, I’ve seen, is common to most realms through which I have traveled. They also worship the goddess Tunema, whose priestesses are sacred prostitutes in her name. I remember when the emperor decreed that every woman of status would spend one night per year in the brothels. She is not permitted to resist or deny any man on this night. It was said this was to make equality between the upper classes and the lower. I have not seen that exact thing done elsewhere, but I have seen its like. In the Eclemarid Kingdoms, they worship the goddess Yesine—I think she is Tunema by another name, but in their kingdoms, every woman is expected to serve one night as a temple prostitute on her twelfth birthday after her naming day. In all these lands you will also find festivals like the one we are here discussing—the Yesine call them <em>ashanalia</em>, if I remember—in which all women are, as we might say, fair game for all men until the night is done. It is never considered that a woman might deny a man. They would not imagine it.</p>



<p>“Among my own people, a woman is valued if she can give male offspring. A man may take concubines as he pleases from lower families, but he will have one wife among them. If she cannot give him sons, then the one who gives him a son becomes his wife, and the other is made a concubine.”</p>



<p>“I suppose it should go without asking,” said Doris, “but do I assume correctly that wives and concubines must honor the man’s sexual desires?”</p>



<p>“Of course, Mistress. It is a grave crime to disobey, in all the cultures I have seen. In another northern tribe with whom my people warred of old, the wife who fails to produce a son before her husband’s concubine does the same is killed, and the concubine raised to the place of wife.</p>



<p>“In the land of Dara, a man may have as many wives as his purse will allow, and it is their duty to satisfy their husband as he pleases, or face punishment from the gods. In the far south, among the Amuatu tribes and others, a young man takes his first wife by conquest. He chooses one whom he desires, and she is expected to fight him, and he to overpower her and couple with her against her will. By this he establishes his mastery. I may add that in some tribes of that area, it is also tradition that a young man, to be called a man, must hunt and kill at least a grown woman of a neighboring tribe as game.</p>



<p>“Among the Nelhtzatl, virgins are killed on altars to the gods. I have seen some ceremonies, though, in which the priests couple with the girl first, so that their seed is given to the gods’s fire with her body. Most of the men of the Nelhtzatl had many wives, and they are under the same duty as wives of any land.</p>



<p>“These are all I can remember on a moment, but I would say, in answer to the question, I do not find Mazastar much different from other nations in the matter of men and their claims on their women.”</p>



<p>“And do none of these cultures value virginity?” asked Doris.</p>



<p>“Among women? They certainly do. An untouched girl of ten or twelve years is prized as a wife, as long as she can produce an heir. And there are goddesses who accept only virgins as priestesses and oracles, or as sacrifices.”</p>



<p>“What about men? Is it valuable for a man to be a virgin?”</p>



<p>“I have never encountered such as thing, if it exists, Mistress. Why would the virginity of a man be valued? The virtue of a man is in his strength. How will you measure his strength if he is not free to impose himself on women and boys?”</p>



<p>“Boys?” asked Doris, her eyebrows going up.</p>



<p>“Yes, of course, Mistress. I can’t imagine you have traveled across Eledring and not observed the boys that men of status keep, there.”</p>



<p>“Well… we did not travel much amongst the upper classes of Eledring. I was aware, but I did not realize it was a widespread practice.”</p>



<p>Josheb wiped his mouth with his napkin and for a moment sought back through his memories. “I would say, amongst primitive tribes, it is less common. In Nelhtzatl, in the far north, in the Amuatu and Bosha, it is considered a, mm, a corruption. But in all wealthy kingdoms, it seems to me, keeping a boy or boys is a mark of riches and status, as they do here. In Dara, even small noblemen, who have barely a castle, pride themselves on having a boy or two.”</p>



<p>“Here?” asked Doris, surprised.</p>



<p>“Of course, Mistress.”</p>



<p>Doris glanced toward Aiham, the family patriarch, who eyed her cooly in return.</p>



<p>“I suppose it makes a certain kind of sense,” she said then, somewhat to Josheb’s surprise. “As a civilization advances so that its survival needs are no longer in question, it is a mark of prosperity to do that which has no purpose of survival. We would call it… what’s the word, in Eledrin? Something which stands out to the eye, to the observer.”</p>



<p>“Conspicuous.”</p>



<p>“Yes. Conspicuous consumption. Lavish celebrations, lavish court appointments. The arts. And sexual activity which does not produce offspring would fit in this category. Thank you, Josh. That was an expert survey.”</p>



<p>“Certainly, Mistress.”</p>



<p>“And what of your own culture, my lady?” asked Rorish.</p>



<p>“In my culture we have none of these things. A woman is measured equally with a man, and her will and free choice are always considered. Her right to decide what she will do and not do is always respected.”</p>



<p>“Pardon me,” said Commandant Groga, considerably more deferentially after his chastisement. “How do you mean ‘right’ in this context? Are you using the word as you intend?”</p>



<p>“I think so. You say a thing is ‘right’ if it is as it ought to be, yes?”</p>



<p>“Yes, just so.”</p>



<p>“We have a notion, in my country, that certain things it is right for any person to have. These are the person’s rights. As we regard women the equal of men, so we regard their rights as equal.”</p>



<p>“How equal?” asked Lilani. “As a woman, I find it a cheerful notion, but how are women the equal of men? Are women in your land as strong as men? Do they not have a monthly cycle which affects them? Are they not given to emotion and mania as men are not? Are women in your land equal in wisdom to men?”</p>



<p>“In truth? Women in my country are as women are here. Smaller, weaker. Yes, we have a monthly cycle. We bleed, and it is miserable, and we become emotional—sometimes irrationally so, if we do not guard ourselves. But in wisdom? I would like to think we are men’s equals. But even if it were not so, it would not change the value or rights of a woman. As we do not measure the servant less than the master, so we do not measure a woman less than a man, regardless of the differences.”</p>



<p>“Then we share some similarity, there, even if the language differs,” said Groga. “We do not keep slaves. All in Mazastar are free to choose their lives and livelihoods.”</p>



<p>“And yet you speak of duty.”</p>



<p>“Well, of course,” said Groga. “Freedom to choose does not mean freedom from duty. A man’s or woman’s worth is still measured against his duty. What is anyone but what he or she does?”</p>



<p>“And a woman’s duty is to men.”</p>



<p>“It certainly is,” said Rorish. “My lady, you speak of value, but, if you will forgive me, it is an empty word as you use it. If a servant requires a master, or a woman requires a man, then what in them is this value which you say is equal? What are you measuring?”</p>



<p>“Their worth as human beings.”</p>



<p>“This is no answer, my lady,” Rorish replied immediately. “Perhaps you may assign them some value equally apportioned, but it does not exist in the world, in the forms or the substance of them.”</p>



<p>Doris frowned and was silent. Josheb waited for her to answer, and he felt a pang in his chest when he realized she would not, that she did not have an answer for him. He wanted her to win. He wanted her to be right.</p>



<p>“So a woman has a duty,” she said instead, “to her man, or to men generally at a ball, and in childbearing. Her worth is in the doing of her duty.”</p>



<p>“Yes.”</p>



<p>“To give herself, if that is required, and to bring forth the child, if she becomes pregnant.”</p>



<p>“Yes.”</p>



<p>“So where are the children?”</p>



<p>Josheb gritted his teeth. She had been doing well, he thought, but this was too far. This was too bold, too soon.</p>



<p>There was silence, and then Groga said, “What do you mean?”</p>



<p>“Where are the children? Where do the babies go?”</p>



<p>“If they are desired, they are raised, as in any land.”</p>



<p>“If they are not desired?”</p>



<p>“Then they are given purpose.”</p>



<p>“Given purpose.”</p>



<p>“Yes.”</p>



<p>“And whose decision is that?”</p>



<p>“It is made for the best of society, and the family.”</p>



<p>“That was not my question.”</p>



<p>“The men involved make the decision.”</p>



<p>“Not the woman?”</p>



<p>“No, of course not.”</p>



<p>Doris bowed her head. “I understand. I hope you will understand I am only a messenger, but this will be a source of difficulty between our nations. If a woman desires her child, she will be welcome in our kingdom, and she will have the opportunity to bring that child into the world and raise it up. And no one may order her otherwise.”</p>



<p>“And if she does not desire it? If the child would be a scandal or a deadly burden on her family? If it would be one too many, taking already precious food from the mouths of those already growing, or if its life would bring strife and even war over inheritance and birthrights? If she does not want it, how do you dispose of it? Toss it into a cesspool, or feed it to pigs?”</p>



<p>Again, Doris was silent, and again Josheb found himself disappointed. He wanted to know the answer. Or, more accurately, he wanted to believe that in her fairy kingdom, no child was ever exposed or sacrificed because no child was ever unwanted, no child ever such a burden on its family that its disposal was required.</p>



<p>Before she could find the words to respond, though, everyone’s attention was drawn to a distant sound, a woman’s voice wailing, faint through many walls and doors. It came from somewhere outside, almost certainly.</p>



<p>All diners looked to one another in wonder, and then Aiham Píe turned his eyes on the head waiter, who bowed and exited. Together the diners waited. Presently, they began to hear a commotion of discussion in the corridor, and then Adam the butler entered the dining hall, went directly to Aiham, and spoke into his ear. He nodded.</p>



<p>“An accident among the serving staff,” he explained to the assembly in Faenish. Josheb understood him well enough. “Nothing to worry about.”</p>



<p>Doris pushed herself back from the table and stood.</p>



<p>“My lady?” asked Groga, but Josheb did not ask. He just stood with her and followed her as she proceeded out of the dining hall. They found servants in the corridor discussing now in hushed tones, and Josheb approached them.</p>



<p>“Which way?” he ordered. A couple of the ladies pointed. Josheb led the way, now, with Doris in tow, and followed the clues to the front door and out. There a crowd was already gathered, and Josheb pushed through it, making a path for his client and mistress.</p>



<p>The last bystanders parted, and Josheb and Doris together beheld the girl broken over the stones, blue dress glittering and white feathers shining in the floodlights and decorative lights of the garden. Josheb felt as if something vital had been ripped out of his gut.</p>



<p>“Who is it?” breathed Doris. She looked up at him and saw the expression on his face. “Josh, who is it?” she asked again, her voice turning desperate.</p>
`,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

async function getImageDimensions(
  filePath: string,
): Promise<{ width: number; height: number } | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharp = require('sharp');
    const metadata = await sharp(filePath).metadata();
    if (metadata.width && metadata.height) {
      return { width: metadata.width, height: metadata.height };
    }
    return null;
  } catch {
    return null;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('=== AECMS Content Seed Script ===\n');

  // --------------------------------------------------
  // 0. Look up owner user
  // --------------------------------------------------
  const owner = await prisma.user.findUnique({
    where: { email: 'owner@aecms.local' },
    select: { id: true },
  });

  if (!owner) {
    throw new Error('Owner user not found. Run the base seed script first: npx prisma db seed');
  }

  const ownerId = owner.id;
  console.log(`Owner user ID: ${ownerId}\n`);

  // --------------------------------------------------
  // 1. Create Media records for images already in repo
  // --------------------------------------------------
  console.log('[1/4] Creating Media records from wp-import images...');

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  let mediaCreated = 0;
  let mediaSkipped = 0;
  const mediaByFilename: Record<string, string> = {};

  const imageFiles = fs.existsSync(UPLOADS_DIR)
    ? fs.readdirSync(UPLOADS_DIR).filter((f) => /\.(jpg|jpeg|png|webp|gif)$/i.test(f))
    : [];

  for (const filename of imageFiles) {
    const filePath = path.join(UPLOADS_DIR, filename);
    const stat = fs.statSync(filePath);
    const mimeType = getMimeType(filename);
    const dimensions = await getImageDimensions(filePath);

    const existing = await prisma.media.findFirst({
      where: { file_path: filePath },
      select: { id: true },
    });

    if (existing) {
      mediaByFilename[filename] = existing.id;
      mediaSkipped++;
      continue;
    }

    const media = await prisma.media.create({
      data: {
        filename,
        original_name: filename,
        mime_type: mimeType,
        size: stat.size,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        file_path: filePath,
        uploaded_by: ownerId,
      },
    });

    mediaByFilename[filename] = media.id;
    mediaCreated++;
    console.log(`  ✓ ${filename} (${media.id})`);
  }

  console.log(`\nMedia: ${mediaCreated} created, ${mediaSkipped} already existed\n`);

  // --------------------------------------------------
  // 2. Create Categories
  // --------------------------------------------------
  console.log('[2/4] Creating article categories...');

  const categoryNames = ['Fiction', 'Non-Fiction'];
  const categoryMap: Record<string, string> = {};

  for (const name of categoryNames) {
    const slug = slugify(name);
    const category = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
    categoryMap[name] = category.id;
    console.log(`  ✓ Category: ${name} (${category.id})`);
  }

  // --------------------------------------------------
  // 3. Create Tags
  // --------------------------------------------------
  console.log('\n[3/4] Creating tags...');

  const allTagNames = Array.from(
    new Set(Object.values(ARTICLE_TAGS).flat()),
  );

  const tagMap: Record<string, string> = {};

  for (const name of allTagNames) {
    const slug = slugify(name);
    const tag = await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
    tagMap[name] = tag.id;
    console.log(`  ✓ Tag: ${name} (${tag.id})`);
  }

  // --------------------------------------------------
  // 4a. Create Articles
  // --------------------------------------------------
  console.log('\n[4a/4] Creating articles...');

  let articlesCreated = 0;
  let articlesSkipped = 0;

  for (const raw of ARTICLES) {
    const title = ARTICLE_TITLES[raw.wp_id] ?? raw.slug;
    const excerpt =
      ARTICLE_EXCERPTS[raw.wp_id] ??
      (raw.excerpt && raw.excerpt.trim() ? raw.excerpt.trim() : undefined);
    const categoryName = ARTICLE_CATEGORIES[raw.wp_id];
    const tagNames = ARTICLE_TAGS[raw.wp_id] ?? [];

    const existing = await prisma.article.findUnique({
      where: { slug: raw.slug },
      select: { id: true },
    });

    if (existing) {
      console.log(`  [SKIP] Article already exists: ${raw.slug}`);
      articlesSkipped++;
      if (categoryName && categoryMap[categoryName]) {
        await prisma.articleCategory
          .upsert({
            where: { article_id_category_id: { article_id: existing.id, category_id: categoryMap[categoryName] } },
            update: {},
            create: { article_id: existing.id, category_id: categoryMap[categoryName] },
          })
          .catch(() => {});
      }
      for (const tagName of tagNames) {
        if (tagMap[tagName]) {
          await prisma.articleTag
            .upsert({
              where: { article_id_tag_id: { article_id: existing.id, tag_id: tagMap[tagName] } },
              update: {},
              create: { article_id: existing.id, tag_id: tagMap[tagName] },
            })
            .catch(() => {});
        }
      }
      continue;
    }

    const article = await prisma.article.create({
      data: {
        title,
        slug: raw.slug,
        content: raw.content,
        excerpt: excerpt ?? null,
        status: 'published',
        visibility: 'public',
        author_id: ownerId,
        author_can_edit: true,
        author_can_delete: true,
        admin_can_edit: true,
        admin_can_delete: true,
        published_at: new Date(raw.wp_date),
        created_at: new Date(raw.wp_date),
      },
    });

    if (categoryName && categoryMap[categoryName]) {
      await prisma.articleCategory.create({
        data: { article_id: article.id, category_id: categoryMap[categoryName] },
      });
    }

    for (const tagName of tagNames) {
      if (tagMap[tagName]) {
        await prisma.articleTag.create({
          data: { article_id: article.id, tag_id: tagMap[tagName] },
        });
      }
    }

    articlesCreated++;
    console.log(`  ✓ Article: "${title}" (${article.id})`);
  }

  console.log(`\nArticles: ${articlesCreated} created, ${articlesSkipped} already existed\n`);

  // --------------------------------------------------
  // 4b. Create Products
  // --------------------------------------------------
  console.log('[4b/4] Creating products...');

  let productsCreated = 0;
  let productsSkipped = 0;

  for (const prod of PRODUCTS) {
    const existing = await prisma.product.findUnique({
      where: { slug: prod.slug },
      select: { id: true },
    });

    if (existing) {
      console.log(`  [SKIP] Product already exists: ${prod.slug}`);
      productsSkipped++;
      continue;
    }

    const product = await prisma.product.create({
      data: {
        name: prod.name,
        slug: prod.slug,
        description: prod.description,
        short_description: prod.short_description,
        price: prod.price,
        sku: prod.sku,
        stock_quantity: null,
        stock_status: prod.stock_status,
        product_type: prod.product_type,
        visibility: prod.visibility,
        status: prod.status,
        author_can_edit: true,
        author_can_delete: true,
        admin_can_edit: true,
        admin_can_delete: true,
        published_at: new Date(),
      },
    });

    productsCreated++;
    console.log(`  ✓ Product: "${prod.name}" (${product.id})`);
  }

  console.log(`\nProducts: ${productsCreated} created, ${productsSkipped} already existed\n`);

  // --------------------------------------------------
  // Summary
  // --------------------------------------------------
  console.log('=== Seed Summary ===');
  console.log(`Media records:   ${mediaCreated} created, ${mediaSkipped} skipped`);
  console.log(`Articles:        ${articlesCreated} created, ${articlesSkipped} skipped`);
  console.log(`Products:        ${productsCreated} created, ${productsSkipped} skipped`);
  console.log('\nContent seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error during content seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
