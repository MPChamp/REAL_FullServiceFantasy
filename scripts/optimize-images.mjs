import sharp from 'sharp';
import { readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC_DIR = join(ROOT, '..', 'player images');
const OUT_DIR = join(ROOT, 'public', 'images', 'players');

mkdirSync(OUT_DIR, { recursive: true });

const files = readdirSync(SRC_DIR).filter(f => f.endsWith('.png'));
console.log(`Found ${files.length} player images to optimize...`);

for (const file of files) {
  const id = file.replace('.png', '');
  const src = join(SRC_DIR, file);

  // Full size (400x400)
  await sharp(src)
    .resize(400, 400, { fit: 'cover', position: 'top' })
    .webp({ quality: 80 })
    .toFile(join(OUT_DIR, `${id}.webp`));

  // Thumbnail (100x100)
  await sharp(src)
    .resize(100, 100, { fit: 'cover', position: 'top' })
    .webp({ quality: 75 })
    .toFile(join(OUT_DIR, `${id}-thumb.webp`));

  console.log(`  Optimized: ${file} -> ${id}.webp + ${id}-thumb.webp`);
}

console.log('Done! All images optimized.');
