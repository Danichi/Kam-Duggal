/**
 * The little assistant in the corner.
 *
 * Nothing is generated. It scores what the visitor typed against the tags in
 * js/chat-kb.js and replays the answer written there, so it can only say
 * things Kam has approved. On top of that it can read the collection itself,
 * which is what lets it answer "is Fun Day available" or "show me blue ones"
 * without anyone writing those out one painting at a time.
 *
 * Anything it cannot place sends the visitor to Kam rather than guessing.
 */
(function () {
  const KD = window.KD || (window.KD = {});
  const KB = KD.CHAT_KB || [];
  const SYN = KD.CHAT_SYNONYMS || {};
  const P = () => window.PAINTINGS || [];
  const esc = KD.esc || (s => String(s ?? ''));

  /* ---------- facts the answers fill themselves in with ---------- */

  const location = () => {
    // direct child only: the copyright span has a nested year span inside it
    const el = document.querySelector('.foot-base > span:last-child');
    const txt = el && el.textContent.trim();
    return txt && txt.length < 60 ? txt : 'Amherstburg, Ontario, Canada';
  };

  const priced = () => P().filter(p => p.price && /\d/.test(p.price));
  const toNum = p => Number(String(p.price).replace(/[^\d.]/g, '')) || 0;

  function priceRange() {
    const list = priced();
    if (!list.length) return 'Every painting here is <b>Price on request</b>, confirmed by Kam directly.';
    const nums = list.map(toNum).filter(Boolean).sort((a, b) => a - b);
    if (!nums.length) return 'Some paintings show a price on the site.';
    const money = n => '$' + n.toLocaleString('en-US');
    return list.length === 1
      ? `One painting shows a price at the moment, at ${money(nums[0])}.`
      : `The ones with a price on them run from ${money(nums[0])} to ${money(nums[nums.length - 1])}.`;
  }

  function sizeRange() {
    const sized = P().filter(p => p.size);
    if (!sized.length) return 'Sizes are listed on each painting.';
    const big = p => Math.max(p.size[0], p.size[1]);
    const sorted = [...sized].sort((a, b) => big(a) - big(b));
    const s = sorted[0], l = sorted[sorted.length - 1];
    return `They run from ${KD.size(s)} up to ${KD.size(l)} — ${esc(l.title)} is the largest.`;
  }

  const TOKENS = () => ({
    '{EMAIL}': KD.EMAIL || 'kamdugal@aol.com',
    '{SHOP}': KD.SHOP || 'https://kam-duggal.pixels.com/',
    '{LOCATION}': location(),
    '{COUNT}': String(P().length),
    '{AVAILABLE}': String(P().filter(p => p.original === 'available').length),
    '{PRICERANGE}': priceRange(),
    '{SIZERANGE}': sizeRange()
  });

  const fill = s => {
    const t = TOKENS();
    return Object.keys(t).reduce((out, k) => out.split(k).join(t[k]), s);
  };

  /* ---------- matching ---------- */

  const CONTRACTIONS = [
    [/\bwhat's\b/g, 'what is'], [/\bwhere's\b/g, 'where is'], [/\bhow's\b/g, 'how is'],
    [/\bit's\b/g, 'it is'], [/\bi'm\b/g, 'i am'], [/\bdon't\b/g, 'do not'],
    [/\bcan't\b/g, 'cannot'], [/\bdoesn't\b/g, 'does not'], [/\byou're\b/g, 'you are'],
    [/\bi'd\b/g, 'i would'], [/\bi've\b/g, 'i have'], [/\bthat's\b/g, 'that is']
  ];

  function norm(s) {
    let t = ' ' + String(s || '').toLowerCase() + ' ';
    CONTRACTIONS.forEach(([re, to]) => { t = t.replace(re, to); });
    return t.replace(/[^a-z0-9$ ]+/g, ' ').replace(/\s+/g, ' ');
  }

  const stem = w => {
    if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';   // replies -> reply
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
  };

  /**
   * Words that mean the same thing collapse to one concept, so an intent
   * tagged price/cost/expensive scores once for "how much", not three times.
   */
  const CANON = (() => {
    const m = {};
    Object.entries(SYN).forEach(([key, list]) => {
      m[stem(key)] = key;
      list.forEach(w => { m[stem(w)] = key; });
    });
    return m;
  })();
  const canon = w => CANON[stem(w)] || stem(w);

  function score(text, intent) {
    const said = new Set(text.trim().split(' ').filter(Boolean).map(canon));
    const counted = new Set();
    let n = 0;
    for (const tag of intent.tags) {
      if (tag.includes(' ')) {
        // a longer phrase is a more specific match than a short one
        if (text.includes(' ' + tag + ' ')) n += 2 + 1.5 * tag.split(' ').length;
      } else {
        const c = canon(tag);
        if (!counted.has(c) && said.has(c)) { counted.add(c); n += 2; }
      }
    }
    return n;
  }

  function bestIntent(text) {
    let top = null, best = 0;
    for (const intent of KB) {
      const s = score(text, intent);
      if (s > best) { best = s; top = intent; }
    }
    return best >= 2 ? top : null;
  }

  /* ---------- reading the collection ---------- */

  const findPainting = text => {
    let hit = null;
    for (const p of P()) {
      const t = norm(p.title).trim();
      if (t.length < 4) continue;
      if (text.includes(' ' + t + ' ') && (!hit || t.length > norm(hit.title).trim().length)) hit = p;
    }
    return hit;
  };

  const COLOURS = {
    ocean: ['blue', 'teal', 'aqua', 'turquoise', 'water', 'sea', 'ocean', 'cool tones'],
    crimson: ['red', 'crimson', 'wine', 'burgundy', 'maroon', 'pink'],
    ember: ['orange', 'fire', 'flame', 'ember', 'warm', 'sunset'],
    night: ['black', 'dark', 'night', 'galaxy', 'space', 'star', 'moon', 'purple'],
    gold: ['gold', 'yellow', 'ochre', 'bronze', 'brown', 'earth', 'beige', 'neutral'],
    gesture: ['splatter', 'drip', 'line', 'gesture', 'graphic'],
    spectrum: ['colourful', 'colorful', 'rainbow', 'multicolour', 'multicolor', 'bright']
  };

  function paintingCard(p) {
    const bits = [`<b>${esc(p.title)}</b>`, esc(p.medium), KD.size(p)].filter(Boolean);
    const avail = p.original === 'available'
      ? `Available · ${KD.price(p)}`
      : 'Ask about availability';
    return `${bits.join(' · ')}<br>${avail}<br>
      <a href="originals.html#${encodeURIComponent(p.slug)}">See the painting</a> ·
      <a href="${KD.inquire(p)}">Ask about it</a> ·
      <a href="${p.shop || KD.SHOP}" target="_blank" rel="noopener">Buy a print</a>`;
  }

  /** Answers that need the collection rather than a written-out reply. */
  function dynamic(text) {
    const p = findPainting(text);
    const wantsPrice = /\b(price|cost|much|expensive|worth)\b/.test(text);
    const wantsAvail = /\b(available|availability|sold|still|stock|left)\b/.test(text);

    if (p) {
      if (wantsPrice && wantsAvail) return { a: [paintingCard(p), 'Kam confirms both when you ask about a piece, since the site can be a step behind a sale.'] };
      if (wantsPrice) {
        return {
          a: [p.price ? `<b>${esc(p.title)}</b> is listed at ${KD.price(p)}, at ${KD.size(p)}.`
            : `<b>${esc(p.title)}</b> is <b>Price on request</b> — Kam confirms that one directly.`,
          `<a href="${KD.inquire(p)}">Ask Kam about ${esc(p.title)}</a>`],
          chips: ['Why price on request?', 'Do you ship?']
        };
      }
      if (wantsAvail) {
        return {
          a: [p.original === 'available'
            ? `<b>${esc(p.title)}</b> is marked available.`
            : `<b>${esc(p.title)}</b> is marked “Ask about availability”.`,
          'Either way Kam confirms it himself, because the site can be a step behind a sale.',
          `<a href="${KD.inquire(p)}">Ask about ${esc(p.title)}</a>`]
        };
      }
      return { a: [paintingCard(p)], chips: ['How do I buy an original?', 'Do you ship?'] };
    }

    // browsing by colour
    for (const [key, words] of Object.entries(COLOURS)) {
      if (words.some(w => text.includes(' ' + w + ' '))) {
        const n = P().filter(x => x.palette === key).length;
        if (!n) continue;
        const label = (KD.PALETTES[key] || {}).name || key;
        return {
          a: [`${n} ${n === 1 ? 'painting sits' : 'paintings sit'} in the <b>${label}</b> family. ${(KD.PALETTES[key] || {}).blurb || ''}`,
            `<a href="originals.html?palette=${key}">See the ${label} paintings</a>`],
          chips: ['Show me large pieces', 'What is available now?']
        };
      }
    }

    // browsing by size
    if (/\b(big|large|huge|oversized|statement piece)\b/.test(text)) {
      const n = P().filter(x => KD.sizeClass(x) === 'large').length;
      return { a: [`${n} of them are over 24 inches on the long side.`, '<a href="originals.html?size=large">See the large paintings</a>'] };
    }
    if (/\b(small|little|tiny|compact)\b/.test(text)) {
      const n = P().filter(x => KD.sizeClass(x) === 'small').length;
      return { a: [`${n} are 16 inches or under.`, '<a href="originals.html?size=small">See the small paintings</a>'] };
    }

    // what can I actually buy
    if (/\bwhat is available|what can i buy|show me available|anything available\b/.test(text)) {
      const list = P().filter(x => x.original === 'available');
      const names = list.slice(0, 5).map(x => esc(x.title)).join(', ');
      return {
        a: [`${list.length} of the ${P().length} are marked available.`,
          `A few of them: ${names}.`,
          '<a href="originals.html">See the whole collection</a>'],
        chips: ['How do I buy an original?', 'How much are they?']
      };
    }

    // the ones Kam is putting forward
    if (/\b(recommend|suggest|favourite|favorite|best|popular|featured|start|where do i)\b/.test(text)) {
      const f = P().filter(x => x.featured).slice(0, 4);
      if (f.length) {
        return {
          a: ['Kam puts these four on the front page, so they are the ones he would show you first:',
            f.map(x => `<a href="originals.html#${encodeURIComponent(x.slug)}">${esc(x.title)}</a> · ${KD.size(x)}`).join('<br>')],
          chips: ['What is available now?', 'How much are they?']
        };
      }
    }

    return null;
  }

  /* ---------- the widget ---------- */

  const OPENERS = ['How do I buy an original?', 'Do you sell prints?', 'Do you ship?', 'Do you take commissions?'];

  let root, log, form, input, open = false, greeted = false;

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  function build() {
    root = el('div', 'kchat');
    root.innerHTML = `
      <button type="button" class="kchat-launch" id="kchat-launch" aria-expanded="false" aria-controls="kchat-panel">
        <svg viewBox="0 0 24 24" aria-hidden="true" class="kchat-ico-open"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.5A8 8 0 1 1 21 12Z"/></svg>
        <svg viewBox="0 0 24 24" aria-hidden="true" class="kchat-ico-close"><path d="M6 6l12 12M18 6L6 18"/></svg>
        <span class="sr-only">Ask about the paintings</span>
      </button>
      <div class="kchat-panel" id="kchat-panel" role="dialog" aria-label="Ask about the paintings" hidden>
        <div class="kchat-head">
          <div>
            <b>Ask about the paintings</b>
            <span>Kam’s own answers</span>
          </div>
          <button type="button" class="kchat-x" id="kchat-x" aria-label="Close"></button>
        </div>
        <div class="kchat-log" id="kchat-log" role="log" aria-live="polite"></div>
        <form class="kchat-form" id="kchat-form">
          <label class="sr-only" for="kchat-input">Your question</label>
          <input id="kchat-input" autocomplete="off" placeholder="Ask a question…" maxlength="300">
          <button type="submit" aria-label="Send">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>
          </button>
        </form>
      </div>`;
    document.body.appendChild(root);

    log = root.querySelector('#kchat-log');
    form = root.querySelector('#kchat-form');
    input = root.querySelector('#kchat-input');

    root.querySelector('#kchat-launch').addEventListener('click', toggle);
    root.querySelector('#kchat-x').addEventListener('click', () => toggle(false));
    form.addEventListener('submit', e => { e.preventDefault(); send(input.value); });

    log.addEventListener('click', e => {
      const chip = e.target.closest('.kchat-chip');
      if (chip) { send(chip.textContent); return; }
      const a = e.target.closest('a[href]');
      if (a && !a.target) sessionStorage.setItem('kchat-open', '1');
    });

    addEventListener('keydown', e => { if (e.key === 'Escape' && open) toggle(false); });

    // keep clear of the editor bar when Kam is signed in
    const bar = () => document.querySelector('.admin-bar');
    const watch = () => root.classList.toggle('with-bar', Boolean(bar() && !bar().hidden));
    watch();
    new MutationObserver(watch).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'], childList: true });
  }

  function toggle(to) {
    open = typeof to === 'boolean' ? to : !open;
    root.classList.toggle('open', open);
    root.querySelector('#kchat-panel').hidden = !open;
    root.querySelector('#kchat-launch').setAttribute('aria-expanded', String(open));
    try { open ? sessionStorage.setItem('kchat-open', '1') : sessionStorage.removeItem('kchat-open'); } catch {}
    if (open) {
      if (!greeted) { greeted = true; greet(); }
      setTimeout(() => input.focus(), 120);
    }
  }

  function bubble(who, html) {
    const b = el('div', 'kchat-msg ' + who, html);
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function chips(list) {
    if (!list || !list.length) return;
    const wrap = el('div', 'kchat-chips');
    list.forEach(c => wrap.appendChild(el('button', 'kchat-chip', esc(c))));
    wrap.querySelectorAll('button').forEach(b => b.type = 'button');
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  /** Several short bubbles read better than one long one, so answers arrive in turn. */
  async function say(messages, quick) {
    for (let i = 0; i < messages.length; i++) {
      const dots = bubble('bot typing', '<i></i><i></i><i></i>');
      await wait(i === 0 ? 260 : Math.min(620, 200 + messages[i - 1].length * 4));
      dots.remove();
      bubble('bot', fill(messages[i]));
    }
    chips(quick);
  }

  function greet() {
    say(["Hello. I can answer most things about Kam's paintings — buying, prints, commissions, delivery.",
      'Ask in your own words, or pick one of these.'], OPENERS);
  }

  const MISS = [
    'I do not have an answer for that one, and I would rather not guess about Kam\'s work.',
    'He answers these himself: <a href="contact.html">send him the question</a> and he will come back to you.'
  ];

  let busy = false;

  async function send(raw) {
    const q = String(raw || '').trim();
    if (!q || busy) return;
    busy = true;
    input.value = '';
    bubble('me', esc(q));

    const text = norm(q);
    const hit = dynamic(text);
    if (hit) {
      await say(hit.a, hit.chips);
    } else {
      const intent = bestIntent(text);
      if (intent) await say(intent.a, intent.chips);
      else await say(MISS, ['How do I buy an original?', 'Do you sell prints?', 'Do you ship?']);
    }
    busy = false;
  }

  /* ---------- go ---------- */
  if (!document.body) return;
  build();
  try { if (sessionStorage.getItem('kchat-open')) toggle(true); } catch {}

  /** Resolve a question without touching the DOM. Used by the coverage test. */
  function match(q) {
    const text = norm(q);
    const hit = dynamic(text);
    if (hit) return { via: 'collection', id: null, a: hit.a.map(fill) };
    const intent = bestIntent(text);
    if (intent) return { via: 'kb', id: intent.id, a: intent.a.map(fill) };
    return { via: 'miss', id: null, a: MISS.map(fill) };
  }

  KD.chat = { open: () => toggle(true), ask: send, match, debug: q => KB.map(i => [i.id, score(norm(q), i)]).sort((a, b) => b[1] - a[1]).slice(0, 4) };
})();
