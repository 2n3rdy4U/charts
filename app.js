/* Consumer Credit Matters — Dashboard App
 * Vanilla JS, no build step required.
 */

(async function () {

  // ── SVG helpers (must be declared before use) ─────────────────
  const icons = {
    'chart-bar': `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
      d="M3 13.5h3v4.5H3v-4.5zm4.5-4.5h3v9h-3V9zm4.5-3h3v12h-3V6zm4.5-3h3v15h-3V3z"/>`,
    'globe': `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
      d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 0c-2.5 2.5-4 6-4 10s1.5 7.5 4 10m0-20c2.5 2.5 4 6 4 10s-1.5 7.5-4 10M2 12h20"/>`,
    'calendar': `<rect x="3" y="4" width="18" height="18" rx="2" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="16" y1="2" x2="16" y2="6" stroke-linecap="round" stroke-width="1.8"/>
      <line x1="8" y1="2" x2="8" y2="6" stroke-linecap="round" stroke-width="1.8"/>
      <line x1="3" y1="10" x2="21" y2="10" stroke-linecap="round" stroke-width="1.8"/>`,
    'document': `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
      <polyline stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" points="14,2 14,8 20,8"/>
      <line x1="8" y1="13" x2="16" y2="13" stroke-linecap="round" stroke-width="1.8"/>
      <line x1="8" y1="17" x2="16" y2="17" stroke-linecap="round" stroke-width="1.8"/>`,
    'microphone': `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
      d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
      d="M19 10a7 7 0 0 1-14 0"/>
      <line x1="12" y1="19" x2="12" y2="23" stroke-linecap="round" stroke-width="1.8"/>
      <line x1="8" y1="23" x2="16" y2="23" stroke-linecap="round" stroke-width="1.8"/>`,
    // Sub-item icons used inside accordion sections
    'car': `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
      d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/>
      <circle cx="9" cy="16" r="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
      <circle cx="17" cy="16" r="2" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>`,
    // Auto Lease — a key (you hold the keys for a term, then hand them back),
    // visually distinct from the Auto Loan car at small sizes.
    'key': `<circle cx="9" cy="9" r="5" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"/>
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
        d="M12.6 12.6 20.5 20.5M16.2 16.2 18.4 14M18.7 18.7 20.9 16.5"/>`,
    'credit-card': `<rect x="2" y="6" width="20" height="13" rx="2" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="2" y1="10.5" x2="22" y2="10.5" stroke-width="1.8" stroke-linecap="round"/>
      <line x1="6" y1="15" x2="10" y2="15" stroke-width="1.8" stroke-linecap="round"/>`,
    'stack': `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
      d="M12 3 2 8l10 5 10-5-10-5zM2 13l10 5 10-5M2 18l10 5 10-5"/>`,
  };

  // ── Two-tone composite icons (Auto Loan / Auto Lease) ─────────────
  // A car (so both read instantly as "auto") plus a small badge encoding the
  // distinction: a green KEY = ownership (loan), an amber CALENDAR = fixed
  // term (lease). These are self-coloured (not the monochrome currentColor
  // system), so they're emitted as complete <svg> art with a class param.
  // viewBox 0 0 48 48. Hand-built APPROXIMATION of the supplied concept —
  // colours/shapes are trivial to tweak. Swap in real SVG exports when ready.
  // Outlined car (stroke = currentColor, so it inherits the brand blue from
  // .tile-icon exactly like the other button glyphs). The badge stays colour-
  // coded — green key = ownership (loan), amber calendar = term (lease) — on a
  // white disc that masks the car outline behind it.
  const CAR_BODY = `
    <g transform="translate(-2.4 -2.7) scale(1.1)" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 31.5 L3 29.5 Q3 27.6 5.1 27.1 L11.6 25.5 L16.2 19.3 Q17.3 18 19.4 18 L30.8 18 Q32.8 18 34 19.6 L38.2 25.4 L43.2 26.6 Q45 27.1 45 29.1 L45 31.5 L39 31.5 A5 5 0 0 0 29 31.5 L19 31.5 A5 5 0 0 0 9 31.5 L3 31.5 Z"/>
      <path d="M26 18.3 L26 30"/>
      <path d="M13.5 26 L26 26"/>
      <circle cx="14" cy="31.5" r="4.2"/>
      <circle cx="34" cy="31.5" r="4.2"/>
    </g>`;

  const customArt = {
    'auto-loan': (cls) => `<svg class="${cls}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${CAR_BODY}
      <circle cx="36" cy="12.5" r="11" fill="#fff" stroke="#16a34a" stroke-width="2.4"/>
      <g fill="none" stroke="#16a34a" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="32.8" cy="9.6" r="3"/>
        <path d="M35 11.8 41.5 18.3"/>
        <path d="M38.6 15.4 40.6 13.4"/>
        <path d="M41.5 18.3 43.5 16.3"/>
      </g>
    </svg>`,
    'auto-lease': (cls) => `<svg class="${cls}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${CAR_BODY}
      <circle cx="36" cy="12.5" r="11" fill="#fff" stroke="#d97706" stroke-width="2.4"/>
      <g fill="none" stroke="#d97706" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
        <rect x="30.5" y="7.7" width="11" height="9.6" rx="1.7"/>
        <line x1="30.5" y1="11.1" x2="41.5" y2="11.1"/>
        <line x1="33.8" y1="5.9" x2="33.8" y2="9"/>
        <line x1="38.2" y1="5.9" x2="38.2" y2="9"/>
      </g>
    </svg>`,
  };

  function iconSVG(name) {
    const path = icons[name] || icons['document'];
    return `<svg class="nav-section-icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" xmlns="http://www.w3.org/2000/svg">${path}</svg>`;
  }

  function tileSVG(name) {
    if (customArt[name]) return customArt[name]('tile-icon tile-icon-art');
    const path = icons[name] || icons['document'];
    return `<svg class="tile-icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" xmlns="http://www.w3.org/2000/svg">${path}</svg>`;
  }

  function itemIconSVG(name) {
    if (customArt[name]) return customArt[name]('nav-item-icon nav-item-icon-art');
    if (!name || !icons[name]) return '';
    return `<svg class="nav-item-icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" xmlns="http://www.w3.org/2000/svg">${icons[name]}</svg>`;
  }

  function chevronSVG() {
    return `<svg class="nav-chevron" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
      <polyline stroke-linecap="round" stroke-linejoin="round" stroke-width="2" points="9,18 15,12 9,6"/>
    </svg>`;
  }

  // Down-pointing chevron used on the mobile pill nav to signal "this
  // section has sub-items that expand inline below". Rotates 180° via
  // CSS when the section is active so the open/closed state is obvious.
  function chevronDownSVG() {
    return `<svg class="pill-chevron" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
      <polyline stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" points="6,9 12,15 18,9"/>
    </svg>`;
  }

  function externalIconSVG() {
    return `<svg class="nav-item-link-icon" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
        d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
    </svg>`;
  }

  function badgeHTML(text) {
    const cls = text.toLowerCase() === 'new' ? 'badge-new' : 'badge-updated';
    return `<span class="badge ${cls}">${text}</span>`;
  }

  // ── Init ──────────────────────────────────────────────────────
  const NAV_CONFIG_VERSION = '20260602-height-origin';
  const config = await fetch(`nav_config.json?v=${encodeURIComponent(NAV_CONFIG_VERSION)}`, { cache: 'no-store' })
    .then(r => r.json());

  const rail          = document.getElementById('rail');
  const panelContent  = document.getElementById('panel-content');
  const panelLoading  = document.getElementById('panel-loading');
  const panelTitle    = document.getElementById('panel-title');
  const panelSection  = document.getElementById('panel-section-label');
  const welcome       = document.getElementById('welcome');
  const hamburger     = document.getElementById('hamburger');
  const backdrop      = document.getElementById('nav-backdrop');

  let activeItemId = null;

  // ── Mobile drawer ────────────────────────────────────────────
  function openDrawer() {
    rail.classList.add('open');
    backdrop.classList.add('visible');
    hamburger.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    rail.classList.remove('open');
    backdrop.classList.remove('visible');
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', () => {
    rail.classList.contains('open') ? closeDrawer() : openDrawer();
  });

  backdrop.addEventListener('click', closeDrawer);

  // ── Build nav ────────────────────────────────────────────────
  config.sections.forEach((section, sIdx) => {
    if (sIdx > 0) {
      const div = document.createElement('div');
      div.className = 'rail-divider';
      rail.appendChild(div);
    }

    const sectionEl = document.createElement('div');
    sectionEl.className = 'nav-section';

    // Section-level external link (e.g. Newsletter, Podcast)
    if (section.type === 'link') {
      const header = document.createElement('a');
      header.className = 'nav-section-header nav-section-link';
      header.href   = section.url || '#';
      header.target = '_blank';
      header.rel    = 'noopener';
      header.innerHTML = `
        ${iconSVG(section.icon)}
        <span class="nav-section-label">${section.label}</span>
        ${section.badge ? badgeHTML(section.badge) : ''}
        ${externalIconSVG()}
      `;
      sectionEl.appendChild(header);
      rail.appendChild(sectionEl);
      return;
    }

    // Section-level direct panel (single destination, no accordion)
    if (section.type === 'panel') {
      const header = document.createElement('div');
      header.className = 'nav-section-header';
      header.setAttribute('role', 'button');
      header.innerHTML = `
        ${iconSVG(section.icon)}
        <span class="nav-section-label">${section.label}</span>
        ${section.badge ? badgeHTML(section.badge) : ''}
      `;
      header.addEventListener('click', () => {
        loadPanel({ id: section.id, label: section.label, url: section.url },
                  section.label, header);
        closeDrawer();
      });
      sectionEl.appendChild(header);
      rail.appendChild(sectionEl);
      return;
    }

    // Accordion section
    const header = document.createElement('div');
    header.className = 'nav-section-header';
    header.setAttribute('role', 'button');
    header.setAttribute('aria-expanded', 'false');
    header.innerHTML = `
      ${iconSVG(section.icon)}
      <span class="nav-section-label">${section.label}</span>
      ${section.badge ? badgeHTML(section.badge) : ''}
      ${chevronSVG()}
    `;

    // Items list
    const itemsEl = document.createElement('div');
    itemsEl.className = 'nav-items';

    section.items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'nav-item';
      el.dataset.id = item.id;
      el.innerHTML = `
        ${itemIconSVG(item.icon)}
        <span>${item.label}</span>
        ${item.badge ? badgeHTML(item.badge) : ''}
      `;
      el.addEventListener('click', () => { loadPanel(item, section.label, el); closeDrawer(); });
      itemsEl.appendChild(el);
    });

    // Toggle accordion
    header.addEventListener('click', () => {
      const isOpen = header.classList.contains('open');
      header.classList.toggle('open', !isOpen);
      header.setAttribute('aria-expanded', String(!isOpen));
      itemsEl.classList.toggle('open', !isOpen);
    });

    // Open first section by default
    if (sIdx === 0) {
      header.classList.add('open');
      header.setAttribute('aria-expanded', 'true');
      itemsEl.classList.add('open');
    }

    sectionEl.appendChild(header);
    sectionEl.appendChild(itemsEl);
    rail.appendChild(sectionEl);
  });

  // ── Build welcome tile grid ───────────────────────────────────
  const tileGrid = document.getElementById('tile-grid');

  // Helper: open the side-rail accordion that owns `sectionLabel` (so the
  // sibling sub-items are reachable from the nav after landing), then load
  // `item` via its rail nav-element. Mirrors the legacy accordion-tile path
  // but targets a SPECIFIC item rather than always the first.
  function openSectionAndLoad(sectionLabel, item, fallbackEl) {
    rail.querySelectorAll('.nav-section-header').forEach(h => {
      if (h.textContent.trim().startsWith(sectionLabel) && !h.classList.contains('open')) {
        h.click();
      }
    });
    const navItem = rail.querySelector(`[data-id="${item.id}"]`);
    loadPanel(item, sectionLabel, navItem || fallbackEl);
  }

  // Build a flat, uniform grid of equal-size buttons. The accordion section
  // (ABS Data) is flattened: each of its sub-items becomes its own top-level
  // button alongside the standalone sections, so first-time visitors see the
  // concrete topics (Auto Loan, Auto Lease, Credit Card, Issuance) directly
  // with no umbrella heading breaking the symmetry. Buttons are icon + label
  // only — uniform size, no descriptions.
  function addButton({ icon, label, isLink, url, onClick }) {
    const tile = isLink ? document.createElement('a') : document.createElement('div');
    tile.className = 'tile';
    if (isLink) {
      tile.href   = url || '#';
      tile.target = '_blank';
      tile.rel    = 'noopener';
      // The small ↗ is the only signal a button opens a new tab.
      tile.innerHTML = `${tileSVG(icon)}<div class="tile-label">${label} ${externalIconSVG()}</div>`;
    } else {
      tile.innerHTML = `${tileSVG(icon)}<div class="tile-label">${label}</div>`;
      tile.addEventListener('click', () => onClick(tile));
    }
    tileGrid.appendChild(tile);
  }

  config.sections.forEach(section => {
    if (section.type === 'accordion') {
      section.items.forEach(item => {
        addButton({
          icon: item.icon,
          label: item.label,
          onClick: (tile) => openSectionAndLoad(section.label, item, tile),
        });
      });
    } else if (section.type === 'link') {
      addButton({ icon: section.icon, label: section.label, isLink: true, url: section.url });
    } else {
      addButton({
        icon: section.icon,
        label: section.label,
        onClick: (tile) => loadPanel(
          { id: section.id, label: section.label, url: section.url }, section.label, tile),
      });
    }
  });

  // ── Build mobile top nav (portrait phones) ──────────────────────
  const mobileNav = document.createElement('nav');
  mobileNav.id = 'mobile-nav';
  mobileNav.setAttribute('aria-label', 'Mobile navigation');

  const mobileNavSections = document.createElement('div');
  mobileNavSections.id = 'mobile-nav-sections';

  const mobileNavItems = document.createElement('div');
  mobileNavItems.id = 'mobile-nav-items';
  mobileNavItems.hidden = true;

  let mobileActiveSectionId = null;

  function setMobileSectionActive(id) {
    mobileActiveSectionId = id;
    mobileNavSections.querySelectorAll('.mobile-nav-pill').forEach(b => {
      b.classList.toggle('active', b.dataset.sectionId === id);
    });
  }

  function buildMobileSubItems(section) {
    mobileNavItems.innerHTML = '';
    if (!section.items || !section.items.length) { mobileNavItems.hidden = true; return; }
    // Determine which sub-item to highlight: the one matching the currently
    // loaded panel if it lives in this section, otherwise the first item
    // (so e.g. Auto reads as the default selection when ABS Data is opened).
    var matchedActive = section.items.some(function(it) { return it.id === activeItemId; });
    section.items.forEach(function(item, idx) {
      const btn = document.createElement('button');
      btn.className = 'mobile-nav-sub';
      btn.dataset.itemId = item.id;
      btn.textContent = item.label;
      var isActive = matchedActive ? (item.id === activeItemId) : (idx === 0);
      if (isActive) btn.classList.add('active');
      btn.addEventListener('click', function() {
        mobileNavItems.querySelectorAll('.mobile-nav-sub').forEach(function(b) {
          b.classList.toggle('active', b === btn);
        });
        loadPanel(item, section.label, btn);
      });
      mobileNavItems.appendChild(btn);
    });
    mobileNavItems.hidden = false;
  }

  config.sections.forEach(section => {
    const isLink = section.type === 'link';
    const pill = document.createElement(isLink ? 'a' : 'button');
    pill.className = 'mobile-nav-pill';
    pill.dataset.sectionId = section.id;
    // Accordion pills get a down-chevron to signal expandable sub-items;
    // external-link pills get an external-link glyph so the user knows
    // the tap will open a new tab (not navigate the current view).
    var pillIcon = '';
    if (section.type === 'accordion') pillIcon = chevronDownSVG();
    else if (isLink) pillIcon = externalIconSVG();
    // Two-form label so portrait phones (≤640px) can show shorter strings
    // (ABS Data → ABS, Macro Data → Macro, Data Calendar → Calendar) while
    // landscape + desktop keep the full label. Short label falls back to
    // full label if the section doesn't define short_label in nav_config.
    var fullLabel = section.label;
    var shortLabel = section.short_label || section.label;
    pill.innerHTML =
      '<span class="pill-label">' +
        '<span class="pill-label-full">' + fullLabel + '</span>' +
        '<span class="pill-label-short">' + shortLabel + '</span>' +
      '</span>' + pillIcon;

    if (isLink) {
      pill.href = section.url || '#';
      pill.target = '_blank';
      pill.rel = 'noopener';
    } else if (section.type === 'accordion') {
      pill.addEventListener('click', () => {
        if (mobileActiveSectionId === section.id && !mobileNavItems.hidden) {
          mobileNavItems.hidden = true;
          setMobileSectionActive(null);
        } else {
          setMobileSectionActive(section.id);
          buildMobileSubItems(section);
          // Auto-load the first sub-item if no panel from this section is
          // currently active. So tapping ABS from the welcome screen lands
          // directly on the Auto Explorer instead of requiring a second tap.
          // If the user is already inside an item in this section (e.g.
          // Issuance), preserve that state and just toggle the sub-row.
          var inSection = section.items.some(function(it) { return it.id === activeItemId; });
          if (!inSection) {
            var firstBtn = mobileNavItems.querySelector('.mobile-nav-sub');
            if (firstBtn) loadPanel(section.items[0], section.label, firstBtn);
          }
        }
      });
    } else {
      pill.addEventListener('click', () => {
        setMobileSectionActive(section.id);
        mobileNavItems.hidden = true;
        loadPanel({ id: section.id, label: section.label, url: section.url },
                  section.label, pill);
      });
    }
    mobileNavSections.appendChild(pill);
  });

  mobileNav.appendChild(mobileNavSections);
  mobileNav.appendChild(mobileNavItems);
  document.getElementById('app').insertBefore(mobileNav, document.getElementById('main'));

  // On the welcome screen the eight tile-buttons ARE the navigation, so the
  // mobile pill bar is redundant and just crowds the top (worst in landscape,
  // where vertical space is scarce). Hide it until the user opens a panel;
  // loadPanel() reveals it so section-switching stays available in-content.
  // Inline 'none' overrides the CSS display:flex; '' later restores it so the
  // desktop rule (display:none) still wins on wide screens.
  mobileNav.style.display = 'none';

  // ── Load panel ───────────────────────────────────────────────
  function loadPanel(item, sectionLabel, el) {
    if (activeItemId === item.id) return;

    // Update active state
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    activeItemId = item.id;

    // Sync mobile top-nav: highlight the section pill that owns this item
    // and reveal its sub-items so the user can see (and reach) sibling
    // items from the section without going back to the welcome screen.
    // Skip when the click originated FROM a mobile sub-item button — that
    // path already set its own active state and rebuilding would lose it.
    var fromMobileSub = el && el.classList && el.classList.contains('mobile-nav-sub');
    var ownerSection = null;
    for (var si = 0; si < config.sections.length; si++) {
      var sec = config.sections[si];
      if (sec.id === item.id) { ownerSection = sec; break; } // section-level panel
      if (sec.items) {
        for (var ii = 0; ii < sec.items.length; ii++) {
          if (sec.items[ii].id === item.id) { ownerSection = sec; break; }
        }
        if (ownerSection) break;
      }
    }
    if (ownerSection && !fromMobileSub) {
      setMobileSectionActive(ownerSection.id);
      if (ownerSection.type === 'accordion' && ownerSection.items && ownerSection.items.length) {
        buildMobileSubItems(ownerSection);
      } else {
        mobileNavItems.hidden = true;
      }
    }

    // Update breadcrumb
    panelSection.textContent = sectionLabel;
    panelTitle.textContent   = item.label;

    // Clear welcome screen and reveal the mobile pill bar now that we're in
    // content (restores the CSS-driven display: flex on phones, none on desktop).
    welcome.style.display = 'none';
    mobileNav.style.display = '';

    if (!item.url) {
      // Placeholder: no URL wired yet
      panelContent.innerHTML = `
        <div id="welcome">
          <div class="welcome-title">${item.label}</div>
          <div class="welcome-sub">This module is not yet wired up. Add a URL to nav_config.json to load content here.</div>
        </div>`;
      return;
    }

    // Show loading spinner, then load iframe
    panelLoading.classList.add('visible');
    panelContent.innerHTML = '';

    const iframe = document.createElement('iframe');
    const sep = item.url.includes('?') ? '&' : '?';
    iframe.src = `${item.url}${sep}_cb=${Date.now()}`;
    iframe.title = item.label;
    // Delegate clipboard-write into the chart frame so the share modal's
    // "Copy image" works. The outer Squarespace embed grants it across the
    // cross-origin boundary; this same-origin nested frame still needs it set
    // explicitly — Chrome does not reliably inherit it for dynamically-created
    // iframes (NotAllowedError on navigator.clipboard.write otherwise).
    iframe.allow = 'clipboard-write';
    iframe.addEventListener('load', () => panelLoading.classList.remove('visible'));
    panelContent.appendChild(iframe);
  }

  // ── iframe-resizer host ──────────────────────────────────────
  // On mobile (≤900 wide) the iframe is fixed at 800px tall by CSS, so
  // long content (Issuance, Explorer) scrolls inside the iframe — which
  // creates a nested-scroll context that iOS Safari handles badly (sticky
  // headers stall, scroll handoff stutters). Listen for iframe content to
  // post its height and grow the iframe to match — eliminates the nested
  // scroll entirely so only the parent shell scrolls.
  //
  // Accepts any postMessage with shape { type:..., height:<number> } from
  // our charts host. Each iframe-loaded page sends its scrollHeight via a
  // ResizeObserver on body, so layout changes (filter, sort, page) update
  // live.
  // The chart frames are served from the custom domain
  // (data.consumercreditmatters.com) — same origin as this shell. We also keep
  // the legacy github.io origin for the direct-Pages access path. (Before this,
  // the hardcoded github.io check silently rejected the custom-domain frames,
  // breaking the mobile iframe-grow behaviour.)
  var CHART_ORIGINS = ['https://data.consumercreditmatters.com', 'https://2n3rdy4u.github.io'];
  window.addEventListener('message', function(e) {
    if (e.origin !== location.origin && CHART_ORIGINS.indexOf(e.origin) === -1) return;
    if (!e.data || typeof e.data.height !== 'number') return;
    if (e.data.height < 200 || e.data.height > 20000) return;  // sanity bounds
    // Grow the iframe to content height only when the shell is in its
    // "mobile" layout, where #panel-content scrolls the page and the iframe
    // is a static block (see style.css @media below). This condition MUST
    // match that media query exactly — including the landscape-phone clause —
    // otherwise a wide-but-short landscape phone (e.g. 932×430) is treated as
    // desktop here while the CSS treats it as mobile: the iframe stays pinned
    // at 800px, its taller content scrolls internally, and that nested scroll
    // freezes iOS Safari. On true desktop, #panel-content is overflow:hidden
    // and the iframe fills it 100% with its own scroll, so skip and clear any
    // leftover inline height.
    var isMobileShell =
      window.matchMedia('(max-width: 768px)').matches ||
      window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches;
    if (!isMobileShell) {
      document.querySelectorAll('#panel-content iframe').forEach(function(f) {
        if (f.style.height) f.style.height = '';
      });
      return;
    }
    document.querySelectorAll('#panel-content iframe').forEach(function(f) {
      f.style.height = e.data.height + 'px';
    });
  });

})();
