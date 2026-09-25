/**
 * The like button and comments under a painting.
 *
 * Lives in the detail view on the Originals page. Comments are held until Kam
 * approves them, so a visitor sees their own go to "waiting to be approved"
 * rather than appearing straight away.
 */
(function () {
  const KD = window.KD || {};
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const LIKED = 'kd-liked';
  const likedSet = () => { try { return new Set(JSON.parse(localStorage.getItem(LIKED) || '[]')); } catch { return new Set(); } };
  const remember = slug => { try { const s = likedSet(); s.add(slug); localStorage.setItem(LIKED, JSON.stringify([...s])); } catch {} };

  const when = ms => {
    const d = Math.floor((Date.now() - ms) / 86400000);
    if (d <= 0) return 'today';
    if (d === 1) return 'yesterday';
    if (d < 30) return d + ' days ago';
    return new Date(ms).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  KD.social = {
    /** Build the block once; it is refilled each time a painting opens. */
    mount(host) {
      if (!host || host.dataset.built) return;
      host.dataset.built = '1';
      host.innerHTML = `
        <div class="sc-bar">
          <button type="button" class="sc-like" id="sc-like" aria-pressed="false">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-9.4A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"/></svg>
            <span class="sc-count" id="sc-count">0</span>
            <em id="sc-word">likes</em>
          </button>
          <button type="button" class="sc-toggle" id="sc-toggle" aria-expanded="false">Comments <span id="sc-n">0</span></button>
        </div>
        <div class="sc-panel" id="sc-panel" hidden>
          <ul class="sc-list" id="sc-list"></ul>
          <form class="sc-form" id="sc-form" novalidate>
            <label class="sr-only" for="sc-name">Your name</label>
            <input id="sc-name" name="name" placeholder="Your name" maxlength="60" required>
            <label class="sr-only" for="sc-text">Your comment</label>
            <textarea id="sc-text" name="text" placeholder="Say something about this painting" maxlength="1200" required></textarea>
            <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
            <div class="sc-send">
              <button type="submit" class="btn small gold">Post comment</button>
              <span class="sc-msg" id="sc-msg"></span>
            </div>
          </form>
        </div>`;

      $('#sc-toggle', host).addEventListener('click', () => {
        const panel = $('#sc-panel', host);
        panel.hidden = !panel.hidden;
        $('#sc-toggle', host).setAttribute('aria-expanded', String(!panel.hidden));
      });

      $('#sc-like', host).addEventListener('click', async () => {
        const slug = host.dataset.slug;
        if (!slug || likedSet().has(slug)) return;
        const btn = $('#sc-like', host);
        btn.classList.add('on');
        btn.setAttribute('aria-pressed', 'true');
        remember(slug);
        try {
          const r = await fetch('/api/like', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin', body: JSON.stringify({ slug })
          });
          const d = await r.json();
          if (typeof d.likes === 'number') KD.social.setCount(host, d.likes);
        } catch {}
      });

      $('#sc-form', host).addEventListener('submit', async e => {
        e.preventDefault();
        const slug = host.dataset.slug;
        const msg = $('#sc-msg', host);
        const name = $('#sc-name', host).value.trim();
        const text = $('#sc-text', host).value.trim();
        if (!name || !text) { msg.textContent = 'Your name and a comment, please.'; msg.className = 'sc-msg bad'; return; }
        msg.textContent = 'Sending…';
        msg.className = 'sc-msg';
        try {
          const r = await fetch('/api/comment', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
            body: JSON.stringify({ slug, name, text, website: $('.hp', host).value })
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || 'That did not send.');
          $('#sc-text', host).value = '';
          msg.textContent = 'Thank you. Kam reads every comment before it appears.';
          msg.className = 'sc-msg ok';
        } catch (err) {
          msg.textContent = err.message;
          msg.className = 'sc-msg bad';
        }
      });
    },

    setCount(host, n) {
      $('#sc-count', host).textContent = n;
      $('#sc-word', host).textContent = n === 1 ? 'like' : 'likes';
    },

    /** Show the numbers and comments for one painting. */
    async load(host, slug) {
      if (!host) return;
      KD.social.mount(host);
      host.dataset.slug = slug;
      const liked = likedSet().has(slug);
      const btn = $('#sc-like', host);
      btn.classList.toggle('on', liked);
      btn.setAttribute('aria-pressed', String(liked));
      KD.social.setCount(host, 0);
      $('#sc-n', host).textContent = '0';
      $('#sc-list', host).innerHTML = '';
      $('#sc-msg', host).textContent = '';
      $('#sc-panel', host).hidden = true;
      $('#sc-toggle', host).setAttribute('aria-expanded', 'false');

      try {
        const r = await fetch('/api/social/' + encodeURIComponent(slug), { credentials: 'same-origin' });
        const d = await r.json();
        if (host.dataset.slug !== slug) return;            // they moved on already
        KD.social.setCount(host, d.likes || 0);
        const list = d.comments || [];
        $('#sc-n', host).textContent = list.length;
        $('#sc-list', host).innerHTML = list.length
          ? list.map(c => `<li><b>${esc(c.name)}</b><time>${when(c.at)}</time><p>${esc(c.text)}</p></li>`).join('')
          : '<li class="sc-empty">No comments yet. Be the first.</li>';
      } catch {}
    }
  };
})();
