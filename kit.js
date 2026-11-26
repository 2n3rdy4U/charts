/* Consumer Credit Matters — site frame behaviour (src/utils/site_frame.py
 * stamps the frame into every page; this is the little that needs a script).
 * Plain, no build step. */
(function () {
  var rail = document.getElementById('rail');
  var hamburger = document.getElementById('hamburger');
  var backdrop = document.getElementById('nav-backdrop');

  // ── Phone drawer (the rail slides in from the hamburger) ──
  function openDrawer() {
    rail.classList.add('open'); backdrop.classList.add('visible');
    hamburger.classList.add('open'); hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    rail.classList.remove('open'); backdrop.classList.remove('visible');
    hamburger.classList.remove('open'); hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  if (hamburger && rail && backdrop) {
    hamburger.addEventListener('click', function () { rail.classList.contains('open') ? closeDrawer() : openDrawer(); });
    backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {   // Escape closes the drawer; focus returns to the button
      if (e.key === 'Escape' && rail.classList.contains('open')) { closeDrawer(); hamburger.focus(); }
    });
  }

  // ── Desktop: the rail hides (2026-11-26). The button is made here, not stamped
  //    into each page, so every framed page has it from the publish that carries
  //    this file; a page rendered since also sets the class before it paints
  //    (site_frame._RAIL_EARLY). The choice is this browser's, one key, and the
  //    page works the same when storage is refused. The phone has no rail: its
  //    stylesheet hides the button. A chart page redraws on a window resize, so
  //    one is announced when the content area changes width. ──
  var RAIL_KEY = 'ccm.rail.v1', root = document.documentElement, header = document.getElementById('header');
  if (rail && header) {
    var wasHidden = false;
    try { wasHidden = window.localStorage.getItem(RAIL_KEY) === 'hidden'; } catch (e) {}
    root.classList.toggle('rail-hidden', wasHidden);
    var railBtn = document.createElement('button');
    railBtn.id = 'rail-toggle'; railBtn.type = 'button'; railBtn.setAttribute('aria-controls', 'rail');
    railBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M9.5 4.5v15"/></svg>';
    var railLabel = function () {
      var hidden = root.classList.contains('rail-hidden'), text = hidden ? 'Show menu' : 'Hide menu';
      railBtn.setAttribute('aria-expanded', String(!hidden)); railBtn.setAttribute('aria-label', text); railBtn.title = text;
    };
    railBtn.addEventListener('click', function () {
      var hidden = root.classList.toggle('rail-hidden');
      try { if (hidden) window.localStorage.setItem(RAIL_KEY, 'hidden'); else window.localStorage.removeItem(RAIL_KEY); } catch (e) {}
      railLabel();
      window.dispatchEvent(new Event('resize'));
    });
    railLabel();
    header.insertBefore(railBtn, header.querySelector('.brand') || header.firstChild);
  }

  // ── Rail accordion ──
  document.querySelectorAll('#rail .nav-section-header[data-section]').forEach(function (h) {
    h.addEventListener('click', function () {
      var open = !h.classList.contains('open');
      h.classList.toggle('open', open); h.setAttribute('aria-expanded', String(open));
      var items = h.nextElementSibling; if (items) items.classList.toggle('open', open);
    });
  });

  // ── Phone pills: an accordion pill shows or hides its row of items ──
  document.querySelectorAll('#mobile-nav button.mobile-nav-pill').forEach(function (p) {
    p.addEventListener('click', function () {
      var row = document.querySelector('.mobile-nav-items[data-section-id="' + p.dataset.sectionId + '"]');
      if (!row) return;
      var show = row.hidden; row.hidden = !show; p.setAttribute('aria-expanded', String(show));
    });
  });

  // ── Current page, for a page that changes what it shows without leaving
  //    (Build B's Loans | Leases toggle): move the highlight and breadcrumb. ──
  window.ccmFrame = {
    setActive: function (id) {
      var label = '', section = '';
      document.querySelectorAll('#rail [data-id]').forEach(function (a) {
        var on = a.dataset.id === id;
        a.classList.toggle('active', on);
        if (on) { a.setAttribute('aria-current', 'page'); label = a.textContent.trim();
                  var h = a.closest('.nav-section') && a.closest('.nav-section').querySelector('.nav-section-label');
                  section = h ? h.textContent.trim() : ''; }
        else a.removeAttribute('aria-current');
      });
      document.querySelectorAll('#mobile-nav .mobile-nav-sub').forEach(function (a) { a.classList.toggle('active', a.dataset.itemId === id); });
      var t = document.getElementById('panel-title'), s = document.getElementById('panel-section-label');
      if (t && label) t.textContent = label;
      if (s && section) s.textContent = section;
    }
  };

  // ── Welcome page: year in the legal line ──
  var y = document.getElementById('ccm-year'); if (y) y.textContent = String(new Date().getFullYear());

  // ── Welcome page: the My Portfolio row says what this browser or account holds.
  //    watch.js (deferred, after this file) defines CCMWatch before DOMContentLoaded. ──
  var note = document.getElementById('home-portfolio-note');
  function portfolioNote() {
    var W = window.CCMWatch; if (!note || !W || !W.available) return;
    var d = 0, i = 0;
    W.list().forEach(function (w) { if (w.kind === 'issuer') i++; else d++; });
    if (!d && !i) { note.textContent = W.account ? 'Signed in · nothing watched yet' : 'The deals you watch and the issuers you follow'; return; }
    var parts = [];
    if (d) parts.push(d + (d === 1 ? ' deal' : ' deals'));
    if (i) parts.push(i + (i === 1 ? ' issuer' : ' issuers'));
    note.textContent = (W.account ? 'Signed in · ' : '') + parts.join(', ');
  }
  if (note) {
    document.addEventListener('DOMContentLoaded', portfolioNote);
    document.addEventListener('ccm-watch-change', portfolioNote);
    document.addEventListener('ccm-watch-session', portfolioNote);
  }
})();
