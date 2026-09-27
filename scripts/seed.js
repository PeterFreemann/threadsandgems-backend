// Loads the store's current 27 products, 4 categories and default settings into MongoDB.
//
//   npm run seed                                  -> products without photos
//   IMAGES_DIR=../threadsandgems/images npm run seed  -> also uploads each photo to Cloudinary
//   npm run seed -- --force                       -> overwrite products that already exist
//
// Safe to run more than once: existing products (matched by their old id) are skipped unless --force.
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDb } from '../src/config/db.js';
import { cloudinary, cloudinaryReady } from '../src/config/cloudinary.js';
import Category from '../src/models/Category.js';
import Product from '../src/models/Product.js';
import { getSettings } from '../src/models/Setting.js';

const force = process.argv.includes('--force');
const imagesDir = process.env.IMAGES_DIR ? path.resolve(process.env.IMAGES_DIR) : null;

const CATEGORIES = [
  { name: 'Ankara', slug: 'ankara' },
  { name: 'Native Wear', slug: 'native' },
  { name: 'Occasion', slug: 'occasion' },
  { name: 'Everyday', slug: 'everyday' },
];

const KAFTAN = 'A beautifully embroidered kaftan dress perfect for any occasion.';

// From ALL_PRODUCTS in the storefront's app/product/[id]/page.tsx (the most complete list).
const PRODUCTS = [
  [1, 'Ankara Two-Piece Set', 4500, 'ankara', 'A stunning co-ord crafted from premium Ankara fabric. The bold geometric print celebrates West African textile tradition, tailored into a modern silhouette perfect for owambes, brunches, and everything in between.'],
  [2, 'Nigerian Native Agbada', 2500, 'native', 'A regal three-piece Agbada set expertly finished with hand-embroidered detailing at the neckline and sleeves. Made for the man who walks into a room and commands it.'],
  [3, 'Ankara Wrap Dress', 3000, 'ankara', 'A figure-flattering wrap silhouette cut from vibrant Ankara print. Versatile enough for casual outings yet striking enough for formal occasions — this dress does it all.'],
  [4, 'Aso-Oke Occasion Set', 2500, 'native', 'Woven from authentic Aso-Oke fabric in rich earth tones and gold thread. This occasion set is the definition of understated elegance — perfect for traditional ceremonies and owambe celebrations.'],
  [5, 'Ankara Peplum Blouse & Skirt', 3000, 'ankara', 'A two-piece featuring a structured peplum blouse paired with a fitted midi skirt, both cut from the same vibrant Ankara print. Polished, bold, and unmistakably Nigerian.'],
  [6, 'Embroidered Kaftan Dress', 3000, 'native', 'A flowing kaftan dress featuring intricate hand-embroidery across the bodice and hem. Effortlessly elegant and rooted in tradition — wear it and feel the culture.'],
  [7, 'Royal Embroidered Kaftan', 3000, 'native', 'A majestic kaftan in deep jewel tones, adorned with gold-thread embroidery along the collar and cuffs. Designed for those who carry tradition with pride and elegance.'],
  [8, 'Brocade Senator Set', 3000, 'native', 'A sharp senator two-piece in premium brocade fabric. Tailored for the modern Nigerian man who values heritage as much as style — equally at home at a boardroom meeting or an owambe.'],
  [9, 'Lace Occasion Gown', 3000, 'native', 'A full-length gown crafted from rich Nigerian lace, with a fitted bodice and flowing skirt. The kind of piece that makes a room go quiet when you walk in.'],
  [10, 'Adire Print Midi Dress', 3000, 'native', 'Cut from hand-dyed Adire fabric in indigo and ivory, this midi dress brings the craft of Yoruba textile art into your everyday wardrobe. Wearable culture at its finest.'],
  [11, 'Aso-Ebi Skirt & Blouse', 3000, 'native', 'A classic Aso-Ebi co-ord in coordinated lace and Aso-Oke, designed to be worn as a set or styled separately. A wardrobe staple for every Nigerian celebration.'],
  [12, 'Damask Agbada Set', 3000, 'native', 'A three-piece Agbada in luxurious damask fabric with tonal embroidery at the chest and hem. Rich, commanding, and thoroughly timeless.'],
  [13, 'Gold-Trim Kaftan Gown', 3000, 'native', 'A floor-length kaftan gown trimmed with gold ribbon detailing along the neckline and sleeves. Effortlessly regal — dress it up with statement jewellery or let the piece speak for itself.'],
  [14, 'Velvet Senator Suit', 3000, 'native', 'A two-piece senator suit in plush velvet with contrast embroidery. The texture adds depth and luxury — perfect for evening events and high-profile occasions.'],
  [15, 'Organza Overlay Gown', 3000, 'native', 'A statement gown with a structured inner dress and a sheer organza overlay, embellished with subtle floral detail. Designed for the woman who wants to be remembered.'],
  [16, 'Tie-Dye Kaftan Set', 3000, 'native', 'A relaxed two-piece kaftan set in earthy tie-dye tones. Comfortable enough for everyday wear, distinctive enough to turn heads wherever you go.'],
  [17, 'Embellished Iro & Buba', 3000, 'native', 'A classic Iro and Buba in coordinating Aso-Oke and lace, finished with crystal bead embellishments at the neckline. A timeless silhouette reimagined for the modern woman.'],
  [18, 'Nigerian Bridal Kaftan', 3000, 'native', 'A bridal-worthy kaftan in ivory and champagne tones, with intricate hand-sewn beading across the bodice. For the bride who wants to honour her roots on the most important day of her life.'],
  // 19-27 share a placeholder name in the store. Rename them in the admin after seeding.
  ...[19, 20, 21, 22, 23, 24, 25, 26, 27].map((id) => [id, `Embroidered Kaftan Dress ${id}`, 3000, 'native', KAFTAN]),
];

// Store image files are "cloth" + N letter s + ".png". Product 1 uses 4 s's, each next product
// adds one, and the store skips one file name before product 23.
function imageFileFor(id) {
  const count = id <= 22 ? id + 3 : id + 4;
  return `cloth${'s'.repeat(count)}.png`;
}

const slugify = (text) => text.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

async function uploadImage(id, name) {
  if (!imagesDir) return [];
  if (!cloudinaryReady) {
    console.warn('  IMAGES_DIR is set but Cloudinary keys are missing, so photos are skipped.');
    return [];
  }
  const file = path.join(imagesDir, imageFileFor(id));
  if (!fs.existsSync(file)) {
    console.warn(`  Photo not found: ${file}`);
    return [];
  }
  const result = await cloudinary.uploader.upload(file, {
    folder: env.CLOUDINARY_FOLDER,
    public_id: `legacy-${id}`,
    overwrite: true,
  });
  return [{ url: result.secure_url, alt: name }];
}

async function run() {
  await connectDb();

  const categoryIds = {};
  for (const [position, c] of CATEGORIES.entries()) {
    const doc = await Category.findOneAndUpdate(
      { slug: c.slug },
      { $setOnInsert: { ...c, position } },
      { new: true, upsert: true }
    );
    categoryIds[c.slug] = doc._id;
  }
  console.log(`Categories ready: ${CATEGORIES.map((c) => c.name).join(', ')}`);

  await getSettings();
  console.log('Store settings ready (VAT 20% included in prices, free shipping, UK/IE/FR/DE).');

  let created = 0;
  let skipped = 0;
  for (const [id, name, pricePence, category, details] of PRODUCTS) {
    const exists = await Product.exists({ legacyId: id });
    if (exists && !force) {
      skipped += 1;
      continue;
    }
    console.log(`${exists ? 'Updating' : 'Adding'} ${id}. ${name}`);
    const images = await uploadImage(id, name);
    const data = {
      legacyId: id,
      name,
      slug: slugify(name),
      shortDescription: '',
      details,
      pricePence,
      categoryId: categoryIds[category],
      stock: 10,
      status: 'active',
      featured: id <= 3,
      ...(images.length ? { images } : {}),
    };
    await Product.findOneAndUpdate({ legacyId: id }, { $set: data }, { upsert: true, runValidators: true });
    created += 1;
  }

  console.log(`\nDone. ${created} products added or updated, ${skipped} already existed.`);
  console.log('Every product starts with 10 in stock. Update real stock levels in the admin.');
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
