/* =============================================================
   KAMALISH — interactions
   Native scroll + rAF-batched scroll work. No dependencies.
   ============================================================= */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* ---------------------------------------- reveal on scroll */
  var pending = [];

  // Safety net: IntersectionObserver callbacks are throttled (or never fire)
  // in tabs that are not compositing. Without this, content stays at
  // opacity:0 and the page looks blank. Never let that happen.
  function sweep() {
    if (!pending.length) return;
    var vh = window.innerHeight;
    pending = pending.filter(function (el) {
      if (el.classList.contains('is-in')) return false;
      // Anything at or above the fold gets revealed - including elements
      // already scrolled past, which IntersectionObserver never reports
      // when the page loads part-way down (deep link, restored scroll).
      if (el.getBoundingClientRect().top < vh * 0.92) {
        el.classList.add('is-in');
        return false;
      }
      return true;
    });
  }

  function reveals() {
    var items = $$('[data-reveal]:not([data-reveal-bound])');
    items.forEach(function (el) { el.setAttribute('data-reveal-bound', '1'); });
    items.forEach(function (el) {
      el.style.setProperty('--d', el.dataset.revealDelay || 0);
    });

    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    items.forEach(function (el) {
      // Already scrolled past: show it now, there is no entrance to play.
      if (el.getBoundingClientRect().bottom < 0) { el.classList.add('is-in'); return; }
      io.observe(el);
      pending.push(el);
    });
    setTimeout(sweep, 1000);
    setTimeout(sweep, 2500);
  }

  /* ---------------------------------------- animated counters */
  function counters() {
    var nums = $$('[data-count]:not([data-count-bound])');
    nums.forEach(function (el) { el.setAttribute('data-count-bound', '1'); });
    if (!nums.length) return;

    var run = function (el) {
      var target = parseFloat(el.dataset.count) || 0;
      var pre = el.dataset.prefix || '';
      var suf = el.dataset.suffix || '';
      if (reduced) { el.textContent = pre + target + suf; return; }

      var dur = 1400, t0 = null;
      var step = function (ts) {
        if (!t0) t0 = ts;
        var p = clamp((ts - t0) / dur, 0, 1);
        var eased = 1 - Math.pow(1 - p, 3);          // easeOutCubic
        el.textContent = pre + Math.round(target * eased) + suf;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    if (!('IntersectionObserver' in window)) { nums.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    nums.forEach(function (el) { io.observe(el); });
  }

  reveals();
  counters();

  // content.js injects markup asynchronously - bind the new nodes too
  document.addEventListener('content:rendered', function () {
    reveals();
    counters();
    onScroll();
  });

  /* ---------------------------------------- header: stick + auto-hide */
  var header = $('#header');
  var lastY = window.scrollY;

  function headerUpdate(y) {
    if (!header) return;
    header.classList.toggle('is-stuck', y > 12);
    var openMenu = header.querySelector('.nav-toggle[aria-expanded="true"]');
    if (!openMenu && y > 420 && y > lastY + 4) header.classList.add('is-hidden');
    else if (y < lastY - 4 || y < 200)         header.classList.remove('is-hidden');
    lastY = y;
  }

  /* ---------------------------------------- scroll-drawn flow line */
  var flowPath  = $('#flowPath');
  var flowStage = $('#flowStage');
  var pathLen   = 0;

  if (flowPath) {
    pathLen = flowPath.getTotalLength();
    flowPath.style.strokeDasharray = pathLen;
    flowPath.style.strokeDashoffset = reduced ? 0 : pathLen;
  }

  function flowUpdate() {
    if (!flowPath || !flowStage || reduced) return;
    var r = flowStage.getBoundingClientRect();
    var vh = window.innerHeight;
    // 0 when the stage top hits 85% of viewport, 1 when its bottom passes 35%
    var start = vh * 0.85;
    var end   = -r.height + vh * 0.35;
    var p = clamp((start - r.top) / (start - end), 0, 1);
    flowPath.style.strokeDashoffset = pathLen * (1 - p);
  }

  /* ---------------------------------------- timeline rail fill */
  var timeline = $('#timeline');
  var fill     = $('#timelineFill');

  function timelineUpdate() {
    if (!timeline || !fill) return;
    var r = timeline.getBoundingClientRect();
    var vh = window.innerHeight;
    var p = clamp((vh * 0.75 - r.top) / (r.height + vh * 0.25), 0, 1);
    fill.style.height = (p * 100).toFixed(2) + '%';
  }

  /* ---------------------------------------- nav scroll-spy */
  var links = $$('.nav__link');
  var targets = links
    .map(function (l) {
      var id = l.getAttribute('href');
      var sec = id && id.charAt(0) === '#' ? document.querySelector(id) : null;
      return sec ? { link: l, sec: sec } : null;
    })
    .filter(Boolean);

  function spyUpdate() {
    var y = window.scrollY + window.innerHeight * 0.34;
    var active = null;
    targets.forEach(function (t) {
      if (t.sec.offsetTop <= y) active = t.link;
    });
    links.forEach(function (l) { l.classList.toggle('is-active', l === active); });
  }

  /* ---------------------------------------- hero parallax */
  var portrait = $('.portrait');
  function parallaxUpdate(y) {
    if (!portrait || reduced || window.innerWidth < 1040) return;
    portrait.style.transform = 'translate3d(0,' + (y * -0.045).toFixed(2) + 'px,0)';
  }

  /* ---------------------------------------- one rAF loop for all of it */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      headerUpdate(y);
      flowUpdate();
      timelineUpdate();
      spyUpdate();
      parallaxUpdate(y);
      sweep();
      ticking = false;
    });
  }

  // sweep() runs outside the rAF batch on purpose: it is the fallback for
  // when rAF itself is throttled, so it must not depend on it.
  window.addEventListener('scroll', function () { sweep(); onScroll(); }, { passive: true });
  window.addEventListener('resize', function () {
    if (flowPath) {
      pathLen = flowPath.getTotalLength();
      flowPath.style.strokeDasharray = pathLen;
    }
    onScroll();
  }, { passive: true });
  onScroll();

  /* ---------------------------------------- pointer tilt on portrait */
  (function tilt() {
    var el = $('[data-tilt]');
    if (!el || reduced || !window.matchMedia('(pointer:fine)').matches) return;
    var frame = el.querySelector('.portrait__frame');
    if (!frame) return;

    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      frame.style.transform =
        'perspective(900px) rotateY(' + (x * 9).toFixed(2) + 'deg) rotateX(' + (-y * 9).toFixed(2) + 'deg)';
    });
    el.addEventListener('pointerleave', function () {
      frame.style.transition = 'transform .5s cubic-bezier(.34,1.56,.64,1)';
      frame.style.transform = '';
      setTimeout(function () { frame.style.transition = ''; }, 520);
    });
  })();

  /* ---------------------------------------- mobile menu */
  (function menu() {
    var btn = $('#navToggle');
    var panel = $('#mobileNav');
    if (!btn || !panel) return;

    var setOpen = function (open) {
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      panel.hidden = !open;
      if (open) header.classList.remove('is-hidden');
    };

    btn.addEventListener('click', function () {
      setOpen(btn.getAttribute('aria-expanded') !== 'true');
    });
    panel.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 860) setOpen(false);
    });
  })();

})();
