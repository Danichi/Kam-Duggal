/**
 * What the assistant knows.
 *
 * There is no AI behind this. Every answer below is written out in advance and
 * matched on keywords, so it can only ever say things Kam has approved. Where
 * the real answer depends on the piece or the buyer (price, shipping, payment)
 * it says so and hands over to Kam rather than inventing a policy.
 *
 * Wording follows the FAQ on the artist page. If that changes, change it here.
 *
 * Tokens: {EMAIL} {SHOP} {LOCATION} {COUNT} {AVAILABLE} {PRICERANGE} {SIZERANGE}
 * A tag with a space in it is a phrase and scores higher than a single word.
 */
(function () {
  const KD = window.KD || (window.KD = {});

  /* Words that mean the same thing to the matcher. */
  const SYNONYMS = {
    painting: ['artwork', 'art', 'piece', 'work', 'canvas', 'picture'],
    buy: ['purchase', 'order', 'acquire', 'buying', 'own'],
    price: ['cost', 'pricing', 'much', 'expensive', 'afford', 'worth', 'charge'],
    ship: ['shipping', 'delivery', 'deliver', 'post', 'mail', 'freight'],
    print: ['prints', 'reproduction', 'repro', 'poster'],
    original: ['originals', 'authentic', 'genuine'],
    commission: ['commissions', 'custom', 'bespoke', 'commissioned'],
    available: ['availability', 'stock', 'unsold'],
    contact: ['reach', 'email', 'message', 'inquiry', 'enquiry', 'touch', 'speak', 'talk'],
    kam: ['artist', 'painter', 'duggal'],
    size: ['sizes', 'dimensions', 'measure', 'inches'],
    hang: ['hanging', 'display', 'mount'],
    care: ['clean', 'cleaning', 'maintain', 'dust'],
    return: ['returns', 'refund', 'refunds', 'exchange']
  };

  /* id, tags, messages, chips */
  const K = (id, tags, a, chips) => ({ id, tags, a, chips });

  const ASK = 'Send him a note on the <a href="contact.html">contact page</a> and he will come straight back to you.';

  const KB = [

    /* ---------- meeting the bot ---------- */
    K('greeting', ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy'],
      ["Hello. I can tell you about Kam's paintings, prices, prints, commissions and getting one to your wall.",
        'What would you like to know?'],
      ['How do I buy an original?', 'Do you ship?', 'Tell me about Kam']),

    K('bot', ['are you a bot', 'are you real', 'a real person', 'are you human', 'are you ai', 'chatgpt', 'robot', 'bot', 'who am i talking to', 'is this a person', 'are you kam'],
      ['I am not Kam and I am not an AI. I am a set of answers Kam wrote out in advance, matched to what you type.',
        'So if I miss your question, it is worth asking him directly. ' + ASK],
      ['Talk to Kam', 'How do I buy an original?']),

    K('help', ['what can you do', 'help', 'options', 'menu', 'what do you know', 'questions'],
      ['I can answer questions about:',
        '<b>The paintings</b> — how they are made, sizes, what is available<br><b>Buying</b> — originals, prices, commissions<br><b>Prints</b> — where they come from and what they cost<br><b>Getting it to you</b> — pickup, delivery, shipping<br><b>Kam himself</b> — where he works and how he paints',
        'Ask in your own words. If I do not know, I will point you at Kam.'],
      ['How do I buy an original?', 'Do you sell prints?', 'How are the paintings made?', 'Where is Kam based?']),

    K('thanks', ['thanks', 'thank you', 'cheers', 'appreciate it'],
      ['Any time. Anything else you want to know?'],
      ['How do I buy an original?', 'Do you ship?']),

    K('bye', ['bye', 'goodbye', 'see you', 'that is all', 'nothing else', 'no thanks'],
      ['Enjoy the paintings. If you want one, the <a href="contact.html">contact page</a> reaches Kam directly.']),

    /* ---------- Kam ---------- */
    K('who', ['who is kam', 'about the artist', 'about kam', 'who painted', 'who paints', 'who paints these', 'who made these', 'who made them', 'who is the artist', 'whose work', 'who does these', 'artist', 'biography', 'bio', 'background'],
      ['Kam Duggal is an improvisational painter who has been letting paint find its own way since 2008.',
        'He works in {LOCATION}, on canvas and board, and often without a brush. Every piece comes out of what he is thinking that day rather than a sketch.',
        'There is more on <a href="artist.html">the artist page</a>, in his own words.'],
      ['How does he paint?', 'Can I meet him?', 'What is his statement?']),

    K('since-when', ['how long has he been painting', 'since when', 'how many years', 'when did he start', 'started painting', 'experience'],
      ['Since 2008. The earliest pieces on the site are from around 2012, including <i>Abhasa</i>, a 36-inch square.',
        'He is still painting now.']),

    K('statement', ['artist statement', 'statement', 'philosophy', 'what is his style', 'inspiration', 'inspired', 'why does he paint', 'meaning'],
      ['In his words: “I am an improvisational artist, creating art since 2008 and inspired by the events of my own life.”',
        '“In each original piece I try to bring out my thoughts in the moment, and push them through the canvas or board with different colours, with and without the use of a brush.”',
        '“It is not what you are looking at. It is what you see.”'],
      ['How does he paint?', 'Tell me about Kam']),

    K('location', ['where is he based', 'where are you located', 'location', 'what city', 'what country', 'where do you live', 'based', 'canada', 'ontario'],
      ['Kam works in {LOCATION}.',
        'Paintings can go anywhere from there — he arranges pickup, delivery or shipping with you once a sale is agreed.'],
      ['Can I see one in person?', 'Do you ship?']),

    K('meet', ['can i see a painting in person', 'meet him', 'studio', 'visit', 'viewing', 'see it in person', 'come by', 'appointment', 'gallery'],
      ['Kam is based in {LOCATION}. Mention it in your inquiry and he will let you know what is possible.',
        ASK],
      ['Where is Kam based?', 'Talk to Kam']),

    K('instagram', ['instagram', 'social media', 'facebook', 'twitter', 'tiktok', 'follow', 'youtube'],
      ['He is on Instagram as <a href="https://instagram.com/{INSTAGRAM}" target="_blank" rel="noopener">@{INSTAGRAM}</a>.',
        'The full collection lives here though, and <a href="contact.html">a note to Kam</a> is the quickest way to reach him about a painting.']),

    /* ---------- the work ---------- */
    K('technique', ['how are the paintings made', 'how does he paint', 'technique', 'flow', 'pour', 'pouring', 'process', 'how is it made', 'brushless', 'improvisational', 'brush'],
      ['Much of the work is made with a brushless flow technique. The paint is poured and guided so the colours meet on their own.',
        'That is what leaves the veins and cells you can see up close — a brush could never make them.',
        'There is no sketch and no plan to copy. Each piece starts from whatever Kam is thinking that day and ends up where the paint takes it.'],
      ['What paint does he use?', 'Canvas or board?', 'Show me the collection']),

    K('materials', ['what paint', 'paint', 'acrylic', 'oil', 'medium', 'materials', 'what is it painted with', 'paint type', 'pigment'],
      ['Acrylic, sometimes with oil, on canvas and board.',
        'Each painting on the site lists its own medium and size under the title.'],
      ['Canvas or board?', 'What sizes are there?']),

    K('surface', ['canvas or board', 'board', 'what surface', 'wood', 'panel', 'stretched'],
      ['Both. Some pieces are on stretched canvas, others on board — the poured work in particular tends to be on board.',
        'Open any painting and the medium is listed beside the size.']),

    K('signed', ['is it signed', 'signed', 'signature', 'signed by the artist', 'autograph'],
      ['Yes — these are Kam\'s own paintings, sold by him directly.',
        'If you want the signature in a particular place, or anything else confirmed before you buy, ask him when you inquire.']),

    K('one-of-a-kind', ['are these originals or reproductions', 'or reproductions', 'or reproduction', 'one of a kind', 'unique', 'is it an original', 'original or print', 'difference between original and print', 'difference between an original'],
      ['Every painting on this site is an original, one-of-a-kind piece.',
        'Reproductions are sold separately as prints, and those are always labelled “Buy a print”. The original is the thing Kam made; the print is a copy of it made to order.'],
      ['Do you sell prints?', 'How do I buy an original?']),

    K('varnish', ['varnish', 'varnished', 'sealed', 'seal', 'glossy', 'matte', 'protective coat'],
      ['That varies from piece to piece, and Kam is the one to ask about a particular painting.',
        ASK]),

    K('framed', ['are they framed', 'frame', 'framing', 'do they come framed', 'ready to hang'],
      ['Kam confirms framing piece by piece — it is one of the things he goes through with you before a sale.',
        'Prints are different: you choose the framing yourself in <a href="{SHOP}" target="_blank" rel="noopener">the print shop</a>.'],
      ['Talk to Kam', 'Do you sell prints?']),

    K('sizes', ['what sizes', 'how big', 'dimensions', 'largest', 'smallest', 'size range', 'biggest', 'how tall', 'how wide'],
      ['{SIZERANGE}',
        'Every painting lists its size, and on the Originals page the <b>To scale</b> view puts them side by side at their real proportions so you can compare.'],
      ['Show me large pieces', 'Show me small pieces']),

    K('how-long-to-paint', ['how long does a painting take', 'how long to make', 'time to paint'],
      ['That depends on the piece, and Kam is the one to ask.',
        'Poured work has to be left to move and dry on its own, so it is not a quick process. ' + ASK]),

    K('titles', ['titles', 'what does the title mean', 'story behind', 'name of the painting', 'why is it called'],
      ['The titles are Kam\'s. Some pieces carry a short note from him about what was behind them — you will see it when you open the painting.',
        'For the rest, he would rather you brought your own reading to it. “It is not what you are looking at. It is what you see.”']),

    /* ---------- buying an original ---------- */
    K('how-to-buy', ['how do i buy', 'how to buy an original', 'i want to buy', 'purchase', 'how do i order', 'want one', 'interested in buying', 'checkout', 'add to cart'],
      ['Four steps, and Kam handles it personally:',
        '<b>1.</b> Find the piece on the <a href="originals.html">Originals page</a>. Use “On a wall” to check the size against a real room.<br><b>2.</b> Press <b>Ask about this piece</b> — the painting is filled in for you.<br><b>3.</b> Kam confirms availability, price and framing, and answers anything else.<br><b>4.</b> Once it is agreed, pickup or delivery is arranged with him directly.',
        'There is no checkout for originals. Nothing is charged through this site.'],
      ['How much are they?', 'Do you ship?', 'Browse the originals']),

    K('price', ['how much', 'price', 'cost', 'expensive', 'price list', 'what do they cost', 'budget', 'cheapest'],
      ['{PRICERANGE}',
        'The rest say <b>Price on request</b> — Kam confirms those directly, because it depends on the size and the piece.',
        'Ask about any painting and he will come back with the price and whether it is still available.'],
      ['Why price on request?', 'What is available now?', 'Talk to Kam']),

    K('price-on-request', ['why price on request', 'price on request', 'no price', 'why is there no price', 'hidden price'],
      ['Prices for originals are confirmed by Kam directly. Send an inquiry and he will get back to you with the price and availability.',
        'It is not a haggling tactic — the right number depends on the piece, and he would rather tell you himself.']),

    K('available', ['is it available', 'still available', 'is it sold', 'sold out', 'what is available', 'in stock', 'unsold', 'sold'],
      ['{AVAILABLE} of the {COUNT} paintings on the site are marked available right now; the others say “Ask about availability”.',
        'Availability changes as pieces sell, so Kam confirms it when you inquire. Tell me a painting by name and I will look it up.'],
      ['What is available now?', 'Talk to Kam']),

    K('payment', ['payment', 'pay', 'credit card', 'paypal', 'e transfer', 'etransfer', 'cash', 'installments', 'payment plan', 'layaway', 'deposit', 'financing'],
      ['Kam arranges payment with you directly — there is no checkout on this site for originals.',
        'Ask him what he accepts when you inquire about a piece and he will tell you. ' + ASK]),

    K('hold', ['can you hold it', 'hold', 'reserve', 'put it on hold', 'first refusal', 'waiting list'],
      ['Worth asking. Kam handles every sale himself, so it is his call on a particular piece. ' + ASK]),

    K('negotiate', ['discount', 'negotiate', 'best price', 'make an offer', 'deal', 'cheaper', 'haggle'],
      ['That is between you and Kam — he sets his own prices and handles every sale himself.',
        ASK]),

    K('tax-invoice', ['tax', 'charge tax', 'sales tax', 'hst', 'gst', 'vat', 'invoice', 'receipt', 'customs', 'duty'],
      ['Kam handles the paperwork for a sale himself, so ask him when you inquire and he will tell you exactly what applies where you are.',
        ASK]),

    K('authenticity', ['certificate of authenticity', 'coa', 'provenance', 'authenticity', 'appraisal', 'insurance value'],
      ['Ask Kam — he sells these himself, so anything you need in writing comes from him directly.',
        ASK]),

    /* ---------- prints ---------- */
    K('prints', ['do you sell prints', 'prints come from', 'where do the prints', 'prints', 'print', 'reproduction', 'poster', 'canvas print', 'buy a print'],
      ['Yes. Every painting is available as a print, and there is a <b>Buy a print</b> button on each one.',
        'Prints are made to order by Pixels, which handles the printing, framing and shipping. The button takes you straight to that piece in <a href="{SHOP}" target="_blank" rel="noopener">Kam\'s shop</a>, where you choose the size and finish.'],
      ['What print finishes are there?', 'How much are prints?', 'Original or print?']),

    K('print-types', ['print finishes', 'metal print', 'framed print', 'acrylic print', 'print options', 'print sizes'],
      ['Canvas, framed, metal and acrylic, in a range of sizes.',
        'You pick the size and finish in <a href="{SHOP}" target="_blank" rel="noopener">the print shop</a>, on the page for whichever painting you like — the price updates as you choose.']),

    K('print-price', ['how much are prints', 'print price', 'print cost', 'cheap print'],
      ['It depends on the size and finish you pick, so the live price is in <a href="{SHOP}" target="_blank" rel="noopener">the print shop</a> rather than here.',
        'Prints start well below the originals, which is rather the point of them.'],
      ['Do you sell prints?']),

    K('print-shipping', ['print shipping', 'how long do prints take', 'print delivery', 'print returns', 'print refund'],
      ['Prints are made to order by Pixels, and they handle the printing, the shipping and anything that goes wrong with a print order.',
        'Their timescales and policies are on <a href="{SHOP}" target="_blank" rel="noopener">the shop page</a> when you order. Kam only handles the originals himself.']),

    /* ---------- getting it to you ---------- */
    K('shipping', ['do you ship', 'shipping', 'delivery', 'how are originals delivered', 'can you post it', 'courier', 'international', 'worldwide', 'overseas', 'abroad'],
      ['For originals: it depends on the size of the piece and where you are. Kam will arrange pickup, delivery or shipping with you once the sale is agreed.',
        'He is in {LOCATION}, so if you are nearby, pickup or local delivery is usually the easy answer. Further away, ask him and he will work it out with you.',
        'Prints are separate — Pixels ships those directly.'],
      ['Can I pick it up?', 'What does shipping cost?', 'Talk to Kam']),

    K('shipping-cost', ['shipping cost', 'how much is shipping', 'free shipping', 'delivery charge'],
      ['There is no flat rate, because a small board and a four-foot canvas are not the same problem.',
        'Kam works it out with you once you have agreed on a piece. Mention where you are in your inquiry and he can tell you early.'],
      ['Talk to Kam']),

    K('pickup', ['can i pick it up', 'pickup', 'collect', 'local delivery', 'drop off'],
      ['Usually the simplest option if you are near {LOCATION}. Kam arranges pickup or delivery directly once a sale is agreed.',
        'Say where you are when you inquire and he will tell you what makes sense.']),

    K('packaging', ['packaging', 'packaged', 'packed', 'protected', 'damaged', 'damage', 'damaged in transit', 'broken', 'crate', 'wrapped'],
      ['Kam handles the originals himself and arranges how each one travels, so the answer depends on the piece.',
        'Ask him before you commit if it matters to you — he would rather talk it through than have you guess. ' + ASK]),

    K('returns', ['return', 'refund', 'exchange', 'money back', 'change my mind', 'guarantee', 'trial'],
      ['Kam sells the originals himself, so returns are his call rather than a shop policy. Ask him before you buy and you will both know where you stand.',
        'Prints are different — those are handled by Pixels under their own terms.'],
      ['Talk to Kam']),

    /* ---------- commissions ---------- */
    K('commission', ['do you take commissions', 'commission', 'custom painting', 'made to order', 'paint something for me', 'can he paint me'],
      ['Ask. Tell Kam the size, the colours you live with and where it will hang.',
        'Every piece is improvised, so a commission is a starting point and not a copy of an existing painting. He will not reproduce one of these exactly — that is rather the nature of the work.',
        ASK],
      ['Can I choose the colours?', 'How much are they?', 'Talk to Kam']),

    K('commission-detail', ['choose the colours', 'pick colours', 'match my sofa', 'specific size', 'match my room'],
      ['You can tell him the size, the colours you live with and where it will hang, and he works from there.',
        'What he will not do is copy an existing painting stroke for stroke. Each one is improvised, so you are commissioning a direction rather than a duplicate.'],
      ['Do you take commissions?']),

    /* ---------- living with it ---------- */
    K('care', ['how do i care', 'clean', 'dust', 'maintain', 'look after', 'care instructions'],
      ['Dust it gently with a dry, soft cloth. No cleaning products, no water, nothing abrasive.',
        'Acrylic surfaces are tougher than they look but they will mark, so treat it like furniture you are fond of rather than glass.',
        'Anything specific to your piece, ask Kam — he knows how each one was made.']),

    K('hanging', ['how do i hang', 'hanging', 'where should i hang', 'sunlight', 'direct sun', 'bathroom', 'humidity', 'fade'],
      ['Keep it out of direct sunlight and away from steady damp — the same rules as any painting. A bathroom, or straight above a radiator, is asking for trouble.',
        'For placement, the <b>On a wall</b> view on the <a href="originals.html">Originals page</a> shows a piece at its real size against a room before you commit.'],
      ['Show me the collection']),

    /* ---------- rights and trade ---------- */
    K('copyright', ['copyright', 'can i use the image', 'reproduce', 'licensing', 'license', 'licence', 'commercial use', 'tattoo', 'album cover', 'book cover'],
      ['All the artwork is the property of the artist. Buying a painting gets you the painting, not the right to reproduce it.',
        'If you want to license an image for something, that is a conversation with Kam. ' + ASK]),

    K('trade', ['interior designer', 'trade', 'wholesale', 'bulk', 'hotel', 'office', 'staging', 'gallery representation', 'represent'],
      ['Worth writing to him about directly — he handles everything himself, so there is nobody else to go through.',
        ASK]),

    K('press', ['press', 'interview', 'feature', 'media', 'article', 'exhibition', 'show'],
      ['Best asked of Kam directly. ' + ASK]),

    /* ---------- the site itself ---------- */
    K('likes', ['like button', 'likes', 'heart', 'how do likes work'],
      ['The heart under a painting is just that — a way of saying you like it. One per painting, and the count is public.',
        'It does not reserve anything or tell Kam you want to buy it. For that, use <b>Ask about this piece</b>.']),

    K('comments', ['comment', 'comments', 'leave a comment', 'review', 'feedback', 'guestbook'],
      ['Open any painting and press <b>Comments</b>. Leave your name and a few words and it goes up on the painting.',
        'Kam reads them and can take one down if he needs to, but there is no queue — yours appears straight away.']),

    K('browse', ['how do i browse', 'filters', 'filter', 'sort', 'search', 'find a painting', 'collection', 'gallery page', 'see them all'],
      ['The <a href="originals.html">Originals page</a> has all {COUNT} of them.',
        'You can filter by colour family, by size and by shape, and switch between <b>Gallery</b> and <b>To scale</b> — the second lays every painting out at its true relative size.',
        'Tell me a colour or a size and I will narrow it down for you.'],
      ['Show me blue paintings', 'Show me large pieces', 'What is available now?']),

    K('wall-view', ['on a wall', 'to scale', 'see it in my room', 'how big is it really', 'real size', 'preview'],
      ['Two ways. On the <a href="originals.html">Originals page</a>, <b>To scale</b> lays every painting out at its true relative size against the others.',
        'Open a single painting and <b>On a wall</b> hangs it at real size over a room, so you can see what it actually is rather than what a square thumbnail suggests.']),

    K('contact', ['how do i contact', 'contact', 'email', 'phone', 'number', 'call', 'get in touch', 'talk to kam', 'speak to someone', 'reach him', 'address', 'write to him'],
      ['By email — <a href="mailto:{EMAIL}">{EMAIL}</a> — or through the form on the <a href="contact.html">contact page</a>, which is the easier route because it fills in the painting for you.',
        'Kam answers these himself, so give him a little time.'],
      ['How do I buy an original?', 'Do you take commissions?']),

    K('response-time', ['how long to reply', 'reply', 'replies', 'respond', 'response time', 'when will he reply', 'has he seen', 'no reply', 'heard back'],
      ['Kam answers his own inquiries, so it is a person rather than a queue. Give it a day or two.',
        'If something is urgent, say so in the message.']),

    K('newsletter', ['newsletter', 'mailing list', 'subscribe', 'updates', 'new work', 'notify me'],
      ['There is no mailing list at the moment.',
        'If you want to hear when new work goes up, say so in <a href="contact.html">a note to Kam</a> and he will know there is interest.'])
,

    /* ---------- the plain questions people actually open with ---------- */
    K('what-is-this', ['what is this', 'what is this site', 'what do you sell', 'what is this website', 'what is going on here', 'what is this page', 'explain this site'],
      ["This is Kam Duggal's own website. He is an abstract painter and every picture here is a painting he made himself.",
        'You can look through the collection, buy an original from him directly, or order a print of any of them.',
        '<a href="originals.html">See the collection</a>'],
      ['Who paints these?', 'How do I buy an original?', 'Do you sell prints?']),

    K('for-sale', ['are these for sale', 'can i buy these', 'is it for sale', 'are they for sale', 'do you sell', 'is this a shop'],
      ['Yes. The originals are sold by Kam directly, and every painting is also available as a print.',
        'There is no checkout here for originals — you ask about a piece and Kam takes it from there.'],
      ['How do I buy an original?', 'How much are they?', 'Do you sell prints?']),

    K('how-many', ['how many paintings', 'how many pieces', 'how big is the collection', 'how many are there', 'size of the collection'],
      ['{COUNT} paintings, with {AVAILABLE} of them marked available at the moment.',
        '<a href="originals.html">See them all</a>'],
      ['What is available now?', 'Show me large pieces']),

    K('abstract', ['what is abstract art', 'what am i looking at', 'i do not get it', 'what is it supposed to be', 'what does it represent', 'is it supposed to be something', 'abstract'],
      ['Nothing in particular, and that is deliberate. There is no picture of a thing hiding in these — the colour and movement are the subject.',
        'Kam puts it better than I can: “It is not what you are looking at. It is what you see.”',
        'Two people will tell you they see different things in the same painting, and he counts that as the work doing its job.'],
      ['How are the paintings made?', 'What would you recommend?']),

    K('hand-painted', ['is it hand painted', 'hand painted', 'is it printed', 'machine', 'is it real paint', 'is it a photo'],
      ['Hand painted, every one, by Kam. Real acrylic on real canvas or board.',
        'Prints are the only reproductions, and those are always labelled as prints.']),

    K('ai-art', ['is this ai', 'ai generated', 'ai art', 'made by ai', 'computer generated', 'digital art', 'is it digital'],
      ['No. These are physical paintings — poured and worked by hand, then photographed for the site.',
        'You can see the paint itself in the close-up view: the veins and cells are what the paint did on the board.'],
      ['How are the paintings made?']),

    K('only-abstract', ['do you paint portraits', 'paint landscapes', 'paint portraits', 'landscapes', 'do you only paint abstract', 'realistic', 'pet portrait', 'can he paint my', 'other subjects'],
      ['Abstract is what Kam does — improvised colour and flow rather than a likeness of something.',
        'If you have something specific in mind it is worth asking him, but a commission would still be a piece in his own language rather than a picture of a subject.'],
      ['Do you take commissions?']),

    K('newest', ['what is new', 'latest', 'newest', 'recent work', 'anything new', 'just added'],
      ['Kam adds new paintings to the site himself as they are finished, so the collection is current.',
        'The four on the front page are the ones he is putting forward at the moment.',
        '<a href="originals.html">See everything</a>'],
      ['What would you recommend?', 'What is available now?']),

    K('colours-available', ['what colours', 'what colors', 'colour range', 'what palettes', 'colour families'],
      ['Seven colour families: Ember, Crimson, Oceanic, Night Sky, Gold &amp; Earth, Line &amp; Gesture and Spectrum.',
        'Tell me a colour and I will point you at the right ones — or filter by them on the <a href="originals.html">Originals page</a>.'],
      ['Show me blue paintings', 'Do you have anything red?', 'I want something dark']),

    K('gift', ['is it a good gift', 'as a present', 'as a gift', 'present', 'gift', 'gift wrap', 'buying for someone', 'anniversary', 'wedding present'],
      ['People do buy these as gifts. Since every piece is one of a kind, it is about as un-generic as a present gets.',
        'For wrapping, a gift note or a delivery date, ask Kam when you inquire — he handles each sale himself, so he can work around you.'],
      ['How do I buy an original?', 'What would you recommend?']),

    K('currency', ['what currency', 'usd or cad', 'canadian dollars', 'us dollars', 'currency', 'in pounds', 'euros'],
      ['Worth confirming with Kam when he gives you the price, since he is in Canada and sells to people elsewhere.',
        'Print prices are set in the shop and shown in its own currency at checkout.']),

    K('storefront', ['do you have a shop', 'storefront', 'opening hours', 'when are you open', 'is there a gallery', 'walk in', 'physical store'],
      ['There is no shop to walk into. Kam works from {LOCATION} and sells directly.',
        'If you want to see a piece in person, say so in your inquiry and he will tell you what is possible.'],
      ['Can I see one in person?', 'Talk to Kam']),

    K('more-photos', ['more photos', 'more pictures', 'close up', 'detail shot', 'see it closer', 'video', 'another angle'],
      ['Open any painting and it fills the screen — there is a close-up view for the surface, and <b>On a wall</b> shows it at real size in a room.',
        'If you want a particular angle or a photo in daylight before you commit, ask Kam and he will take one for you.'],
      ['Talk to Kam', 'Show me the collection']),

    K('sold-similar', ['it is sold', 'already sold', 'can i get one like it', 'similar piece', 'something like this', 'missed out'],
      ['If the one you wanted has gone, tell Kam which it was and what you liked about it.',
        'He will not copy it — every piece is improvised — but he can point you at the closest thing in the collection, or work from that direction as a commission.'],
      ['Do you take commissions?', 'What is available now?']),

    K('multiple', ['buy two', 'more than one', 'a pair', 'set of', 'several paintings', 'whole wall', 'bulk'],
      ['Ask him. Kam handles every sale himself, so buying two or three is a conversation rather than a cart.',
        'Tell him the wall you are filling and he can suggest pieces that sit well together.'],
      ['Talk to Kam', 'What would you recommend?']),

    K('hardware', ['hanging wire', 'hardware', 'hooks', 'ready to hang', 'how do i mount', 'does it come with'],
      ['That depends on the piece, so it is one for Kam when you inquire.',
        'He goes through framing and how it hangs with you before the sale, so nothing arrives as a surprise.'],
      ['Talk to Kam', 'How do I hang it?']),

    K('edges', ['are the sides painted', 'edges', 'wrapped canvas', 'sides of the canvas', 'deep edge'],
      ['Varies from piece to piece. Ask Kam about the one you have your eye on and he will tell you exactly how it is finished.']),

    K('resin', ['resin', 'epoxy', 'is it glossy resin', 'pour medium', 'what brand of paint', 'what supplies'],
      ['Acrylic, sometimes with oil, poured and guided rather than brushed.',
        'For anything more specific about how a particular piece was made, Kam is the one to ask — it is his method.'],
      ['How are the paintings made?']),

    K('lessons', ['do you teach', 'lessons', 'classes', 'workshop', 'tutorial', 'how can i learn', 'can you show me how'],
      ['Nothing advertised. If you are interested, ask him — it is his time to offer.',
        ASK]),

    K('collaborate', ['collaborate', 'work together', 'partnership', 'feature your art', 'can we work'],
      ['Best put to Kam directly, in as much detail as you can manage. ' + ASK]),

    K('privacy', ['privacy', 'what do you do with my details', 'data', 'spam', 'share my email', 'gdpr'],
      ['Your message goes to Kam and nowhere else. There is no mailing list to be added to and nothing is sold on.',
        'Comments show the name you type, so use whatever you are happy being public.']),

    K('login', ['how do i log in', 'login', 'sign in', 'account', 'register', 'do i need an account', 'padlock'],
      ['You do not need an account for anything here — browsing, liking and commenting are all open.',
        'The padlock at the top is how Kam signs in to update his own site.']),

    K('who-built', ['who made this website', 'who built this site', 'web designer', 'who designed this'],
      ['The site was built for Kam by his web designer. The paintings, the words and the choices are his.',
        'If you want to reach him about the art, the <a href="contact.html">contact page</a> goes straight to him.']),

    K('praise', ['i love this', 'beautiful', 'amazing', 'gorgeous', 'stunning', 'these are great', 'wow', 'nice work'],
      ['Kam will be glad to hear it. If you want to tell him, leave a comment on the painting — he reads them.',
        'The heart under each one is the quick version.'],
      ['How do I leave a comment?', 'How do I buy an original?']),

    K('ok', ['ok', 'okay', 'cool', 'right', 'got it', 'i see', 'sure', 'alright'],
      ['Anything else you want to know?'],
      ['How do I buy an original?', 'Do you sell prints?', 'What would you recommend?']),

    K('sorry', ['sorry', 'my mistake', 'never mind', 'ignore that'],
      ['No trouble. Ask away when you are ready.']),

    K('weight', ['how heavy', 'weight', 'how much does it weigh', 'is it heavy'],
      ['Depends on the piece — a small board is light enough to hang on a picture hook, a large stretched canvas rather less so.',
        'Ask Kam about the one you are looking at and he will tell you what it weighs and what it needs to hang on.'],
      ['How do I hang it?', 'Talk to Kam'])
  ];

  KD.CHAT_KB = KB;
  KD.CHAT_SYNONYMS = SYNONYMS;
})();
