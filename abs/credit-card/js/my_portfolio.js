// My Portfolio (web/my_portfolio.html): the deals a reader watches, one row each
// that tells the deal's whole story (status pills after its name, its latest
// filings, one headline figure, an optional rule), and the issuers they follow
// for new deals, one line each. Reads watch.json + events.json (built by
// src/workflows/sec/shelf_detail/watch_feed.py) and the browser store in
// /watch/watch.js. Draws only: no figure is computed here beyond a difference.
// Draft 4 of the alerts mockups (docs/alerts-mockups, 2026-11-22) is the design:
// no separate Updates box, deals named by ticker and series, rows breached first.
(function () {
  "use strict";
  var root = document.getElementById("md"), FEED = root.dataset.feed || "/abs/performance/data/";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var W = window.CCMWatch, PAGE = "/abs/my-portfolio/", NAME = "My Portfolio";

  // ── formatting ───────────────────────────────────────────────────
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(iso, year) { if (!iso) return "—"; var d = new Date(iso.slice(0, 10) + "T00:00:00"); return MONTHS[d.getMonth()] + " " + d.getDate() + (year === false ? "" : ", " + d.getFullYear()); }
  function fmtDay(iso) { return fmtDate(iso, iso && iso.slice(0, 4) !== String(new Date().getFullYear())); }   // the year only when it is not this one
  function fmtVal(x, fmt) { if (x == null) return "—"; return fmt === "fac" ? x.toFixed(3) : (x * 100).toFixed(2) + "%"; }
  function fmtDelta(cur, prev, fmt) {
    if (cur == null || prev == null) return "";
    var d = fmt === "fac" ? cur - prev : (cur - prev) * 100, s = fmt === "fac" ? d.toFixed(3) : d.toFixed(2) + " pp";
    var cls = Math.abs(d) < (fmt === "fac" ? 0.0005 : 0.005) ? "flat" : d > 0 ? "up" : "dn";
    return '<span class="delta ' + cls + '" title="Change from the previous reporting period">' + (d > 0 ? "+" : d < 0 ? "−" : "") + s.replace("-", "") + "</span>";
  }
  function ofN(n, cap, word) { return n + " of " + cap + " " + word + (cap === 1 ? "" : "s"); }
  function pill(cls, text) { return ' <span class="md-pill ' + cls + '">' + text + "</span>"; }

  // ── what each kind of deal shows and may set a rule on ───────────
  // Issuers are followed for new deals only: no headline, no rule.
  var HEAD = { loan: "dq60", lease: "dq60", card: "co" };   // the one headline figure per row
  var RULE = { loan: ["dq30", "dq60", "cnl", "factor"], lease: ["dq30", "dq60", "gl", "factor"], card: ["dq30", "co", "pay", "excess"] };
  function isIssuer(it) { return it.kind === "issuer"; }
  function groupOf(it) { return it.kind === "trust" ? "card" : it.ac; }
  function label(it) { return it.kind === "deal" && it.series ? it.ticker + " " + it.series : it.kind === "trust" ? it.ticker : it.name; }
  // A deal that has not reported yet: announced or closed, no servicer report, no
  // figures. Its row says so and takes a rule that applies from its first report.
  function pending(it) { return it.kind === "deal" && (it.state === "pending" || (it.state === "new" && !Object.keys(it.m).length)); }
  // On a shelf the site has no performance page for: its presale report is all there is.
  function untracked(it) { return it.state === "untracked"; }
  function pendingNote(it) {
    if (!it.close) return it.filed ? "filed " + fmtDate(it.filed) : "";
    return (it.close > new Date().toISOString().slice(0, 10) ? "expected close " : "closed ") + fmtDate(it.close);
  }
  // A deal that reports and has not for 45 days, by the feed's own date, not the clock. A
  // card trust is dated by its reporting period, filed some seven weeks on, so its limit is 90.
  function staleDays(it) { return it.kind === "trust" ? STALE_DAYS * 2 : STALE_DAYS; }
  function stale(it) { return !pending(it) && !untracked(it) && it.as_of && DATA.built && it.as_of < _day(staleDays(it), DATA.built); }

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
      return '<span class="ok">' + esc(ruleText(rule, meta)) + '</span>' + from +
             ' <button type="button" class="md-link" data-edit="' + esc(it.key) + '">Edit</button>';
    }
    if (!rule && !editing[it.key]) return '<span class="flat">None</span> <button type="button" class="md-link" data-edit="' + esc(it.key) + '">Add</button>';
    var r = rule || { metric: opts[0], op: "above", value: "" };
    return '<form class="md-rule" data-rule="' + esc(it.key) + '"><span class="flat">Flag if</span>' +
      '<select name="metric" aria-label="Metric">' + opts.map(function (k) { return '<option value="' + k + '"' + (k === r.metric ? " selected" : "") + ">" + esc(meta[k].label) + "</option>"; }).join("") + "</select>" +
      '<select name="op" aria-label="Direction"><option value="above"' + (r.op === "above" ? " selected" : "") + '>above</option><option value="below"' + (r.op === "below" ? " selected" : "") + '>below</option></select>' +
      '<input name="value" type="number" step="any" inputmode="decimal" aria-label="Threshold" value="' + esc(r.value) + '" required>' +
      '<span class="flat" data-unit>' + (meta[r.metric].fmt === "fac" ? "" : "%") + '</span>' +
      '<button type="submit" class="md-btn">Save</button>' + (rule ? '<button type="button" class="md-btn md-btn-quiet" data-unrule="' + esc(it.key) + '">Remove</button>' : '<button type="button" class="md-btn md-btn-quiet" data-cancel="' + esc(it.key) + '">Cancel</button>') +
      (wait ? '<span class="flat note">Applies from its first servicer report.</span>' : "") + "</form>";
  }

  // ── filings: what events.json says about an item ─────────────────
  var TITLE = { report: "servicer report", tape: "loan tape", amendment: "amended filing", psr: "PSR" };
  var byItem = {};   // key → its events, newest first
  function indexEvents() {
    byItem = {};
    (EVENTS && EVENTS.events || []).forEach(function (e) { (byItem[e.key] = byItem[e.key] || []).push(e); });
    Object.keys(byItem).forEach(function (k) { byItem[k].sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }); });
  }
  function filingLine(e, it) {
    // "Nov 16 servicer report"; a presale event keeps its detail ("PSR, final terms");
    // on a card trust a presale event is a new series, linked to the series' report, and
    // a trust report is named by its period ("trust report, Oct 2026"): the feed dates it
    // by the period, not the filing.
    var extra = e.title.indexOf("·") > 0 ? e.title.split("·")[1].trim() : "";
    if (it.kind === "trust" && e.type === "report") return "trust report" + (extra ? ", " + esc(extra) : "");
    var what = (it.kind === "trust" && e.type === "psr" ? "new series " + esc(e.series || e.name) + " · " : "") + TITLE[e.type] + (e.type === "psr" && extra ? ", " + esc(extra) : "");
    if (e.url && e.type === "psr") what = '<a href="' + esc(e.url) + '">' + what + "</a>";
    return '<span class="d">' + esc(fmtDay(e.date)) + "</span>" + what;
  }
  function filingsCell(it) {
    var ev = byItem[it.key] || [], lines = [];
    if (ev.length) {
      // the newest filing, an earlier one inside the window, and always the newest report
      var pick = [ev[0]]; if (ev[1] && ev[1].date >= WINDOW) pick.push(ev[1]);
      var rep = ev.filter(function (e) { return e.type === "report"; })[0];
      if (rep && pick.indexOf(rep) < 0) pick[pick.length > 1 ? 1 : pick.length] = rep;
      lines = pick.map(function (e) { return filingLine(e, it); });
    } else if (it.as_of) {
      lines.push('<span class="d">' + esc(fmtDay(it.as_of)) + "</span>servicer report");
    }
    if (pending(it)) lines.push(esc(pendingNote(it)));
    else if (untracked(it)) lines.push("no servicer reports on this site for " + esc(it.ticker));
    if (!lines.length) return '<span class="flat">—</span>';
    return lines[0] + lines.slice(1).map(function (l) { return '<span class="sub">' + l + "</span>"; }).join("");
  }
  function newestFiling(it) {   // for the row order: the newest event, else the item's own dates
    var ev = byItem[it.key]; return (ev && ev[0].date) || it.as_of || it.filed || it.close || "";
  }

  // ── render ───────────────────────────────────────────────────────
  var DATA = null, EVENTS = null, byKey = {}, editing = {};
  var WINDOW_DAYS = 30, JUST_DAYS = 10, STALE_DAYS = 45;
  var _day = function (n, from) { return new Date((from ? new Date(from.slice(0, 10) + "T00:00:00").getTime() : Date.now()) - n * 864e5).toISOString().slice(0, 10); };
  var WINDOW = _day(WINDOW_DAYS), JUST = _day(JUST_DAYS);

  function render() {
    var body = $("md-body"), all = W.list(), deals = all.filter(function (w) { return !isIssuer(w); }), issuers = all.filter(isIssuer);
    var n = all.length, lim = W.limits;
    $("md-export").hidden = $("md-clear").hidden = !n;
    $("md-sub").textContent = n ? ofN(deals.length, lim.deals, "deal") + " · " + ofN(issuers.length, lim.issuers, "issuer") + " · saved in this browser only"
                                : "Saved in this browser only. Nothing is sent to us.";
    if (!n) { renderEmpty(body); $("md-foot").hidden = true; return; }
    body.innerHTML = renderDeals(deals, lim) + renderIssuers(issuers, lim);
    var foot = $("md-foot"); foot.hidden = false;
    foot.textContent = "Figures as published " + fmtDate(DATA.built) + ". Headline: 60+ day delinquency by loan count from the ABS-EE tape (by balance from the 10-D where a deal files no tape); for card trusts, annualized net charge-offs. Δ is the change from the previous reporting period." +
      " A free portfolio holds " + lim.deals + " deals and follows " + lim.issuers + " issuers. Your list and rules live in this browser's storage; clearing site data removes them.";
  }
  function renderDeals(deals, lim) {
    var meta = DATA.metrics;
    var html = '<section class="md-group" aria-label="Deals you watch"><h2>Deals you watch<span class="n">' + ofN(deals.length, lim.deals, "deal") + ' · breached first, then by newest filing · a name opens its charts</span></h2>';
    if (!deals.length) return html + '<p class="md-none">No deals yet. Star a deal on the Auto Loan, Auto Lease, Credit Card or Issuance pages, or on its PSR.</p></section>';
    html += '<div class="md-scroll"><table class="md"><thead><tr>' +
      '<th class="wcol"><span class="sr-only">Watch</span></th><th>Deal</th><th>Latest filings</th>' +
      '<th class="num">Headline<span class="basis">60+ DQ · cards: charge-offs</span></th><th>Rule</th></tr></thead><tbody>';
    // breached rules first, then the newest filing first; a deal the feed no longer carries last
    var rows = deals.map(function (w) { var it = byKey[w.key]; return { w: w, it: it, b: it && breached(W.rule(w.key), it) ? 1 : 0, d: it ? newestFiling(it) : "" }; });
    rows.sort(function (a, b) { return b.b - a.b || (a.d < b.d ? 1 : a.d > b.d ? -1 : 0); });
    rows.forEach(function (r) {
      var w = r.w, it = r.it;
      if (!it) {   // the feed no longer describes it: it left the build (the generators star only what the feed carries)
        html += '<tr><td class="star wcol">' + star(w) + '</td><td class="name">' + (w.url ? '<a href="' + esc(w.url) + '">' + esc(w.name) + "</a>" : esc(w.name)) +
                '</td><td colspan="3" class="flat">Not in the current build: paid off or withdrawn.</td></tr>';
        return;
      }
      var g = groupOf(it), m = it.m[HEAD[g]], just = it.as_of && it.as_of >= JUST;
      var pills = (r.b ? pill("breach", "Breached") : "") + (just ? pill("new", "New") : "") +
                  (pending(it) ? pill("wait", "Awaiting first report") : untracked(it) ? pill("off", "Not tracked") : stale(it) ? pill("stale", "Not reported in " + staleDays(it) + " days") : "");
      html += '<tr data-key="' + esc(w.key) + '"><td class="star wcol">' + star(it) + "</td>" +
        '<td class="name"><a href="' + esc(it.url) + '" title="' + esc(it.name) + '">' + esc(label(it)) + "</a>" + pills + "</td>" +
        '<td class="when" data-l="Filings">' + filingsCell(it) + "</td>" +
        '<td class="num" data-l="' + esc(meta[HEAD[g]].label) + '"' + (m && m.basis ? ' title="' + esc(meta[HEAD[g]].label + ", " + m.basis) + '"' : "") + '><span class="vd">' + (m ? fmtVal(m.v, meta[HEAD[g]].fmt) : "—") + "</span>" + (m ? fmtDelta(m.v, m.p, meta[HEAD[g]].fmt) : "") + "</td>" +
        '<td class="rule" data-l="Rule">' + ruleCell(it, meta) + "</td></tr>";
    });
    return html + "</tbody></table></div></section>";
  }
  function newestDeal(ticker) {   // the shelf's newest series in the feed, by series name within the year
    var best = null;
    DATA.items.forEach(function (it) { if (it.kind === "deal" && it.ticker === ticker && it.series && (!best || it.series > best.series)) best = it; });
    return best;
  }
  function renderIssuers(issuers, lim) {
    var html = '<section class="md-group" aria-label="New deals from issuers you follow"><h2>New deals from issuers you follow<span class="n">' + ofN(issuers.length, lim.issuers, "issuer") + ' · new deals only, no figures</span></h2>';
    if (!issuers.length) return html + '<p class="md-none">No issuers yet. Follow one from its performance page to see its new deals here.</p></section>';
    html += '<ul class="md-follow">';
    issuers.forEach(function (w) {
      var it = byKey[w.key], nd = it ? newestDeal(it.ticker) : null, x = "";
      if (nd) {   // one line: the newest deal, dated by its first filing, and its PSR when the site has one
        var ev = byItem[nd.key] || [], psrs = ev.filter(function (e) { return e.type === "psr"; }), first = psrs.length ? psrs[psrs.length - 1].date : null, when = first || nd.filed || nd.close;
        var fresh = when && when >= WINDOW, who = esc(nd.ticker + " " + nd.series) + (when ? ", " + esc(fmtDay(when)) : "");
        var psr = nd.url && nd.url.indexOf("/presale/") > 0 ? nd.url : (ev.filter(function (e) { return e.type === "psr" && e.url; })[0] || {}).url;
        x = (fresh ? "<b>New deal</b> " + who : "No new deal since " + who) + (psr ? ' · <a href="' + esc(psr) + '">PSR ›</a>' : "");
      }
      html += '<li><span class="star">' + star(it || w) + '</span><span class="who">' +
        (it ? '<a href="' + esc(it.url) + '">' + esc(it.name) + "</a>" : esc(w.name)) +
        '<span class="sub">' + (it && it.n_active != null ? it.n_active + " active deals" : "") + "</span></span>" +
        '<span class="x">' + x + "</span></li>";
    });
    return html + "</ul></section>";
  }
  function star(it) {
    return '<span data-watch="' + esc(it.key) + '" data-watch-kind="' + esc(it.kind) + '" data-watch-ac="' + esc(it.ac) + '" data-watch-ticker="' + esc(it.ticker || "") + '" data-watch-name="' + esc(it.name) + '" data-watch-series="' + esc(it.series || "") + '" data-watch-url="' + esc(it.url || "") + '"></span>';
  }
  function renderEmpty(body) {
    body.innerHTML = '<div class="md-state md-empty"><h2>Nothing in your portfolio yet</h2>' +
      "<p>Star up to " + W.limits.deals + " deals, auto or card, from their pages. Each appears here with its latest filings and one headline figure, and you can set one alert rule on it. Follow up to " + W.limits.issuers + " issuers to see their new deals here.</p>" +
      '<div class="where"><a href="/abs/performance/index.html?ac=loan">Auto Loan ›</a><a href="/abs/performance/index.html?ac=lease">Auto Lease ›</a><a href="/abs/credit-card/index.html">Credit Card ›</a><a href="/abs/issuance/index.html">Issuance ›</a></div>' +
      '<div class="demo">' + (W.available ? "Saved in this browser only — no account, nothing sent to us." : "This browser is not storing site data, so a portfolio cannot be kept here.") + "</div></div>";
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
      var g = groupOf(it), m = it.m[HEAD[g]], r = W.rule(w.key);
      if (pending(it)) return label(it) + "  awaiting first servicer report" + (pendingNote(it) ? ", " + pendingNote(it) : "");
      if (untracked(it)) return label(it) + "  not tracked on this site (PSR only)";
      return label(it) + "  " + DATA.metrics[HEAD[g]].label + " " + (m ? fmtVal(m.v, DATA.metrics[HEAD[g]].fmt) : "—") + "  reported " + fmtDate(it.as_of) +
             (r ? "  rule " + ruleText(r, DATA.metrics) + (breached(r, it) ? " (breached)" : "") : ""); });
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
      .then(function (res) { DATA = res[0]; EVENTS = res[1]; byKey = {}; DATA.items.forEach(function (it) { byKey[it.key] = it; }); indexEvents(); render();
             try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: PAGE, title: NAME, event: false }); } catch (e) {} })
      .catch(function () { fail("The latest figures could not be loaded. Your portfolio is still saved in this browser."); });
  }
  load();
})();
