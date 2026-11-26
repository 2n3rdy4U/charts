// My Portfolio (web/my_portfolio.html): the deals a reader watches, one row each
// that tells the deal's whole story (status pills after its name, its latest
// filings, one headline figure, an optional rule), and the issuers they follow
// for new deals, one line each. Reads watch.json + events.json (built by
// src/workflows/sec/shelf_detail/watch_feed.py) and the store in
// /watch/watch.js. Draws only: no figure is computed here beyond a difference.
// Draft 6 of the alerts mockups (docs/alerts-mockups, 2026-11-25) is the design:
// no separate Updates box, deals named by ticker and series, rows breached first, the
// Add bar under the header, the Headline following the rule's metric, the issuers a table.
//
// With an account (Phase 3, the account layer of watch.js): the quiet sign-in
// line, the stand-alone form and "check your email" screens, the chip with the
// Settings sheet, an Email switch per row, the delete confirmation. Every string
// is from docs/alerts-mockups/microcopy.md. Signed out, nothing is gated.
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
  function n_(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }
  function pill(cls, text) { return ' <span class="md-pill ' + cls + '">' + text + "</span>"; }
  function signedIn() { return !!(W && W.account); }

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
  var TITLE = { report: "servicer report (10-D)", tape: "loan tape (ABS-EE)", amendment: "amended filing", psr: "PSR" };
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
    if (it.kind === "trust" && e.type === "report") return '<span class="d">' + esc(fmtDay(e.date)) + "</span>trust report (10-D)" + (extra ? ", " + esc(extra) : "");
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
      lines.push('<span class="d">' + esc(fmtDay(it.as_of)) + "</span>" + (it.kind === "trust" ? "trust report (10-D)" : "servicer report (10-D)"));
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

  function mailState(all) {   // "on" when any item mails, "off" when none does
    var on = all.some(function (w) { return W.emailOn(w.key); });
    return all.length ? (on ? " · email alerts on" : " · email alerts off") : "";
  }
  function render() {
    renderHead();
    if (!DATA) return;
    var body = $("md-body"), all = W.list(), deals = all.filter(function (w) { return !isIssuer(w); }), issuers = all.filter(isIssuer);
    var n = all.length, lim = W.limits, acct = signedIn();
    $("md-clear").hidden = !n || acct;                // an account is emptied star by star
    renderAdd();
    $("md-sub").textContent = n ? ofN(deals.length, lim.deals, "deal") + " · " + ofN(issuers.length, lim.issuers, "issuer") + (acct ? mailState(all) : " · saved in this browser only")
                                : acct ? ofN(0, lim.deals, "deal") + " · " + ofN(0, lim.issuers, "issuer") : "Saved in this browser only. Nothing is sent to us.";
    if (!n) { renderEmpty(body); $("md-foot").hidden = true; return; }
    body.innerHTML = renderDeals(deals, lim, acct) + renderIssuers(issuers, lim, acct);
    var foot = $("md-foot"); foot.hidden = false;
    foot.innerHTML = esc("Figures as published " + fmtDate(DATA.built) + ". Headline: the figure your rule is judged on; with no rule, 60+ day delinquency by loan count from the ABS-EE tape (by balance from the 10-D where a deal files no tape), or a card trust's annualized net charge-offs. Δ is the change from the previous reporting period.") +
      (acct ? esc(" Your account holds " + lim.deals + " deals and follows " + lim.issuers + " issuers; one email a day at most.") + ' <a class="ac-link" href="/privacy/">Privacy</a>'
            : esc(" A free portfolio holds " + lim.deals + " deals and follows " + lim.issuers + " issuers. Your list and rules live in this browser's storage; clearing site data removes them."));
  }
  function mailSwitch(it, kind) {
    var on = W.emailOn(it.key), title = kind === "issuer" ? "Email me about new deals from this issuer" : (on ? "Email me about this deal" : "Email off for this deal");
    return '<label class="ac-sw' + (on ? " on" : "") + '" title="' + title + '"><input type="checkbox" data-mail="' + esc(it.key) + '"' + (on ? " checked" : "") + ' aria-label="' + title + '"><i></i></label>';
  }
  function renderDeals(deals, lim, acct) {
    var meta = DATA.metrics;
    var html = '<section class="md-group" aria-label="Deals you watch"><h2>Deals you watch<span class="n">' + ofN(deals.length, lim.deals, "deal") + ' · breached first, then by newest filing · a name opens its charts</span></h2>';
    if (!deals.length) return html + '<p class="md-none">No deals yet. Star a deal on the Auto Loan, Auto Lease, Credit Card or Issuance pages, or on its PSR.' + (acct ? "" : " Sign in and we email you when one reports or crosses a line you set.") + '</p></section>';
    html += '<div class="md-scroll"><table class="md"><thead><tr>' +
      '<th class="wcol"><span class="sr-only">Watch</span></th><th>Deal</th><th>Latest filings</th>' +
      '<th class="num">Headline</th><th>Alert rule</th>' + (acct ? '<th class="mail">Email</th>' : "") + '</tr></thead><tbody>';
    // breached rules first, then the newest filing first; a deal the feed no longer carries last
    var rows = deals.map(function (w) { var it = byKey[w.key]; return { w: w, it: it, b: it && breached(W.rule(w.key), it) ? 1 : 0, d: it ? newestFiling(it) : "" }; });
    rows.sort(function (a, b) { return b.b - a.b || (a.d < b.d ? 1 : a.d > b.d ? -1 : 0); });
    rows.forEach(function (r) {
      var w = r.w, it = r.it, mail = acct ? '<td class="mail" data-l="Email">' + mailSwitch(w, "deal") + "</td>" : "", cls = acct && !W.emailOn(w.key) ? ' class="nomail"' : "";
      if (!it) {   // the feed no longer describes it: it left the build (the generators star only what the feed carries)
        html += "<tr" + cls + ' data-key="' + esc(w.key) + '"><td class="star wcol">' + star(w) + '</td><td class="name">' + (w.url ? '<a href="' + esc(w.url) + '">' + esc(w.name || w.key) + "</a>" : esc(w.name || w.key)) +
                '</td><td colspan="3" class="flat">Not in the current build: paid off or withdrawn.</td>' + mail + "</tr>";
        return;
      }
      // the Headline is the figure the rule is judged on when there is a rule (named in the cell), else the type's default
      var g = groupOf(it), rule = W.rule(w.key), hm = rule && meta[rule.metric] ? rule.metric : HEAD[g], m = it.m[hm], just = it.as_of && it.as_of >= JUST;
      var pills = (r.b ? pill("breach", "Breached") : "") + (just ? pill("new", "New") : "") +
                  (pending(it) ? pill("wait", "Awaiting first report") : untracked(it) ? pill("off", "Not tracked") : stale(it) ? pill("stale", "Not reported in " + staleDays(it) + " days") : "");
      html += "<tr" + cls + ' data-key="' + esc(w.key) + '"><td class="star wcol">' + star(it) + "</td>" +
        '<td class="name"><a href="' + esc(it.url) + '" title="' + esc(it.name) + '">' + esc(label(it)) + "</a>" + (pills ? '<span class="pills">' + pills + "</span>" : "") + "</td>" +
        '<td class="when" data-l="Filings">' + filingsCell(it) + "</td>" +
        '<td class="num" data-l="' + esc(meta[hm].label) + '"' + (m && m.basis ? ' title="' + esc(meta[hm].label + ", " + m.basis) + '"' : "") + '><span class="vd">' + (m ? fmtVal(m.v, meta[hm].fmt) : "—") + '</span><span class="hlm">' + esc(meta[hm].label) + "</span>" + (m ? fmtDelta(m.v, m.p, meta[hm].fmt) : "") + "</td>" +
        '<td class="rule" data-l="Alert rule">' + ruleCell(it, meta) + "</td>" + mail + "</tr>";
    });
    return html + "</tbody></table></div></section>";
  }
  function newestDeal(ticker) {   // the shelf's newest series in the feed, by series name within the year
    var best = null;
    DATA.items.forEach(function (it) { if (it.kind === "deal" && it.ticker === ticker && it.series && (!best || it.series > best.series)) best = it; });
    return best;
  }
  // "Issuers you follow" (draft 6): every followed issuer is a row, new deal or not, in the
  // deals table's grammar: the issuer with a New deal or Quiet pill on its own line, its
  // latest deal with the date, its state in the issuance page's words and the PSR link at
  // the cell's right edge, the email switch.
  function renderIssuers(issuers, lim, acct) {
    var html = '<section class="md-group" aria-label="Issuers you follow"><h2>Issuers you follow<span class="n">' + ofN(issuers.length, lim.issuers, "issuer") + (acct ? " · you hear when one announces a deal" : " · sign in and we email you when one announces a deal") + "</span></h2>";
    if (!issuers.length) return html + '<p class="md-none">No issuers yet. Follow one with the Add bar above, or from its performance page.</p></section>';
    html += '<div class="md-scroll"><table class="md md-iss"><thead><tr><th class="wcol"><span class="sr-only">Follow</span></th><th>Issuer</th><th>Latest deal</th>' + (acct ? '<th class="mail">Email</th>' : "") + '</tr></thead><tbody>';
    var today = (DATA.built || new Date().toISOString()).slice(0, 10);
    issuers.forEach(function (w) {
      var it = byKey[w.key], nd = it ? newestDeal(it.ticker) : null, latest = '<span class="flat">—</span>', pills = "";
      if (nd) {
        var ev = byItem[nd.key] || [], psrs = ev.filter(function (e) { return e.type === "psr"; }), first = psrs.length ? psrs[psrs.length - 1].date : null, when = first || nd.filed || nd.close;
        var fresh = when && when >= WINDOW;
        var psr = nd.url && nd.url.indexOf("/presale/") > 0 ? nd.url : (psrs.filter(function (e) { return e.url; })[0] || {}).url;
        var state = nd.close && nd.close <= today ? "Closed " + fmtDay(nd.close)
                  : (psrs.some(function (e) { return /final/i.test(e.title || ""); }) ? "Priced" : "Preliminary") + (nd.close ? " · closes " + fmtDay(nd.close) : "");
        pills = fresh ? pill("new", "New deal") : pill("off", "Quiet");
        latest = (psr ? '<a class="psr-link md-link" href="' + esc(psr) + '">PSR ›</a>' : "") + (when ? '<span class="d">' + esc(fmtDay(when)) + "</span>" : "") +
                 "<b>" + esc(nd.ticker + " " + nd.series) + "</b>" + '<span class="sub">' + esc(state) + (fresh ? "" : " · no new deal in " + WINDOW_DAYS + " days") + "</span>";
      }
      var mail = acct ? '<td class="mail" data-l="Email">' + mailSwitch(w, "issuer") + "</td>" : "", cls = acct && !W.emailOn(w.key) ? ' class="nomail"' : "";
      html += "<tr" + cls + ' data-key="' + esc(w.key) + '"><td class="star wcol">' + star(it || w) + "</td>" +
        '<td class="name">' + (it ? '<a href="' + esc(it.url) + '">' + esc(it.name) + "</a>" : esc(w.name || w.key)) +
        '<span class="sub">' + (it && it.n_active != null ? it.n_active + " active deals" : "") + "</span>" + (pills ? '<span class="pills">' + pills + "</span>" : "") + "</td>" +
        '<td class="when" data-l="Latest deal">' + latest + "</td>" + mail + "</tr>";
    });
    return html + "</tbody></table></div></section>";
  }
  // ── the Add bar: a deal by ticker or name, an issuer from a grouped list ──
  function addLabel(it) { return label(it) + " · " + (it.name || ""); }
  function renderAdd() {
    var box = $("md-add"); if (!DATA || !W.available) { box.hidden = true; return; }
    if (!box.innerHTML) {
      var deals = DATA.items.filter(function (it) { return it.kind === "deal" || it.kind === "trust"; }).sort(function (a, b) { return label(a) < label(b) ? -1 : 1; });
      var shelves = DATA.items.filter(isIssuer), groups = { loan: "Auto loan", lease: "Auto lease" };
      var sel = Object.keys(groups).map(function (ac) {
        var list = shelves.filter(function (x) { return x.ac === ac; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
        return list.length ? '<optgroup label="' + groups[ac] + '">' + list.map(function (x) { return '<option value="' + esc(x.key) + '">' + esc(x.name) + "</option>"; }).join("") + "</optgroup>" : "";
      }).join("");
      box.innerHTML = '<span class="k">Add to your portfolio</span>' +
        '<input class="md-find" id="md-find" list="md-deal-list" placeholder="Find a deal by ticker or name…" aria-label="Find a deal" autocomplete="off">' +
        '<datalist id="md-deal-list">' + deals.map(function (it) { return '<option value="' + esc(addLabel(it)) + '">'; }).join("") + "</datalist>" +
        '<select class="md-follow-pick" id="md-follow-pick" aria-label="Follow an issuer"><option value="">Follow an issuer…</option>' + sel + "</select>" +
        '<span class="flat">or star a deal on its page</span>';
    }
    box.hidden = !!auth.state;
  }
  function capText(why) {
    var lim = W.limits, who = signedIn() ? "Your account" : "This browser";
    return why === "issuers" ? who + " follows " + lim.issuers + " issuers. Unfollow one to add this one." : who + " holds " + lim.deals + " deals. Remove one to add this one.";
  }
  function addItem(it) {
    if (W.has(it.key)) { W.toast(label(it) + " is already in your portfolio."); return; }
    var item = { key: it.key, kind: it.kind, ac: it.ac || "", ticker: it.ticker || "", name: it.name || it.key, series: it.series || null, url: it.url || "" };
    var why = W.room(item);
    if (why) { W.toast(capText(why)); return; }
    if (W.add(item)) { W.toast((isIssuer(it) ? "Following " : "Watching ") + label(it) + "."); render(); }
  }
  root.addEventListener("change", function (e) {
    if (e.target.id === "md-follow-pick") { var k = e.target.value; e.target.value = ""; if (k && byKey[k]) addItem(byKey[k]); }
    if (e.target.id === "md-find") {
      var v = e.target.value.trim().toLowerCase(); if (!v) return;
      var hit = DATA.items.filter(function (it) { return (it.kind === "deal" || it.kind === "trust") && (addLabel(it).toLowerCase() === v || label(it).toLowerCase() === v); })[0];
      if (hit) { e.target.value = ""; addItem(hit); } else W.toast("No deal by that name on the site. Pick one from the list as you type.");
    }
  });
  function star(it) {
    return '<span data-watch="' + esc(it.key) + '" data-watch-kind="' + esc(it.kind) + '" data-watch-ac="' + esc(it.ac || "") + '" data-watch-ticker="' + esc(it.ticker || "") + '" data-watch-name="' + esc(it.name || it.key) + '" data-watch-series="' + esc(it.series || "") + '" data-watch-url="' + esc(it.url || "") + '"></span>';
  }
  function renderEmpty(body) {
    var lim = W.limits, acct = signedIn();
    body.innerHTML = '<div class="md-state md-empty"><h2>Nothing in your portfolio yet</h2>' +
      (acct ? "<p>Star a deal on any performance page, PSR or the issuance table and it appears here with its latest filings and one headline figure. You can set one alert rule on each and we'll email you when it reports or crosses the line. Follow an issuer to hear when it brings a new deal.</p>"
            : "<p>Star up to " + lim.deals + " deals, auto or card, from their pages. Each appears here with its latest filings and one headline figure, and you can set one alert rule on it. Follow up to " + lim.issuers + " issuers to see their new deals here.</p>") +
      '<div class="where"><a href="/abs/performance/index.html?ac=loan">Auto Loan ›</a><a href="/abs/performance/index.html?ac=lease">Auto Lease ›</a><a href="/abs/credit-card/index.html">Credit Card ›</a><a href="/abs/issuance/index.html">Issuance ›</a></div>' +
      '<div class="demo">' + (acct ? esc(n_(lim.deals, "deal") + " and " + n_(lim.issuers, "issuer") + " on an account · one message a day at most.")
                                   : W.available ? "Saved in this browser only — no account, nothing sent to us." : "This browser is not storing site data, so a portfolio cannot be kept here.") + "</div></div>";
  }

  // ── the header: the sign-in line, or the chip ────────────────────
  var ACCOUNTS = null;   // true once /watch/alerts.json names a project
  function renderHead() {
    var a = W && W.account;
    $("md-chip").hidden = !a;
    $("md-signin").hidden = !!a || !ACCOUNTS || !(W && W.available);
    if (a) {
      $("md-who").textContent = a.first_name || a.email;
      $("md-badge").hidden = !a.label; $("md-badge").textContent = a.label || "";
    }
  }
  function notice(html, cls) {
    $("md-notice").innerHTML = html ? '<div class="ac-note' + (cls ? " " + cls : "") + '">' + html + "</div>" : "";
  }
  function landed(res) {   // what the merge moved, in one line; nothing to say when nothing moved
    var m = res.moved, l = res.left, parts = [];
    if (m.deals) parts.push(n_(m.deals, "deal"));
    if (m.issuers) parts.push(n_(m.issuers, "issuer"));
    if (m.rules) parts.push(n_(m.rules, "rule"));
    var lim = W.limits, text = "";
    if (parts.length) {
      var list = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0];
      text = "<b>You're signed in.</b> The " + esc(list) + " saved in this browser " + (parts.length === 1 && !/^1 /.test(parts[0]) || parts.length > 1 ? "are" : "is") +
             " now on your account, and email alerts are on for each. Turn any off with its switch, or change how often you hear from us in Settings.";
    }
    if (l.deals || l.issuers) {
      var left = l.deals && l.issuers ? n_(l.deals, "deal") + " and " + n_(l.issuers, "issuer") : l.deals ? n_(l.deals, "deal") : n_(l.issuers, "issuer");
      text += (text ? " " : "") + "Your account holds " + esc(n_(lim.deals, "deal") + " and " + n_(lim.issuers, "issuer")) + "; " + esc(left) + " from this browser didn't fit and " + (l.deals + l.issuers === 1 ? "is" : "are") + " still saved here. Remove one to add them.";
    }
    notice(text, l.deals || l.issuers ? "warn" : "");
  }

  // ── the sign-in screens: form → check your email; the expired link ──
  var auth = { state: null, email: "", first: "", last: "", again: null };
  function showAuth(state) {
    auth.state = state;
    var on = !!state;
    $("md-head").hidden = $("md-body").hidden = on; if (on) $("md-foot").hidden = true; else if (DATA && W.count()) $("md-foot").hidden = false;
    $("md-notice").hidden = on;
    $("md-add").hidden = on || !DATA;
    $("md-auth").hidden = !on;
    clearInterval(auth.again);
    if (!on) { $("md-auth").innerHTML = ""; return; }
    var back = '<a class="ac-link ac-back" href="#" data-auth="back">‹ My Portfolio</a>';
    if (state === "form") {
      $("md-auth").innerHTML = back + '<div class="ac-card" role="region" aria-labelledby="ac-h1"><h2 id="ac-h1">Get email alerts</h2>' +
        "<p>One message a day at most, when a deal you watch reports, a rule you set is crossed, or an issuer you follow brings a new deal. Your portfolio moves to the account.</p>" +
        '<form class="ac-form" id="ac-form" novalidate>' +
        '<div class="full"><label for="f-email">Email</label><input id="f-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" required value="' + esc(auth.email) + '"></div>' +
        '<div><label for="f-first">First name</label><input id="f-first" name="first" type="text" autocomplete="given-name" required value="' + esc(auth.first) + '"></div>' +
        '<div><label for="f-last">Last name</label><input id="f-last" name="last" type="text" autocomplete="family-name" required value="' + esc(auth.last) + '"></div>' +
        '<p class="err" id="ac-err" hidden></p>' +
        '<div class="row"><button type="submit" class="md-btn md-btn-primary" id="ac-send">Send me a sign-in link</button><span class="flat">No password. The link signs you in.</span></div></form>' +
        '<p class="small">We ask for your name so we know who we\'re writing to. We hold it and your email address, nothing else, and only you can see your portfolio. <a class="ac-link" href="/privacy/">Privacy ›</a></p></div>';
      $("f-email").focus();
    } else if (state === "check") {
      // draft 6: the link leads; the code boxes appear only behind the "another device" line
      $("md-auth").innerHTML = back + '<div class="ac-card" role="region" aria-labelledby="ac-h2"><h2 id="ac-h2">Check your email</h2>' +
        '<p>We sent a sign-in link to <span class="ac-addr">' + esc(auth.email) + "</span>. <b>Open the link and you're in.</b> Nothing to type here.</p>" +
        '<p class="ac-other" id="ac-other"><a class="ac-link" href="#" data-auth="code">Reading the email on another device? Type the code from it instead ›</a></p>' +
        '<form class="ac-form" id="ac-code-form" novalidate hidden><div class="full"><label for="c1">The six-digit code from the email</label><div class="ac-code" id="codebox">' +
        [1, 2, 3, 4, 5, 6].map(function (i) { return '<input id="c' + i + '" inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="' + (i === 1 ? "one-time-code" : "off") + '" aria-label="Digit ' + i + '">'; }).join("") + "</div></div>" +
        '<div class="row"><button type="submit" class="md-btn md-btn-primary" id="ac-verify">Sign in with the code</button></div></form>' +
        '<p class="err" id="ac-err" hidden></p>' +
        '<p class="ac-wait" id="ac-again">Didn\'t get it? Check your spam folder. You can send again in <b id="ac-secs">30</b>s.</p>' +
        '<p class="small">The link and the code work once, for 15 minutes. <a class="ac-link" href="#" data-auth="form">Wrong address? Start over.</a></p></div>';
      var n = 30;
      auth.again = setInterval(function () {
        n--; var s = $("ac-secs"), box = $("ac-again"); if (!box) { clearInterval(auth.again); return; }
        if (n <= 0) { clearInterval(auth.again); box.innerHTML = 'Didn\'t get it? Check your spam folder, or <a class="ac-link" href="#" data-auth="again">send again</a>.'; } else if (s) s.textContent = n;
      }, 1000);
    } else if (state === "expired") {
      $("md-auth").innerHTML = back + '<div class="ac-card" role="region" aria-labelledby="ac-h3"><h2 id="ac-h3">That sign-in link has expired</h2>' +
        "<p>Links work once, for 15 minutes.</p>" +
        '<div class="ac-form"><div class="row"><button type="button" class="md-btn md-btn-primary" data-auth="form">Send me a new link</button></div></div></div>';
    }
    window.scrollTo(0, 0);
  }
  function authError(msg, field) {
    var e = $("ac-err"); if (!e) return; e.textContent = msg; e.hidden = !msg;
    if (field) { field.setAttribute("aria-invalid", "true"); field.focus(); }
  }
  var INVITED = "Sign-in is by invitation for now. Email hello@consumercreditmatters.com if you'd like one.";
  function sendLink(again) {
    var btn = $("ac-send") || $("ac-verify"); if (btn) btn.disabled = true;
    // registration may be limited to invited addresses (the private QA, the founders preview): ask first
    return (again ? Promise.resolve(true) : W.canRegister(auth.email)).then(function (may) {
      if (!may) { if (btn) btn.disabled = false; authError(INVITED, $("f-email")); return; }
      return W.signIn({ email: auth.email, first_name: auth.first, last_name: auth.last }).then(function () {
        if (!again) showAuth("check"); else { W.toast("Sent again."); showAuth("check"); }
      }, function (e) {
        if (btn) btn.disabled = false;
        if (again) { authError(e.reason === "rate" ? "We just sent a link to that address. Give it a minute, then try again." : "Couldn't send the link. Try again in a moment."); return; }
        authError(e.reason === "email" ? "That doesn't look like an email address." : e.reason === "rate" ? "We just sent a link to that address. Give it a minute, then try again."
                  : e.reason === "invited" ? INVITED : "Couldn't send the link. Try again in a moment.", e.reason === "email" || e.reason === "invited" ? $("f-email") : null);
      });
    });
  }
  function verifyCode() {
    var code = Array.prototype.map.call(document.querySelectorAll("#codebox input"), function (i) { return i.value; }).join("");
    if (code.length < 6) { authError("Type all six digits of the code.", $("c1")); return; }
    var btn = $("ac-verify"); btn.disabled = true;
    W.verify({ email: auth.email, token: code }).then(function (res) {
      showAuth(null); landed(res); render();
    }, function (e) {
      btn.disabled = false;
      document.querySelectorAll("#codebox input").forEach(function (i) { i.value = ""; });
      // the project answers "expired or invalid" for both a wrong code and an old one
      authError(e.reason === "expired" ? "That code didn't match. Check the newest email; each request sends a new one." : "Couldn't check the code. Try again in a moment.", $("c1"));
    });
  }
  root.addEventListener("click", function (e) {
    var a = e.target.closest("[data-auth]"); if (!a) return;
    e.preventDefault();
    var go = a.dataset.auth;
    if (go === "back") showAuth(null);
    else if (go === "form") showAuth("form");
    else if (go === "again") sendLink(true);
    else if (go === "code") { $("ac-code-form").hidden = false; $("ac-other").hidden = true; $("c1").focus(); }
  });
  $("md-signin-link").addEventListener("click", function (e) { e.preventDefault(); showAuth("form"); });
  root.addEventListener("submit", function (e) {
    var f = e.target;
    if (f.id === "ac-form") {
      e.preventDefault();
      auth.email = f.email.value.trim(); auth.first = f.first.value.trim(); auth.last = f.last.value.trim();
      ["f-email", "f-first", "f-last"].forEach(function (id) { $(id).removeAttribute("aria-invalid"); });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(auth.email)) { authError("That doesn't look like an email address.", f.email); return; }
      if (!auth.first) { authError("Please tell us your name.", f.first); return; }
      if (!auth.last) { authError("Please tell us your name.", f.last); return; }
      authError(""); sendLink(false);
    } else if (f.id === "ac-code-form") { e.preventDefault(); verifyCode(); }
  });
  // the code boxes: a digit moves on, backspace moves back, a pasted code fills all six
  root.addEventListener("input", function (e) {
    var i = e.target; if (!i.closest || !i.closest("#codebox")) return;
    var v = i.value.replace(/\D/g, "");
    if (v.length > 1) { var boxes = document.querySelectorAll("#codebox input"), at = Array.prototype.indexOf.call(boxes, i); v.split("").forEach(function (d, j) { if (boxes[at + j]) boxes[at + j].value = d; }); (boxes[Math.min(at + v.length, 5)]).focus(); return; }
    i.value = v;
    if (v && i.nextElementSibling) i.nextElementSibling.focus();
    else if (v && !i.nextElementSibling) verifyCode();
  });
  root.addEventListener("keydown", function (e) {
    var i = e.target; if (!i.closest || !i.closest("#codebox")) return;
    if (e.key === "Backspace" && !i.value && i.previousElementSibling) i.previousElementSibling.focus();
  });

  // ── the settings sheet and the delete confirmation ───────────────
  var editingName = false, editingEmail = false, emailSent = "";
  function openSheet() {
    var a = W.account; if (!a) return;
    $("md-scrim").hidden = $("md-sheet").hidden = false;
    $("md-sheet").innerHTML = '<button type="button" class="ac-close" aria-label="Close" data-sheet="close">×</button><h2 id="md-sheet-h">Settings</h2><p class="sub">Your account on Consumer Credit Matters</p>' +
      "<h3>Account</h3>" +
      (editingName ? '<div class="ac-field"><span class="k">Name</span><form id="ac-name"><input name="first" aria-label="First name" value="' + esc(a.first_name) + '" required><input name="last" aria-label="Last name" value="' + esc(a.last_name) + '" required><div class="row"><button type="submit" class="md-btn">Save</button><button type="button" class="md-btn md-btn-quiet" data-sheet="name-cancel">Cancel</button></div></form></div>'
                   : '<div class="ac-field"><span class="k">Name</span><span class="v">' + esc(a.first_name + " " + a.last_name) + '</span><button type="button" class="md-link" data-sheet="name">Edit</button></div>') +
      (editingEmail ? '<div class="ac-field"><span class="k">Email</span><form id="ac-email"><input name="email" type="email" inputmode="email" autocomplete="email" aria-label="New email address" placeholder="new@example.com" required><div class="row"><button type="submit" class="md-btn">Send the link</button><button type="button" class="md-btn md-btn-quiet" data-sheet="email-cancel">Cancel</button></div></form></div>'
                    : '<div class="ac-field"><span class="k">Email</span><span class="v">' + esc(a.email) +
                      (emailSent ? "<small>We sent a link to " + esc(emailSent) + " and one to this address. The change takes effect when both are opened.</small>"
                                 : "<small>Changing it sends a link to the new address and to this one; the change takes effect when both are opened.</small>") +
                      '</span><button type="button" class="md-link" data-sheet="email">Change</button></div>') +
      '<div class="ac-field"><span class="k">Since</span><span class="v">' + esc(fmtDate(a.since)) + (a.label ? " · " + esc(a.label) + "<small>" + esc(a.label + "s hold " + W.limits.deals + " deals and follow " + W.limits.issuers + " issuers.") + "</small>" : "") + "</span></div>" +
      "<h3>How often</h3>" +
      '<label class="ac-radio' + (a.cadence === "daily" ? " on" : "") + '"><input type="radio" name="cad" value="daily"' + (a.cadence === "daily" ? " checked" : "") + ">As it happens<small>One message a day at most, after the day's filings have been published. Most months that is a few messages.</small></label>" +
      '<label class="ac-radio' + (a.cadence === "monthly" ? " on" : "") + '"><input type="radio" name="cad" value="monthly"' + (a.cadence === "monthly" ? " checked" : "") + ">Monthly digest<small>One message on the first sending day of each month with everything from the month before, including the deals that were quiet.</small></label>" +
      "<h3>Your account</h3>" +
      '<div class="ac-actions"><button type="button" class="md-link" data-sheet="signout">Sign out</button><button type="button" class="md-link danger" data-sheet="delete">Delete my account…</button></div>' +
      '<p class="small">Only you can see your portfolio. We hold your email, name, this list, and a record of what we sent you. <a class="ac-link" href="/privacy/">Privacy ›</a></p>';
    ($("ac-name") ? $("ac-name").first : $("ac-email") ? $("ac-email").email : $("md-sheet").querySelector(".ac-close")).focus();
  }
  function closeSheet() { $("md-scrim").hidden = $("md-sheet").hidden = true; $("md-sheet").innerHTML = ""; editingName = editingEmail = false; $("md-settings").focus(); }
  function openDelete() {
    var all = W.list(), deals = all.filter(function (w) { return !isIssuer(w); }).length, iss = all.length - deals, rules = all.filter(function (w) { return W.rule(w.key); }).length;
    $("md-sheet").hidden = true;
    $("md-delete").hidden = false;
    $("md-delete").innerHTML = '<h2 id="md-delete-h">Delete your account?</h2>' +
      "<p>This removes your email address and name, your " + esc(n_(deals, "deal") + " and " + n_(iss, "issuer") + ", your " + n_(rules, "rule")) + ", and the record of what we sent you. No more email from us. It can't be undone, but you can sign up again any time.</p>" +
      '<p class="small">Your portfolio stays in this browser\'s storage, the way it was before you signed in, until you clear it.</p>' +
      '<div class="row"><button type="button" class="md-btn" data-sheet="keep">Keep my account</button><button type="button" class="md-btn md-btn-danger" data-sheet="delete-confirm">Delete my account</button></div>';
    $("md-delete").querySelector("[data-sheet=keep]").focus();
  }
  function closeDelete(back) { $("md-delete").hidden = true; $("md-delete").innerHTML = ""; if (back) { $("md-sheet").hidden = false; } else closeSheet(); }
  $("md-settings").addEventListener("click", openSheet);
  $("md-scrim").addEventListener("click", function () { if (!$("md-delete").hidden) closeDelete(true); else closeSheet(); });
  document.addEventListener("keydown", function (e) { if (e.key !== "Escape") return; if (!$("md-delete").hidden) closeDelete(true); else if (!$("md-sheet").hidden) closeSheet(); });
  function saved(p) { return p.then(function () { W.toast("Saved."); }, function () { W.toast("Couldn't save that change. Your portfolio is as it was — try again in a moment."); }); }
  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-sheet]"); if (!b) return;
    var what = b.dataset.sheet;
    if (what === "close") closeSheet();
    else if (what === "name") { editingName = true; openSheet(); }
    else if (what === "name-cancel") { editingName = false; openSheet(); }
    else if (what === "email") { editingEmail = true; openSheet(); }
    else if (what === "email-cancel") { editingEmail = false; openSheet(); }
    else if (what === "signout") { closeSheet(); W.signOut(); notice(""); render(); }
    else if (what === "delete") openDelete();
    else if (what === "keep") closeDelete(true);
    else if (what === "delete-confirm") {
      b.disabled = true;
      W.deleteAccount().then(function () {
        closeDelete(false); render();
        notice("<b>Your account is deleted.</b> Your email address, name, portfolio, rules and the record of what we sent you are gone. The portfolio saved in this browser is as it was before you signed in.");
      }, function () { b.disabled = false; W.toast("Couldn't delete the account. Try again in a moment."); });
    }
  });
  root.addEventListener("submit", function (e) {
    if (e.target.id === "ac-email") {
      e.preventDefault();
      var addr = e.target.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { W.toast("That doesn't look like an email address."); return; }
      if (addr.toLowerCase() === (W.account.email || "").toLowerCase()) { W.toast("That is already your address."); return; }
      e.target.querySelector("button[type=submit]").disabled = true;
      W.changeEmail(addr).then(function () { emailSent = addr; editingEmail = false; openSheet(); },
                              function (e) { W.toast(e.status === 429 ? "We just sent a link to that address. Give it a minute, then try again." : "Couldn't send the link. Try again in a moment."); editingEmail = false; openSheet(); });
      return;
    }
    if (e.target.id !== "ac-name") return;
    e.preventDefault();
    var f = e.target, first = f.first.value.trim(), last = f.last.value.trim();
    if (!first || !last) { W.toast("Please tell us your name."); return; }
    saved(W.setAccount({ first_name: first, last_name: last })).then(function () { editingName = false; openSheet(); renderHead(); });
  });
  root.addEventListener("change", function (e) {
    if (e.target.name === "cad") {
      document.querySelectorAll(".ac-radio").forEach(function (l) { l.classList.toggle("on", l.contains(e.target)); });
      saved(W.setAccount({ cadence: e.target.value }));
    }
    if (e.target.dataset && e.target.dataset.mail) {
      var k = e.target.dataset.mail, on = e.target.checked;
      W.setEmail(k, on);
      e.target.closest(".ac-sw").classList.toggle("on", on);
      var row = e.target.closest("tr"); if (row) row.classList.toggle("nomail", !on);
      $("md-sub").textContent = $("md-sub").textContent.replace(/ · email alerts (on|off)$/, mailState(W.list()));
    }
  });

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
  document.addEventListener("ccm-watch-change", function (e) { if (!(e.detail && e.detail.reverted) || !auth.state) render(); });
  document.addEventListener("ccm-watch-session", function (e) {
    var d = e.detail || {};
    if (!d.signedIn && d.why === "expired") notice("<b>Your session ended.</b> Sign in again to keep getting email alerts; your portfolio is still here.", "warn");
    render();
  });
  $("md-clear").addEventListener("click", function () { if (confirm("Remove every deal, issuer and rule from this browser's portfolio?")) { W.clear(); render(); } });

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
      .catch(function () { fail("The latest figures could not be loaded. Your portfolio is still saved" + (signedIn() ? "." : " in this browser.")); });
  }
  // Accounts on? Then the sign-in line shows, a session syncs from the account, and the
  // link's token (W.landing) signs in and says what moved.
  if (W) {
    W.config().then(function (cfg) {
      ACCOUNTS = !!cfg; renderHead();
      if (W.landing && W.landingType === "email_change") {
        W.landing.then(function (res) {
          emailSent = "";
          notice(res.pending ? "<b>One more step.</b> This address is confirmed; open the link we sent to the other one and the change takes effect."
                             : "<b>Your email address is now " + esc(W.account ? W.account.email : res.changed) + ".</b> Alerts go there from now on.");
          render();
        }, function (e) { notice(e.reason === "expired" ? "<b>That link has expired.</b> Links work once, for 15 minutes; ask for the change again in Settings." : "<b>Couldn't confirm the address.</b> Try the link again in a moment.", "err"); render(); });
      } else if (W.landing) W.landing.then(function (res) { landed(res); render(); }, function (e) { if (e.reason === "expired") showAuth("expired"); else notice("<b>Couldn't sign you in.</b> Try the link again in a moment, or ask for a new one.", "err"); });
      else if (W.account) W.sync().catch(function () {});
      // the unsubscribe page's "Delete my account instead" lands here: open Settings for a signed-in reader
      if (location.hash === "#settings" && W.account) { history.replaceState(null, "", location.pathname + location.search); openSheet(); }
    });
  }
  load();
})();
