/* Consumer Credit Matters — the workspace (charts roadmap, phase 3, step 1).
 * One to four tiles. A tile is an existing chart page in its embed mode
 * (?embed=1: the site frame is hidden, the page fills the tile), so every
 * control the page has works in the tile, in a panel that slides out beside it. The address is the workspace:
 *   ?n=3&t1=perf;ac=loan;sel=ALL,SDART;m=dq_60plus_pct&t2=card;sel=CHAIT
 * n is how many tiles are shown; tN is a tile's page and that page's own
 * settings, ';' between them. A tile tells this page when its settings change
 * (the kit's syncAddress posts 'ccm-tile-state'), and the address follows.
 * This format is kept when a tile's inside becomes a chart drawn directly.
 * Plain script, no build step. */
(function () {
  var KINDS = {
    perf: { path: '/abs/performance/index.html' },
    card: { path: '/abs/credit-card/index.html' },
    macro: { path: '/macro/index.html' },
    iss: { path: '/abs/issuance/index.html' }
  };
  // What the tile's menu offers; each starts from a view worth opening.
  var TYPES = [
    { id: 'loan',  label: 'Auto Loan',   kind: 'perf', q: 'ac=loan&sel=ALL,SDART,TAOT,CAOT&m=dq_60plus_pct&view=calendar' },
    { id: 'lease', label: 'Auto Lease',  kind: 'perf', q: 'ac=lease&sel=ALL-LEASE,NALT,GMALT&m=dq_60plus_pct&view=calendar' },
    { id: 'card',  label: 'Credit Card', kind: 'card', q: 'sel=ALL,CHAIT,COMET,SYNIT' },
    { id: 'macro', label: 'Macro',       kind: 'macro', q: 'cat=Labor+Market&series=UNRATE' },
    { id: 'iss',   label: 'Issuance',    kind: 'iss', q: '' }
  ];
  var T = function (kind, q) { return { kind: kind, q: q }; };
  var PRESETS = [
    { id: 'credit', label: 'Auto loans: delinquency and losses', n: 2, tiles: [
        T('perf', 'ac=loan&sel=ALL,SDART,TAOT,CAOT&m=dq_60plus_pct&view=calendar'),
        T('perf', 'ac=loan&sel=SDART,AMCAR,CAOT,TAOT&m=cnl_ratio&view=calendar')] },
    { id: 'classes', label: 'Loans, leases and cards', n: 3, tiles: [
        T('perf', 'ac=loan&sel=ALL,SDART,TAOT,CAOT&m=dq_60plus_pct&view=calendar'),
        T('perf', 'ac=lease&sel=ALL-LEASE,NALT,GMALT&m=dq_60plus_pct&view=calendar'),
        T('card', 'sel=ALL,CHAIT,COMET,SYNIT')] },
    { id: 'four', label: 'Loans, leases, cards and the economy', n: 4, tiles: [
        T('perf', 'ac=loan&sel=ALL,SDART,TAOT,CAOT&m=dq_60plus_pct&view=calendar'),
        T('perf', 'ac=lease&sel=ALL-LEASE,NALT,GMALT&m=dq_60plus_pct&view=calendar'),
        T('card', 'sel=ALL,CHAIT,COMET,SYNIT'),
        T('macro', 'cat=Labor+Market&series=UNRATE')] }
  ];
  var MAX = 4;
  var $ = function (id) { return document.getElementById(id); };
  var grid = $('ws-grid'), tabs = $('ws-tabs');
  var narrow = function () { return window.matchMedia('(max-width: 900px), (orientation: landscape) and (max-height: 500px)').matches; };

  // ── the address ──
  function clean(q) {            // a page's settings without the embed flag, as "k=v;k=v"
    return String(q || '').replace(/^\?/, '').split('&').filter(function (p) { return p && !/^embed=/.test(p); }).join(';');
  }
  function parse(search) {
    var out = { n: 0, tiles: [] };
    String(search || '').replace(/^\?/, '').split('&').forEach(function (part) {
      var i = part.indexOf('='); if (i < 0) return;
      var k = part.slice(0, i), v = part.slice(i + 1);
      try { v = decodeURIComponent(v); } catch (e) { return; }
      if (k === 'n') { var n = parseInt(v, 10); if (n >= 1 && n <= MAX) out.n = n; return; }
      var m = /^t([1-4])$/.exec(k); if (!m) return;
      var bits = v.split(';'), kind = bits.shift();
      if (KINDS[kind]) out.tiles[+m[1] - 1] = T(kind, bits.join('&'));
    });
    return out;
  }
  function address() {
    var parts = ['n=' + state.n];
    state.tiles.forEach(function (t, i) { if (t) parts.push('t' + (i + 1) + '=' + t.kind + (t.q ? ';' + clean(t.q) : '')); });
    return location.pathname + '?' + parts.join('&');
  }
  function writeAddress() { try { history.replaceState(null, '', address()); } catch (e) {} }

  // ── state: what the address says, else the four-chart set (two on a small window) ──
  var given = parse(location.search), dflt = PRESETS[2];
  var state = { n: given.n || (window.innerWidth < 1100 ? 2 : 4), tiles: [], cur: 0, max: -1 };
  for (var i = 0; i < MAX; i++) state.tiles[i] = given.tiles[i] || dflt.tiles[i];

  var typeOf = function (t) { return t.kind === 'macro' ? 'macro' : t.kind === 'iss' ? 'iss' : t.kind === 'card' ? 'card' : (/(^|&)ac=lease(&|$)/.test(t.q) ? 'lease' : 'loan'); };
  var labelOf = function (t) { return TYPES.filter(function (x) { return x.id === typeOf(t); })[0].label; };
  var srcOf = function (t) { return KINDS[t.kind].path + '?' + (t.q ? t.q + '&' : '') + 'embed=1'; };

  // ── tiles ──
  var els = [];
  function build() {
    grid.innerHTML = ''; els = [];
    for (var i = 0; i < MAX; i++) (function (i) {
      var tile = document.createElement('section'); tile.className = 'ws-tile'; tile.setAttribute('aria-label', 'Chart ' + (i + 1));
      var head = document.createElement('div'); head.className = 'ws-tile-head';
      var sel = document.createElement('select'); sel.className = 'ws-sel'; sel.setAttribute('aria-label', 'Chart ' + (i + 1) + ' shows');
      TYPES.forEach(function (x) { var o = document.createElement('option'); o.value = x.id; o.textContent = x.label; sel.appendChild(o); });
      sel.addEventListener('change', function () {
        var x = TYPES.filter(function (y) { return y.id === sel.value; })[0];
        closePanel(); state.tiles[i] = T(x.kind, x.q); load(i); writeAddress(); drawTabs();
      });
      // Two dots at the top left, as on a Mac window: red closes this chart, green shows it alone
      // (and brings the others back). Each shows its sign when the pointer is over the pair.
      var X = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.6 3.6l4.8 4.8M8.4 3.6l-4.8 4.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" fill="none"/></svg>';
      var OUT = '<svg viewBox="0 0 12 12" aria-hidden="true"><path class="o" d="M3 3h4.2L3 7.2zM9 9H4.8L9 4.8z" fill="currentColor"/><path class="i" d="M5.6 5.6H2.2l3.4-3.4zM6.4 6.4h3.4L6.4 9.8z" fill="currentColor"/></svg>';
      var dot = function (cls, label, glyph, fn) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'ws-dot ' + cls; b.title = label; b.setAttribute('aria-label', label);
        b.innerHTML = '<span>' + glyph + '</span>'; b.addEventListener('click', fn); return b;
      };
      var shut = dot('ws-shut', 'Close this chart', X, function () { closeTile(i); });
      var grow = dot('ws-grow', 'Show this chart alone', OUT, function () { closePanel(); state.max = state.max === i ? -1 : i; show(); });
      var dots = document.createElement('div'); dots.className = 'ws-dots'; dots.appendChild(shut); dots.appendChild(grow);
      head.appendChild(sel); tile.appendChild(dots); tile.appendChild(head);
      grid.appendChild(tile);
      els.push({ tile: tile, sel: sel, grow: grow, shut: shut, frame: null, loaded: '' });
    })(i);
  }
  function solo(e) { try { e.frame.contentDocument.documentElement.classList.toggle('ws-solo', state.n < 2); } catch (x) {} }   // no dots: the title takes the corner
  function load(i) {              // (re)load a tile's page; an iframe is made only for a tile that is shown
    var e = els[i], t = state.tiles[i];
    e.sel.value = typeOf(t);
    if (!e.frame) {
      e.frame = document.createElement('iframe'); e.frame.title = 'Chart ' + (i + 1) + ': ' + labelOf(t);
      e.frame.addEventListener('load', function () { solo(e); });
      e.tile.appendChild(e.frame);
    }
    e.frame.title = 'Chart ' + (i + 1) + ': ' + labelOf(t);
    e.loaded = srcOf(t); e.frame.src = e.loaded;
  }
  function show() {
    var one = narrow();
    if (state.max >= state.n || one) state.max = -1;
    var alone = state.max >= 0;
    grid.setAttribute('data-n', String(alone ? 1 : state.n));
    if (state.cur >= state.n) state.cur = 0;
    els.forEach(function (e, i) {
      var on = one ? i === state.cur : alone ? i === state.max : i < state.n;
      e.grow.hidden = state.n < 2 || one; e.shut.hidden = state.n < 2; e.tile.classList.toggle('ws-nodots', state.n < 2); solo(e);
      e.grow.classList.toggle('on', alone); e.grow.title = alone ? 'Show all ' + state.n + ' charts' : 'Show this chart alone'; e.grow.setAttribute('aria-label', e.grow.title);
      e.tile.hidden = !on;
      if (on && !e.frame) load(i);
    });
    $('ws-n').querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.n === state.n)); });
    drawTabs();
  }
  function closeTile(i) {         // the chart leaves; those after it move up; its settings wait at the end for "Charts"
    if (state.n < 2) return;
    closePanel(); state.max = -1;
    state.tiles.push(state.tiles.splice(i, 1)[0]); state.n--;
    els.forEach(function (e, j) { if (e.frame && e.loaded !== srcOf(state.tiles[j])) load(j); });
    show(); writeAddress();
  }
  function drawTabs() {
    tabs.innerHTML = '';
    for (var i = 0; i < state.n; i++) (function (i) {
      var b = document.createElement('button'); b.type = 'button';
      b.textContent = (i + 1) + ' · ' + labelOf(state.tiles[i]); b.setAttribute('aria-pressed', String(i === state.cur));
      b.addEventListener('click', function () { closePanel(); state.cur = i; show(); });
      tabs.appendChild(b);
    })(i);
  }

  // ── a tile's controls panel. A frame cannot draw outside itself, so the tile's frame is
  //    enlarged over its neighbour (rightward, and to the grid's height; a tile at the right
  //    edge keeps its frame and the chart gives the panel its right side) and
  //    the page inside is told where its chart sits in the larger frame (the kit's ccmTileBox).
  //    One panel at a time. It stays until the reader closes it (the gear, Done or Escape). ──
  var PANEL = 310, PAD = 10, openAt = -1, shade = null;
  function boxTo(i, box) { try { els[i].frame.contentWindow.ccmTileBox(box); } catch (e) {} }
  function closePanel() {
    if (openAt < 0) return;
    var e = els[openAt], i = openAt; openAt = -1;
    e.tile.classList.remove('ws-open'); e.tile.style.removeProperty('--hs'); e.tile.style.removeProperty('--ds'); e.frame.removeAttribute('style');
    if (shade) { shade.remove(); shade = null; }
    boxTo(i, null);
  }
  function openPanel(i) {
    closePanel();
    var e = els[i], r = e.tile.getBoundingClientRect(), w = e.frame.clientWidth, h = e.frame.clientHeight;
    if (narrow()) { openAt = i; boxTo(i, { x: 0, y: 0, w: w, h: h, side: 'bottom', pw: w }); return; }
    var g = grid.getBoundingClientRect(), x0 = g.left + PAD, x1 = g.left + grid.clientWidth - PAD;
    var y0 = Math.min(r.top, g.top + PAD), y1 = Math.max(r.bottom, g.top + grid.clientHeight - PAD);
    // Always at the chart's right side. Beside a left tile the frame grows rightward over its
    // neighbour. A tile at the right edge has no room there: the chart steps left over its
    // neighbour, at its own size, and the panel takes the place it left. With no neighbour
    // either (one chart) the chart gives up the width and redraws.
    var ext = Math.round(Math.min(PANEL, Math.max(0, x1 - r.right))), need = PANEL - ext;
    var shift = Math.round(Math.min(need, Math.max(0, r.left - x0))), cw = w - (need - shift);
    if (cw < 220) { openAt = i; boxTo(i, { x: 0, y: 0, w: w, h: h, side: 'bottom', pw: w }); return; }
    shade = document.createElement('div'); shade.className = 'ws-shade'; grid.appendChild(shade);   // dims the rest; the panel is closed by its own button
    var top = Math.round(y0 - r.top);
    e.tile.classList.add('ws-open');
    e.tile.style.setProperty('--hs', need + 'px');   // the tile's menu stays at the chart's corner
    e.tile.style.setProperty('--ds', shift + 'px');   // and so do its dots
    e.frame.style.cssText = 'left:' + (-shift) + 'px;top:' + top + 'px;width:' + (w + ext + shift) + 'px;height:' + Math.round(y1 - y0) + 'px';
    openAt = i;
    boxTo(i, { x: 0, y: -top, w: cw, h: h, side: 'right', pw: PANEL, resized: need > shift });
  }
  window.ccmTilePanel = function (win, open) {       // called by the page inside a tile (same origin)
    for (var i = 0; i < els.length; i++) if (els[i].frame && els[i].frame.contentWindow === win) { if (open) openPanel(i); else closePanel(); return; }
  };
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closePanel(); });

  // ── a tile's settings changed: remember them and keep the address in step ──
  window.addEventListener('message', function (ev) {
    if (ev.origin !== location.origin || !ev.data || ev.data.type !== 'ccm-tile-state') return;
    for (var i = 0; i < els.length; i++) {
      if (els[i].frame && els[i].frame.contentWindow === ev.source) {
        var kind = Object.keys(KINDS).filter(function (k) { return KINDS[k].path.replace(/index\.html$/, '') === String(ev.data.path || '').replace(/index\.html$/, ''); })[0];
        if (!kind) return;
        var q = clean(ev.data.search).split(';').join('&');
        if (state.tiles[i].kind === kind && clean(state.tiles[i].q) === clean(q)) return;   // the page restating what it was given: a bare address stays bare
        state.tiles[i] = T(kind, q);
        els[i].sel.value = typeOf(state.tiles[i]);
        writeAddress(); drawTabs();
        return;
      }
    }
  });

  // ── controls ──
  $('ws-n').querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () { closePanel(); state.max = -1; state.n = +b.dataset.n; show(); writeAddress(); });
  });
  var preset = $('ws-preset');
  PRESETS.forEach(function (p) { var o = document.createElement('option'); o.value = p.id; o.textContent = p.label; preset.appendChild(o); });
  preset.addEventListener('change', function () {
    var p = PRESETS.filter(function (x) { return x.id === preset.value; })[0]; if (!p) return;
    closePanel(); state.max = -1; state.n = p.n; p.tiles.forEach(function (t, i) { state.tiles[i] = t; });
    els.forEach(function (e, i) { if (e.frame) load(i); });
    show(); writeAddress(); preset.value = '';
  });
  var copy = $('ws-copy');
  copy.addEventListener('click', function () {
    var url = location.origin + address(), done = function (ok) { copy.textContent = ok ? 'Copied' : 'Copy the address bar'; setTimeout(function () { copy.textContent = 'Copy link'; }, 2200); };
    try { navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); }); } catch (e) { done(false); }
  });
  var wasNarrow = narrow(), rz;
  window.addEventListener('resize', function () { clearTimeout(rz); closePanel(); rz = setTimeout(function () { if (narrow() !== wasNarrow) { wasNarrow = narrow(); show(); } }, 150); });

  build(); show();
  if (given.n || given.tiles.length) writeAddress();   // tidy an address that came with gaps; a bare /workspace/ stays bare
})();
