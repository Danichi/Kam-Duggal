/**
 * The like button and comments under a painting.
 *
 * Lives in the detail view on the Originals page. A comment appears on the
 * painting as soon as it is written; Kam can delete one later from the editor.
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

  const li = c => `<li><b>${esc(c.name)}</b><time>${when(c.at)}</time><p>${esc(c.text)}</p></li>`;

  /** Post a like for a painting. Returns the new total, or null if already liked. */
  async function sendLike(slug) {
    if (!slug || likedSet().has(slug)) return null;
    remember(slug);
    try {
      const r = await fetch('/api/like', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify({ slug })
      });
      const d = await r.json();
      return typeof d.likes === 'number' ? d.likes : null;
    } catch { return null; }
  }

  KD.social = {
    /** Counts for every painting at once, for the gallery tiles. */
    async counts() {
      try { return await (await fetch('/api/social', { credentials: 'same-origin' })).json(); }
      catch { return {}; }
    },

    /** The little row of likes and comments that sits under a tile. */
    strip(slug) {
      const liked = likedSet().has(slug);
      return `<div class="tsoc" data-piece="${esc(slug)}">
        <button type="button" class="tsoc-like${liked ? ' on' : ''}" aria-pressed="${liked}" title="${liked ? 'You liked this' : 'Like this painting'}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-9.4A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"/></svg><span class="n">0</span>
        </button>
        <button type="button" class="tsoc-cm" title="Read and write comments">Comments <span class="n">0</span></button>
      </div>`;
    },

    /** Fill the strips in a container once the counts arrive. */
    async fill(root) {
      const data = await KD.social.counts();
      root.querySelectorAll('.tsoc').forEach(el => {
        const c = data[el.dataset.piece] || { likes: 0, comments: 0 };
        el.querySelector('.tsoc-like .n').textContent = c.likes;
        el.querySelector('.tsoc-cm .n').textContent = c.comments;
      });
    },

    /** Like straight from a tile. */
    async likeFrom(btn) {
      const el = btn.closest('.tsoc');
      if (btn.classList.contains('on')) return;
      btn.classList.add('on');
      btn.setAttribute('aria-pressed', 'true');
      const n = await sendLike(el.dataset.piece);
      if (n !== null) btn.querySelector('.n').textContent = n;
    },

    /** Open the comment panel in the detail view. */
    expand(host) {
      if (!host) return;
      const panel = $('#sc-panel', host);
      if (!panel) return;
      panel.hidden = false;
      $('#sc-toggle', host).setAttribute('aria-expanded', 'true');
      panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },

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
        const n = await sendLike(slug);
        if (n !== null) KD.social.setCount(host, n);
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
          const list = $('#sc-list', host);
          const empty = $('.sc-empty', host);
          if (empty) empty.remove();
          if (d.comment) list.insertAdjacentHTML('beforeend', li(d.comment));
          const n = $('#sc-n', host);
          n.textContent = String(Number(n.textContent || 0) + 1);
          list.scrollTop = list.scrollHeight;
          msg.textContent = 'Posted. Thank you.';
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
          ? list.map(li).join('')
          : '<li class="sc-empty">No comments yet. Be the first.</li>';
      } catch {}
    }
  };
})();
