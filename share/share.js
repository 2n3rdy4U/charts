/* ── ChartShare ──────────────────────────────────────────────────────
   Self-installing share-button + branded-PNG-export module.

   Usage:
     <script src="../share/share.js"></script>

   That's it. The module:
   - Adds a small floating share button at the top-right of the viewport
   - On click: rasterizes the page (or a chosen container) via html2canvas,
     composites with the Consumer Credit Matters brand frame, and shows a
     modal with Download / Copy / Share actions
   - Auto-derives title from <title> and URL from location.href

   Optional per-page overrides (place a <script> before share.js):
     window.CC_CHART_META   = { title, url, asof };   // explicit meta
     window.CC_CHART_TARGET = "#chart" or ".whatever"; // CSS selector for
                                                       // the region to capture
                                                       // (default: <main> if
                                                       // present, else <body>)

   Brand: cream #FAF9F5, royal blue #0034A5
   ───────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  // ── Self-locate so asset paths work from any nesting depth ────────
  var SCRIPT_EL = document.currentScript || (function () {
    var s = document.getElementsByTagName("script");
    return s[s.length - 1];
  })();
  var SCRIPT_URL = SCRIPT_EL ? new URL(SCRIPT_EL.src, document.baseURI).toString() : "";
  var ASSETS_BASE = SCRIPT_URL ? new URL("../assets/brand/", SCRIPT_URL).toString() : "/assets/brand/";
  var CSS_URL = SCRIPT_URL ? new URL("./share.css", SCRIPT_URL).toString() : "/share/share.css";
  var MARK_URL = ASSETS_BASE + "logo-mark-primary.png";

  var HTML2CANVAS_URL = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";

  var FOOTER_URL = "consumercreditmatters.com";

  // Branded frame dimensions — rendered at 2x for crispness. 16:9 (1200×675
  // at 1x) fits LinkedIn feed cards edge-to-edge and PowerPoint widescreen
  // slides drop-in. Tightened chrome (110px header / 70px footer) maximises
  // the chart plot area; institutional convention puts the brand as a small
  // icon-mark bottom-right rather than a header wordmark.
  var FRAME_W = 2400;
  var FRAME_H = 1350;
  var HEADER_H = 110;
  var FOOTER_H = 70;
  var PAD_X = 80;

  var CREAM = "#FAF9F5";
  var INK = "#111827";
  var BLUE = "#0034A5";
  var MUTED = "#6b7280";

  // ── Inline SVG icons ──────────────────────────────────────────────
  var ICON_SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';
  var ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  var ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var ICON_LINK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  var ICON_LINKEDIN = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';

  // ── Init ──────────────────────────────────────────────────────────
  // Three modes:
  //   1. window.CC_CHART_TARGETS = "selector"  → install one button per matched
  //      element, inline at its top-right corner. Each captures that element.
  //   2. Touch device + window.CC_CHART_TARGET → same as (1) but treat the
  //      single target as a per-chart anchor. Avoids the iOS WebKit bug where
  //      position:fixed is demoted to position:absolute inside iframes (which
  //      drops the button to the bottom of the document, far from the chart).
  //   3. (default, desktop) → install one floating button at viewport bottom-
  //      right that captures window.CC_CHART_TARGET (or <main>/<body>).
  function init() {
    ensureStylesheet();
    var isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (window.CC_CHART_TARGETS) {
      initPerChart(window.CC_CHART_TARGETS);
    } else if (isTouch && window.CC_CHART_TARGET) {
      initPerChart(window.CC_CHART_TARGET);
    } else {
      initFloating();
    }
  }

  function initFloating() {
    if (document.getElementById("cc-share-floating-btn")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "cc-share-floating-btn";
    btn.className = "cc-share-btn cc-share-btn--floating";
    btn.setAttribute("aria-label", "Share or copy this chart");
    btn.title = "Share or copy this chart";
    btn.innerHTML = ICON_SHARE;
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      // resolveCaptureTarget(null) returns CC_CHART_CAPTURE_SELECTOR's first
      // visible match if set, else null. captureChart() handles a null target
      // by falling back to CC_CHART_TARGET / <main> / <body>.
      var captureEl = resolveCaptureTarget(null);
      if (shouldGoDirectToShareSheet()) {
        captureAndShare(currentMeta(), captureEl);
      } else {
        openModal(currentMeta(), captureEl);
      }
    });
    document.body.appendChild(btn);
  }

  // If CC_CHART_CAPTURE_SELECTOR is set, return the first visible element
  // matching it; otherwise fall back to the supplied default (typically the
  // button's anchor element). Lets a page decouple the button's location
  // from the actual capture target.
  function resolveCaptureTarget(defaultEl) {
    if (window.CC_CHART_CAPTURE_SELECTOR) {
      var sels = Array.isArray(window.CC_CHART_CAPTURE_SELECTOR)
        ? window.CC_CHART_CAPTURE_SELECTOR
        : [window.CC_CHART_CAPTURE_SELECTOR];
      for (var i = 0; i < sels.length; i++) {
        var c = document.querySelector(sels[i]);
        if (c && c.offsetWidth > 0 && c.offsetHeight > 0) return c;
      }
    }
    return defaultEl;
  }

  // Returns true when the OS native share sheet should handle sharing
  // directly (skipping our in-page modal). Mobile/touch + Web Share API
  // with file support is the canonical case.
  function shouldGoDirectToShareSheet() {
    var isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (!isTouch) return false;
    if (typeof navigator.share !== "function") return false;
    if (typeof navigator.canShare !== "function") return false;
    try {
      var probe = new File([new Blob([""], { type: "image/png" })], "p.png", { type: "image/png" });
      return navigator.canShare({ files: [probe] });
    } catch (e) {
      return false;
    }
  }

  // Build the branded PNG, then hand it directly to the OS share sheet.
  // On cancel: silent. On failure or missing capability: fall back to the
  // in-page modal so the user still has Download / Copy / etc.
  function captureAndShare(meta, target) {
    buildBrandedPNG(meta, target)
      .then(function (result) {
        var file = new File(
          [result.blob],
          slugify(meta.title) + ".png",
          { type: "image/png" }
        );
        return navigator.share({ files: [file] });
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") return; // user cancelled
        console.warn("Direct share failed, opening modal fallback:", err);
        openModal(meta, target);
      });
  }

  function initPerChart(selector) {
    // Accept array of selectors (joined into a CSS selector list) or a single string.
    var selectorStr = Array.isArray(selector) ? selector.join(", ") : selector;
    var elements = document.querySelectorAll(selectorStr);
    if (elements.length === 0) {
      console.warn("ChartShare: no elements matched", selector);
      return;
    }
    elements.forEach(function (el) {
      if (el.querySelector(":scope > .cc-share-btn")) return; // idempotent
      var cs = getComputedStyle(el);
      if (cs.position === "static") el.style.position = "relative";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cc-share-btn cc-share-btn--inline";
      btn.setAttribute("aria-label", "Share or copy this chart");
      btn.title = "Share or copy this chart";
      btn.innerHTML = ICON_SHARE;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var override = currentMeta();
        // Per-chart title resolution (best signal first):
        //   1. data-chart-title attribute on the target element
        //   2. .chart-title child (used by CC chart sections)
        //   3. aria-label on an inline <svg> (used by presale chart cells)
        //   4. fall back to the global CC_CHART_META.title (which itself
        //      may have come from CC_CHART_DYNAMIC_TITLE_SELECTOR)
        var titleEl = el.querySelector(".chart-title");
        var svgEl   = el.tagName === "SVG" ? el : el.querySelector("svg[aria-label]");
        var perTitle =
          el.dataset.chartTitle ||
          (titleEl && titleEl.textContent.trim()) ||
          (svgEl && svgEl.getAttribute("aria-label")) ||
          override.title;
        var perMeta = { title: perTitle, url: override.url, asof: override.asof };
        // Capture target may differ from the button's anchor element. Useful
        // when the anchor is a stable wrapper (e.g. #export-region on the
        // SEC explorer) but the actual chart to capture is a child or
        // sibling.  CC_CHART_CAPTURE_SELECTOR (string or array of selectors)
        // takes precedence; first visible match wins.
        var captureEl = resolveCaptureTarget(el);
        if (shouldGoDirectToShareSheet()) {
          captureAndShare(perMeta, captureEl);
        } else {
          openModal(perMeta, captureEl);
        }
      });
      el.appendChild(btn);
    });
  }

  function currentMeta() {
    var override = window.CC_CHART_META || {};
    // Dynamic title: a page can set CC_CHART_DYNAMIC_TITLE_SELECTOR pointing
    // to a DOM element whose text is the *current* chart title (e.g. for the
    // SEC explorer where the title changes per active tab). Optionally a
    // second SUBTITLE selector. Read at capture time so the brand-frame
    // header reflects exactly what the user is looking at.
    var dynTitle = "";
    if (window.CC_CHART_DYNAMIC_TITLE_SELECTOR) {
      var t = document.querySelector(window.CC_CHART_DYNAMIC_TITLE_SELECTOR);
      if (t) dynTitle = (t.textContent || "").trim();
    }
    var dynSubtitle = "";
    if (window.CC_CHART_DYNAMIC_SUBTITLE_SELECTOR) {
      var s = document.querySelector(window.CC_CHART_DYNAMIC_SUBTITLE_SELECTOR);
      if (s) dynSubtitle = (s.textContent || "").trim();
    }
    // Dynamic "as of" line: a page can set CC_CHART_DYNAMIC_ASOF_SELECTOR
    // pointing to an element whose text already reads as a complete line
    // (e.g. "Most recent data: April 2026"). Used verbatim in the brand
    // frame's right-footer cell — no "Data as of" prefix added.
    var dynAsof = "";
    if (window.CC_CHART_DYNAMIC_ASOF_SELECTOR) {
      var a = document.querySelector(window.CC_CHART_DYNAMIC_ASOF_SELECTOR);
      if (a) dynAsof = (a.textContent || "").trim();
    }
    return {
      title:    dynTitle || override.title || document.title || "Consumer Credit Matters chart",
      subtitle: dynSubtitle || override.subtitle || "",
      source:   window.CC_CHART_SOURCE || override.source || "SEC ABS-EE filings",
      url:      override.url || window.location.href,
      asof:     override.asof || formatToday(),
      asofLine: dynAsof  // empty unless explicit; compositor falls back to "Data as of " + asof
    };
  }

  function ensureStylesheet() {
    // Idempotent: only inject the <link> if it isn't already present.
    var links = document.getElementsByTagName("link");
    for (var i = 0; i < links.length; i++) {
      if (links[i].href && links[i].href.indexOf("/share/share.css") !== -1) return;
    }
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = CSS_URL;
    document.head.appendChild(link);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function formatToday() {
    var d = new Date();
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  // ── Modal ─────────────────────────────────────────────────────────
  function openModal(meta, explicitTarget) {
    // Web Share API only shown on touch devices (mobile/tablet) where the
    // native share sheet is the conventional flow. On desktop, Copy + Download
    // are simpler and more reliable.
    var isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var probeFile = new File([new Blob([""], { type: "image/png" })], "probe.png", { type: "image/png" });
    var showSendToApp = isTouch &&
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [probeFile] });

    var actionsHTML =
      '<button class="cc-share-action" data-action="download" disabled>' + ICON_DOWNLOAD + '<span>Download</span></button>' +
      '<button class="cc-share-action" data-action="copy" disabled>' + ICON_COPY + '<span>Copy image</span></button>' +
      '<button class="cc-share-action" data-action="copylink">' + ICON_LINK + '<span>Copy link</span></button>';
    if (showSendToApp) {
      actionsHTML +=
        '<button class="cc-share-action" data-action="share" disabled>' + ICON_SHARE + '<span>Send to app…</span></button>';
    }

    var footerNote = showSendToApp
      ? "Send to app… opens your system share sheet to post the image directly to LinkedIn, X, Slack, Messages, etc. Copy link copies a link back to this exact view."
      : "Download saves a PNG; Copy image puts it on your clipboard. Copy link copies a link back to this exact view — paste it into your newsletter, an email, Slack, etc.";

    var bg = document.createElement("div");
    bg.className = "cc-share-modal-bg cc-open";
    bg.innerHTML = (
      '<div class="cc-share-modal" role="dialog" aria-modal="true" aria-label="Share chart">' +
        '<div class="cc-share-header">' +
          '<span class="cc-share-title">Share this chart</span>' +
          '<button class="cc-share-close" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="cc-share-preview">' +
          '<div class="cc-share-preview-loading">Rendering preview…</div>' +
        '</div>' +
        '<div class="cc-share-actions">' +
          actionsHTML +
        '</div>' +
        '<div class="cc-share-footer-note">' +
          footerNote +
        '</div>' +
        '<div class="cc-share-toast" aria-live="polite" style="display:none;"></div>' +
      '</div>'
    );
    document.body.appendChild(bg);

    // Copy-link: copies the URL of the CURRENT view (query params included), so
    // an author can paste a deep link to exactly this chart + parameterization.
    // Works immediately — it doesn't wait on the PNG preview.
    var _clBtn = bg.querySelector('[data-action="copylink"]');
    if (_clBtn) {
      _clBtn.addEventListener("click", function () {
        var href = window.location.href;
        var t = bg.querySelector(".cc-share-toast");
        function say(msg, ms) {
          if (!t) return;
          t.textContent = msg; t.style.display = "block";
          clearTimeout(t._t); t._t = setTimeout(function () { t.style.display = "none"; }, ms || 3000);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(href).then(
            function () { say("Link to this view copied", 3000); },
            function () { say("Couldn't copy automatically — " + href, 8000); }
          );
        } else { say("Couldn't copy automatically — " + href, 8000); }
      });
    }

    function close() {
      bg.classList.remove("cc-open");
      bg.remove();
    }
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    bg.querySelector(".cc-share-close").addEventListener("click", close);
    var escHandler = function (e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", escHandler); }
    };
    document.addEventListener("keydown", escHandler);

    // Build branded PNG and wire actions
    buildBrandedPNG(meta, explicitTarget)
      .then(function (result) {
        var previewWrap = bg.querySelector(".cc-share-preview");
        previewWrap.innerHTML = "";
        var img = document.createElement("img");
        img.src = result.dataURL;
        img.alt = meta.title;
        previewWrap.appendChild(img);

        var buttons = bg.querySelectorAll(".cc-share-action");
        for (var i = 0; i < buttons.length; i++) buttons[i].disabled = false;

        var dlBtn = bg.querySelector('[data-action="download"]');
        var cpBtn = bg.querySelector('[data-action="copy"]');
        var shareBtn = bg.querySelector('[data-action="share"]');
        var toast = bg.querySelector('.cc-share-toast');

        function flashToast(msg, ms) {
          if (!toast) return;
          toast.textContent = msg;
          toast.style.display = "block";
          clearTimeout(toast._t);
          toast._t = setTimeout(function () { toast.style.display = "none"; }, ms || 3500);
        }
        function flashCopied(btn) {
          btn.classList.add("cc-copied");
          var span = btn.querySelector("span");
          var orig = span.textContent;
          span.textContent = "Copied!";
          setTimeout(function () {
            btn.classList.remove("cc-copied");
            span.textContent = orig;
          }, 1600);
        }

        dlBtn.addEventListener("click", function () {
          var a = document.createElement("a");
          a.href = result.dataURL;
          a.download = slugify(meta.title) + ".png";
          a.click();
        });

        cpBtn.addEventListener("click", function () {
          copyToClipboard(result.blob)
            .then(function () { flashCopied(cpBtn); })
            .catch(function (err) {
              console.warn("Clipboard copy failed:", err);
              flashToast("Copy failed. Try Download instead.", 4000);
            });
        });

        if (shareBtn) {
          shareBtn.addEventListener("click", function () {
            var file = new File([result.blob], slugify(meta.title) + ".png", { type: "image/png" });
            navigator.share({ files: [file] })
              .catch(function (err) {
                if (err && err.name === "AbortError") return;
                console.warn("Web Share failed:", err);
                flashToast("Share unavailable. Use Download or Copy.", 4000);
              });
          });
        }
      })
      .catch(function (err) {
        console.error("Branded PNG render failed:", err);
        var previewWrap = bg.querySelector(".cc-share-preview");
        previewWrap.innerHTML = '<div class="cc-share-preview-loading" style="color:#dc2626;flex-direction:column;gap:8px;padding:24px;font-family:monospace;font-size:11px;line-height:1.4;text-align:left;align-items:flex-start;white-space:pre-wrap;">PNG render failed:\n' + (err && err.message ? err.message : String(err)) + '</div>';
      });
  }

  function copyToClipboard(blob) {
    if (!navigator.clipboard || !window.ClipboardItem) {
      return Promise.reject(new Error("Clipboard API not supported"));
    }
    return navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  }

  function slugify(s) {
    return (s || "chart").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  // ── Capture: html2canvas (lazy-loaded on first share click) ───────
  function loadHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = HTML2CANVAS_URL;
      s.onload = function () { resolve(window.html2canvas); };
      s.onerror = function () { reject(new Error("Failed to load html2canvas from " + HTML2CANVAS_URL)); };
      document.head.appendChild(s);
    });
  }

  function captureChart(explicitTarget) {
    return loadHtml2Canvas().then(function (html2canvas) {
      var target = explicitTarget || null;
      if (!target && window.CC_CHART_TARGET) {
        // CC_CHART_TARGET may be a string OR an array of selectors. For arrays,
        // try each in order and use the first that's visible (non-zero size).
        // Useful for pages where the active chart container changes by tab
        // (e.g., #vis, #repoChart, .fico-chart on the SEC explorer).
        var selectors = Array.isArray(window.CC_CHART_TARGET)
          ? window.CC_CHART_TARGET
          : [window.CC_CHART_TARGET];
        for (var i = 0; i < selectors.length; i++) {
          var cand = document.querySelector(selectors[i]);
          if (cand && cand.offsetWidth > 0 && cand.offsetHeight > 0) {
            target = cand;
            break;
          }
        }
      }
      if (!target) target = document.querySelector("main");
      if (!target) target = document.body;

      // Guard: if the target collapses to 0×0 (e.g. user is on a non-chart
      // view like a data table), bail with a clear error instead of letting
      // html2canvas produce a 0-sized canvas that crashes drawImage later.
      if (target.offsetWidth === 0 || target.offsetHeight === 0) {
        return Promise.reject(new Error(
          "Nothing to share — the chart isn't visible. " +
          "Switch to a chart view and try again."
        ));
      }

      // On narrow viewports, Vega-Lite charts using width:container render in
      // portrait (~360×600) which looks small + letterboxed in the landscape
      // brand frame. Temporarily force the target to a desktop-like width
      // and dispatch a resize event so Vega re-renders at landscape. After
      // capture, restore. Disruption is brief and hidden by the modal/share-
      // sheet UI that's already on screen.
      var DESKTOP_W = 1100;
      var origWidth = "";
      var origMaxWidth = "";
      var origMinWidth = "";
      var needsReflow = target.offsetWidth < 700;
      if (needsReflow) {
        origWidth    = target.style.width;
        origMaxWidth = target.style.maxWidth;
        origMinWidth = target.style.minWidth;
        target.style.width    = DESKTOP_W + "px";
        target.style.maxWidth = "none";
        target.style.minWidth = DESKTOP_W + "px";
        window.dispatchEvent(new Event("resize"));
      }

      // Wait for Vega-Lite ResizeObserver to fire + redraw. ~500ms is the
      // sweet spot — long enough for the redraw, short enough to feel snappy.
      var wait = needsReflow
        ? new Promise(function (r) { setTimeout(r, 500); })
        : Promise.resolve();

      return wait.then(function () {
        var fullW = Math.max(target.scrollWidth, target.clientWidth);
        var fullH = Math.max(target.scrollHeight, target.clientHeight);
        return html2canvas(target, {
          scale: 3,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
          width: fullW,
          height: fullH,
          windowWidth: Math.max(document.documentElement.scrollWidth, window.innerWidth, DESKTOP_W),
          windowHeight: Math.max(document.documentElement.scrollHeight, window.innerHeight),
          ignoreElements: function (el) {
            if (!el.classList) return false;
            return (
              el.classList.contains("cc-share-modal-bg") ||
              el.classList.contains("cc-share-btn") ||
              el.id === "cc-share-floating-btn"
            );
          }
        });
      }).then(function (canvas) {
        if (needsReflow) {
          target.style.width    = origWidth;
          target.style.maxWidth = origMaxWidth;
          target.style.minWidth = origMinWidth;
          window.dispatchEvent(new Event("resize"));
        }
        return canvas;
      }).catch(function (err) {
        if (needsReflow) {
          target.style.width    = origWidth;
          target.style.maxWidth = origMaxWidth;
          target.style.minWidth = origMinWidth;
          window.dispatchEvent(new Event("resize"));
        }
        throw err;
      });
    });
  }

  // ── Branded PNG compositor ────────────────────────────────────────
  function buildBrandedPNG(meta, explicitTarget) {
    return Promise.all([captureChart(explicitTarget), loadImage(MARK_URL, false)]).then(function (parts) {
      var chartCanvas = parts[0];
      var markImg = parts[1];

      var canvas = document.createElement("canvas");
      canvas.width = FRAME_W;
      canvas.height = FRAME_H;
      var ctx = canvas.getContext("2d");

      // Cream background
      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 0, FRAME_W, FRAME_H);

      // Header — centered title + subtitle, mirroring the on-screen chart
      // header (FT / NYT Upshot pattern). 56px / 30px font specs are 2x of
      // the 1x display sizes (28px / 15px) — the export renders at 2x for
      // retina crispness. As-of stamp lives in the bottom-source line rather
      // than top-right so the header stays clean and centered.
      var TITLE_PAD_TOP = 36;
      ctx.fillStyle = INK;
      ctx.font = '600 56px Inter, system-ui, -apple-system, sans-serif';
      ctx.textBaseline = "top";
      ctx.textAlign = "center";
      var maxTitleWidth = FRAME_W - 2 * PAD_X;
      var title = truncateToWidth(ctx, meta.title, maxTitleWidth);
      ctx.fillText(title, FRAME_W / 2, TITLE_PAD_TOP);

      if (meta.subtitle) {
        ctx.fillStyle = MUTED;
        ctx.font = '400 30px Inter, system-ui, -apple-system, sans-serif';
        var subtitle = truncateToWidth(ctx, meta.subtitle, maxTitleWidth);
        ctx.fillText(subtitle, FRAME_W / 2, TITLE_PAD_TOP + 70);
      }
      ctx.textAlign = "left";

      // Separator below header
      ctx.strokeStyle = "#ECE9DD";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(PAD_X, HEADER_H);
      ctx.lineTo(FRAME_W - PAD_X, HEADER_H);
      ctx.stroke();

      // Chart fits between header and footer; preserve aspect ratio.
      var chartBoxX = PAD_X;
      var chartBoxY = HEADER_H + 24;
      var chartBoxW = FRAME_W - 2 * PAD_X;
      var chartBoxH = FRAME_H - HEADER_H - FOOTER_H - 48;
      var fitted = fitContain(chartCanvas.width, chartCanvas.height, chartBoxW, chartBoxH);
      ctx.drawImage(
        chartCanvas,
        chartBoxX + (chartBoxW - fitted.w) / 2,
        chartBoxY + (chartBoxH - fitted.h) / 2,
        fitted.w, fitted.h
      );

      // Footer — source line left, icon-mark bottom-right (institutional convention).
      var footerY = FRAME_H - FOOTER_H + FOOTER_H / 2;
      ctx.strokeStyle = "#ECE9DD";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(PAD_X, FRAME_H - FOOTER_H);
      ctx.lineTo(FRAME_W - PAD_X, FRAME_H - FOOTER_H);
      ctx.stroke();

      ctx.fillStyle = MUTED;
      ctx.font = '400 26px Inter, system-ui, -apple-system, sans-serif';
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      var sourceLine = "Source: " + (meta.source || "SEC ABS-EE filings") + " · " + FOOTER_URL;
      // Fold the as-of stamp into the source line (Pattern A) so the header
      // stays a clean centered title/subtitle and the footer carries the
      // attribution + dating together.
      var asofText = meta.asofLine || ("Data as of " + meta.asof);
      if (asofText) sourceLine += " · " + asofText;
      ctx.fillText(sourceLine, PAD_X, footerY);

      // Icon-mark bottom-right — preserves brand identity without competing
      // with the title. ~44px @ 1x (88 @ 2x); square crop from logo-mark PNG.
      if (markImg.complete && markImg.naturalWidth) {
        var markSize = 88;
        var markX = FRAME_W - PAD_X - markSize;
        var markY = footerY - markSize / 2;
        ctx.drawImage(markImg, markX, markY, markSize, markSize);
      }

      var dataURL = canvas.toDataURL("image/png");
      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          resolve({ dataURL: dataURL, blob: blob });
        }, "image/png");
      });
    });
  }

  function fitContain(srcW, srcH, boxW, boxH) {
    var sr = srcW / srcH, br = boxW / boxH;
    return sr > br ? { w: boxW, h: boxW / sr } : { w: boxH * sr, h: boxH };
  }

  function truncateToWidth(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    var ell = "…";
    while (text.length > 0 && ctx.measureText(text + ell).width > maxW) {
      text = text.slice(0, -1);
    }
    return text + ell;
  }

  function loadImage(src, crossOrigin) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      if (crossOrigin) img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("Image load failed: " + src)); };
      img.src = src;
    });
  }
})();
