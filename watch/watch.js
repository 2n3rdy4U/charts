/* ── CCM Watch ──────────────────────────────────────────────────────
   The portfolio store and the "Watch" / "Follow" star, shared by every deal surface.

   Usage: <script src="/watch/watch.js" defer></script> on a page that marks
   its watchable things with attributes:

     <span data-watch="0002111835" data-watch-kind="deal" data-watch-ac="loan"
           data-watch-ticker="AART" data-watch-name="Ally Auto Receivables Trust 2026-1"
           data-watch-series="2026-1" data-watch-url="/abs/issuance/presale/...html"
           data-watch-label></span>

   Each becomes a star button (toggle, aria-pressed, keyboard operable);
   data-watch-label adds the word "Watch"/"Watching" (deals and card trusts) or
   "Follow"/"Following" (an issuer, followed for its new deals only). Keys: a
   deal is its 10-digit CIK; an issuer is shelf:<TICKER>; a card trust is
   trust:<TICKER>. A free portfolio holds FREE_DEALS watched deals (card trusts
   count as deals) and FREE_ISSUERS followed issuers; the store refuses the
   next one and the star says why. In Phase 1 that is a product rule the page
   enforces; from Phase 3 the account enforces it.

   The list lives in this browser's localStorage only (one origin), wrapped in
   try/catch: with storage unavailable the star says so and does nothing.
   Each click sends GoatCounter one anonymous event (/watch/add/<key> or
   /watch/remove/<key>) — a count, never a person.
   ───────────────────────────────────────────────────────────────── */
(function () {
  "use strict";
  var KEY = "ccm.watch.v1", FREE_DEALS = 3, FREE_ISSUERS = 3;
  var PAGE = "/abs/my-portfolio/", PAGE_NAME = "My Portfolio";
  function isIssuer(x) { return (x.kind || "deal") === "issuer"; }
  var SCRIPT_EL = document.currentScript;
  var CSS_URL = SCRIPT_EL && SCRIPT_EL.src ? new URL("./watch.css", SCRIPT_EL.src).toString() : "/watch/watch.css";

  // ── store ───────────────────────────────────────────────────────
  function blank() { return { v: 1, items: {}, rules: {}, seen: {}, lastVisit: null }; }
  var cache = null, available = true;
  function load() {
    if (cache) return cache;
    try {
      var raw = window.localStorage.getItem(KEY);
      cache = raw ? Object.assign(blank(), JSON.parse(raw)) : blank();
    } catch (e) { available = false; cache = blank(); }
    return cache;
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(cache)); return true; }
    catch (e) { available = false; return false; }
  }
  function probe() {   // storage can be present but refused (private mode, blocked site data)
    try { var t = "ccm.watch.probe"; window.localStorage.setItem(t, "1"); window.localStorage.removeItem(t); return true; }
    catch (e) { available = false; return false; }
  }

  var W = {
    get available() { load(); return available; },
    list: function () { var s = load(); return Object.keys(s.items).map(function (k) { return s.items[k]; })
                        .sort(function (a, b) { return (a.added || "").localeCompare(b.added || ""); }); },
    has: function (key) { return !!load().items[key]; },
    get: function (key) { return load().items[key] || null; },
    counts: function () {
      var s = load(), c = { deals: 0, issuers: 0 };
      Object.keys(s.items).forEach(function (k) { if (isIssuer(s.items[k])) c.issuers++; else c.deals++; });
      return c;
    },
    limits: { deals: FREE_DEALS, issuers: FREE_ISSUERS },
    room: function (item) {   // "" when it fits, else the reason it does not
      var s = load(); if (s.items[item.key]) return "";
      var c = W.counts();
      if (isIssuer(item)) return c.issuers >= FREE_ISSUERS ? "issuers" : "";
      return c.deals >= FREE_DEALS ? "deals" : "";
    },
    add: function (item) {
      var s = load();
      if (W.room(item)) return false;
      s.items[item.key] = Object.assign({ added: new Date().toISOString() }, s.items[item.key] || {}, item);
      return save();
    },
    remove: function (key) { var s = load(); delete s.items[key]; delete s.rules[key]; delete s.seen[key]; return save(); },
    toggle: function (item) { if (W.has(item.key)) { W.remove(item.key); return false; } return W.add(item) ? true : null; },
    clear: function () { cache = blank(); return save(); },
    rule: function (key) { return load().rules[key] || null; },
    setRule: function (key, rule) { var s = load(); if (rule) s.rules[key] = rule; else delete s.rules[key]; return save(); },
    seen: function () { return load().seen; },
    lastVisit: function () { return load().lastVisit; },
    markSeen: function (map) { var s = load(); s.seen = map; s.lastVisit = new Date().toISOString(); return save(); },
    count: function () { return Object.keys(load().items).length; }
  };
  window.CCMWatch = W;

  // ── analytics: one anonymous count per click ─────────────────────
  function ping(on, item) {
    try {
      if (!(window.goatcounter && window.goatcounter.count)) return;
      window.goatcounter.count({ path: "/watch/" + (on ? "add" : "remove") + "/" + item.key,
                                 title: (on ? "Watch " : "Unwatch ") + (item.name || item.key), event: true });
    } catch (e) {}
  }

  // ── the star ─────────────────────────────────────────────────────
  var STAR = '<svg class="ccm-star-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
             '<path d="M12 2.6l2.9 6.1 6.7.8-4.9 4.6 1.3 6.6L12 17.4l-6 3.3 1.3-6.6L2.4 9.5l6.7-.8z"/></svg>';

  function itemOf(el) {
    var d = el.dataset;
    return { key: d.watch, kind: d.watchKind || "deal", ac: d.watchAc || "loan", ticker: d.watchTicker || "",
             name: d.watchName || d.watch, series: d.watchSeries || null, url: d.watchUrl || location.pathname };
  }
  function paint(btn, on) {
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    var item = itemOf(btn), label = btn.querySelector(".ccm-star-label"), iss = isIssuer(item);
    var verb = iss ? (on ? "Following " : "Follow ") : (on ? "Watching " : "Watch ");
    btn.setAttribute("aria-label", verb + item.name + (iss ? " for new deals" : ""));
    btn.title = iss ? (on ? "Following new deals from this issuer · click to stop" : "Follow this issuer: hear when it brings a new deal")
                    : (on ? "In " + PAGE_NAME + " · click to remove" : "Add to " + PAGE_NAME);
    if (label) label.textContent = iss ? (on ? "Following" : "Follow") : (on ? "Watching" : "Watch");
  }
  function toast(msg, href) {
    var t = document.getElementById("ccm-watch-toast");
    ensureStylesheet();
    if (!t) { t = document.createElement("div"); t.id = "ccm-watch-toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.appendChild(t); }
    t.innerHTML = "";
    t.appendChild(document.createTextNode(msg + " "));
    if (href) { var a = document.createElement("a"); a.href = href; a.textContent = PAGE_NAME + " ›"; t.appendChild(a); }
    t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }
  function upgrade(el) {
    if (el.dataset.watchReady) return;
    el.dataset.watchReady = "1";
    ensureStylesheet();   // the script rides on every framed page; the stylesheet only where a star is drawn
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "ccm-star" + (el.hasAttribute("data-watch-label") ? " labeled" : "");
    btn.innerHTML = STAR + (el.hasAttribute("data-watch-label") ? '<span class="ccm-star-label"></span>' : "");
    Array.prototype.forEach.call(el.attributes, function (a) { if (a.name.indexOf("data-watch") === 0) btn.setAttribute(a.name, a.value); });
    el.replaceWith(btn);
    if (!W.available) {
      btn.disabled = true; btn.classList.add("na"); btn.setAttribute("aria-label", "Watchlist unavailable: this browser is not storing site data");
      btn.title = "Watchlist unavailable: this browser is not storing site data"; return;
    }
    paint(btn, W.has(btn.dataset.watch));
    btn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      var item = itemOf(btn), on = W.toggle(item);
      if (!W.available) { paint(btn, false); toast("Could not save: this browser is not storing site data."); return; }
      if (on === null) {   // the free cap
        var why = W.room(item);
        toast(why === "issuers" ? "A free portfolio follows " + FREE_ISSUERS + " issuers. Unfollow one to add this one."
                                 : "A free portfolio holds " + FREE_DEALS + " deals. Remove one to add this one.", PAGE);
        return;
      }
      paint(btn, on); ping(on, item);
      document.querySelectorAll('.ccm-star[data-watch="' + CSS.escape(item.key) + '"]').forEach(function (b) { if (b !== btn) paint(b, on); });
      toast(isIssuer(item) ? (on ? "Following · you will see its new deals in " + PAGE_NAME + "." : "No longer following.")
                           : (on ? "Added to " + PAGE_NAME + " · saved in this browser only." : "Removed from " + PAGE_NAME + "."), on ? PAGE : null);
      document.dispatchEvent(new CustomEvent("ccm-watch-change", { detail: { key: item.key, on: on, count: W.count() } }));
    });
  }
  function scan(root) { (root || document).querySelectorAll("[data-watch]:not([data-watch-ready])").forEach(upgrade); }

  function ensureStylesheet() {
    if (document.querySelector('link[href="' + CSS_URL + '"]')) return;
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = CSS_URL; document.head.appendChild(l);
  }
  function init() {
    load(); probe(); scan();
    // Rows the page fetches later (the performance page's Deals table) get their star too.
    new MutationObserver(function (muts) {
      muts.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.matches && n.matches("[data-watch]")) upgrade(n); scan(n); } }); });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
