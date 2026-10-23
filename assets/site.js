(function () {
  var root = document.documentElement;
  // Must match BREAK in convert.py. Below it the 320px mobile design is used.
  var BREAK = 1024, DESKTOP = 1200, MOBILE = 320;
  // Tablets show the mobile design; cap its zoom so it doesn't become huge.
  var MOBILE_MAX_SCALE = 1.6;
  // Text may shrink by at most this much to fit its box.
  var MIN_FIT = 0.82;
  var lastMode = null;

  // Scale the fixed-width design canvases to the window (Showit behaviour).
  function layout() {
    var vw = root.clientWidth, vh = window.innerHeight;
    var mobile = vw < BREAK;
    var w = mobile ? MOBILE : DESKTOP;
    var s = mobile ? Math.min(vw / MOBILE, MOBILE_MAX_SCALE) : Math.min(1, vw / DESKTOP);
    root.style.setProperty("--s", s);
    root.style.setProperty("--ext", Math.max(0, (vw / s - w) / 2) + "px");
    root.style.setProperty("--vhc", vh / s + "px");
    var mode = mobile ? "m" : "d";
    if (mode !== lastMode) {
      lastMode = mode;
      fitText();
    }
  }

  // Browsers measure fonts slightly differently from Showit's editor, so text that fit
  // in the editor can overflow its box. Shrink it a little until it fits; if it still
  // doesn't (e.g. a long email address), let it wrap instead of running off screen.
  function overflows(t) {
    return t.scrollWidth > t.clientWidth + 1 || t.scrollHeight > t.clientHeight + 2;
  }

  function fitText() {
    var items = document.querySelectorAll(".tx");
    for (var i = 0; i < items.length; i++) {
      var t = items[i];
      t.style.fontSize = "";
      t.style.whiteSpace = "";
      t.style.overflowWrap = "";
      t.style.letterSpacing = "";
      if (!t.offsetParent || !t.clientWidth || !overflows(t)) continue;
      var cs = getComputedStyle(t);
      var base = parseFloat(cs.fontSize);
      var size = base;
      while (size > base * MIN_FIT && overflows(t)) {
        size -= base * 0.02;
        t.style.fontSize = size + "px";
      }
      if (overflows(t) && !/\s/.test(t.textContent.trim())) {
        // A single word (e.g. "01.") broke across lines; keep it whole.
        t.style.whiteSpace = "nowrap";
      } else if (t.scrollWidth > t.clientWidth + 1) {
        t.style.whiteSpace = "normal";
        t.style.overflowWrap = "anywhere";
      }
    }
  }

  layout();
  window.addEventListener("resize", layout);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitText);
  }
  window.addEventListener("load", fitText);

  function findBlock(id) {
    return document.querySelector('.blk[data-id="' + id + '"]') ||
      document.querySelector('.blk[data-pid="' + id + '"]');
  }

  function setState(block, next, noLoop) {
    var count = +block.dataset.states || 0;
    if (!count) return;
    if (next >= count || next < 0) {
      if (noLoop) return;
      next = (next + count) % count;
    }
    block.dataset.state = next;
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-act]");
    if (!a) return;
    e.preventDefault();
    var block = findBlock(a.dataset.target) || a.closest(".blk");
    if (!block) return;
    if (a.dataset.act === "toggle") {
      block.classList.toggle("shown");
    } else if (a.dataset.act === "state") {
      setState(block, +a.dataset.state, a.dataset.noloop);
    }
  });

  // Close an open overlay (e.g. the mobile menu) when one of its page links is used.
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href]:not([data-act])");
    var shown = a && a.closest(".blk.shown");
    if (shown) shown.classList.remove("shown");
  });

  document.querySelectorAll(".blk[data-aav]").forEach(function (block) {
    setInterval(function () {
      setState(block, (+block.dataset.state || 0) + 1);
    }, +block.dataset.aav * 1000);
  });

  // Parallax backgrounds (Showit bgScroll "x"): the image layer is twice the window
  // height and moves at half the scroll speed, anchored per its vertical position
  // (b = bottom edge aligned when the block reaches the top of the window,
  //  m = centred when the block is centred, t = top aligned when the block's
  //  bottom reaches the bottom of the window). Measured from Showit's runtime.
  var plx = [];
  function collectParallax() {
    plx = [];
    document.querySelectorAll(".blk").forEach(function (block) {
      var img = block.querySelector(":scope>.bg>.bgi");
      var cs = getComputedStyle(block);
      var on = cs.getPropertyValue("--px").trim() === "1" && getComputedStyle(img).display !== "none";
      img.classList.toggle("plx", on);
      if (!on) {
        img.style.transform = "";
        img.style.height = "";
        return;
      }
      plx.push({ block: block, img: img, anchor: cs.getPropertyValue("--py").replace(/['"\s]/g, "") || "m" });
    });
    parallax();
  }

  function parallax() {
    var vh = window.innerHeight;
    for (var i = 0; i < plx.length; i++) {
      var p = plx[i];
      var r = p.block.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;
      var h = r.height, imgH = Math.max(2 * vh, h * 1.5);
      var ty;
      if (p.anchor === "b") ty = -(imgH - h) - 0.5 * r.top;
      else if (p.anchor === "t") ty = -0.5 * (r.top - (vh - h));
      else ty = (h - imgH) / 2 - 0.5 * (r.top - (vh - h) / 2);
      p.img.style.height = imgH + "px";
      p.img.style.transform = "translate3d(0," + ty + "px,0)";
    }
  }

  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; parallax(); });
  }, { passive: true });
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // Which blocks use parallax depends on the layout (desktop vs mobile settings).
    window.addEventListener("resize", collectParallax);
    window.addEventListener("load", collectParallax);
    window.matchMedia("(min-width: " + BREAK + "px)").addEventListener("change", collectParallax);
    collectParallax();
  }
})();
