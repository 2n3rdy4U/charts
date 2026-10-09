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
})();
