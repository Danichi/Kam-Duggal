const fs = require('fs'); const { execFileSync } = require('child_process');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36';
const p = JSON.parse(fs.readFileSync('paintings.json'));
fs.mkdirSync('big', { recursive: true });
const dim = f => { try { return execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f]).toString().trim().split(',').map(Number); } catch { return [0, 0]; } };
for (const o of p) {
  const out = 'big/' + o.slug + '.jpg';
  if (fs.existsSync(out)) { o.px = dim(out); continue; }
  const path = o.img.replace(/^https:\/\/[^/]+\//, '');
  const [w, h] = [o.w, o.h];
  const W = Math.round(w / Math.min(w, h) * 20), H = Math.round(h / Math.min(w, h) * 20);
  const variants = [...new Set([path.replace('/mediumlarge/', '/medium/'), path, path.replace('images-medium-large', 'images-medium')])];
  let best = 'raw/' + o.slug + '.jpg', bd = dim(best);
  for (const v of variants) {
    const url = `https://render.pixels.com/images/rendered/large/print/${W}/${H}/break/${v}`;
    try { execFileSync('curl', ['-sfL', '-A', UA, '-o', 'tmp.jpg', url]); } catch { continue; }
    const d = dim('tmp.jpg');
    if (d[0] * d[1] > bd[0] * bd[1]) { fs.copyFileSync('tmp.jpg', out + '.part'); bd = d; best = out + '.part'; }
    break;
  }
  if (best.endsWith('.part')) fs.renameSync(best, out); else fs.copyFileSync(best, out);
  o.px = bd; console.log(o.slug, bd.join('x'));
}
fs.writeFileSync('paintings.json', JSON.stringify(p, null, 1));
