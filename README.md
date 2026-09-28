# Kam Duggal — Original Art

Three-page informational site for **Kam Duggal**, an improvisational painter in
Amherstburg, Ontario, Canada. The site showcases his original paintings; every "buy a
print" link goes out to his existing print shop at
[kam-duggal.pixels.com](https://kam-duggal.pixels.com/). Nothing is sold here.

Plain HTML, CSS and JS with no build step. Hosted on **Cloudflare Pages**, which
also runs one small function for the inquiry form.

**Live demo: https://kam-duggal.pages.dev** (Pages project `kam-duggal`). Deploy
with `node tools/stage.js && npx wrangler pages deploy --project-name kam-duggal`.
No mail key is set there yet, so the inquiry form falls back to opening the
visitor's email app; add `RESEND_API_KEY` and `EMAIL_FROM` to switch that on.

| Page | What's on it |
|---|---|
| `index.html` | **Follows Kam's own homepage mockup**: hero wordmark with a cycling panel of artwork, stats band, four featured originals with prices and buy buttons, a piece to look at closely through a magnifying loupe, scroll-driven process section, a pinned sideways-scrolling strip of the collection, palette explorer, about + collector inquiries, prints line |
| `originals.html` | All 49 paintings. Filter by palette, size and shape; "to scale" wall layout; detail view with zoom, an on-a-wall room preview at true size, inquire and buy-a-print links |
| `alt.html` | **Kam's own homepage mockup, rebuilt one-to-one** (his layout, his four paintings, his prices and sizes, his Instagram line). Self-contained CSS, `noindex`. Opened from the **Alt view** button at the top left of the hero, which shows it in an overlay over the site, or directly at `/alt.html` |
| `artist.html` | Portrait of Kam, artist statement, how he works, timeline, `#collectors` (how buying works + FAQ), `#contact` (inquiry form) |

---

## Run it locally

```bash
cp .dev.vars.example .dev.vars      # EMAIL_LOG_ONLY=true prints the email instead of sending
npx wrangler pages dev . --port 8811
```

Open http://127.0.0.1:8811. Opening the files directly with `file://` mostly
works, but the hero shader falls back to a blurred still (the browser refuses to
load a local image into WebGL) and the form falls back to the visitor's email app.

## Deploy (Cloudflare Pages)

1. Push to GitHub and create a Pages project from the repo.
   - Build command: `node tools/stage.js` · Output directory: `.deploy`
2. Add the variables below under **Settings → Variables and Secrets**.

> **Never deploy the project root.** `wrangler pages deploy` uploads every file
> in its output directory and does **not** honour `.assetsignore`. Deploying `.`
> published `.dev.vars`, the drafts, `README.md`, `wrangler.toml` and `lib/` on
> the live site. `tools/stage.js` copies only the public files into `.deploy/`,
> and `wrangler.toml` points Pages at that. Shared server code lives in
> `functions/_lib/`, because `functions/` is compiled rather than served.
3. Point the domain at it (see "The domain" below) and update the URLs in
   `robots.txt` and `sitemap.xml` if it isn't `kamduggal.com`.

| Variable | Required | Purpose |
|---|---|---|
| `RESEND_API_KEY` | yes | Sends the inquiry email via [Resend](https://resend.com). Without it the form returns a clear error and offers Kam's email address. |
| `EMAIL_FROM` | yes | e.g. `Kam Duggal Website <website@kamduggal.com>`. The domain must be verified in Resend. |
| `INQUIRY_TO` | no | Where inquiries go. Defaults to `kamdugal@aol.com`. |
| `SITE_URL` | no | Canonical origin, used for the same-origin check. |
| `EMAIL_LOG_ONLY` | dev only | `true` logs the email instead of sending it. |

---

## The editor (Kam runs the site himself)

A small lock sits at the right of the header on every page. It opens a password
box; the password is a Cloudflare secret (`ADMIN_PASSWORD`) and is never in this
repo. Signing in sets a signed, http-only cookie for 30 days and puts an
**Editor** bar along the bottom of the screen.

| In the bar | What it does |
|---|---|
| **Edit mode** | Marked text becomes typeable. Every image becomes replaceable: click it to pick a file, or drag one onto it. Every section grows a **Move** handle and a **Hide** button, so blocks can be dragged into a different order or taken off the page |
| **Paintings** | The whole collection: retitle, set medium, size, price and story; tick **Hero** (cycles at the top of the home page), **Featured** (the four cards), **Sold** or **Hide**; drag rows by the handle to reorder; **Add a painting** from a file; **Remove** |
| **Publish changes** | Writes everything to KV in one go. Nothing he types is live until he presses it |
| **Undo publish** | Puts the previous published version back (one step) |

Every image of a painting on the site is a drop target: the hero slides, the four
featured cards, the gallery tiles, the close-up piece, the process section, the
palette covers, the timeline thumbnails, the faded backdrops and the detail view.
His portrait is one too (kept in `content.images`, keyed by `data-img-slot`).
Dragging an image file onto any of them replaces
that painting's photo. The browser resizes it to 1400px and 560px WebP before
uploading, so a phone photo arrives as a web-ready file.

### How it is wired

- `functions/api/admin/*` handles login, saving, restoring and uploads. Every one
  needs the cookie and refuses cross-site posts; wrong passwords are rate limited
  per IP (8 tries per 15 minutes).
- `functions/api/content.js` serves the saved content as `window.CONTENT = {...}`,
  loaded before `js/site.js` on every page so edits appear with no flicker. It is
  always revalidated against an ETag, so a publish is live on the next page load.
- `functions/api/img/[id].js` serves uploaded images out of KV, cached forever
  (ids are random and never reused).
- `js/admin.js` and `css/admin.css` are the editor. A signed-out visitor pays for
  one `/api/admin/login` check and nothing else.
- KV namespace `CONTENT` (id in `wrangler.toml`) holds one `content` document, one
  `content:previous` backup and every uploaded image under `img:*`.

### Changing the password

Kam changes it himself: **Password** in the editor bar, which asks for the
current one and the new one twice. A Worker cannot rewrite its own secret, so
the new password is stored in KV under `auth:password` as a salted PBKDF2-SHA256
hash, and that takes over from `ADMIN_PASSWORD`. Changing it stamps the time and
any cookie issued before then stops working, so every other device is signed
out; the browser doing the change gets a fresh cookie and stays in.

`ADMIN_PASSWORD` is the fallback used until that KV record exists, so it is
still what a brand new deployment signs in with. To force it back to the secret
— if Kam locks himself out — delete the record and the env password works again:

```bash
npx wrangler kv key delete auth:password --namespace-id 843b8b8f0a984b7abfeaccf5bf8204a2 --remote
printf 'the-new-password' | npx wrangler pages secret put ADMIN_PASSWORD --project-name kam-duggal
```

`SESSION_SECRET` signs the cookie, so changing it signs everyone out. For local
work put both in `.dev.vars` and run:

```bash
node tools/stage.js && npx wrangler pages dev .deploy --port 8811 --kv CONTENT
```

### What is still code, not editable

The page structure, the palettes and the process section's four paintings live in
the files. `tools/build-art.js` is still the source for a fresh install, but once
Kam publishes anything the live collection comes from KV and `js/data.js` is only
the fallback.

---

## The assistant in the corner

`js/chat-kb.js` is the whole brain (about 80 entries). There is **no AI** — it scores what the
visitor typed against the `tags` on each entry and replays the answer written
there, so it can only ever say things Kam has approved. `js/chat.js` is the
widget and the matcher; `css/chat.css` is the look.

To add a question, add an entry:

```js
K('framing-service', ['do you frame', 'framing service'],
  ['Kam can talk you through framing when you inquire.',
   'Send him a note on the <a href="contact.html">contact page</a>.'],
  ['How do I buy an original?'])
```

`tags` are what it matches on. A tag with a space is a phrase and outranks a
single word, and the longer the phrase the more specific it is taken to be.
Words that mean the same thing go in `SYNONYMS` at the top, which collapses
them to one concept so an entry tagged price/cost/expensive does not score
three times for one question.

Each entry's answer is an **array**: one bubble per line, sent in turn, because
three short messages read better than one wall of text. The fourth argument is
the suggested follow-up buttons. `{EMAIL}`, `{SHOP}`, `{LOCATION}`, `{COUNT}`,
`{AVAILABLE}`, `{PRICERANGE}` and `{SIZERANGE}` are filled in at runtime, so
prices and counts follow whatever Kam has published rather than going stale.

Questions about a specific painting, a colour or a size are answered from the
collection itself rather than from the list, so new paintings are covered the
moment Kam adds them. Anything it cannot place sends the visitor to Kam instead
of guessing.

`KD.chat.match('...')` returns the answer without touching the page, and
`KD.chat.debug('...')` shows the top-scoring entries — both are for tuning in
the browser console.

### Answers that currently hand over to Kam

These are the ones where the honest answer depends on the buyer or on a policy
Kam has not set, so the bot says he will confirm rather than inventing one.
Worth pinning down with him, after which they can be answered outright:

payment methods · deposits and payment plans · returns and refunds · how a
piece is packaged · certificate of authenticity · whether a piece is varnished
· whether originals come framed · how long a painting takes · his Instagram

## Where the content came from

Kam had no informational site: **kamduggal.com currently 301-redirects straight
to his Pixels store**. So everything here was pulled from his 99 Pixels listings.

- `tools/scrape-pixels.js` → `tools/source/pixels-paintings.json` (titles, sizes,
  listed prices, medium, availability, print prices, shop URLs)
- `tools/fetch-large.js` → `tools/originals/*.jpg`, the largest clean render
  Pixels serves (1200px on the long edge)
- `tools/build-art.js` → `js/data.js` + `img/art/*.webp` (1200px and 560px)

Re-run after editing the `CURATED` list:

```bash
node tools/build-art.js
```

`CURATED` is the editorial layer: it drops the photographs and the duplicate
uploads, fixes titles, and assigns each painting a palette. **It is the only file
to edit** — `js/data.js` is generated.

### What was left out, and why

- **Photographs.** His Pixels account also has ~35 photos (egrets, sunsets, the
  Don CeSar hotel, beach chairs). The brief was original paintings, so they are
  not on the site. Easy to add as a second collection if he wants.
- **Duplicate uploads.** About 12 paintings were uploaded more than once
  (*Reborn* three times, *Coda*, *Vase*, *Spring Day*, *War and Peace* twice
  each). One copy of each is shown.
- **Pixels' machine-written descriptions.** Many listings end with text like
  "A mesmerizing array of red and black swirls…" that Pixels generates, not Kam.
  Dropped. Only his own words are used.

### Kam's mockup

He mocked up a homepage himself and it is the design direction: header, hero
(WELCOME TO + the kamduggal.com Art wordmark + "Original art | Impressionistic |
One of a kind" + the tagline + artwork on the right), FEATURED ORIGINALS as four
cards with prices and two buttons each, then ABOUT THE ARTIST beside COLLECTOR
INQUIRIES. The homepage follows that order. His mockup's bio paragraph and the
"Art is not just what I do" quote are his words, taken from it.

Two things in his mockup are not on the site yet: the Instagram link (no handle
known) and his mockup prices, which disagree with his Pixels listings — New
Voyage is $897 there and $1,200 on Pixels, and Crimson Currents, Purplerane and
Silverlite carry prices ($1,250 / $960 / $750) that Pixels lists as "price not
specified". The site shows the Pixels figures. Ask him which are current.

### Stories behind the paintings

The site is a portfolio first, so what each painting *is* matters more than what
it costs. There are no per-piece stories anywhere on Pixels: every listing
repeats his one shared statement. The only pieces with anything of his own are
the few title meanings now in `STORIES` in `tools/build-art.js` (Anadi, Abhasa,
MU4YTE, and two notes). **Ask Kam for a line or two per painting** — what it was
about, where he was, what the title means. Drop them into `STORIES` keyed by
slug and they appear in the detail view automatically.

---

## Confirm with Kam before launch

1. **Prices.** The prices shown come from his Pixels listings, where most
   originals say "Price Not Specified" (those show as *Price on request*). Six
   have numbers: New Voyage $1,200, Ablaze $7,500, Back to Earth, Global Warming
   and Summer Breeze $950, MU4YTE $550. Some of those listings are over a decade
   old, so they need confirming.
2. **Sizes.** Taken from the listings, and several were recorded width-by-height
   inconsistently. They are corrected against each photo's orientation here, but
   he should check them; the on-a-wall preview relies on them.
3. **Email address.** His listing says `kamdugal@aol.com` (one "g"), which is
   probably why the domain got written down as "camdugal". Confirm before the
   form goes live, and consider a `kam@kamduggal.com` address on the domain.
4. **Phone.** His Pixels profile lists 519 977-3167, a Canadian (Windsor) area
   code while he is in Amherstburg ON. Deliberately left off the site. Add if he wants.
5. **Sold pieces.** Pixels marks nearly everything "currently for sale". If any
   originals are already sold, they should be marked (or removed) so the site
   doesn't offer them.
6. **Clean image files — the one real blocker.** Nine paintings carry a Fine Art
   America watermark that is **baked into the file Kam uploaded**, not applied by
   the image server: every size and every render URL shows it, so there is no way
   to fetch a clean copy. They are flagged `x` in `tools/build-art.js` and kept
   out of the hero and featured rail. **Fun Day is one of them**, and Kam wants it
   as the first painting on the site — it goes in the moment he sends the
   original photo. The rest of the images also top out at 1200px and about a
   dozen are photographed hanging on a wall, so better photography would lift the
   whole site. The nine: Fun Day, Eruption, Dori, Cloudy Day, Long Cool Day,
   Nite Fall, Play Full, Slipstream and Out of the Blue — checked by eye against
   the bottom 40% of every file, where the watermark sits.
8. **A sentence or two per painting** (see "Stories behind the paintings"). This is what would make the portfolio feel like his rather than a catalogue.
9. **Instagram / social.** His mockup had a "Follow on Instagram" line but no
   handle was found. Add the link and it goes in the footer.

## Brand assets

`img/logo-mark.png` (header monogram), `img/logo-full.png` (the footer lockup)
and `img/favicon.png` are cut from the logo Kam supplied. The black background of
the original file is keyed to alpha, so the mark sits on any dark surface:

```bash
ffmpeg -i logo.png -filter_complex   "[0:v]crop=610:580:222:18,format=rgba[c];[c]split[c1][c2];[c2]format=gray[al];[c1][al]alphamerge"   img/logo-mark.png
```

`img/kam-portrait.jpg` is his photo, cropped to 4:5 for the artist page.

## Notes

- **Motion** respects `prefers-reduced-motion`: the hero shader, parallax and
  reveals all stand down.
- **The hero shader** (`js/flow.js`) warps the painting through layered noise at
  a low resolution. If WebGL is unavailable it swaps in a blurred still.
- **The room preview** scales each painting against an 84-inch (7 ft) sofa using
  the listed inches, so it is only as accurate as the sizes in point 2.
