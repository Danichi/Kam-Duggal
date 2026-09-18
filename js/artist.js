(function () {
  const $ = s => document.querySelector(s);
  const P = window.PAINTINGS;
  const params = new URLSearchParams(location.search);

  /* ---------- timeline progress line ---------- */
  const tl = $('#timeline');
  if (tl) {
    const items = [...tl.children];
    const update = () => {
      const r = tl.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * .6 - r.top) / r.height));
      tl.style.setProperty('--p', p * 100 + '%');
      items.forEach(li => li.classList.toggle('on', li.getBoundingClientRect().top < innerHeight * .6));
    };
    addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ---------- portrait parallax ---------- */
  const portrait = $('#portrait-img');
  if (portrait && !KD.reduced) {
    addEventListener('scroll', () => {
      const r = portrait.parentElement.getBoundingClientRect();
      if (r.bottom < 0) return;
      portrait.style.transform = `scale(1.15) translateY(${(r.top + r.height / 2 - innerHeight / 2) * -.06}px)`;
    }, { passive: true });
  }

  /* ---------- inquiry form ---------- */
  const form = $('#inquiry');
  if (!form) return;
  const select = $('#piece');
  select.insertAdjacentHTML('beforeend', [...P].sort((a, b) => a.title.localeCompare(b.title))
    .map(p => `<option value="${p.slug}">${KD.esc(p.title)} (${KD.size(p)})</option>`).join(''));
  const pick = $('#piece-pick');

  function showPiece() {
    const p = KD.bySlug[select.value];
    pick.hidden = !p;
    $('#piece-field').hidden = !!p;
    if (!p) return;
    pick.querySelector('img').src = KD.img(p, true);
    pick.querySelector('b').textContent = p.title;
    pick.querySelector('span').textContent = `${p.medium} · ${KD.size(p)} · ${p.original === 'available' ? KD.price(p) : 'Ask about availability'}`;
  }
  select.addEventListener('change', showPiece);
  $('#piece-clear').addEventListener('click', () => { select.value = ''; showPiece(); select.focus(); });

  const piece = params.get('piece');
  if (piece && KD.bySlug[piece]) {
    select.value = piece;
    const msg = $('#message');
    if (!msg.value) msg.value = `Hi Kam, I'm interested in the original "${KD.bySlug[piece].title}". Is it still available?`;
  }
  const interest = params.get('interest');
  if (interest) form.querySelectorAll('[name=interest]').forEach(r => { r.checked = r.value === interest; });
  showPiece();

  const status = $('#status');
  const fieldErr = (name, text) => {
    const input = form.elements[name];
    const field = input.closest('.field');
    field.classList.toggle('invalid', !!text);
    let el = field.querySelector('.err');
    if (!text) { el && el.remove(); input.removeAttribute('aria-invalid'); return; }
    if (!el) { el = document.createElement('span'); el.className = 'err'; el.id = name + '-err'; field.appendChild(el); }
    el.textContent = text;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', el.id);
  };

  function validate() {
    const v = n => form.elements[n].value.trim();
    const errs = {};
    if (!v('name')) errs.name = 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email'))) errs.email = 'Please enter a valid email address.';
    if (!v('message')) errs.message = 'Please add a short message.';
    ['name', 'email', 'message'].forEach(n => fieldErr(n, errs[n]));
    return errs;
  }

  function mailto(data) {
    const p = KD.bySlug[data.get('piece')];
    const body = [
      `Interest: ${data.get('interest')}`,
      p ? `Painting: ${p.title} (${KD.size(p)})` : '',
      '',
      data.get('message'),
      '',
      data.get('name'),
      data.get('email'),
      data.get('phone'),
      data.get('city')
    ].filter(x => x !== null).join('\n');
    const subject = `Website inquiry: ${p ? p.title : data.get('interest')}`;
    return `mailto:${KD.EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      status.className = 'status bad';
      status.textContent = 'Please check the highlighted fields.';
      form.elements[Object.keys(errs)[0]].focus();
      return;
    }
    const data = new FormData(form);
    const chosen = KD.bySlug[data.get('piece')];
    if (chosen) data.set('piece_title', chosen.title);
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    status.className = 'status';
    status.textContent = 'Sending…';
    try {
      const res = await fetch('/api/inquiry', { method: 'POST', body: data });
      const out = await res.json().catch(() => ({}));
      if (res.status === 404 || res.status === 405) throw new Error('no-backend');
      if (!res.ok) {
        Object.entries(out.fields || {}).forEach(([k, t]) => form.elements[k] && fieldErr(k, t));
        throw new Error(out.error || 'We could not send your message.');
      }
      form.innerHTML = `<div class="sent"><span class="eyebrow">Thank you</span><h3>Your note is on its way.</h3><p class="muted" style="margin:0">Kam will reply to ${KD.esc(data.get('email'))}.</p></div>`;
    } catch (err) {
      btn.disabled = false;
      if (err.message === 'no-backend' || err instanceof TypeError) {
        // Static preview without the server function: fall back to the visitor's email app.
        location.href = mailto(data);
        status.className = 'status ok';
        status.textContent = 'Opening your email app…';
      } else {
        status.className = 'status bad';
        status.innerHTML = `${KD.esc(err.message)} You can also email <a href="${mailto(data)}" style="text-decoration:underline">${KD.EMAIL}</a>.`;
      }
    }
  });
  form.addEventListener('input', e => { if (e.target.closest('.invalid')) validate(); });
})();
