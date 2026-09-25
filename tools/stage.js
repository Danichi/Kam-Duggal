/**
 * Builds .deploy/, the only directory Cloudflare Pages is given.
 *
 * `wrangler pages deploy` uploads every file in its output directory and does
 * NOT honour .assetsignore, so anything sitting in the project root is served
 * publicly. That is how .dev.vars, the drafts and lib/ ended up readable on the
 * live site. Staging the upload is the only reliable way to keep them off it.
 *
 * Run this before every deploy: node tools/stage.js && wrangler pages deploy
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.deploy');

/** Never upload these. Anything not listed here is treated as public. */
const KEEP_BACK = [
  '.git', '.wrangler', '.deploy', 'node_modules', 'tools',
  'wrangler.toml', '.assetsignore', '.gitignore', 'package.json', 'package-lock.json',
  'README.md', 'PROPOSAL.md'
];
const KEEP_BACK_RE = [/^\.dev\.vars/, /^EMAIL-.*\.md$/i, /\.md$/i];

const blocked = name => KEEP_BACK.includes(name) || KEEP_BACK_RE.some(re => re.test(name));

function copy(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copy(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let files = 0;
for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (blocked(entry.name)) continue;
  const src = path.join(ROOT, entry.name);
  const dst = path.join(OUT, entry.name);
  if (entry.isDirectory()) copy(src, dst);
  else fs.copyFileSync(src, dst);
  files++;
}

// functions/ is compiled by Pages, never served, so _lib rides along safely
const must = ['index.html', 'functions', 'css', 'js', 'img'];
const missing = must.filter(m => !fs.existsSync(path.join(OUT, m)));
if (missing.length) throw new Error('staging is missing: ' + missing.join(', '));

for (const gone of ['.dev.vars', 'README.md', 'PROPOSAL.md', 'wrangler.toml']) {
  if (fs.existsSync(path.join(OUT, gone))) throw new Error('private file reached staging: ' + gone);
}

console.log('staged ' + files + ' top-level entries into .deploy/');
