/**
 * Builds js/data.js and img/art/*.webp from the Pixels scrape.
 *
 *   node tools/build-art.js
 *
 * Source: tools/source/pixels-paintings.json (tools/scrape-pixels.js) and the
 * 1200px renders in tools/originals/ (tools/fetch-large.js). The CURATED list
 * below is the edit: it drops photographs and duplicate uploads, cleans up
 * titles and assigns each piece a palette for the Originals filter.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const src = JSON.parse(fs.readFileSync(path.join(__dirname, 'source/pixels-paintings.json')));
const bySlug = Object.fromEntries(src.map(p => [p.slug, p]));

// slug, display title, palette, flags (f = featured on home, w = photographed on a wall, x = watermark)
const CURATED = [
  ['new-voyage', 'New Voyage', 'ember', 'f'],
  ['abhasa-reflection-of-consciousness', 'Abhasa', 'gold', 'f'],
  ['crimson-currents', 'Crimson Currents', 'crimson', ''],
  ['flp-66', 'FLP 66', 'ocean', ''],
  ['purplerane', 'Purplerane', 'crimson', ''],
  ['distant-galaxy', 'Distant Galaxy', 'night', 'f'],
  ['anadi', 'Anadi', 'ember', 'f'],
  ['silverlite', 'Silverlite', 'crimson', ''],
  ['ablaze', 'Ablaze', 'ember', 'f'],
  ['flp-65', 'FLP 65', 'ocean', ''],
  ['flp64', 'FLP 64', 'ocean', ''],
  ['1-twilight', 'Reborn', 'ocean', ''],
  ['1-after-burn', 'After Burn', 'ember', ''],
  ['1-misty-mountain', 'Misty Mountain', 'ember', ''],
  ['2-the-phoenix', 'The Phoenix', 'ember', ''],
  ['wall-street-bull', 'Wall Street Bull', 'ember', ''],
  ['2-eruption', 'Eruption', 'ember', 'x'],
  ['release-p', 'Release', 'crimson', 'f'],
  ['2-bloom', 'Bloom', 'crimson', 'w'],
  ['celestial', 'Celestial', 'crimson', 'w'],
  ['1-dori', 'Dori', 'crimson', 'x'],
  ['distant-star', 'Distant Star', 'night', ''],
  ['howling-moon', 'Howling Moon', 'night', 'f'],
  ['mystic-vase', 'Mystic Vase', 'night', 'f'],
  ['1sc', '1SC', 'night', 'w'],
  ['2-becoming', 'Becoming', 'night', 'w'],
  ['1-out-of-the-blue-and-into-a-dream', 'Out of the Blue and into a Dream', 'ocean', 'x'],
  ['24-x-48-2012', 'Untitled, 2012', 'gold', ''],
  ['2-the-relic', 'The Relic', 'gold', ''],
  ['fun-day', 'Fun Day', 'gold', 'x'],
  ['vase', 'Vase', 'gold', ''],
  ['1-spring-day', 'Spring Day', 'gesture', ''],
  ['1-war-and-peace', 'War and Peace', 'gesture', ''],
  ['coda', 'Coda', 'gesture', ''],
  ['wireless', 'Wireless', 'gesture', ''],
  ['festive-day', 'Festive Day', 'gesture', 'w'],
  ['3-while-my-guitar', 'While My Guitar', 'gesture', 'w'],
  ['mu4yte-mathematical-universe-4-you-to-entangle', 'MU4YTE', 'gesture', ''],
  ['simplexity', 'Simplexity', 'gesture', 'w'],
  ['cloudy-day', 'Cloudy Day', 'spectrum', 'x'],
  ['back-to-earth', 'Back to Earth', 'spectrum', ''],
  ['global-warming', 'Global Warming', 'spectrum', ''],
  ['summer-breeze', 'Summer Breeze', 'spectrum', ''],
  ['2-summer-breeze', 'Summer Breeze II', 'spectrum', ''],
  ['long-cool-day', 'Long Cool Day', 'spectrum', 'x'],
  ['nite-fall', 'Nite Fall', 'spectrum', 'x'],
  ['play-full', 'Play Full', 'spectrum', 'x'],
  ['slipstream', 'Slipstream', 'spectrum', 'x'],
  ['limelite', 'Stormy Monday', 'spectrum', 'w']
];

// What Kam himself has said about a piece. Pixels has no per-painting stories,
// only his one shared statement; these come from the few listings where he
// wrote a note of his own. Add to this as he sends more.
const STORIES = {
  'anadi': 'Anadi means without beginning.',
  'abhasa-reflection-of-consciousness': 'Abhasa: the reflection of consciousness. Painted in February 2012.',
  'mu4yte-mathematical-universe-4-you-to-entangle': 'MU4YTE: Mathematical Universe 4 You To Entangle.',
  '24-x-48-2012': 'Painted in February 2012.',
  'summer-breeze': 'The original comes with a decorative frame.'
};

// The listing's "Medium" field (tools/source/mediums.txt), falling back to
// Kam's own notes when the field is just "Painting".
const MEDIUMS = Object.fromEntries(fs.readFileSync(path.join(__dirname, 'source/mediums.txt'), 'utf8')
  .trim().split(/\r?\n/).map(l => l.split('|')));
function medium(slug, desc) {
  const d = ((MEDIUMS[slug] || '') + ' ' + desc).toLowerCase();
  const surface = /canvas board/.test(d) ? 'canvas board' : /\bboard\b/.test(d) ? 'board' : /c(a|na|an)vas/.test(d) ? 'canvas' : '';
  const paint = /oil/.test(d) ? 'Acrylic and oil' : 'Acrylic';
  if (/mixed media/.test(d)) return 'Mixed media';
  return surface ? `${paint} on ${surface}` : 'Acrylic';
}

const inches = s => s ? s.split(' x ').slice(0, 2).map(n => +parseFloat(n).toFixed(2)) : null;

const out = [];
for (const [slug, title, palette, flags] of CURATED) {
  const p = bySlug[slug];
  if (!p) throw new Error('Missing ' + slug);
  const jpg = path.join(__dirname, 'originals', slug + '.jpg');
  const [pw, ph] = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', jpg]).toString().trim().split(',').map(Number);
  for (const [suffix, w] of [['', 1200], ['-sm', 560]]) {
    const dest = path.join(ROOT, 'img/art', slug + suffix + '.webp');
    if (!fs.existsSync(dest)) {
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', jpg, '-vf', `scale='min(${w},iw)':-2`, '-quality', suffix ? '78' : '84', dest]);
    }
  }
  // Kam's own note after the shared statement. Pixels appends machine-written
  // alt text ("A mesmerizing array of...") to many listings; that is not his and is dropped.
  const notes = p.desc.replace(/^I am an improvisational artist[\s\S]*?creating them\.\s*/, '').trim();
  let size = inches(p.dims);
  // Listings are inconsistent about width x height; trust the photo's orientation.
  if (size && (pw > ph) !== (size[0] > size[1]) && size[0] !== size[1]) size = [size[1], size[0]];
  const flow = /flow paint|brush ?less/i.test((MEDIUMS[slug] || '') + notes);
  out.push({
    slug, title, palette,
    featured: flags.includes('f'),
    wall: flags.includes('w'),
    medium: medium(slug, notes),
    flow, // Kam's brushless flow-paint technique, per his listing
    size, // [width, height] in inches, as listed on Pixels
    ratio: +(pw / ph).toFixed(4),
    original: p.status === 'available' ? 'available' : 'inquire',
    price: p.price && p.price.startsWith('$') ? p.price : null,
    printsFrom: +p.printFrom > 0 && +p.printFrom < 2000 ? Math.round(+p.printFrom) : null,
    year: /2012/.test(notes + title) ? 2012 : null,
    story: STORIES[slug] || '',
    shop: p.url
  });
}

const header = '// Generated by tools/build-art.js. Edit the CURATED list there, not this file.\n';
fs.writeFileSync(path.join(ROOT, 'js/data.js'), header + 'window.PAINTINGS = ' + JSON.stringify(out, null, 1) + ';\n');
console.log(out.length, 'paintings;', out.filter(p => p.featured).length, 'featured');
