/* Shared chrome and helpers for every page. Loaded after js/data.js. */
(function () {
  const KD = (window.KD = window.KD || {});
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  KD.reduced = reduced;

  /* ---------- config ---------- */
  KD.SHOP = 'https://kam-duggal.pixels.com/';
  KD.EMAIL = 'kamdugal@aol.com';

  KD.PALETTES = {
    ember: { name: 'Ember', blurb: 'Fire, flame orange and deep night.', sw: ['#e0582a', '#f2b134', '#101216'], cover: 'new-voyage' },
    crimson: { name: 'Crimson', blurb: 'Reds, wine and silver currents.', sw: ['#9e1b2c', '#d0435a', '#cfc9c4'], cover: 'crimson-currents' },
    ocean: { name: 'Oceanic', blurb: 'Blues, teal and white water.', sw: ['#1b4f8a', '#3e8e9a', '#e6eef0'], cover: 'flp-66' },
    night: { name: 'Night Sky', blurb: 'Galaxies, moons and starlight.', sw: ['#0b0c1c', '#e3c341', '#3b2f8f'], cover: 'distant-galaxy' },
    gold: { name: 'Gold & Earth', blurb: 'Ochre, bronze and warm ground.', sw: ['#b8872d', '#6b4a24', '#e7c01c'], cover: 'abhasa-reflection-of-consciousness' },
    gesture: { name: 'Line & Gesture', blurb: 'Drips, splatter and shape.', sw: ['#e7c01c', '#c42a2a', '#1d4fa3'], cover: 'wireless' },
    spectrum: { name: 'Spectrum', blurb: 'Every colour at once.', sw: ['#e7c01c', '#2c5fb8', '#d0312d'], cover: 'back-to-earth' }
  };

  /* ---------- content Kam has edited (window.CONTENT, from /api/content.js) ---------- */
  const C = window.CONTENT || {};
  if (Array.isArray(C.paintings) && C.paintings.length) window.PAINTINGS = C.paintings;
  // hidden pieces stay out of every list on the site
  window.PAINTINGS = (window.PAINTINGS || []).filter(p => !p.hidden);

  const P = window.PAINTINGS;
  KD.bySlug = Object.fromEntries(P.map(p => [p.slug, p]));
  // an uploaded image wins over the one built into the site
  KD.img = (p, small) => {
    if (!p) p = P[0] || {};   // a piece can be hidden or removed out from under a reference
    return (small ? (p.imgSm || p.img) : (p.img || p.imgSm)) ||
      (p.slug ? `img/art/${p.slug}${small ? '-sm' : ''}.webp` : '');
  };
  KD.size = p => p.size ? `${fmt(p.size[0])} × ${fmt(p.size[1])} in` : 'Size on request';
  const fmt = n => String(+n.toFixed(1));
  KD.price = p => p.price || 'Price on request';
  KD.inquire = p => `artist.html?piece=${encodeURIComponent(p.slug)}#contact`;
  KD.sizeClass = p => {
    if (!p.size) return 'unknown';
    const long = Math.max(...p.size);
    return long <= 16 ? 'small' : long <= 24 ? 'medium' : 'large';
  };
  KD.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ICONS = {
    out: '<path d="M4 12 12 4M5.5 4H12v6.5" />',
    right: '<path d="M2 8h12M9.5 3.5 14 8l-4.5 4.5" />',
    left: '<path d="M14 8H2M6.5 3.5 2 8l4.5 4.5" />',
    close: '<path d="m3 3 10 10M13 3 3 13" />',
    mail: '<rect x="1.5" y="3.5" width="13" height="9" /><path d="m1.5 4 6.5 5 6.5-5" />',
    pin: '<path d="M8 15s5-4.6 5-8.5a5 5 0 1 0-10 0C3 10.4 8 15 8 15Z" /><circle cx="8" cy="6.5" r="1.8" />',
    shop: '<path d="M2.5 5.5h11l-1 9h-9l-1-9ZM5.5 5.5V4a2.5 2.5 0 0 1 5 0v1.5" />',
    zoom: '<circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3.5 3.5M7 5v4M5 7h4" />',
    wall: '<rect x="3.5" y="2.5" width="9" height="7" /><path d="M1 14h14M4 14v-2h8v2" />'
  };
  KD.icon = (name, cls = '') => `<svg class="ico-i ${cls}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="square" aria-hidden="true">${ICONS[name]}</svg>`;

  // Fill <i data-icon="..."> placeholders in static markup.
  document.querySelectorAll('[data-icon]').forEach(el => { el.outerHTML = KD.icon(el.dataset.icon, el.className); });

  /* ---------- editable text ---------- */
  // Every element matching one of these gets a stable key, so the editor can
  // save it and the site can put it back. JS-rendered lists are left out: their
  // words live in the painting data instead.
  const EDIT_SELECTORS = [
    '.hero .tag', '.hero .pills li', '.eyebrow', '.display', '.h2', '.h3', '.lede',
    'p.muted', '.spot-copy dd', '.steps h3', '.steps p', '.steps blockquote',
    '.about-copy p', '.about-portrait .hand', '.inquiries p',
    '.statement .body p', '.pillar h3', '.pillar p', '.timeline h3', '.timeline p',
    '.howto h3', '.howto p', '.faq summary', '.faq details p',
    '.contact-info .item p', '.prints-line .lede', '.stats-band .facts b',
    '.stats-band .facts span', '.foot-grid p', '.plate figcaption', '.strip-head .h2'
  ];
  const EDIT_SKIP = '#feature-grid, #gallery, #palette-grid, .strip-track, #wall, .lb, .admin-bar, .admin-modal, .alt-view, .showcase, .am-card, [data-count], #result-title, #result-count, #strip-label';
  const PAGE = (location.pathname.replace(/\/$/, '/index').split('/').pop() || 'index').replace(/\.html$/, '');

  /** Owner-written HTML, kept to plain formatting. */
  function safeHtml(html) {
    const t = document.createElement('template');
    t.innerHTML = String(html);
    t.content.querySelectorAll('script, style, iframe, object, embed, link, meta, form').forEach(n => n.remove());
    t.content.querySelectorAll('*').forEach(n => {
      [...n.attributes].forEach(a => {
        const v = String(a.value).replace(/\s+/g, '').toLowerCase();
        if (/^on/i.test(a.name) || (['href', 'src', 'xlink:href'].includes(a.name) && v.startsWith('javascript:'))) n.removeAttribute(a.name);
      });
    });
    return t.innerHTML;
  }

  KD.markEditable = function () {
    EDIT_SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach((el, i) => {
        if (el.closest(EDIT_SKIP) || el.hasAttribute('data-edit')) return;
        el.setAttribute('data-edit', PAGE + '|' + sel + '|' + i);
      });
    });
  };
  KD.markEditable();

  if (C.text) {
    Object.entries(C.text).forEach(([k, v]) => {
      const el = document.querySelector('[data-edit="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]');
      if (el) el.innerHTML = safeHtml(v);
    });
  }

  /* ---------- header ---------- */
  const header = document.querySelector('.site-header');
  let lastY = scrollY;
  function onScroll() {
    const y = scrollY;
    if (header) {
      header.classList.toggle('scrolled', y > 30);
      const hide = y > 420 && y > lastY + 4 && !root.classList.contains('menu-open');
      if (hide) header.classList.add('hide');
      else if (y < lastY - 4 || y < 420) header.classList.remove('hide');
      document.body.classList.toggle('header-hidden', header.classList.contains('hide'));
    }
    lastY = y;
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const menuBtn = document.querySelector('.menu-btn');
  if (menuBtn) {
    const setMenu = open => {
      root.classList.toggle('menu-open', open);
      menuBtn.setAttribute('aria-expanded', open);
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';
    };
    menuBtn.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
    document.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('menu-open')) setMenu(false); });
    matchMedia('(min-width: 1021px)').addEventListener('change', e => { if (e.matches) setMenu(false); });
  }

  /* ---------- reveal ---------- */
  KD.observe = function (scope = document) {
    const els = scope.querySelectorAll('.rv:not(.in), .rv-img:not(.in)');
    if (reduced || !('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    els.forEach(el => io.observe(el));
  };
  KD.observe();

  /* ---------- cursor ---------- */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced) {
    const dot = document.createElement('div');
    dot.className = 'cursor';
    document.body.appendChild(dot);
    let x = -100, y = -100, cx = x, cy = y;
    addEventListener('pointermove', e => { x = e.clientX; y = e.clientY; dot.classList.add('on'); }, { passive: true });
    document.addEventListener('pointerleave', () => dot.classList.remove('on'));
    document.addEventListener('pointerover', e => {
      const t = e.target.closest('a, button, [data-cursor], summary, label, select');
      dot.classList.toggle('big', !!t && !t.closest('[data-cursor="none"]'));
      dot.style.opacity = e.target.closest('[data-cursor="none"]') ? 0 : '';
    });
    (function loop() {
      cx += (x - cx) * .22; cy += (y - cy) * .22;
      dot.style.transform = `translate(${cx}px, ${cy}px)`;
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- page transitions ---------- */
  if (!reduced) {
    addEventListener('click', e => {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return; // same page / hash
      e.preventDefault();
      root.classList.add('leaving');
      setTimeout(() => { location.href = a.href; }, 280);
    });
    // coming back via the bfcache should not land on a faded-out page
    addEventListener('pageshow', () => root.classList.remove('leaving'));
  }

  /* ---------- misc ---------- */
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
  document.querySelectorAll('[data-count="paintings"]').forEach(el => { el.textContent = P.length; });
  document.querySelectorAll('a[href^="http"]').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });

  const ready = () => requestAnimationFrame(() => document.body.classList.add('ready'));
  if (document.readyState === 'complete') ready(); else addEventListener('load', ready);
  setTimeout(ready, 1600); // don't hold the intro hostage to slow images
})();
