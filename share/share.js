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
  var LOGO_URL = ASSETS_BASE + "logo-horizontal-primary.png";

  var HTML2CANVAS_URL = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";

  var FOOTER_URL = "consumercreditmatters.com";

  // Branded frame dimensions — rendered at 2x social-card size for crispness.
  // 2400×1260 keeps the 1200×630 OG aspect ratio; social platforms downscale
  // on display but the source is sharp at full-screen view too.
  var FRAME_W = 2400;
  var FRAME_H = 1260;
  var HEADER_H = 192;
  var FOOTER_H = 112;
  var PAD_X = 80;

  var CREAM = "#FAF9F5";
  var INK = "#111827";
  var BLUE = "#0034A5";
  var MUTED = "#6b7280";

  // ── Inline SVG icons ──────────────────────────────────────────────
  var ICON_SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';
  var ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  var ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
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
    btn.setAttribute("aria-label", "Save chart as branded image");
    btn.title = "Save chart as branded image";
    btn.innerHTML = ICON_SHARE;
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      if (shouldGoDirectToShareSheet()) {
        captureAndShare(currentMeta(), null);
      } else {
        openModal(currentMeta(), null);
      }
    });
    document.body.appendChild(btn);
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
    var elements = document.querySelectorAll(selector);
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
      btn.setAttribute("aria-label", "Save this chart as branded image");
      btn.title = "Save this chart as branded image";
      btn.innerHTML = ICON_SHARE;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var override = currentMeta();
        // Per-chart title resolution (best signal first):
        //   1. data-chart-title attribute on the target element
        //   2. .chart-title child (used by CC chart sections)
        //   3. aria-label on an inline <svg> (used by presale chart cells)
        //   4. fall back to the global CC_CHART_META.title
        var titleEl = el.querySelector(".chart-title");
        var svgEl   = el.tagName === "SVG" ? el : el.querySelector("svg[aria-label]");
        var perTitle =
          el.dataset.chartTitle ||
          (titleEl && titleEl.textContent.trim()) ||
          (svgEl && svgEl.getAttribute("aria-label")) ||
          override.title;
        var perMeta = { title: perTitle, url: override.url, asof: override.asof };
        // On touch devices, skip the modal and hand the PNG directly to the
        // OS share sheet via Web Share API. The OS sheet covers Save / Copy /
        // Send-to-app natively, so our modal would be redundant. Fall back
        // to the modal if Web Share isn't supported or the user cancels and
        // we still want to give them Download/Copy.
        if (shouldGoDirectToShareSheet()) {
          captureAndShare(perMeta, el);
        } else {
          openModal(perMeta, el);
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
    if (window.CC_CHART_DYNAMIC_SUBTITLE_SELECTOR) {
      var s = document.querySelector(window.CC_CHART_DYNAMIC_SUBTITLE_SELECTOR);
      if (s) {
        var sTxt = (s.textContent || "").trim();
        if (sTxt) dynTitle = dynTitle ? dynTitle + " — " + sTxt : sTxt;
      }
    }
    return {
      title: dynTitle || override.title || document.title || "Consumer Credit Matters chart",
      url:   override.url || window.location.href,
      asof:  override.asof || formatToday()
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
      '<button class="cc-share-action" data-action="copy" disabled>' + ICON_COPY + '<span>Copy image</span></button>';
    if (showSendToApp) {
      actionsHTML +=
        '<button class="cc-share-action" data-action="share" disabled>' + ICON_SHARE + '<span>Send to app…</span></button>';
    }

    var footerNote = showSendToApp
      ? "Send to app… opens your system share sheet to post the image directly to LinkedIn, X, Slack, Messages, etc."
      : "Download saves a PNG. Copy puts the image on your clipboard — paste it directly into a LinkedIn post, tweet, Slack message, email, etc.";

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

      // Use scrollWidth/scrollHeight (not clientWidth/Height) so we capture
      // the full content even when the element extends beyond its visible box
      // (e.g. tall data tables, multi-chart sections).
      var fullW = Math.max(target.scrollWidth, target.clientWidth);
      var fullH = Math.max(target.scrollHeight, target.clientHeight);

      return html2canvas(target, {
        scale: 3,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        width: fullW,
        height: fullH,
        windowWidth: Math.max(document.documentElement.scrollWidth, window.innerWidth),
        windowHeight: Math.max(document.documentElement.scrollHeight, window.innerHeight),
        // Skip the modal, the floating button, and any inline share buttons
        ignoreElements: function (el) {
          if (!el.classList) return false;
          return (
            el.classList.contains("cc-share-modal-bg") ||
            el.classList.contains("cc-share-btn") ||
            el.id === "cc-share-floating-btn"
          );
        }
      });
    });
  }

  // ── Branded PNG compositor ────────────────────────────────────────
  function buildBrandedPNG(meta, explicitTarget) {
    return Promise.all([captureChart(explicitTarget), loadImage(LOGO_URL, false)]).then(function (parts) {
      var chartCanvas = parts[0];
      var logoImg = parts[1];

      var canvas = document.createElement("canvas");
      canvas.width = FRAME_W;
      canvas.height = FRAME_H;
      var ctx = canvas.getContext("2d");

      // Cream background
      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 0, FRAME_W, FRAME_H);

      // Header — logo on left, title on right (all dimensions 2x for crispness)
      var logoH = 112;
      var logoW = (logoImg.width / logoImg.height) * logoH;
      var logoY = (HEADER_H - logoH) / 2;
      if (logoImg.complete && logoImg.naturalWidth) {
        ctx.drawImage(logoImg, PAD_X, logoY, logoW, logoH);
      }

      ctx.fillStyle = INK;
      ctx.font = '600 52px Inter, system-ui, -apple-system, sans-serif';
      ctx.textBaseline = "middle";
      var titleX = PAD_X + logoW + 56;
      var maxTitleWidth = FRAME_W - titleX - PAD_X;
      var title = truncateToWidth(ctx, meta.title, maxTitleWidth);
      ctx.fillText(title, titleX, HEADER_H / 2);

      ctx.strokeStyle = "#ECE9DD";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(PAD_X, HEADER_H);
      ctx.lineTo(FRAME_W - PAD_X, HEADER_H);
      ctx.stroke();

      // Chart fits in middle, preserve aspect
      var chartBoxX = PAD_X;
      var chartBoxY = HEADER_H + 32;
      var chartBoxW = FRAME_W - 2 * PAD_X;
      var chartBoxH = FRAME_H - HEADER_H - FOOTER_H - 64;
      var fitted = fitContain(chartCanvas.width, chartCanvas.height, chartBoxW, chartBoxH);
      ctx.drawImage(
        chartCanvas,
        chartBoxX + (chartBoxW - fitted.w) / 2,
        chartBoxY + (chartBoxH - fitted.h) / 2,
        fitted.w, fitted.h
      );

      // Footer — URL on left, date on right
      var footerY = FRAME_H - FOOTER_H + FOOTER_H / 2;
      ctx.strokeStyle = "#ECE9DD";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(PAD_X, FRAME_H - FOOTER_H);
      ctx.lineTo(FRAME_W - PAD_X, FRAME_H - FOOTER_H);
      ctx.stroke();

      ctx.fillStyle = BLUE;
      ctx.font = '600 32px Inter, system-ui, -apple-system, sans-serif';
      ctx.textAlign = "left";
      ctx.fillText(FOOTER_URL, PAD_X, footerY);

      ctx.fillStyle = MUTED;
      ctx.font = '400 28px Inter, system-ui, -apple-system, sans-serif';
      ctx.textAlign = "right";
      ctx.fillText("Data as of " + meta.asof, FRAME_W - PAD_X, footerY);
      ctx.textAlign = "left";

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
