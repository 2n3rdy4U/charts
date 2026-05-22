/* ── ChartShare ──────────────────────────────────────────────────────
   Reusable share-button + branded-PNG-export module for Vega-Lite
   charts on consumercreditmatters.com.

   Usage:
     vegaEmbed("#vis", spec, opt).then(result => {
       ChartShare.attach(result.view, {
         title: "CPI Headline YoY %",
         url:   window.location.href,
         asof:  "2026-05-22"        // optional, defaults to today
       });
     });

   Brand: cream #FAF9F5, royal blue #0034A5
   ───────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  // Derive asset paths from this script's own URL so they resolve
  // correctly whether the chart is served from localhost, github.io,
  // or the consumercreditmatters.com iframe (same-origin to GH Pages).
  // share.js lives at <base>/share/share.js -> brand assets at <base>/assets/brand/
  var SCRIPT_EL = document.currentScript || (function () {
    var s = document.getElementsByTagName("script");
    return s[s.length - 1];
  })();
  var SCRIPT_URL = SCRIPT_EL ? new URL(SCRIPT_EL.src, document.baseURI).toString() : "";
  var ASSETS_BASE = SCRIPT_URL ? new URL("../assets/brand/", SCRIPT_URL).toString() : "/assets/brand/";
  var LOGO_URL = ASSETS_BASE + "logo-horizontal-primary.png";
  var FOOTER_URL = "consumercreditmatters.com";

  // Branded frame dimensions (1200×630 = OG aspect ratio)
  var FRAME_W = 1200;
  var FRAME_H = 630;
  var HEADER_H = 96;
  var FOOTER_H = 56;
  var PAD_X = 40;

  var CREAM = "#FAF9F5";
  var INK = "#111827";
  var BLUE = "#0034A5";
  var MUTED = "#6b7280";

  // ── SVG icons (inline so no external deps) ────────────────────────
  var ICON_SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>';
  var ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
  var ICON_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  var ICON_LINKEDIN = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>';

  // ── Public API ────────────────────────────────────────────────────
  var ChartShare = {
    attach: function (view, opts) {
      opts = opts || {};
      var meta = {
        title: opts.title || document.title || "Consumer Credit Matters chart",
        url: opts.url || window.location.href,
        asof: opts.asof || formatToday()
      };
      var btn = buildShareButton();
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        openModal(view, meta);
      });

      // Place the button absolutely against the chart container.
      // Look for #vis (Altair default) first, else find chart's parent
      // container by walking up from the Vega view.
      var host = document.getElementById("vis") || findHost(view);
      if (host) {
        var cs = getComputedStyle(host);
        if (cs.position === "static") host.style.position = "relative";
        host.appendChild(btn);
      } else {
        // Fallback: pin to top-right of viewport
        btn.style.position = "fixed";
        btn.style.top = "12px";
        btn.style.right = "12px";
        document.body.appendChild(btn);
      }
    }
  };

  function findHost(view) {
    try {
      var sceneRoot = view.container && view.container();
      return sceneRoot && sceneRoot.parentElement;
    } catch (e) {
      return null;
    }
  }

  function buildShareButton() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cc-share-btn";
    btn.setAttribute("aria-label", "Share or save this chart");
    btn.title = "Share or save this chart";
    btn.innerHTML = ICON_SHARE;
    return btn;
  }

  function formatToday() {
    var d = new Date();
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  // ── Modal ─────────────────────────────────────────────────────────
  function openModal(view, meta) {
    // Detect Web Share API with file support (mobile + Chrome/Safari/Edge desktop).
    // We'll build the actual File from the blob later; the canShare probe needs
    // a placeholder File of the same type to return an accurate answer.
    var probeFile = new File([new Blob([""], { type: "image/png" })], "probe.png", { type: "image/png" });
    var webShareSupported =
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [probeFile] });

    var actionsHTML;
    if (webShareSupported) {
      actionsHTML =
        '<button class="cc-share-action" data-action="download" disabled>' + ICON_DOWNLOAD + '<span>Download</span></button>' +
        '<button class="cc-share-action" data-action="copy" disabled>' + ICON_COPY + '<span>Copy image</span></button>' +
        '<button class="cc-share-action" data-action="share" disabled>' + ICON_SHARE + '<span>Share…</span></button>';
    } else {
      actionsHTML =
        '<button class="cc-share-action" data-action="download" disabled>' + ICON_DOWNLOAD + '<span>Download</span></button>' +
        '<button class="cc-share-action" data-action="copy" disabled>' + ICON_COPY + '<span>Copy image</span></button>' +
        '<button class="cc-share-action" data-action="tweet" disabled>' + ICON_X + '<span>Tweet</span></button>' +
        '<button class="cc-share-action" data-action="linkedin" disabled>' + ICON_LINKEDIN + '<span>LinkedIn</span></button>';
    }

    var footerNote = webShareSupported
      ? "Share… opens your system share sheet so you can post the chart image directly to LinkedIn, X, Slack, Messages, etc."
      : "Tweet and LinkedIn auto-copy the image, then open the post dialog — paste with Cmd+V (Ctrl+V on Windows).";

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
    document.addEventListener("keydown", function escHandler(e) {
      if (e.key === "Escape") { close(); document.removeEventListener("keydown", escHandler); }
    });

    // Build branded PNG and wire actions
    buildBrandedPNG(view, meta)
      .then(function (result) {
        var previewWrap = bg.querySelector(".cc-share-preview");
        previewWrap.innerHTML = "";
        var img = document.createElement("img");
        img.src = result.dataURL;
        img.alt = meta.title;
        previewWrap.appendChild(img);

        // Enable all action buttons
        var buttons = bg.querySelectorAll(".cc-share-action");
        buttons.forEach(function (b) { b.disabled = false; });

        var dlBtn = bg.querySelector('[data-action="download"]');
        var cpBtn = bg.querySelector('[data-action="copy"]');
        var shareBtn = bg.querySelector('[data-action="share"]');
        var tw = bg.querySelector('[data-action="tweet"]');
        var li = bg.querySelector('[data-action="linkedin"]');
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
            // Pass ONLY files. Including text/url in the same share payload caused
            // some macOS share targets (notably LinkedIn) to attach the image twice
            // (once from the file, once from a URL-preview representation).
            navigator.share({ files: [file] })
              .catch(function (err) {
                if (err && err.name === "AbortError") return; // user cancelled
                console.warn("Web Share failed:", err);
                flashToast("Share dialog unavailable. Use Download or Copy.", 4000);
              });
          });
        }

        function copyThenOpen(intentURL) {
          copyToClipboard(result.blob)
            .then(function () {
              flashToast("Image copied — paste it into your post (Cmd+V / Ctrl+V).", 5000);
              setTimeout(function () { window.open(intentURL, "_blank", "noopener"); }, 350);
            })
            .catch(function (err) {
              console.warn("Auto-copy failed, opening dialog anyway:", err);
              flashToast("Couldn't auto-copy. Use Download then attach manually.", 4500);
              window.open(intentURL, "_blank", "noopener");
            });
        }

        if (tw) {
          tw.addEventListener("click", function () {
            copyThenOpen(
              "https://twitter.com/intent/tweet?" +
              "text=" + encodeURIComponent(meta.title + " — via consumercreditmatters.com") +
              "&url=" + encodeURIComponent(meta.url)
            );
          });
        }
        if (li) {
          li.addEventListener("click", function () {
            copyThenOpen(
              "https://www.linkedin.com/sharing/share-offsite/?url=" +
              encodeURIComponent(meta.url)
            );
          });
        }
      })
      .catch(function (err) {
        console.error("Branded PNG render failed:", err);
        var previewWrap = bg.querySelector(".cc-share-preview");
        previewWrap.innerHTML = '<div class="cc-share-preview-loading" style="color:#dc2626;flex-direction:column;gap:8px;padding:24px;font-family:monospace;font-size:11px;line-height:1.4;text-align:left;align-items:flex-start;white-space:pre-wrap;">PNG render failed:\n' + (err && err.message ? err.message : String(err)) + '\n\nLOGO_URL=' + LOGO_URL + '</div>';
      });
  }

  function copyToClipboard(blob) {
    if (!navigator.clipboard || !window.ClipboardItem) {
      return Promise.reject(new Error("Clipboard API not supported in this browser"));
    }
    return navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  }

  function slugify(s) {
    return (s || "chart").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  // ── Branded PNG compositor ────────────────────────────────────────
  function buildBrandedPNG(view, meta) {
    var chartPromise = view.toImageURL("png", 2)
      .then(function (url) { return loadImage(url); });
    var logoPromise = loadImage(LOGO_URL, false);

    return Promise.all([chartPromise, logoPromise]).then(function (parts) {
      var chartImg = parts[0];
      var logoImg = parts[1];

      var canvas = document.createElement("canvas");
      canvas.width = FRAME_W;
      canvas.height = FRAME_H;
      var ctx = canvas.getContext("2d");

      // Cream background
      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 0, FRAME_W, FRAME_H);

      // Header bar — logo on left, title on right
      var logoH = 56;
      var logoW = (logoImg.width / logoImg.height) * logoH;
      var logoY = (HEADER_H - logoH) / 2;
      if (logoImg.complete && logoImg.naturalWidth) {
        ctx.drawImage(logoImg, PAD_X, logoY, logoW, logoH);
      }

      // Title (right of logo, vertically centered in header)
      ctx.fillStyle = INK;
      ctx.font = '600 26px Inter, system-ui, -apple-system, sans-serif';
      ctx.textBaseline = "middle";
      var titleX = PAD_X + logoW + 28;
      var maxTitleWidth = FRAME_W - titleX - PAD_X;
      var title = truncateToWidth(ctx, meta.title, maxTitleWidth);
      ctx.fillText(title, titleX, HEADER_H / 2);

      // Subtle divider under header
      ctx.strokeStyle = "#ECE9DD";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD_X, HEADER_H);
      ctx.lineTo(FRAME_W - PAD_X, HEADER_H);
      ctx.stroke();

      // Chart area — fit-to-box, preserve aspect
      var chartBoxX = PAD_X;
      var chartBoxY = HEADER_H + 16;
      var chartBoxW = FRAME_W - 2 * PAD_X;
      var chartBoxH = FRAME_H - HEADER_H - FOOTER_H - 32;
      var fitted = fitContain(chartImg.width, chartImg.height, chartBoxW, chartBoxH);
      ctx.drawImage(
        chartImg,
        chartBoxX + (chartBoxW - fitted.w) / 2,
        chartBoxY + (chartBoxH - fitted.h) / 2,
        fitted.w, fitted.h
      );

      // Footer — URL on left, date on right
      var footerY = FRAME_H - FOOTER_H + FOOTER_H / 2;
      ctx.strokeStyle = "#ECE9DD";
      ctx.beginPath();
      ctx.moveTo(PAD_X, FRAME_H - FOOTER_H);
      ctx.lineTo(FRAME_W - PAD_X, FRAME_H - FOOTER_H);
      ctx.stroke();

      ctx.fillStyle = BLUE;
      ctx.font = '600 16px Inter, system-ui, -apple-system, sans-serif';
      ctx.textAlign = "left";
      ctx.fillText(FOOTER_URL, PAD_X, footerY);

      ctx.fillStyle = MUTED;
      ctx.font = '400 14px Inter, system-ui, -apple-system, sans-serif';
      ctx.textAlign = "right";
      ctx.fillText("Data as of " + meta.asof, FRAME_W - PAD_X, footerY);
      ctx.textAlign = "left"; // reset

      var dataURL = canvas.toDataURL("image/png");
      return new Promise(function (resolve) {
        canvas.toBlob(function (blob) {
          resolve({ dataURL: dataURL, blob: blob });
        }, "image/png");
      });
    });
  }

  function fitContain(srcW, srcH, boxW, boxH) {
    var srcRatio = srcW / srcH;
    var boxRatio = boxW / boxH;
    if (srcRatio > boxRatio) {
      return { w: boxW, h: boxW / srcRatio };
    } else {
      return { w: boxH * srcRatio, h: boxH };
    }
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
      img.onerror = function (e) { reject(new Error("Image load failed: " + src)); };
      img.src = src;
    });
  }

  // Expose
  window.ChartShare = ChartShare;
})();
