/**
 * Kamalish Portfolio - shared traffic tracker
 *
 * Every visitor's browser increments public counters on a free, no-signup
 * counter API (countapi.mileshilliard.com), so the /analytics/ dashboard
 * sees traffic from everyone, not just the browser it is opened in.
 *
 * No cookies, no IP addresses, no personal data: only anonymous counts.
 * Keys are listed in KamalishTrackerKeys so the dashboard can read them.
 */
(function () {
  'use strict';

  var API = 'https://countapi.mileshilliard.com/api/v1/';
  var PREFIX = 'kamalish07_pf_';

  // ----------------------------------------------------- shared definitions
  var SOURCES = ['direct', 'linkedin', 'google', 'github', 'twitter', 'whatsapp',
                 'instagram', 'facebook', 'bing', 'other'];
  var DEVICES = ['desktop', 'mobile', 'tablet'];
  var BROWSERS = ['chrome', 'safari', 'edge', 'firefox', 'samsung', 'opera', 'other'];
  var REGIONS = ['india', 'usa_canada', 'uk', 'europe', 'middle_east',
                 'singapore_sea', 'asia_other', 'australia_nz', 'other'];
  var PAGES = ['home', 'case_studies', 'software', 'software_item', 'wireframes'];

  function slug(s) {
    return String(s || '').toLowerCase().replace(/\.pdf$/, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48) || 'unknown';
  }

  // Calendar day in IST, so the dashboard's days match the owner's clock.
  function dayKey(date) {
    var d = date || new Date();
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })
        .format(d).replace(/-/g, '');
    } catch (e) {
      return d.toISOString().slice(0, 10).replace(/-/g, '');
    }
  }

  // Exposed for the dashboard (it must read exactly what this file writes).
  window.KamalishTrackerKeys = {
    api: API, prefix: PREFIX, slug: slug, dayKey: dayKey,
    sources: SOURCES, devices: DEVICES, browsers: BROWSERS,
    regions: REGIONS, pages: PAGES
  };

  // ------------------------------------------------------------ guards
  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }
  function sget(kind, k) { try { return store(kind).getItem(k); } catch (e) { return null; } }
  function sset(kind, k, v) { try { store(kind).setItem(k, v); } catch (e) {} }

  var ua = navigator.userAgent || '';
  var isBot = navigator.webdriver ||
    /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|quora link/i.test(ua);
  var isOwner = sget('localStorage', 'kmpf_ignore') === '1';
  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/.test(location.hostname) ||
    location.protocol === 'file:';
  // Local previews only count when explicitly opted in (for testing).
  var allowLocal = sget('localStorage', 'kmpf_count_local') === '1';

  var enabled = !isBot && !isOwner && (!isLocal || allowLocal);

  function hit(key) {
    if (!enabled) return;
    var url = API + 'hit/' + PREFIX + key;
    try {
      if (window.fetch) {
        fetch(url, { mode: 'cors', keepalive: true, cache: 'no-store' }).catch(function () {});
      } else {
        new Image().src = url;
      }
    } catch (e) {}
  }

  // ------------------------------------------------------- classifiers
  function device() {
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'tablet';
    if (/Mobi|iP(hone|od)|Android|BlackBerry|IEMobile|Opera M(obi|ini)/i.test(ua)) return 'mobile';
    // iPadOS reports itself as Mac
    if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'tablet';
    return 'desktop';
  }

  function browser() {
    if (/SamsungBrowser/.test(ua)) return 'samsung';
    if (/OPR\/|Opera/.test(ua)) return 'opera';
    if (/Edg\//.test(ua)) return 'edge';
    if (/Firefox|FxiOS/.test(ua)) return 'firefox';
    if (/Chrome|CriOS/.test(ua)) return 'chrome';
    if (/Safari/.test(ua)) return 'safari';
    return 'other';
  }

  function region() {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    if (/^Asia\/(Kolkata|Calcutta)$/.test(tz)) return 'india';
    if (/^America\/|^Canada\/|^US\//.test(tz)) return 'usa_canada';
    if (/^Europe\/(London|Belfast)$|^GB/.test(tz)) return 'uk';
    if (/^Europe\//.test(tz)) return 'europe';
    if (/^Asia\/(Dubai|Riyadh|Qatar|Bahrain|Kuwait|Muscat|Jerusalem|Tel_Aviv)$/.test(tz)) return 'middle_east';
    if (/^Asia\/(Singapore|Kuala_Lumpur|Jakarta|Bangkok|Manila|Ho_Chi_Minh|Saigon)$/.test(tz)) return 'singapore_sea';
    if (/^Asia\//.test(tz)) return 'asia_other';
    if (/^Australia\/|^Pacific\/Auckland$/.test(tz)) return 'australia_nz';
    return 'other';
  }

  function source() {
    var params;
    try { params = new URLSearchParams(location.search); } catch (e) { params = null; }
    var utm = params && (params.get('utm_source') || params.get('ref') || params.get('source'));
    var ref = sget('sessionStorage', 'kmpf_ref');   // set by redirect pages
    if (ref === null) ref = document.referrer || '';
    var host = '';
    if (utm) {
      host = String(utm).toLowerCase();
    } else if (ref) {
      try { host = new URL(ref).hostname.toLowerCase(); } catch (e) { host = ''; }
      if (host === location.hostname) host = '';
    }
    if (!host) return 'direct';
    if (/linkedin|lnkd\.in/.test(host)) return 'linkedin';
    if (/google/.test(host)) return 'google';
    if (/github/.test(host)) return 'github';
    if (/twitter|^t\.co$|x\.com/.test(host)) return 'twitter';
    if (/whatsapp|wa\.me/.test(host)) return 'whatsapp';
    if (/instagram/.test(host)) return 'instagram';
    if (/facebook|fb\.com|^fb$/.test(host)) return 'facebook';
    if (/bing|duckduckgo|yahoo/.test(host)) return 'bing';
    return 'other';
  }

  function pageName() {
    var p = location.pathname.replace(/index\.html$/, '');
    if (/\/analytics\/?$/.test(p) || /\/admin\/?$/.test(p)) return null;
    if (/\/work\/case-studies\/?$/.test(p)) return 'case_studies';
    if (/\/work\/software\/item(\.html)?$/.test(p)) return 'software_item';
    if (/\/work\/software\/?$/.test(p)) return 'software';
    if (/\/work\/wireframes\/?$/.test(p)) return 'wireframes';
    if (/\/$/.test(p) && !/\/work\//.test(p)) return 'home';
    return null;
  }

  function softwareSlug() {
    var s = '';
    try {
      s = decodeURIComponent((location.hash || '').replace(/^#/, '')) ||
          new URLSearchParams(location.search).get('s') || '';
    } catch (e) {}
    return s ? slug(s) : '';
  }

  // ---------------------------------------------------------- pageview
  function trackPageView() {
    var page = pageName();
    if (!page) return;
    var today = dayKey();

    hit('pv_total');
    hit('pv_day_' + today);
    hit('page_' + page);

    // Unique visitor (ever) and unique visitor per day
    if (!sget('localStorage', 'kmpf_vid')) {
      sset('localStorage', 'kmpf_vid', '1');
      hit('uv_total');
    }
    if (sget('localStorage', 'kmpf_lastday') !== today) {
      sset('localStorage', 'kmpf_lastday', today);
      hit('uv_day_' + today);
    }

    // Session (one per tab visit): source, device, browser, region
    if (!sget('sessionStorage', 'kmpf_sid')) {
      sset('sessionStorage', 'kmpf_sid', '1');
      hit('ss_total');
      hit('ss_day_' + today);
      hit('src_' + source());
      hit('dev_' + device());
      hit('br_' + browser());
      hit('geo_' + region());
    }
    try { sessionStorage.removeItem('kmpf_ref'); } catch (e) {}

    if (page === 'software_item') trackSoftware();
  }

  var lastSoftware = '';
  function trackSoftware() {
    var s = softwareSlug();
    if (!s || s === lastSoftware) return;
    lastSoftware = s;
    hit('sw_' + s);
  }

  // ------------------------------------------------------- click events
  function trackClicks() {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') return;

      var abs;
      try { abs = new URL(href, location.href); } catch (err) { return; }
      var path = abs.pathname.toLowerCase();

      if (/resume[^/]*\.pdf$/.test(path)) { hit('ev_resume'); return; }
      if (/\/decks\/[^/]+\.pdf$/.test(path)) {
        hit('ev_deck');
        hit('deck_' + slug(path.split('/').pop()));
        return;
      }
      if (abs.protocol === 'mailto:') { hit('ev_email'); return; }
      if (abs.protocol === 'tel:') { hit('ev_phone'); return; }
      if (/linkedin\.com$/.test(abs.hostname)) { hit('ev_linkedin'); return; }

      // External link from a software page = live demo / product visit
      if (abs.hostname && abs.hostname !== location.hostname &&
          pageName() === 'software_item') {
        hit('ev_demo');
        var s = softwareSlug();
        if (s) hit('demo_' + s);
      }
    }, true);
  }

  // -------------------------------------------------------------- init
  function init() {
    trackPageView();
    trackClicks();
    window.addEventListener('hashchange', function () {
      if (pageName() === 'software_item') {
        hit('pv_total');
        hit('pv_day_' + dayKey());
        hit('page_software_item');
        trackSoftware();
      }
    });
  }

  if (!/\/analytics\/?(index\.html)?$/.test(location.pathname)) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
})();
