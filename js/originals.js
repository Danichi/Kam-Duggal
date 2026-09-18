(function () {
  const $ = s => document.querySelector(s);
  const P = window.PAINTINGS;
  const params = new URLSearchParams(location.search);
  const state = {
    palette: KD.PALETTES[params.get('palette')] ? params.get('palette') : '',
    size: params.get('size') || '',
    shape: params.get('shape') || '',
    layout: 'grid'
  };
  let list = P;

  const shape = p => p.ratio > 1.08 ? 'landscape' : p.ratio < .92 ? 'portrait' : 'square';

  /* ---------- filters ---------- */
  const filters = $('#filters');
  const chip = (key, label, sw, n) => `<button type="button" class="chip" data-palette="${key}" aria-pressed="${state.palette === key}" ${sw ? `style="--sw:${sw}"` : ''}>
    <i></i>${label} <small>${n}</small></button>`;
  filters.innerHTML = chip('', 'All', 'conic-gradient(#e0582a, #e7c01c, #3e8e9a, #1b4f8a, #9e1b2c, #e0582a)', P.length) +
    Object.entries(KD.PALETTES).map(([k, v]) =>
      chip(k, v.name, `linear-gradient(135deg, ${v.sw[0]} 0 45%, ${v.sw[1]} 45% 75%, ${v.sw[2]} 75%)`, P.filter(p => p.palette === k).length)).join('');
  filters.addEventListener('click', e => {
    const b = e.target.closest('[data-palette]');
    if (!b) return;
    state.palette = b.dataset.palette;
    render(true);
  });
  $('#f-size').value = state.size;
  $('#f-shape').value = state.shape;
  $('#f-size').addEventListener('change', e => { state.size = e.target.value; render(true); });
  $('#f-shape').addEventListener('change', e => { state.shape = e.target.value; render(true); });
  $('#reset').addEventListener('click', () => {
    Object.assign(state, { palette: '', size: '', shape: '' });
    $('#f-size').value = $('#f-shape').value = '';
    render(true);
  });
  document.querySelectorAll('[data-layout]').forEach(b => b.addEventListener('click', () => {
    state.layout = b.dataset.layout;
    document.querySelectorAll('[data-layout]').forEach(x => x.setAttribute('aria-pressed', x === b));
    render(false);
  }));

  /* ---------- render ---------- */
  const gallery = $('#gallery');
  const wall = $('#wall');
  function render(filtersChanged) {
    list = P.filter(p =>
      (!state.palette || p.palette === state.palette) &&
      (!state.size || KD.sizeClass(p) === state.size) &&
      (!state.shape || shape(p) === state.shape));

    filters.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.palette === state.palette));
    const pal = KD.PALETTES[state.palette];
    $('#result-title').textContent = pal ? pal.name : 'All originals';
    $('#result-count').textContent = `${list.length} ${list.length === 1 ? 'painting' : 'paintings'}`;
    $('#empty').hidden = list.length > 0;

    if (filtersChanged) {
      const q = new URLSearchParams();
      ['palette', 'size', 'shape'].forEach(k => state[k] && q.set(k, state[k]));
      history.replaceState(null, '', (q.toString() ? '?' + q : location.pathname.split('/').pop() || 'originals.html') + location.hash);
    }

    const grid = state.layout === 'grid';
    gallery.hidden = !grid || !list.length;
    wall.hidden = grid || !list.length;

    if (grid) {
      gallery.innerHTML = list.map((p, i) => `
        <button type="button" class="tile" data-slug="${p.slug}" style="--d:${Math.min(i, 12) * .04}s">
          <span class="img" style="--r:${p.ratio}">
            ${p.original === 'inquire' ? '<span class="badge">Ask about availability</span>' : ''}
            <img src="${KD.img(p, true)}" alt="${KD.esc(p.title)}, ${p.medium.toLowerCase()}" loading="lazy" width="560" height="${Math.round(560 / p.ratio)}">
          </span>
          <span class="cap"><span class="t">${KD.esc(p.title)}</span></span>
          <span class="sub">${p.medium} · ${KD.size(p)}</span>
        </button>`).join('');
    } else {
      const sized = list.filter(p => p.size);
      const inner = $('#wall-inner');
      const ppi = Math.max(2.6, Math.min(5.5, inner.clientWidth / 190 || 5));
      wall.style.setProperty('--ppi', ppi + 'px');
      inner.innerHTML = sized.map(p => `
        <button type="button" class="piece" data-slug="${p.slug}" style="--iw:${p.size[0]}">
          <img src="${KD.img(p, true)}" alt="${KD.esc(p.title)}" loading="lazy">
          <span>${KD.esc(p.title)} · ${KD.size(p)}</span>
        </button>`).join('') +
        (sized.length < list.length ? `<p class="muted" style="flex-basis:100%;text-align:center;font-size:13px;margin:0 0 20px">${list.length - sized.length} more without a listed size. Switch to Gallery to see them.</p>` : '');
    }
  }
  addEventListener('resize', () => { if (state.layout === 'wall') render(false); });
  [gallery, wall].forEach(el => el.addEventListener('click', e => {
    const t = e.target.closest('[data-slug]');
    if (t) open(t.dataset.slug, t);
  }));

  /* ---------- detail view ---------- */
  const lb = $('#lb');
  const stage = $('#lb-stage');
  const lbImg = $('#lb-img');
  const room = $('#room');
  let idx = -1, opener = null, closeTimer = 0;

  function fill(p) {
    const pal = KD.PALETTES[p.palette];
    lbImg.classList.add('swap');
    const next = new Image();
    next.src = KD.img(p);
    const apply = () => {
      lbImg.src = next.src;
      lbImg.alt = `${p.title} by Kam Duggal`;
      requestAnimationFrame(() => lbImg.classList.remove('swap'));
    };
    next.decode ? next.decode().then(apply, apply) : (next.onload = apply);

    $('#lb-palette').textContent = pal.name;
    $('#lb-title').textContent = p.title;
    const story = document.querySelector('#lb-story');
    story.textContent = p.story || '';
    story.hidden = !p.story;
    $('#lb-price').textContent = p.medium + (p.flow ? ', flow technique' : '');
    const rows = [
      ['Size', KD.size(p)],
      ['Year', p.year],
      ['Original', p.original === 'available' ? (p.price ? 'Available · ' + p.price : 'Available, price on request') : 'Ask Kam']
    ].filter(r => r[1]);
    $('#lb-dl').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${KD.esc(v)}</dd>`).join('');
    $('#lb-inquire').href = KD.inquire(p);
    $('#lb-shop').href = p.shop;
    $('#lb-note').textContent = p.wall ? 'This photo shows the painting hanging on a wall.' : '';
    $('#lb-count').textContent = `${String(idx + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`;
    history.replaceState(null, '', '#' + p.slug);
    placeRoom(p);
  }

  function placeRoom(p) {
    const W = stage.clientWidth, H = stage.clientHeight;
    const size = p.size || (p.ratio >= 1 ? [24, 24 / p.ratio] : [24 * p.ratio, 24]);
    const [pw, ph] = size;
    const sofaBottom = H * .89;
    const ppi = Math.min((W * .82) / Math.max(84, pw), (sofaBottom - 90) / (33 + 10 + ph));
    const sofa = room.querySelector('.sofa');
    sofa.style.width = 84 * ppi + 'px';
    const sofaTop = sofaBottom - 33 * ppi;
    const img = $('#room-img');
    img.src = KD.img(p, true);
    img.style.width = pw * ppi + 'px';
    img.style.height = ph * ppi + 'px';
    img.style.objectFit = 'cover';
    img.style.top = sofaTop - 10 * ppi - ph * ppi + 'px';
    const lamp = room.querySelector('.lamp');
    lamp.style.width = 12 * ppi + 'px';
    lamp.style.left = W / 2 + 50 * ppi + 'px';
    lamp.style.display = W / 2 + 62 * ppi < W ? '' : 'none';
    const dim = $('#room-dim');
    dim.textContent = p.size ? KD.size(p) : 'Size on request';
    dim.style.left = W / 2 + pw * ppi / 2 + 12 + 'px';
    dim.style.top = sofaTop - 10 * ppi - ph * ppi / 2 + 'px';
  }

  function setTab(tab) {
    stage.classList.toggle('in-room', tab === 'room');
    lb.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tab === tab));
    if (tab === 'room') placeRoom(list[idx]);
  }
  lb.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  room.querySelectorAll('[data-wall]').forEach(b => b.addEventListener('click', () => {
    room.style.setProperty('--wall', b.dataset.wall);
    room.classList.toggle('dark', b.hasAttribute('data-dark'));
    room.querySelectorAll('[data-wall]').forEach(x => x.setAttribute('aria-pressed', x === b));
  }));

  function open(slug, from) {
    let i = list.findIndex(p => p.slug === slug);
    if (i < 0) {
      // deep link to a piece hidden by the current filters: show everything
      Object.assign(state, { palette: '', size: '', shape: '' });
      render(true);
      i = list.findIndex(p => p.slug === slug);
      if (i < 0) return;
    }
    idx = i;
    opener = from || null;
    clearTimeout(closeTimer);
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => lb.classList.add('open'));
    fill(list[idx]);
    flip(from);
    $('#lb-close').focus({ preventScroll: true });
  }
  // the tile grows into the full painting
  async function flip(fromEl) {
    const thumb = fromEl && fromEl.querySelector('img');
    if (KD.reduced || !thumb || !lbImg.getAnimations) return;
    const a = thumb.getBoundingClientRect();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const b = lbImg.getBoundingClientRect();
    if (!a.width || !b.width) return;
    const ghost = document.createElement('img');
    ghost.src = thumb.currentSrc || thumb.src;
    ghost.alt = '';
    ghost.style.cssText = `position:fixed;z-index:200;margin:0;object-fit:cover;pointer-events:none;
      left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px`;
    document.body.appendChild(ghost);
    lbImg.style.opacity = '0';
    const anim = ghost.animate(
      [{ left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' },
       { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px' }],
      { duration: 560, easing: 'cubic-bezier(.2,.7,.1,1)' });
    const done = () => { lbImg.style.opacity = ''; ghost.remove(); };
    anim.onfinish = done;
    anim.oncancel = done;
  }

  function close() {
    lb.classList.remove('open');
    document.body.style.overflow = '';
    history.replaceState(null, '', location.pathname + location.search);
    closeTimer = setTimeout(() => { lb.hidden = true; setTab('art'); stage.classList.remove('zoomed'); lbImg.style.transform = ''; }, 450);
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  }
  const step = d => {
    idx = (idx + d + list.length) % list.length;
    stage.classList.remove('zoomed');
    lbImg.style.transform = '';
    fill(list[idx]);
  };
  $('#lb-close').addEventListener('click', close);
  $('#lb-prev').addEventListener('click', () => step(-1));
  $('#lb-next').addEventListener('click', () => step(1));
  addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'Tab') {
      const f = [...lb.querySelectorAll('a[href], button:not([disabled])')].filter(el => el.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  addEventListener('resize', () => { if (!lb.hidden && stage.classList.contains('in-room')) placeRoom(list[idx]); });

  // click to zoom, move to pan
  lbImg.addEventListener('click', e => {
    const z = stage.classList.toggle('zoomed');
    if (!z) { lbImg.style.transform = ''; return; }
    pan(e);
  });
  function pan(e) {
    if (!stage.classList.contains('zoomed')) return;
    const r = lbImg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    lbImg.style.transform = `scale(2.2) translate(${-x * 45}%, ${-y * 45}%)`;
  }
  lbImg.addEventListener('pointermove', pan);

  // swipe between paintings on touch
  let sx = null;
  stage.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (sx === null || stage.classList.contains('in-room')) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    sx = null;
  });

  // paintings drift a little inside their frames as the page moves
  if (!KD.reduced) {
    let ticking = false;
    const drift = () => {
      ticking = false;
      gallery.querySelectorAll('.tile .img img').forEach(img => {
        const r = img.getBoundingClientRect();
        if (r.bottom < -100 || r.top > innerHeight + 100) return;
        const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        img.style.objectPosition = `50% ${(50 + p * 7).toFixed(2)}%`;
      });
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(drift); } }, { passive: true });
    addEventListener('resize', drift);
    requestAnimationFrame(drift);
  }

  render(false);
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash && KD.bySlug[hash]) open(hash);
})();
