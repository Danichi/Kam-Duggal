(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const P = window.PAINTINGS;
  const by = KD.bySlug;

  /* ---------- hero showcase + flowing background ---------- */
  const SLIDES = ['distant-galaxy', 'anadi', 'new-voyage', 'distant-star', '24-x-48-2012'].map(s => by[s]);
  const DUR = 7000;
  const show = $('#showcase');
  const stage = $('.stage', show);
  const bars = $('.bars', show);
  const flow = window.KDFlow($('#flow'), SLIDES.map(p => p.slug));
  stage.innerHTML = SLIDES.map((p, i) => `
    <figure data-i="${i}" ${i ? 'aria-hidden="true"' : ''}>
      <a class="frame" href="originals.html#${p.slug}" aria-label="${KD.esc(p.title)}, view details">
        <img src="${KD.img(p)}" alt="${KD.esc(p.title)} by Kam Duggal" ${i ? 'loading="lazy"' : 'fetchpriority="high"'}>
      </a>
    </figure>`).join('');
  bars.innerHTML = SLIDES.map((p, i) => `<button type="button" role="tab" aria-label="Show ${KD.esc(p.title)}"></button>`).join('');
  bars.style.setProperty('--dur', DUR + 'ms');
  const figs = [...stage.children];
  const btns = [...bars.children];
  let cur = -1, timer = 0;

  function go(i, user) {
    i = (i + SLIDES.length) % SLIDES.length;
    if (i === cur) return;
    const p = SLIDES[i];
    figs.forEach((f, k) => { f.classList.toggle('on', k === i); f.setAttribute('aria-hidden', k !== i); });
    btns.forEach((b, k) => {
      b.classList.remove('on');
      b.classList.toggle('done', k < i);
      b.setAttribute('aria-selected', k === i);
    });
    void bars.offsetWidth; // restart the progress animation
    btns[i].classList.add('on');
    $('.now b', show).textContent = p.title;
    $('.now span', show).textContent = `${p.medium} · ${KD.size(p)}`;
    $('.count', show).textContent = `${String(i + 1).padStart(2, '0')} / ${String(SLIDES.length).padStart(2, '0')}`;
    if (cur !== -1) flow.show(i);
    cur = i;
    clearTimeout(timer);
    if (!KD.reduced) timer = setTimeout(() => go(cur + 1), DUR);
  }
  btns.forEach((b, i) => b.addEventListener('click', () => go(i, true)));
  go(0);
  // pause while the visitor is looking at the frame
  show.addEventListener('pointerenter', () => { clearTimeout(timer); show.closest('.hero').classList.add('paused'); });
  show.addEventListener('pointerleave', () => { show.closest('.hero').classList.remove('paused'); const c = cur; cur = -2; go(c); });

  /* ---------- intro: words light up as you read ---------- */
  const intro = $('#intro-words');
  if (intro && !KD.reduced) {
    const wrapWords = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(t => {
            if (!t) return;
            if (/^\s+$/.test(t)) frag.append(t);
            else { const s = document.createElement('span'); s.className = 'w'; s.textContent = t; frag.append(s); }
          });
          n.replaceWith(frag);
        } else wrapWords(n);
      });
    };
    wrapWords(intro);
    const words = [...intro.querySelectorAll('.w')];
    const light = () => {
      const r = intro.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * .85 - r.top) / (r.height + innerHeight * .35)));
      const n = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle('lit', i < n));
    };
    addEventListener('scroll', light, { passive: true });
    light();
  }

  /* ---------- counting facts ---------- */
  document.querySelectorAll('.facts b').forEach(el => {
    const target = parseInt(el.textContent, 10);
    if (!target || KD.reduced) return;
    const suffix = el.innerHTML.slice(String(target).length);
    let started = false;
    new IntersectionObserver((entries, io) => {
      if (!entries[0].isIntersecting || started) return;
      started = true; io.disconnect();
      const from = target > 100 ? target - 40 : 0;
      const t0 = performance.now();
      (function tick(now) {
        const k = Math.min(1, (now - t0) / 1400);
        const eased = 1 - Math.pow(1 - k, 4);
        el.innerHTML = Math.round(from + (target - from) * eased) + suffix;
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    }, { threshold: .6 }).observe(el);
  });

  /* ---------- featured rail ---------- */
  const rail = $('#rail');
  const ctrl = document.querySelectorAll('.rail-ctrl button');
  const bar = $('.rail-progress i');
  const FEATURED = P.filter(p => p.featured).concat(P.filter(p => !p.featured && p.price));
  const MOUNT = 400;
  const longest = Math.max(...FEATURED.filter(p => p.size).map(p => Math.max(...p.size)));
  rail.innerHTML = FEATURED.map(p => `
    <li class="card" data-slug="${p.slug}">
      <a class="mount" href="originals.html#${p.slug}" aria-label="${KD.esc(p.title)}, view the painting">
        <img src="${KD.img(p, true)}" alt="${KD.esc(p.title)}" loading="lazy" draggable="false">
        <span class="scale-note">${KD.size(p)}</span>
      </a>
      <a class="meta" href="originals.html#${p.slug}" tabindex="-1">
        <h3>${KD.esc(p.title)}</h3>
        <p class="spec">${p.medium} · ${KD.size(p)}</p>
      </a>
    </li>`).join('');

  function layoutRail(scale) {
    rail.closest('section').classList.toggle('to-scale', scale);
    const narrow = innerWidth < 600;
    const mh = narrow ? 320 : MOUNT;
    [...rail.children].forEach(li => {
      const p = by[li.dataset.slug];
      const img = li.querySelector('img');
      let w;
      if (scale && p.size) {
        // one shared inch scale: the biggest canvas fills the mount
        const ppi = (mh * .86) / longest;
        img.style.width = p.size[0] * ppi + 'px';
        img.style.height = p.size[1] * ppi + 'px';
        img.style.maxWidth = img.style.maxHeight = 'none';
        w = Math.max(narrow ? 240 : 280, p.size[0] * ppi + 60);
      } else {
        img.style.width = img.style.height = img.style.maxWidth = img.style.maxHeight = '';
        w = Math.min(narrow ? 300 : 460, Math.max(narrow ? 240 : 290, mh * .8 * p.ratio / .78 + 30));
      }
      li.style.setProperty('--w', Math.round(w) + 'px');
      li.style.setProperty('--mh', mh + 'px');
      li.querySelector('.mount').style.alignItems = scale ? 'end' : '';
      li.querySelector('.mount').style.paddingBottom = scale ? '36px' : '';
    });
    progress();
  }
  let scaleView = false;
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
    scaleView = b.dataset.view === 'scale';
    document.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', x === b));
    layoutRail(scaleView);
  }));
  addEventListener('resize', () => layoutRail(scaleView));
  layoutRail(false);
  rail.scrollLeft = 0;

  function progress() {
    const max = rail.scrollWidth - rail.clientWidth;
    const f = max > 0 ? rail.scrollLeft / max : 0;
    const w = Math.max(.08, rail.clientWidth / rail.scrollWidth);
    bar.style.width = w * 100 + '%';
    bar.style.transform = `translateX(${f * (1 / w - 1) * 100}%)`;
    ctrl[0].disabled = rail.scrollLeft < 4;
    ctrl[1].disabled = rail.scrollLeft > max - 4;
  }
  rail.addEventListener('scroll', progress, { passive: true });
  ctrl.forEach(b => b.addEventListener('click', () => {
    rail.scrollBy({ left: +b.dataset.dir * rail.clientWidth * .7, behavior: KD.reduced ? 'auto' : 'smooth' });
  }));
  // drag to scroll with a mouse (touch already scrolls natively)
  let drag = null;
  rail.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.target.closest('.btn')) return;
    drag = { x: e.clientX, left: rail.scrollLeft, moved: false };
  });
  addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 5) { drag.moved = true; rail.classList.add('dragging'); }
    rail.scrollLeft = drag.left - dx;
  });
  addEventListener('pointerup', () => {
    if (!drag) return;
    setTimeout(() => rail.classList.remove('dragging'), 0);
    drag = null;
  });
  rail.addEventListener('click', e => { if (rail.classList.contains('dragging')) e.preventDefault(); }, true);

  /* ---------- spotlight loupe ---------- */
  const host = $('#loupe');
  const lens = $('.loupe', host);
  const limg = $('img', host);
  const ZOOM = 3;
  lens.style.backgroundImage = `url(${limg.currentSrc || limg.src})`;
  host.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    const r = limg.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const size = lens.offsetWidth;
    lens.style.left = x + 'px';
    lens.style.top = y + 'px';
    lens.style.backgroundSize = `${r.width * ZOOM}px ${r.height * ZOOM}px`;
    lens.style.backgroundPosition = `${-(x * ZOOM - size / 2)}px ${-(y * ZOOM - size / 2)}px`;
    lens.classList.add('on');
  });
  host.addEventListener('pointerleave', () => lens.classList.remove('on'));

  /* ---------- process: the lens zooms into the paint ---------- */
  const steps = [...document.querySelectorAll('#steps li')];
  const lensImg = $('#lens-img');
  const lensN = $('#lens-n');
  const lensLabel = $('#lens-label');
  let active = -1;
  function setStep(i) {
    if (i === active) return;
    active = i;
    const s = steps[i];
    steps.forEach((li, k) => li.classList.toggle('on', k === i));
    const src = `img/art/${s.dataset.img}.webp`;
    if (!lensImg.src.endsWith(src)) {
      lensImg.style.opacity = 0;
      setTimeout(() => { lensImg.src = src; lensImg.onload = () => { lensImg.style.opacity = 1; }; }, 250);
    }
    lensImg.style.transition = 'transform 1.6s cubic-bezier(.2,.7,.1,1), opacity .25s';
    lensImg.style.setProperty('--z', KD.reduced ? 1 : s.dataset.z);
    lensN.textContent = String(i + 1).padStart(2, '0');
    lensLabel.textContent = s.dataset.label;
  }
  const stepIO = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) setStep(steps.indexOf(e.target)); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach(s => stepIO.observe(s));
  setStep(0);

  /* ---------- palettes ---------- */
  const grid = $('#palette-grid');
  const order = ['ember', 'crimson', 'ocean', 'night', 'spectrum', 'gesture', 'gold'];
  grid.innerHTML = order.map((k, i) => {
    const pal = KD.PALETTES[k];
    const n = P.filter(p => p.palette === k).length;
    const cover = by[pal.cover];
    return `<a class="palette rv" style="--d:${i * .06}s" href="originals.html?palette=${k}">
      <img src="${KD.img(cover, i > 0)}" alt="" loading="lazy">
      <span class="count">${n} works</span>
      <h3>${pal.name}</h3>
      <p>${pal.blurb}</p>
      <span class="swatches">${pal.sw.map(c => `<i style="background:${c}"></i>`).join('')}</span>
      <span class="go">${KD.icon('right')}</span>
    </a>`;
  }).join('');
  KD.observe(grid);

  /* ---------- quote parallax ---------- */
  const qbg = $('#quote-bg');
  if (qbg && !KD.reduced) {
    const band = qbg.parentElement;
    const par = () => {
      const r = band.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      qbg.style.transform = `translateY(${p * -80}px) scale(1.05)`;
    };
    addEventListener('scroll', par, { passive: true });
    par();
  }
})();

/* ---------- the collection strip ---------- */
(function () {
  const section = document.querySelector('#strip');
  if (!section) return;
  const track = document.querySelector('#strip-track');
  const label = document.querySelector('#strip-label');
  const P = window.PAINTINGS;
  // a spread of the collection: every palette, both orientations, no duplicates
  const picked = [];
  const order = ['ember', 'crimson', 'ocean', 'night', 'gold', 'gesture', 'spectrum'];
  for (let round = 0; round < 3; round++) {
    order.forEach(pal => {
      const next = P.filter(p => p.palette === pal && !picked.includes(p))[round];
      if (next) picked.push(next);
    });
  }
  const items = picked.slice(0, 16);
  track.innerHTML = items.map((p, i) => `
    <a class="strip-item" href="originals.html#${p.slug}" data-title="${KD.esc(p.title)} · ${KD.size(p)}" style="--i:${i}">
      <img src="${KD.img(p, true)}" alt="${KD.esc(p.title)}" loading="lazy">
    </a>`).join('');

  const kids = [...track.children];
  let travel = 0, current = -1;
  function measure() {
    travel = Math.max(0, track.scrollWidth - innerWidth + 80);
    section.style.height = KD.reduced ? 'auto' : Math.round(innerHeight + travel * 1.05) + 'px';
    if (KD.reduced) track.style.transform = '';
  }
  function onScroll() {
    if (KD.reduced) return;
    const r = section.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / (section.offsetHeight - innerHeight || 1)));
    track.style.transform = `translate3d(${-p * travel}px, 0, 0)`;
    // name whatever is actually nearest the middle of the screen
    const mid = innerWidth / 2;
    let best = 0, bestD = Infinity;
    kids.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - mid);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best !== current) { current = best; label.textContent = kids[best].dataset.title; }
  }
  addEventListener('resize', () => { measure(); onScroll(); });
  addEventListener('scroll', onScroll, { passive: true });
  measure();
  onScroll();
  label.textContent = kids[0].dataset.title;
})();
