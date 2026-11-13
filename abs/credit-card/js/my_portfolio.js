// My Portfolio (web/my_portfolio.html): the deals a reader watches, as a short
// roster with one headline figure and an optional rule each; the issuers they
// follow for new deals, as a list with no figures; and a dated list of what
// was filed for either. Reads watch.json + events.json (built by
// src/workflows/sec/shelf_detail/watch_feed.py) and the browser store in
// /watch/watch.js. Draws only: no figure is computed here beyond a difference.
(function () {
  "use strict";
  var root = document.getElementById("md"), FEED = root.dataset.feed || "/abs/performance/data/";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var W = window.CCMWatch, PAGE = "/abs/my-portfolio/", NAME = "My Portfolio";

  // ── formatting ───────────────────────────────────────────────────
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(iso, year) { if (!iso) return "—"; var d = new Date(iso.slice(0, 10) + "T00:00:00"); return MONTHS[d.getMonth()] + " " + d.getDate() + (year === false ? "" : ", " + d.getFullYear()); }
  function fmtVal(x, fmt) { if (x == null) return "—"; return fmt === "fac" ? x.toFixed(3) : (x * 100).toFixed(2) + "%"; }
  function fmtDelta(cur, prev, fmt) {
    if (cur == null || prev == null) return "";
    var d = fmt === "fac" ? cur - prev : (cur - prev) * 100, s = fmt === "fac" ? d.toFixed(3) : d.toFixed(2) + " pp";
    var cls = Math.abs(d) < (fmt === "fac" ? 0.0005 : 0.005) ? "flat" : d > 0 ? "up" : "dn";
    return '<span class="delta ' + cls + '" title="Change from the previous reporting period">' + (d > 0 ? "+" : d < 0 ? "−" : "") + s.replace("-", "") + "</span>";
  }
  function ofN(n, cap, word) { return n + " of " + cap + " " + word + (cap === 1 ? "" : "s"); }

  // ── what each kind of deal shows and may set a rule on ───────────
  // Issuers are followed for new deals only: no headline, no rule.
  var HEAD = { loan: "dq60", lease: "dq60", card: "co" };   // the one headline figure per row
  var RULE = { loan: ["dq30", "dq60", "cnl", "factor"], lease: ["dq30", "dq60", "gl", "factor"], card: ["dq30", "co", "pay", "excess"] };
  var TYPE = { loan: "Auto loan", lease: "Auto lease", card: "Card trust" };
  function isIssuer(it) { return it.kind === "issuer"; }
  function groupOf(it) { return it.kind === "trust" ? "card" : it.ac; }
  function label(it) { return it.kind === "deal" && it.series ? it.ticker + " " + it.series : it.name; }
  // A deal that has not reported yet: announced or closed, no servicer report, no
  // figures. Its row says so and takes a rule that applies from its first report.
  function pending(it) { return it.kind === "deal" && (it.state === "pending" || (it.state === "new" && !Object.keys(it.m).length)); }
  // On a shelf the site has no performance page for: its presale report is all there is.
  function untracked(it) { return it.state === "untracked"; }
  function pendingNote(it) {
    if (!it.close) return it.filed ? "filed " + fmtDate(it.filed) : "";
    return (it.close > new Date().toISOString().slice(0, 10) ? "expected close " : "closed ") + fmtDate(it.close);
  }

  // ── rules ────────────────────────────────────────────────────────
  function breached(rule, it) {
    if (!rule || !it || !it.m[rule.metric] || it.m[rule.metric].v == null) return false;
    var v = it.m[rule.metric].v, lim = rule.fmt === "fac" ? rule.value : rule.value / 100;
    return rule.op === "above" ? v > lim : v < lim;
  }
  function ruleText(rule, meta) { return meta[rule.metric].label + " " + rule.op + " " + (rule.fmt === "fac" ? rule.value : rule.value + "%"); }
  function ruleCell(it, meta) {
    var rule = W.rule(it.key), wait = pending(it), opts = RULE[groupOf(it)].filter(function (k) { return it.m[k]; });
    if (wait) opts = RULE[groupOf(it)];               // every figure its type will publish
    if (!opts.length) return '<span class="flat">—</span>';
    var from = wait ? ' <span class="flat">from its first report</span>' : "";
    if (rule && !editing[it.key]) {
      return '<span class="ok">' + esc(ruleText(rule, meta)) + '</span>' + from + (breached(rule, it) ? ' <span class="md-pill breach">Breached</span>' : "") +
             ' <button type="button" class="md-link" data-edit="' + esc(it.key) + '">Edit</button>';
    }
    if (!rule && !editing[it.key]) return '<button type="button" class="md-link" data-edit="' + esc(it.key) + '">+ Alert rule</button>';
    var r = rule || { metric: opts[0], op: "above", value: "" };
    return '<form class="md-rule" data-rule="' + esc(it.key) + '"><span class="flat">Flag if</span>' +
      '<select name="metric" aria-label="Metric">' + opts.map(function (k) { return '<option value="' + k + '"' + (k === r.metric ? " selected" : "") + ">" + esc(meta[k].label) + "</option>"; }).join("") + "</select>" +
      '<select name="op" aria-label="Direction"><option value="above"' + (r.op === "above" ? " selected" : "") + '>above</option><option value="below"' + (r.op === "below" ? " selected" : "") + '>below</option></select>' +
      '<input name="value" type="number" step="any" inputmode="decimal" aria-label="Threshold" value="' + esc(r.value) + '" required>' +
      '<span class="flat" data-unit>' + (meta[r.metric].fmt === "fac" ? "" : "%") + '</span>' +
      '<button type="submit" class="md-btn">Save</button>' + (rule ? '<button type="button" class="md-btn md-btn-quiet" data-unrule="' + esc(it.key) + '">Remove</button>' : '<button type="button" class="md-btn md-btn-quiet" data-cancel="' + esc(it.key) + '">Cancel</button>') +
      (wait ? '<span class="flat note">Applies from its first servicer report.</span>' : "") + "</form>";
  }

  // ── render ───────────────────────────────────────────────────────
  var DATA = null, EVENTS = null, byKey = {}, editing = {};
  var WINDOW_DAYS = 30, JUST_DAYS = 10, _day = function (n) { return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10); };
  var WINDOW = _day(WINDOW_DAYS), JUST = _day(JUST_DAYS);

  function render() {
    var body = $("md-body"), all = W.list(), deals = all.filter(function (w) { return !isIssuer(w); }), issuers = all.filter(isIssuer);
    var n = all.length, lim = W.limits;
    $("md-export").hidden = $("md-clear").hidden = !n;
    $("md-sub").textContent = n ? ofN(deals.length, lim.deals, "deal") + " · " + ofN(issuers.length, lim.issuers, "issuer") + " · saved in this browser only"
                                : "Saved in this browser only. Nothing is sent to us.";
    if (!n) { renderEmpty(body); $("md-since").hidden = true; $("md-foot").hidden = true; return; }
    body.innerHTML = renderDeals(deals, lim) + renderIssuers(issuers, lim);
    renderUpdates(deals, issuers);
    var foot = $("md-foot"); foot.hidden = false;
    foot.textContent = "Headline: 60+ day delinquency by loan count from the ABS-EE tape (by balance from the 10-D where a deal files no tape); for card trusts, annualized net charge-offs. Δ is the change from the previous reporting period. Figures as published " + fmtDate(DATA.built) +
      ". A free portfolio holds " + lim.deals + " deals and follows " + lim.issuers + " issuers. Your list and rules live in this browser's storage; clearing site data removes them.";
  }
  function renderDeals(deals, lim) {
    var meta = DATA.metrics;
    var html = '<section class="md-group" aria-label="Deals you watch"><h2>Deals you watch<span class="n">' + ofN(deals.length, lim.deals, "deal") + ' · click a name for its charts</span></h2>';
    if (!deals.length) return html + '<p class="md-none">No deals yet. Star a deal on the Auto Loan, Auto Lease, Credit Card or Issuance pages, or on its presale report.</p></section>';
    html += '<div class="md-scroll"><table class="md"><thead><tr>' +
      '<th class="wcol"><span class="sr-only">Watch</span></th><th>Deal</th><th>Type</th><th>Latest report</th>' +
      '<th class="num">Headline<span class="basis">60+ DQ · cards: charge-offs</span></th><th>Alert rule</th></tr></thead><tbody>';
    deals.forEach(function (w) {
      var it = byKey[w.key];
      if (!it) {   // the feed no longer describes it: it left the build (the generators star only what the feed carries)
        html += '<tr><td class="star wcol">' + star(w) + '</td><td class="name">' + (w.url ? '<a href="' + esc(w.url) + '">' + esc(w.name) + "</a>" : esc(w.name)) +
                '</td><td colspan="4" class="flat">Not in the current build: paid off or withdrawn.</td></tr>';
        return;
      }
      var g = groupOf(it), m = it.m[HEAD[g]], just = it.as_of && it.as_of >= JUST, wait = pending(it);
      html += '<tr data-key="' + esc(w.key) + '"><td class="star wcol">' + star(it) + "</td>" +
        '<td class="name"><a href="' + esc(it.url) + '">' + esc(label(it)) + "</a>" +
        '<span class="sub">' + esc(it.kind === "deal" ? it.name : it.ticker) + "</span></td>" +
        '<td data-l="Type"><span class="md-pill state">' + esc(TYPE[g]) + "</span></td>" +
        '<td class="when" data-l="Latest report">' + (wait ? '<span class="md-pill wait">Awaiting first report</span><span class="sub">' + esc(pendingNote(it)) + "</span>"
                                                          : untracked(it) ? '<span class="md-pill off">Not tracked</span><span class="sub">no servicer reports on this site for ' + esc(it.ticker) + "</span>"
                                                          : esc(fmtDate(it.as_of)) + (just ? ' <span class="md-pill new">New</span>' : "")) + "</td>" +
        '<td class="num" data-l="' + esc(meta[HEAD[g]].label) + '"' + (m && m.basis ? ' title="' + esc(meta[HEAD[g]].label + ", " + m.basis) + '"' : "") + '><span class="vd">' + (m ? fmtVal(m.v, meta[HEAD[g]].fmt) + fmtDelta(m.v, m.p, meta[HEAD[g]].fmt) : "—") + "</span></td>" +
        '<td class="rule" data-l="Alert rule">' + ruleCell(it, meta) + "</td></tr>";
    });
    return html + "</tbody></table></div></section>";
  }
  function newestDeal(ticker) {   // the shelf's newest series in the feed, by series name within the year
    var best = null;
    DATA.items.forEach(function (it) { if (it.kind === "deal" && it.ticker === ticker && it.series && (!best || it.series > best.series)) best = it; });
    return best;
  }
  function renderIssuers(issuers, lim) {
    var html = '<section class="md-group" aria-label="Issuers you follow"><h2>Issuers you follow<span class="n">' + ofN(issuers.length, lim.issuers, "issuer") + ' · new deals only, no figures</span></h2>';
    if (!issuers.length) return html + '<p class="md-none">No issuers yet. Follow one from its performance page to hear when it brings a new deal.</p></section>';
    html += '<ul class="md-follow">';
    issuers.forEach(function (w) {
      var it = byKey[w.key], nd = it ? newestDeal(it.ticker) : null;
      html += '<li><span class="star">' + star(it || w) + '</span><span class="who">' +
        (it ? '<a href="' + esc(it.url) + '">' + esc(it.name) + "</a>" : esc(w.name)) +
        '<span class="sub">' + (it && it.n_active != null ? it.n_active + " active deals" : "") + (nd ? (it && it.n_active != null ? " · " : "") + "newest " + esc(nd.ticker + " " + nd.series) : "") + "</span></span>" +
        '<span class="x">' + (nd && nd.url ? '<a href="' + esc(nd.url) + '">' + esc(nd.ticker + " " + nd.series) + " ›</a>" : "") + "</span></li>";
    });
    return html + "</ul></section>";
  }
  function star(it) {
    return '<span data-watch="' + esc(it.key) + '" data-watch-kind="' + esc(it.kind) + '" data-watch-ac="' + esc(it.ac) + '" data-watch-ticker="' + esc(it.ticker || "") + '" data-watch-name="' + esc(it.name) + '" data-watch-series="' + esc(it.series || "") + '" data-watch-url="' + esc(it.url || "") + '"></span>';
  }
  function renderEmpty(body) {
    body.innerHTML = '<div class="md-state md-empty"><h2>Nothing in your portfolio yet</h2>' +
      "<p>Star up to " + W.limits.deals + " deals, auto or card, from their pages. Each appears here with its latest filings and one headline figure, and you can set one alert rule on it. Follow up to " + W.limits.issuers + " issuers to hear when they bring a new deal.</p>" +
      '<div class="where"><a href="/abs/performance/index.html?ac=loan">Auto Loan ›</a><a href="/abs/performance/index.html?ac=lease">Auto Lease ›</a><a href="/abs/credit-card/index.html">Credit Card ›</a><a href="/abs/issuance/index.html">Issuance ›</a></div>' +
      '<div class="demo">' + (W.available ? "Saved in this browser only — no account, nothing sent to us." : "This browser is not storing site data, so a portfolio cannot be kept here.") + "</div></div>";
  }
  var TITLE = { report: "servicer report", tape: "loan tape", amendment: "amended filing", psr: "presale report" };
  function renderUpdates(deals, issuers) {
    // Watched deals: every filing. Followed issuers: new-deal events only (a
    // presale report appearing or going final). One line per deal, or per
    // issuer per day when several of its deals move at once.
    var box = $("md-since"), keys = {}, tickers = {};
    deals.forEach(function (w) { keys[w.key] = 1; });
    issuers.forEach(function (w) { tickers[w.ticker] = 1; });
    var lines = [];
    deals.forEach(function (w) {   // breached rules lead
      var it = byKey[w.key], r = W.rule(w.key);
      if (it && r && breached(r, it)) lines.push('<li><span class="d">now</span><span class="t breach"><a href="' + esc(it.url) + '">' + esc(label(it)) + "</a></span><span class=\"x\">" + esc(DATA.metrics[r.metric].label) + " " + fmtVal(it.m[r.metric].v, DATA.metrics[r.metric].fmt) + ", " + esc(r.op) + " your " + esc(r.fmt === "fac" ? r.value : r.value + "%") + "</span></li>");
    });
    var groups = {}, order = [];
    (EVENTS && EVENTS.events || []).forEach(function (e) {
      if (e.date < WINDOW) return;
      var own = keys[e.key], viaIssuer = !own && e.type === "psr" && tickers[e.ticker];
      if (!own && !viaIssuer) return;
      var id = e.date + "|" + (viaIssuer ? "shelf:" + e.ticker : e.key) + "|" + e.type;
      if (!groups[id]) { groups[id] = { date: e.date, ticker: e.ticker, type: e.type, issuer: !!viaIssuer, trust: e.type === "psr" && e.key.indexOf("trust:") === 0, names: [], url: e.url, extra: e.title.indexOf("·") > 0 ? e.title.split("·")[1].trim() : "" }; order.push(id); }
      var g = groups[id], who = e.series || e.name; if (g.names.indexOf(who) < 0) g.names.push(who);
    });
    order.slice(0, 30).forEach(function (id) {
      var g = groups[id], issuer = byKey["shelf:" + g.ticker];
      var who = g.ticker + " " + g.names[0] + (g.issuer && g.names.length > 1 ? " and " + (g.names.length - 1) + " more" : "");
      if (g.names[0].indexOf(g.ticker) === 0) who = g.names[0];
      var what = (g.issuer ? "new deal · " : g.trust ? "new series · " : "") + TITLE[g.type] + (g.extra ? ", " + g.extra : "");
      var href = g.url || (byKey[g.names[0]] ? byKey[g.names[0]].url : null) || (issuer ? issuer.url : null);
      lines.push('<li><span class="d">' + esc(fmtDate(g.date, false)) + '</span><span class="t">' + (href ? '<a href="' + esc(href) + '">' + esc(who) + "</a>" : esc(who)) + '</span><span class="x">' + esc(what) + "</span></li>");
    });
    box.hidden = false;
    box.innerHTML = '<h2 id="md-since-h">Updates <span>· last ' + WINDOW_DAYS + " days</span></h2>" +
      (lines.length ? "<ul>" + lines.join("") + "</ul>" + (order.length > 30 ? '<p class="quiet">' + (order.length - 30) + " more…</p>" : "") : '<p class="quiet">No filings, reports or new deals for your portfolio in the last ' + WINDOW_DAYS + " days.</p>");
  }

  // ── events ───────────────────────────────────────────────────────
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-edit],[data-cancel],[data-unrule]"); if (!b) return;
    var k = b.dataset.edit || b.dataset.cancel || b.dataset.unrule;
    if (b.dataset.unrule) W.setRule(k, null);
    editing[k] = !!b.dataset.edit; render();
    if (b.dataset.edit) { var f = root.querySelector('form[data-rule="' + CSS.escape(k) + '"] input'); if (f) f.focus(); }
  });
  root.addEventListener("submit", function (e) {
    var f = e.target.closest("form[data-rule]"); if (!f) return; e.preventDefault();
    var k = f.dataset.rule, v = parseFloat(f.value.value); if (isNaN(v)) return;
    W.setRule(k, { metric: f.metric.value, op: f.op.value, value: v, fmt: DATA.metrics[f.metric.value].fmt });
    editing[k] = false; render();
  });
  root.addEventListener("change", function (e) {
    if (e.target.name !== "metric") return; var u = e.target.form.querySelector("[data-unit]");
    if (u) u.textContent = DATA.metrics[e.target.value].fmt === "fac" ? "" : "%";
  });
  document.addEventListener("ccm-watch-change", function () { render(); });
  $("md-clear").addEventListener("click", function () { if (confirm("Remove every deal, issuer and rule from this browser's portfolio?")) { W.clear(); render(); } });
  $("md-export").addEventListener("click", function () {
    var lines = W.list().map(function (w) { var it = byKey[w.key]; if (!it) return w.name;
      if (isIssuer(it)) return it.name + "  (following for new deals)";
      var g = groupOf(it), m = it.m[HEAD[g]];
      if (pending(it)) return label(it) + "  awaiting first servicer report" + (pendingNote(it) ? ", " + pendingNote(it) : "");
      if (untracked(it)) return label(it) + "  not tracked on this site (presale report only)";
      return label(it) + "  " + DATA.metrics[HEAD[g]].label + " " + (m ? fmtVal(m.v, DATA.metrics[HEAD[g]].fmt) : "—") + "  reported " + fmtDate(it.as_of); });
    var text = NAME + " · " + fmtDate(new Date().toISOString()) + " · consumercreditmatters.com\n" + lines.join("\n");
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { $("md-export").textContent = "Copied"; setTimeout(function () { $("md-export").textContent = "Copy as text"; }, 1600); }, function () { prompt("Copy:", text); });
  });

  // ── load ─────────────────────────────────────────────────────────
  function fail(msg) { $("md-body").innerHTML = '<div class="md-state error">' + esc(msg) + ' <button type="button" class="md-btn" id="md-retry">Try again</button></div>'; $("md-retry").addEventListener("click", load); }
  function load() {
    $("md-body").innerHTML = '<div class="md-state"><span class="md-spin" aria-hidden="true"></span> Loading the latest figures…</div>';
    if (!W || !W.available) { renderEmpty($("md-body")); return; }
    var bust = "?t=" + Math.floor(Date.now() / 36e5);
    Promise.all([fetch(FEED + "watch.json" + bust).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
                 fetch(FEED + "events.json" + bust).then(function (r) { return r.ok ? r.json() : { events: [] }; }).catch(function () { return { events: [] }; })])
      .then(function (res) { DATA = res[0]; EVENTS = res[1]; byKey = {}; DATA.items.forEach(function (it) { byKey[it.key] = it; }); render();
             try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: PAGE, title: NAME, event: false }); } catch (e) {} })
      .catch(function () { fail("The latest figures could not be loaded. Your portfolio is still saved in this browser."); });
  }
  load();
})();
