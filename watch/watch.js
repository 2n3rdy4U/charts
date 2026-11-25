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
   next one and the star says why.

   Two stores, one API. Signed out, the list lives in this browser's
   localStorage only (one origin), wrapped in try/catch: with storage
   unavailable the star says so and does nothing. Signed in (Phase 3, the
   account layer below), the account's tables are the store and the session
   record holds a cache of them: every read is answered from the cache, every
   write goes to the cache first and to the table behind it, and a write the
   table refuses is reverted with a toast. The browser's own list is left
   exactly as it was at sign-in, so signing out or deleting the account brings
   it back. Each click sends GoatCounter one anonymous event (/watch/add/<key>
   or /watch/remove/<key>) — a count, never a person.
   ───────────────────────────────────────────────────────────────── */
(function () {
  "use strict";
  var KEY = "ccm.watch.v1", FREE_DEALS = 3, FREE_ISSUERS = 3;
  var PAGE = "/abs/my-portfolio/", PAGE_NAME = "My Portfolio";
  function isIssuer(x) { return (x.kind || "deal") === "issuer"; }
  var SCRIPT_EL = document.currentScript;
  var CSS_URL = SCRIPT_EL && SCRIPT_EL.src ? new URL("./watch.css", SCRIPT_EL.src).toString() : "/watch/watch.css";
  var CONFIG_URL = SCRIPT_EL && SCRIPT_EL.src ? new URL("./alerts.json", SCRIPT_EL.src).toString() : "/watch/alerts.json";
  var SAVE_FAILED = "Couldn't save that change. Your portfolio is as it was — try again in a moment.";

  // ── the browser's own store ─────────────────────────────────────
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
  function saveBrowser() {
    try { window.localStorage.setItem(KEY, JSON.stringify(cache)); return true; }
    catch (e) { available = false; return false; }
  }
  function probe() {   // storage can be present but refused (private mode, blocked site data)
    try { var t = "ccm.watch.probe"; window.localStorage.setItem(t, "1"); window.localStorage.removeItem(t); return true; }
    catch (e) { available = false; return false; }
  }

  // ── the session: the account's cache, kept beside the browser's list ──
  var SKEY = "ccm.watch.session.v1", sess = null;
  function loadSession() {
    try { var raw = window.localStorage.getItem(SKEY); sess = raw ? JSON.parse(raw) : null; }
    catch (e) { sess = null; }
    if (sess && !(sess.url && sess.key && sess.access_token && sess.reader && sess.cache)) sess = null;
    return sess;
  }
  function saveSession() {
    try { if (sess) window.localStorage.setItem(SKEY, JSON.stringify(sess)); else window.localStorage.removeItem(SKEY); return true; }
    catch (e) { return false; }
  }
  // Which store answers: the account's cache when signed in, else the browser's list.
  function store() { return sess ? sess.cache : load(); }
  function save() { return sess ? saveSession() : saveBrowser(); }
  function countsOf(s) {
    var c = { deals: 0, issuers: 0 };
    Object.keys(s.items).forEach(function (k) { if (isIssuer(s.items[k])) c.issuers++; else c.deals++; });
    return c;
  }
  function limits() { return sess ? sess.reader.caps : { deals: FREE_DEALS, issuers: FREE_ISSUERS }; }
  function changed(detail) { document.dispatchEvent(new CustomEvent("ccm-watch-change", { detail: detail || {} })); }

  var W = {
    get available() { load(); return available; },
    list: function () { var s = store(); return Object.keys(s.items).map(function (k) { return s.items[k]; })
                        .sort(function (a, b) { return (a.added || "").localeCompare(b.added || ""); }); },
    has: function (key) { return !!store().items[key]; },
    get: function (key) { return store().items[key] || null; },
    counts: function () { return countsOf(store()); },
    get limits() { return limits(); },
    room: function (item) {   // "" when it fits, else the reason it does not
      var s = store(); if (s.items[item.key]) return "";
      var c = countsOf(s), lim = limits();
      if (isIssuer(item)) return c.issuers >= lim.issuers ? "issuers" : "";
      return c.deals >= lim.deals ? "deals" : "";
    },
    add: function (item) {
      var s = store();
      if (W.room(item)) return false;
      var was = s.items[item.key];
      s.items[item.key] = Object.assign({ added: new Date().toISOString() }, was || {}, item, sess ? { email_on: was ? was.email_on !== false : true } : {});
      if (!save()) return false;
      if (sess && !was) remote(api("/rest/v1/items", { method: "POST", prefer: "return=minimal",
                                    body: { reader_id: sess.reader.id, key: item.key, email_on: true, rule: s.rules[item.key] || null } }),
                              function () { delete s.items[item.key]; }, item.key, { duplicate: true });
      return true;
    },
    remove: function (key) {
      var s = store(), was = s.items[key], rule = s.rules[key], seen = s.seen[key];
      delete s.items[key]; delete s.rules[key]; delete s.seen[key];
      if (!save()) return false;
      if (sess && was) remote(api("/rest/v1/items?key=eq." + encodeURIComponent(key), { method: "DELETE", prefer: "return=minimal" }),
                              function () { s.items[key] = was; if (rule) s.rules[key] = rule; if (seen) s.seen[key] = seen; }, key);
      return true;
    },
    toggle: function (item) { if (W.has(item.key)) { W.remove(item.key); return false; } return W.add(item) ? true : null; },
    clear: function () { if (sess) return false; cache = blank(); return saveBrowser(); },   // the browser's list only; an account is emptied star by star
    rule: function (key) { return store().rules[key] || null; },
    setRule: function (key, rule) {
      var s = store(), was = s.rules[key] || null;
      if (rule) s.rules[key] = rule; else delete s.rules[key];
      if (!save()) return false;
      if (sess && s.items[key]) remote(api("/rest/v1/items?key=eq." + encodeURIComponent(key), { method: "PATCH", prefer: "return=minimal", body: { rule: rule || null } }),
                                       function () { if (was) s.rules[key] = was; else delete s.rules[key]; }, key);
      return true;
    },
    // Per-item email switch (signed in only; the browser's list has no email).
    emailOn: function (key) { var it = store().items[key]; return !!it && it.email_on !== false; },
    setEmail: function (key, on) {
      var s = store(), it = s.items[key]; if (!sess || !it) return false;
      var was = it.email_on; it.email_on = !!on;
      if (!save()) return false;
      remote(api("/rest/v1/items?key=eq." + encodeURIComponent(key), { method: "PATCH", prefer: "return=minimal", body: { email_on: !!on } }),
             function () { it.email_on = was; }, key);
      return true;
    },
    seen: function () { return load().seen; },            // what this device has shown: per device, never on the account
    lastVisit: function () { return load().lastVisit; },
    markSeen: function (map) { var s = load(); s.seen = map; s.lastVisit = new Date().toISOString(); return saveBrowser(); },
    count: function () { return Object.keys(store().items).length; }
  };
  window.CCMWatch = W;

  // ── the account layer (Phase 3) ──────────────────────────────────
  // Six calls to the project's own API over fetch, no library: a sign-in
  // request, its verification, a token refresh, sign-out, the reader's row and
  // the items table. The project's address and publishable key come from
  // /watch/alerts.json (written at render time from the env file; absent when
  // accounts are off) and ride in the session record so that a star on any
  // page can write to the account without another request.
  var config = null, refreshing = null, inflight = [];
  function parse(r) {
    return r.text().then(function (t) {
      var b = null; try { b = t ? JSON.parse(t) : null; } catch (e) {}
      if (!r.ok) throw apiError(r.status, b);
      return b;
    });
  }
  function apiError(status, body) {
    var msg = (body && (body.message || body.msg || body.error_description || body.error)) || ("HTTP " + status);
    var e = new Error(msg); e.status = status; e.body = body; e.cap = /^cap:/.test(msg);
    e.code = body && (body.error_code || body.code) || "";
    return e;
  }
  function track(p) { inflight.push(p); var done = function () { inflight.splice(inflight.indexOf(p), 1); }; p.then(done, done); return p; }
  function anon(cfg, path, body) {
    return track(fetch(cfg.url + path, { method: "POST", headers: { apikey: cfg.key, "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(parse));
  }
  function api(path, opts) {
    opts = opts || {};
    var p = ensureFresh().then(function () {
      if (!sess) throw new Error("signed out");
      var h = { apikey: sess.key, Authorization: "Bearer " + sess.access_token, "Content-Type": "application/json" };
      if (opts.prefer) h.Prefer = opts.prefer;
      return fetch(sess.url + path, { method: opts.method || "GET", headers: h, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }).then(parse);
    });
    return track(p);
  }
  function adoptTokens(b) {
    sess.access_token = b.access_token; sess.refresh_token = b.refresh_token;
    sess.expires_at = b.expires_at || (Math.floor(Date.now() / 1000) + (b.expires_in || 3600));
    saveSession();
  }
  function ensureFresh() {   // a token near its end is renewed first; a refresh the project refuses ends the session
    if (!sess) return Promise.reject(new Error("signed out"));
    if (sess.expires_at - 60 > Date.now() / 1000) return Promise.resolve();
    if (refreshing) return refreshing;
    refreshing = fetch(sess.url + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { apikey: sess.key, "Content-Type": "application/json" },
                       body: JSON.stringify({ refresh_token: sess.refresh_token }) }).then(parse)
      .then(function (b) { adoptTokens(b); })
      .catch(function (e) { if (e.status === 400 || e.status === 401 || e.status === 403) dropSession("expired"); throw e; })
      .then(function (v) { refreshing = null; return v; }, function (e) { refreshing = null; throw e; });
    return refreshing;
  }
  // A write the table refused: put the cache back, repaint, say so. A duplicate on insert (the
  // row is there already, from another device) is not a failure.
  function remote(p, revert, key, ok) {
    p.catch(function (e) {
      if (ok && ok.duplicate && (e.status === 409 || e.code === "23505")) return;
      if (e.message === "signed out") return;
      revert(); saveSession();
      if (key) document.querySelectorAll('.ccm-star[data-watch="' + CSS.escape(key) + '"]').forEach(function (b) { paint(b, W.has(key)); });
      toast(e.cap ? capMessage(e) : SAVE_FAILED);
      changed({ key: key, reverted: true });
      document.dispatchEvent(new CustomEvent("ccm-watch-error", { detail: { key: key, message: e.message, status: e.status } }));
    });
  }
  function capMessage(e) {   // "cap: this account holds 3 deals and allows 3"
    var m = /holds (\d+) (deals|issuers)/.exec(e.message), lim = limits();
    var iss = m ? m[2] === "issuers" : false;
    return iss ? "Your account follows " + lim.issuers + " issuers. Unfollow one to add this one."
               : "Your account holds " + lim.deals + " deals. Remove one to add this one.";
  }
  function dropSession(why) {
    if (!sess) return;
    sess = null; saveSession();
    document.querySelectorAll(".ccm-star").forEach(function (b) { if (b.dataset.watch) paint(b, W.has(b.dataset.watch)); });
    document.dispatchEvent(new CustomEvent("ccm-watch-session", { detail: { signedIn: false, why: why || "signed out" } }));
    changed({ session: why || "signed out" });
  }
  function readerOf(r) {
    var t = r.tiers || {};
    return { id: r.id, email: r.email, first_name: r.first_name, last_name: r.last_name, tier: r.tier, label: t.label || "",
             cadence: r.cadence, newsletter: !!r.newsletter, status: r.status, since: r.created_at,
             caps: { deals: t.cap_deals != null ? t.cap_deals : FREE_DEALS, issuers: t.cap_issuers != null ? t.cap_issuers : FREE_ISSUERS } };
  }
  // The account is the store: replace the cache with the tables. Display details a star captured
  // (name, link, ticker) are kept for rows the tables know only by key.
  function sync() {
    return api("/rest/v1/readers?select=id,email,first_name,last_name,tier,cadence,status,newsletter,created_at,tiers(label,cap_deals,cap_issuers)")
      .then(function (rows) {
        if (!rows || !rows[0]) throw new Error("no reader");
        sess.reader = readerOf(rows[0]);
        return api("/rest/v1/items?select=key,kind,email_on,rule,added_at&order=added_at");
      })
      .then(function (rows) {
        var old = sess.cache.items, c = blank();
        (rows || []).forEach(function (it) {
          c.items[it.key] = Object.assign({ name: it.key }, old[it.key] || {}, { key: it.key, kind: it.kind, email_on: it.email_on !== false, added: it.added_at });
          if (it.rule) c.rules[it.key] = it.rule;
        });
        sess.cache = c; saveSession();
        changed({ sync: true });
        return sess.reader;
      });
  }
  // The browser's list joins the account up to its caps, in the order it was starred; the account
  // wins a conflict, and a browser rule fills an account item that has none. What did not fit
  // stays in the browser and is counted for the page's notice.
  function merge() {
    var b = load(), c = sess.cache, caps = sess.reader.caps, n = countsOf(c);
    var moved = { deals: 0, issuers: 0, rules: 0 }, left = { deals: 0, issuers: 0 }, reqs = [];
    Object.keys(b.items).sort(function (x, y) { return (b.items[x].added || "").localeCompare(b.items[y].added || ""); }).forEach(function (k) {
      var it = b.items[k], iss = isIssuer(it), rule = b.rules[k] || null;
      if (c.items[k]) {
        if (rule && !c.rules[k]) {
          c.rules[k] = rule; moved.rules++;
          reqs.push(api("/rest/v1/items?key=eq." + encodeURIComponent(k), { method: "PATCH", prefer: "return=minimal", body: { rule: rule } }).catch(function () { delete c.rules[k]; moved.rules--; }));
        }
        return;
      }
      if (iss ? n.issuers >= caps.issuers : n.deals >= caps.deals) { left[iss ? "issuers" : "deals"]++; return; }
      c.items[k] = Object.assign({}, it, { email_on: true });
      if (rule) { c.rules[k] = rule; moved.rules++; }
      if (iss) n.issuers++; else n.deals++;
      moved[iss ? "issuers" : "deals"]++;
      reqs.push(api("/rest/v1/items", { method: "POST", prefer: "return=minimal", body: { reader_id: sess.reader.id, key: k, email_on: true, rule: rule } })
                .catch(function (e) { if (e.status === 409 || e.code === "23505") return; delete c.items[k]; delete c.rules[k]; moved[iss ? "issuers" : "deals"]--; if (rule) moved.rules--; }));
    });
    saveSession();
    return Promise.all(reqs).then(function () { saveSession(); changed({ merged: true }); return { moved: moved, left: left }; });
  }
  function start(cfg, body) {
    sess = { url: cfg.url, key: cfg.key, cache: blank(), reader: { caps: { deals: FREE_DEALS, issuers: FREE_ISSUERS } } };
    adoptTokens(body);
    return sync().then(merge).then(function (res) {
      document.querySelectorAll(".ccm-star").forEach(function (b) { if (b.dataset.watch) paint(b, W.has(b.dataset.watch)); });
      document.dispatchEvent(new CustomEvent("ccm-watch-session", { detail: { signedIn: true, moved: res.moved, left: res.left } }));
      return res;
    }).catch(function (e) { sess = null; saveSession(); throw e; });
  }
  function signInError(e) {   // the reasons the page can name
    if (e.status === 429 || /rate/i.test(e.code)) e.reason = "rate";
    else if (e.status === 422 || e.status === 400 && /email|validat/i.test(e.message)) e.reason = "email";
    else if (e.status === 403 || e.status === 401 || /expired|invalid/i.test(e.message)) e.reason = "expired";
    else if (e.status === 500 && /(saving|creating) new user/i.test(e.message)) e.reason = "invited";   // the registration trigger refused the address
    else e.reason = "other";
    return e;
  }

  // Accounts on: the config file exists. null when it does not (the page shows no sign-in line).
  W.config = function () {
    if (config !== null) return Promise.resolve(config || null);
    return fetch(CONFIG_URL, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
      .then(function (c) { config = c && c.url && c.key ? { url: c.url, key: c.key } : false; return config || null; });
  };
  Object.defineProperty(W, "account", { get: function () { return sess ? sess.reader : null; } });
  // Ask for the sign-in email. first_name and last_name create the account on a first sign-in.
  W.signIn = function (who) {
    return W.config().then(function (cfg) {
      if (!cfg) throw signInError(Object.assign(new Error("accounts are off"), { status: 0 }));
      return anon(cfg, "/auth/v1/otp", { email: who.email, create_user: true, data: { first_name: who.first_name || "", last_name: who.last_name || "" } })
        .then(function () { return true; }, function (e) { throw signInError(e); });
    });
  };
  // May this address register now? The project's can_register (open registration, an
  // invited address, or an account that exists). Resolves true when accounts are off or
  // the question cannot be asked, so the sign-in itself gives the answer.
  W.canRegister = function (email) {
    return W.config().then(function (cfg) {
      if (!cfg) return true;
      return anon(cfg, "/rest/v1/rpc/can_register", { addr: email }).then(function (b) { return b !== false; }, function () { return true; });
    });
  };
  // Unsubscribe from every alert email by the token in the email's link (no session).
  // Resolves with the project's answer: {ok, email, already} or {ok: false}.
  W.unsubscribe = function (token) {
    return W.config().then(function (cfg) {
      if (!cfg) throw new Error("accounts are off");
      return anon(cfg, "/rest/v1/rpc/unsubscribe", { t: token });
    });
  };
  // The six-digit code ({email, token}) or the link's token ({token_hash}). Resolves with what the
  // merge moved and left behind. A link of type "email_change" confirms a new address instead:
  // it resolves with {changed: <address>} once the account's address has moved, or
  // {pending: true} when the project still waits on a link sent to the other address
  // (its "secure email change" setting); the session the browser holds is kept either way.
  W.verify = function (what) {
    return W.config().then(function (cfg) {
      if (!cfg) throw signInError(Object.assign(new Error("accounts are off"), { status: 0 }));
      if (what.type === "email_change") {
        return anon(cfg, "/auth/v1/verify", { type: "email_change", token_hash: what.token_hash }).then(function (b) {
          if (b && b.access_token && !sess) { adoptNew(cfg, b); }
          else if (b && b.access_token && sess) { adoptTokens(b); }
          var done = !!(b && b.user && b.user.email) || !(b && /other email/i.test(b.msg || ""));
          return (sess ? sync().catch(function () {}) : Promise.resolve()).then(function () {
            return done ? { changed: (b && b.user && b.user.email) || (sess && sess.reader.email) || true } : { pending: true };
          });
        }, function (e) { throw signInError(e); });
      }
      var body = what.token_hash ? { type: "email", token_hash: what.token_hash } : { type: "email", email: what.email, token: what.token };
      return anon(cfg, "/auth/v1/verify", body).then(function (b) { return start(cfg, b); }, function (e) { throw signInError(e); });
    });
  };
  function adoptNew(cfg, body) {   // a session from a link opened in a browser that held none
    sess = { url: cfg.url, key: cfg.key, cache: blank(), reader: { caps: { deals: FREE_DEALS, issuers: FREE_ISSUERS } } };
    adoptTokens(body);
  }
  // Ask the project to move the account to another address: it mails that address a link
  // (and, with secure email change on, the current one too); nothing changes until opened.
  W.changeEmail = function (email) {
    if (!sess) return Promise.reject(new Error("signed out"));
    return api("/auth/v1/user", { method: "PUT", body: { email: email } }).then(function (u) { return { sent_to: email, new_email: u && u.new_email }; });
  };
  W.sync = function () { return sess ? sync() : Promise.resolve(null); };
  W.signOut = function () {
    if (!sess) return Promise.resolve();
    var p = api("/auth/v1/logout", { method: "POST" }).catch(function () {});
    dropSession("signed out");
    return p;
  };
  W.setAccount = function (fields) {   // first_name, last_name, cadence
    if (!sess) return Promise.reject(new Error("signed out"));
    var body = {}; ["first_name", "last_name", "cadence"].forEach(function (k) { if (fields[k] !== undefined) body[k] = fields[k]; });
    return api("/rest/v1/readers?id=eq." + sess.reader.id, { method: "PATCH", prefer: "return=representation",
                                                              body: body }).then(function (rows) {
      if (rows && rows[0]) { Object.keys(body).forEach(function (k) { sess.reader[k] = rows[0][k]; }); saveSession(); }
      document.dispatchEvent(new CustomEvent("ccm-watch-session", { detail: { signedIn: true, updated: Object.keys(body) } }));
      return sess.reader;
    });
  };
  W.deleteAccount = function () {
    if (!sess) return Promise.resolve();
    return api("/rest/v1/rpc/delete_my_account", { method: "POST", body: {} }).then(function () { dropSession("deleted"); });
  };
  W.pending = function () { return Promise.all(inflight.slice()).then(function () {}, function () {}); };

  // The sign-in link lands here with ?token_hash=…&type=email: verify in this tab, clean the
  // address so a reload does not try the used token again. W.landing is the promise, or null.
  W.landing = null;
  function landing() {
    var q = new URLSearchParams(location.search), th = q.get("token_hash"), type = q.get("type");
    if (!th || (type !== "email" && type !== "email_change")) return;
    q.delete("token_hash"); q.delete("type");
    try { history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash); } catch (e) {}
    W.landing = W.verify({ token_hash: th, type: type });
    W.landingType = type;
    W.landing.catch(function () {});
  }

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
  W.toast = toast;
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
      var item = itemOf(btn), on = W.toggle(item), lim = limits();
      if (!W.available) { paint(btn, false); toast("Could not save: this browser is not storing site data."); return; }
      if (on === null) {   // the cap: the browser's, or the account's
        var why = W.room(item);
        toast(sess ? (why === "issuers" ? "Your account follows " + lim.issuers + " issuers. Unfollow one to add this one."
                                        : "Your account holds " + lim.deals + " deals. Remove one to add this one.")
                   : (why === "issuers" ? "A free portfolio follows " + lim.issuers + " issuers. Unfollow one to add this one."
                                        : "A free portfolio holds " + lim.deals + " deals. Remove one to add this one."), PAGE);
        return;
      }
      paint(btn, on); ping(on, item);
      document.querySelectorAll('.ccm-star[data-watch="' + CSS.escape(item.key) + '"]').forEach(function (b) { if (b !== btn) paint(b, on); });
      toast(isIssuer(item) ? (on ? (sess ? "Following · email on for new deals from this issuer." : "Following · you will see its new deals in " + PAGE_NAME + ".") : "No longer following.")
                           : (on ? (sess ? "Added to " + PAGE_NAME + " · email on for this deal." : "Added to " + PAGE_NAME + " · saved in this browser only.") : "Removed from " + PAGE_NAME + "."), on ? PAGE : null);
      changed({ key: item.key, on: on, count: W.count() });
    });
  }
  function scan(root) { (root || document).querySelectorAll("[data-watch]:not([data-watch-ready])").forEach(upgrade); }

  function ensureStylesheet() {
    if (document.querySelector('link[href="' + CSS_URL + '"]')) return;
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = CSS_URL; document.head.appendChild(l);
  }
  function init() {
    load(); probe(); loadSession(); landing(); scan();
    // Rows the page fetches later (the performance page's Deals table) get their star too.
    new MutationObserver(function (muts) {
      muts.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.matches && n.matches("[data-watch]")) upgrade(n); scan(n); } }); });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
