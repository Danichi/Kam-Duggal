/**
 * The editor. Loaded on every page, invisible to visitors apart from a small
 * lock in the header.
 *
 * Sign in  -> an Edit mode toggle appears.
 * Edit on  -> text with [data-edit] becomes typeable, paintings accept a
 *             dropped image, and the Paintings panel opens for adding,
 *             reordering, hiding and pricing work.
 * Publish  -> writes one JSON document to KV. Undo puts the last version back.
 *
 * Nothing here runs for a signed-out visitor beyond one /api/admin/login check.
 */
(function () {
  const KD = window.KD || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = {
    signedIn: false,
    editing: false,
    dirty: false,
    doc: { text: {}, paintings: null, hero: null },
    defaults: (window.PAINTINGS || []).map(p => ({ ...p }))
  };

  /* ---------------- chrome ---------------- */

  const header = $('.site-header .wrap');
  if (!header) return;

  const signIn = document.createElement('button');
  signIn.type = 'button';
  signIn.className = 'admin-key';
  signIn.title = 'Site owner sign in';
  signIn.setAttribute('aria-label', 'Site owner sign in');
  signIn.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';
  header.appendChild(signIn);

  const bar = document.createElement('div');
  bar.className = 'admin-bar';
  bar.hidden = true;
  bar.innerHTML = `
    <div class="ab-left">
      <span class="ab-brand">Editor</span>
      <label class="ab-switch"><input type="checkbox" id="ab-edit"><span></span>Edit mode</label>
      <button type="button" class="ab-btn" id="ab-paintings">Paintings</button>
    </div>
    <div class="ab-right">
      <span class="ab-status" id="ab-status"></span>
      <button type="button" class="ab-btn" id="ab-undo" title="Put the last published version back">Undo publish</button>
      <button type="button" class="ab-btn gold" id="ab-save" disabled>Publish changes</button>
      <button type="button" class="ab-btn" id="ab-out">Sign out</button>
    </div>`;
  document.body.appendChild(bar);

  const dialog = document.createElement('div');
  dialog.className = 'admin-modal';
  dialog.hidden = true;
  document.body.appendChild(dialog);

  const status = (msg, kind = '') => {
    const el = $('#ab-status');
    el.textContent = msg || '';
    el.className = 'ab-status ' + kind;
    if (msg && kind === 'ok') setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 3000);
  };

  const markDirty = () => {
    state.dirty = true;
    $('#ab-save').disabled = false;
    status('Not published yet', 'warn');
  };

  /* ---------------- sign in ---------------- */

  const api = async (url, opts = {}) => {
    const res = await fetch(url, { credentials: 'same-origin', ...opts });
    let body = {};
    try { body = await res.json(); } catch {}
    if (!res.ok) throw new Error(body.error || 'Something went wrong (' + res.status + ').');
    return body;
  };

  function askPassword() {
    dialog.hidden = false;
    dialog.innerHTML = `
      <div class="am-card">
        <h2>Sign in to edit</h2>
        <p>This is only for Kam. Visitors never see it.</p>
        <form id="am-form">
          <label for="am-pw">Password</label>
          <input id="am-pw" type="password" autocomplete="current-password" required>
          <p class="am-err" id="am-err" hidden></p>
          <div class="am-row">
            <button type="submit" class="ab-btn gold">Sign in</button>
            <button type="button" class="ab-btn" id="am-cancel">Cancel</button>
          </div>
        </form>
      </div>`;
    $('#am-pw').focus();
    $('#am-cancel').onclick = () => { dialog.hidden = true; };
    $('#am-form').onsubmit = async e => {
      e.preventDefault();
      const err = $('#am-err');
      err.hidden = true;
      try {
        await api('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: $('#am-pw').value })
        });
        dialog.hidden = true;
        await start();
      } catch (e2) {
        err.textContent = e2.message;
        err.hidden = false;
      }
    };
  }
  signIn.addEventListener('click', askPassword);
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.hidden = true; });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !dialog.hidden) dialog.hidden = true; });

  /* ---------------- start editing ---------------- */

  async function start() {
    state.signedIn = true;
    document.body.classList.add('is-admin');
    signIn.hidden = true;
    bar.hidden = false;
    try {
      const { content } = await api('/api/admin/content');
      state.doc = {
        text: content.text || {},
        paintings: Array.isArray(content.paintings) ? content.paintings : null,
        hero: Array.isArray(content.hero) ? content.hero : null,
        images: content.images || {},
        layout: content.layout || {}
      };
    } catch (e) { status(e.message, 'warn'); }
    status('Signed in', 'ok');
  }

  /* ---------------- text editing ---------------- */

  function setEditing(on) {
    state.editing = on;
    document.body.classList.toggle('editing', on);
    $$('[data-edit]').forEach(el => {
      el.contentEditable = on ? 'true' : 'false';
      el.spellcheck = on;
      if (on && !el.dataset.bound) {
        el.dataset.bound = '1';
        el.addEventListener('input', () => {
          state.doc.text[el.dataset.edit] = el.innerHTML.trim();
          markDirty();
        });
        el.addEventListener('paste', ev => {             // keep pasted text plain
          ev.preventDefault();
          document.execCommand('insertText', false, (ev.clipboardData || window.clipboardData).getData('text'));
        });
        el.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey && el.tagName !== 'P') ev.preventDefault(); });
      }
    });
    markDroppable(on);
    markSortable(on);
  }

  /* ---------------- drag an image onto a painting ---------------- */

  function paintingFromEl(el) {
    const host = el.closest('[data-slug], [data-painting]');
    const slug = host && (host.dataset.slug || host.dataset.painting);
    return slug ? list().find(p => p.slug === slug) : null;
  }

  function markDroppable(on) {
    const imgs = $$('.fcard .shot, .tile .img, .showcase .frame, .strip-item, .loupe-host, .plate, .lens, .palette, .timeline .thumbs img, .ghost-wrap, .lb-stage, [data-img-slot]');
    imgs.forEach(el => {
      el.classList.toggle('can-drop', on);
      if (on && !el.dataset.dropBound) {
        el.dataset.dropBound = '1';
        el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drop-over'); });
        el.addEventListener('dragleave', () => el.classList.remove('drop-over'));
        el.addEventListener('click', e => {
          if (!state.editing) return;
          e.preventDefault();
          e.stopPropagation();
          pickFor(el);
        }, true);
        el.addEventListener('drop', async e => {
          e.preventDefault();
          el.classList.remove('drop-over');
          const file = e.dataTransfer.files && e.dataTransfer.files[0];
          if (!file) return status('Drop an image file to replace this one.', 'warn');
          const slot = el.closest('[data-img-slot]');
          if (slot) return replaceSlot(slot, file);        // a page image, not a painting
          const p = paintingFromEl(el);
          if (!p) return status('That image is not tied to a painting yet.', 'warn');
          await replaceImage(p, file);
        });
      }
    });
  }

  /* ---------------- click to upload ---------------- */

  const filePick = document.createElement('input');
  filePick.type = 'file';
  filePick.accept = 'image/*';
  filePick.hidden = true;
  document.body.appendChild(filePick);
  let pickTarget = null;

  /** Open the file picker for a spot on the page (no dragging needed). */
  function pickFor(el) {
    pickTarget = el;
    filePick.value = '';
    filePick.click();
  }
  filePick.addEventListener('change', async () => {
    const file = filePick.files && filePick.files[0];
    const el = pickTarget;
    pickTarget = null;
    if (!file || !el) return;
    const slot = el.closest('[data-img-slot]');
    if (slot) return replaceSlot(slot, file);
    const p = paintingFromEl(el);
    if (!p) return status('That image is not tied to a painting yet.', 'warn');
    await replaceImage(p, file);
  });

  /* ---------------- images ---------------- */

  /** Shrink in the browser, so a phone photo becomes a small WebP before upload. */
  function resize(file, maxEdge) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        c.toBlob(b => b ? resolve({ blob: b, w, h }) : reject(new Error('Could not read that image.')), 'image/webp', 0.86);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error('That file is not an image the browser can open.'));
      img.src = URL.createObjectURL(file);
    });
  }

  async function uploadBoth(file) {
    const big = await resize(file, 1400);
    const small = await resize(file, 560);
    const send = async ({ blob }, suffix) => {
      const fd = new FormData();
      fd.append('file', new File([blob], 'art' + suffix + '.webp', { type: 'image/webp' }));
      const { url } = await api('/api/admin/upload', { method: 'POST', body: fd });
      return url;
    };
    return { img: await send(big, ''), imgSm: await send(small, '-sm'), ratio: +(big.w / big.h).toFixed(4) };
  }

  async function replaceImage(p, file) {
    status('Uploading…');
    try {
      const up = await uploadBoth(file);
      Object.assign(p, up);
      saveList();
      markDirty();
      status('Image replaced. Publish to make it live.', 'ok');
      refreshImages(p);
    } catch (e) { status(e.message, 'warn'); }
  }

  /** A page image that is not a painting: the portrait, for instance. */
  async function replaceSlot(el, file) {
    status('Uploading…');
    try {
      const { img } = await uploadBoth(file);
      (state.doc.images ||= {})[el.dataset.imgSlot] = img;
      el.src = img;
      markDirty();
      status('Image replaced. Publish to make it live.', 'ok');
    } catch (e) { status(e.message, 'warn'); }
  }

  /** Swap every img on the page that shows this painting. */
  function refreshImages(p) {
    const sel = CSS.escape(p.slug);
    $$(`[data-slug="${sel}"], [data-painting="${sel}"]`).forEach(host => {
      const img = host.tagName === 'IMG' ? host : host.querySelector('img');
      if (img) img.src = img.width && img.width < 700 ? (p.imgSm || p.img) : (p.img || p.imgSm);
    });
  }

  /* ---------------- rearranging blocks ---------------- */

  let dragBlock = null;

  function markSortable(on) {
    $$('[data-sort]').forEach(c => {
      c.classList.toggle('sorting', on);
      [...c.children].forEach(ch => {
        if (!on) { const t = ch.querySelector(':scope > .block-tools'); if (t) t.remove(); ch.classList.remove('block'); return; }
        if (ch.querySelector(':scope > .block-tools')) return;
        ch.classList.add('block');
        const tools = document.createElement('div');
        tools.className = 'block-tools';
        tools.innerHTML = '<span class="bt-grip" draggable="true" title="Drag to move this block">⠿ Move</span>' +
          '<button type="button" class="bt-hide" title="Show or hide this block">' + (ch.hidden ? 'Show' : 'Hide') + '</button>';
        tools.querySelector('.bt-hide').addEventListener('click', ev => {
          ev.preventDefault(); ev.stopPropagation();
          ch.hidden = !ch.hidden;
          ch.classList.toggle('block-off', ch.hidden);
          ev.target.textContent = ch.hidden ? 'Show' : 'Hide';
          saveLayout(c);
        });
        tools.querySelector('.bt-grip').addEventListener('dragstart', ev => {
          dragBlock = ch;
          ch.classList.add('block-dragging');
          ev.dataTransfer.effectAllowed = 'move';
          try { ev.dataTransfer.setData('text/plain', 'block'); } catch {}
        });
        tools.querySelector('.bt-grip').addEventListener('dragend', () => {
          ch.classList.remove('block-dragging');
          $$('.block-over').forEach(x => x.classList.remove('block-over'));
          dragBlock = null;
        });
        ch.prepend(tools);
      });

      if (on && !c.dataset.sortBound) {
        c.dataset.sortBound = '1';
        c.addEventListener('dragover', e => {
          if (!dragBlock || dragBlock.parentElement !== c) return;
          e.preventDefault();
          const over = [...c.children].find(ch => ch !== dragBlock && ch.contains(e.target));
          if (!over) return;
          $$('.block-over', c).forEach(x => x.classList.remove('block-over'));
          over.classList.add('block-over');
          const r = over.getBoundingClientRect();
          const after = (e.clientY - r.top) > r.height / 2;
          c.insertBefore(dragBlock, after ? over.nextSibling : over);
        });
        c.addEventListener('drop', e => {
          if (!dragBlock) return;
          e.preventDefault();
          $$('.block-over', c).forEach(x => x.classList.remove('block-over'));
          saveLayout(c);
        });
      }
    });
  }

  function saveLayout(c) {
    (state.doc.layout ||= {})[c.dataset.sort] =
      [...c.children].map(ch => ({ b: ch.dataset.block, h: ch.hidden || undefined }));
    markDirty();
    status('Layout changed. Publish to make it live.', 'warn');
  }

  /* ---------------- the painting list ---------------- */

  const list = () => (state.doc.paintings ||= state.defaults.map(p => ({ ...p })));
  const saveList = () => { state.doc.paintings = list(); };

  function blank() {
    return {
      slug: 'piece-' + Math.random().toString(36).slice(2, 8),
      title: 'Untitled',
      medium: 'Acrylic on canvas',
      size: null, ratio: 1, price: null, original: 'available',
      palette: 'ember', featured: false, hero: false, flow: false, story: '', year: null,
      printsFrom: null, shop: KD.SHOP || 'https://kam-duggal.pixels.com/',
      img: '', imgSm: '', hidden: false
    };
  }

  function openPaintings() {
    dialog.hidden = false;
    dialog.innerHTML = `
      <div class="am-card wide">
        <div class="am-head">
          <h2>Paintings</h2>
          <div class="am-head-actions">
            <label class="ab-btn gold" for="am-add">Add a painting</label>
            <input id="am-add" type="file" accept="image/*" multiple hidden>
            <button type="button" class="ab-btn" id="am-done">Done</button>
          </div>
        </div>
        <p class="am-hint">Drag a row by its handle to reorder. <b>Hero</b> pieces cycle at the top of the home page, <b>Featured</b> ones fill the four cards below it. Drop an image straight onto a row to replace its photo.</p>
        <div class="am-list" id="am-list"></div>
      </div>`;
    renderRows();
    $('#am-done').onclick = () => { dialog.hidden = true; };
    $('#am-add').onchange = async e => {
      const files = [...e.target.files];
      e.target.value = '';
      for (const f of files) await addPainting(f);
    };
  }

  function renderRows() {
    const host = $('#am-list');
    if (!host) return;
    host.innerHTML = list().map((p, i) => `
      <div class="am-row${p.hidden ? ' is-hidden' : ''}" draggable="true" data-i="${i}" data-painting="${esc(p.slug)}">
        <span class="am-grip" title="Drag to reorder">⠿</span>
        <span class="am-thumb"><img src="${esc(p.imgSm || p.img || `img/art/${p.slug}-sm.webp`)}" alt=""></span>
        <span class="am-fields">
          <input class="am-title" value="${esc(p.title)}" data-f="title" placeholder="Title">
          <input value="${esc(p.medium)}" data-f="medium" placeholder="Acrylic on canvas">
          <input value="${p.size ? p.size.join(' x ') : ''}" data-f="size" placeholder="Width x height in inches">
          <input value="${esc(p.price || '')}" data-f="price" placeholder="$1,200 (blank = price on request)">
          <input value="${esc(p.story || '')}" data-f="story" placeholder="A line about this painting (optional)">
        </span>
        <span class="am-toggles">
          <label><input type="checkbox" data-f="hero" ${p.hero ? 'checked' : ''}>Hero</label>
          <label><input type="checkbox" data-f="featured" ${p.featured ? 'checked' : ''}>Featured</label>
          <label><input type="checkbox" data-f="sold" ${p.original === 'sold' ? 'checked' : ''}>Sold</label>
          <label><input type="checkbox" data-f="hidden" ${p.hidden ? 'checked' : ''}>Hide</label>
          <button type="button" class="am-del" data-del="${i}" title="Remove from the site">Remove</button>
        </span>
      </div>`).join('');

    host.oninput = e => {
      const row = e.target.closest('.am-row');
      if (!row) return;
      const p = list()[+row.dataset.i];
      const f = e.target.dataset.f;
      if (!p || !f) return;
      if (f === 'size') {
        const nums = e.target.value.split(/[x×,]/).map(n => parseFloat(n)).filter(n => n > 0);
        p.size = nums.length === 2 ? nums : null;
      } else if (f === 'featured') p.featured = e.target.checked;
      else if (f === 'hero') p.hero = e.target.checked;
      else if (f === 'sold') p.original = e.target.checked ? 'sold' : 'available';
      else if (f === 'hidden') { p.hidden = e.target.checked; row.classList.toggle('is-hidden', p.hidden); }
      else if (f === 'price') p.price = e.target.value.trim() || null;
      else p[f] = e.target.value;
      saveList();
      markDirty();
    };
    host.onclick = e => {
      const thumb = e.target.closest('.am-thumb');
      if (thumb) {
        const row = thumb.closest('.am-row');
        pickFor(row);
        return;
      }
      const del = e.target.closest('[data-del]');
      if (!del) return;
      const i = +del.dataset.del;
      const p = list()[i];
      if (!confirm(`Remove "${p.title}" from the site?`)) return;
      list().splice(i, 1);
      saveList(); markDirty(); renderRows();
    };

    // drag to reorder
    let dragIndex = null;
    host.ondragstart = e => {
      const row = e.target.closest('.am-row');
      if (!row) return;
      dragIndex = +row.dataset.i;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(dragIndex)); } catch {}
    };
    host.ondragend = () => { $$('.am-row', host).forEach(r => r.classList.remove('dragging', 'over')); };
    host.ondragover = e => {
      e.preventDefault();
      const row = e.target.closest('.am-row');
      if (!row) return;
      $$('.am-row', host).forEach(r => r.classList.toggle('over', r === row));
    };
    host.ondrop = async e => {
      e.preventDefault();
      const row = e.target.closest('.am-row');
      if (!row) return;
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) { await replaceImage(list()[+row.dataset.i], file); renderRows(); return; }
      const to = +row.dataset.i;
      if (dragIndex === null || to === dragIndex) return;
      const items = list();
      items.splice(to, 0, items.splice(dragIndex, 1)[0]);
      dragIndex = null;
      saveList(); markDirty(); renderRows();
    };
  }

  async function addPainting(file) {
    status('Uploading…');
    try {
      const up = await uploadBoth(file);
      const p = { ...blank(), ...up, title: file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').slice(0, 80) };
      list().unshift(p);
      saveList(); markDirty(); renderRows();
      status('Added. Fill in the title and size, then publish.', 'ok');
    } catch (e) { status(e.message, 'warn'); }
  }

  /* ---------------- publish ---------------- */

  async function publish() {
    $('#ab-save').disabled = true;
    status('Publishing…');
    try {
      await api('/api/admin/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: state.doc.text, paintings: state.doc.paintings || undefined, hero: state.doc.hero || undefined, images: state.doc.images || undefined, layout: state.doc.layout || undefined })
      });
      state.dirty = false;
      status('Published. The site is live with your changes.', 'ok');
    } catch (e) {
      status(e.message, 'warn');
      $('#ab-save').disabled = false;
    }
  }

  async function undo() {
    if (!confirm('Put the last published version back?')) return;
    try {
      const { content } = await api('/api/admin/content', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restore: true })
      });
      state.doc = { text: content.text || {}, paintings: content.paintings || null, hero: content.hero || null };
      status('Put back. Reloading…', 'ok');
      setTimeout(() => location.reload(), 900);
    } catch (e) { status(e.message, 'warn'); }
  }

  /* ---------------- wire up ---------------- */

  bar.addEventListener('click', e => {
    if (e.target.id === 'ab-save') publish();
    if (e.target.id === 'ab-undo') undo();
    if (e.target.id === 'ab-paintings') openPaintings();
    if (e.target.id === 'ab-out') {
      api('/api/admin/logout', { method: 'POST' }).finally(() => location.reload());
    }
  });
  bar.addEventListener('change', e => { if (e.target.id === 'ab-edit') setEditing(e.target.checked); });

  addEventListener('beforeunload', e => {
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // already signed in from a previous visit?
  fetch('/api/admin/login', { credentials: 'same-origin' })
    .then(r => r.json())
    .then(d => { if (d.signedIn) start(); else if (!d.configured) signIn.title = 'Editor not set up yet'; })
    .catch(() => {});
})();
