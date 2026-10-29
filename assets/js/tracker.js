/**
 * Kamalish Portfolio - Lightweight Privacy-Friendly Analytics Tracker
 * Automatically tracks page views, referrers, device types, and key conversions
 * (e.g. Resume downloads, Case Study deck views, live project demos).
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'kamalish_analytics_v1';
  var GA_KEY = 'kamalish_ga4_id';

  // 1. Generate or retrieve persistent Visitor ID
  var visitorId = localStorage.getItem('kamalish_vid');
  if (!visitorId) {
    visitorId = 'v_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem('kamalish_vid', visitorId);
  }

  // 2. Session ID (expires when tab/browser closes)
  var sessionId = sessionStorage.getItem('kamalish_sid');
  var isNewSession = false;
  if (!sessionId) {
    sessionId = 's_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    sessionStorage.setItem('kamalish_sid', sessionId);
    isNewSession = true;
  }

  // 3. Detect Device & Browser
  function getDeviceType() {
    var ua = navigator.userAgent || '';
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'Tablet';
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
      return 'Mobile';
    }
    return 'Desktop';
  }

  function getBrowser() {
    var ua = navigator.userAgent;
    if (ua.indexOf('Firefox') > -1) return 'Firefox';
    if (ua.indexOf('SamsungBrowser') > -1) return 'Samsung Browser';
    if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) return 'Opera';
    if (ua.indexOf('Trident') > -1) return 'IE';
    if (ua.indexOf('Edge') > -1 || ua.indexOf('Edg') > -1) return 'Edge';
    if (ua.indexOf('Chrome') > -1) return 'Chrome';
    if (ua.indexOf('Safari') > -1) return 'Safari';
    return 'Other';
  }

  // 4. Normalize Referrer
  function categorizeReferrer(ref) {
    if (!ref) {
      // Check UTM tags
      var params = new URLSearchParams(window.location.search);
      if (params.get('utm_source')) {
        return params.get('utm_source').toUpperCase();
      }
      return 'Direct';
    }
    try {
      var hostname = new URL(ref).hostname.toLowerCase();
      if (hostname.indexOf('linkedin') > -1 || hostname.indexOf('lnkd.in') > -1) return 'LinkedIn';
      if (hostname.indexOf('google') > -1) return 'Google';
      if (hostname.indexOf('github') > -1) return 'GitHub';
      if (hostname.indexOf('twitter') > -1 || hostname.indexOf('t.co') > -1 || hostname.indexOf('x.com') > -1) return 'Twitter / X';
      if (hostname.indexOf('whatsapp') > -1) return 'WhatsApp';
      if (hostname.indexOf('instagram') > -1) return 'Instagram';
      if (hostname.indexOf('facebook') > -1) return 'Facebook';
      if (hostname.indexOf(window.location.hostname) > -1) return 'Internal';
      return hostname.replace(/^www\./, '');
    } catch (e) {
      return 'Direct';
    }
  }

  // 5. Data store access
  function getAnalyticsData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      created: Date.now(),
      pageviews: 0,
      uniqueVisitors: {},
      sessions: {},
      pages: {},
      referrers: {},
      devices: { Desktop: 0, Mobile: 0, Tablet: 0 },
      events: [],
      history: [] // Last 100 log entries
    };
  }

  function saveAnalyticsData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      // Dispatch custom event for real-time dashboard updates
      window.dispatchEvent(new CustomEvent('kamalish_analytics_update', { detail: data }));
    } catch (e) {}
  }

  // 6. Record Page View
  function trackPageView() {
    var path = window.location.pathname || '/';
    // Normalize path for GitHub Pages
    if (path.indexOf('index.html') > -1) path = path.replace('index.html', '');
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    if (!path) path = '/';

    var referrer = categorizeReferrer(document.referrer);
    var device = getDeviceType();
    var browser = getBrowser();
    var title = document.title || 'Kamalish Portfolio';

    var data = getAnalyticsData();
    data.pageviews = (data.pageviews || 0) + 1;
    data.uniqueVisitors[visitorId] = (data.uniqueVisitors[visitorId] || 0) + 1;
    data.sessions[sessionId] = (data.sessions[sessionId] || 0) + 1;

    data.pages[path] = (data.pages[path] || 0) + 1;
    data.referrers[referrer] = (data.referrers[referrer] || 0) + 1;
    data.devices[device] = (data.devices[device] || 0) + 1;

    // Log item
    var item = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      type: 'pageview',
      path: path,
      title: title,
      referrer: referrer,
      device: device,
      browser: browser,
      timestamp: Date.now()
    };

    if (!data.history) data.history = [];
    data.history.unshift(item);
    if (data.history.length > 200) data.history.pop();

    saveAnalyticsData(data);
  }

  // 7. Record Custom Event (Download resume, view deck, click demo)
  function trackEvent(category, action, label) {
    var data = getAnalyticsData();
    if (!data.events) data.events = [];

    var eventItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      type: 'event',
      category: category,
      action: action,
      label: label || '',
      path: window.location.pathname,
      timestamp: Date.now()
    };

    data.events.unshift(eventItem);
    if (data.events.length > 200) data.events.pop();

    saveAnalyticsData(data);
  }

  // 8. Auto-track High-Value Clicks
  function setupClickTracking() {
    document.addEventListener('click', function(e) {
      var target = e.target.closest('a, button');
      if (!target) return;

      var href = target.getAttribute('href') || '';
      var text = (target.innerText || '').trim();

      // Resume download
      if (href.indexOf('Resume.pdf') > -1 || target.hasAttribute('download') || text.toLowerCase().indexOf('resume') > -1) {
        trackEvent('Conversion', 'Resume Download', href);
      }
      // Case study PDF deck opens
      else if (href.indexOf('.pdf') > -1 && href.indexOf('decks') > -1) {
        var deckName = href.split('/').pop().replace('.pdf', '');
        trackEvent('Case Study', 'Deck Opened', deckName);
      }
      // External project demos
      else if (href.indexOf('vercel.app') > -1 || href.indexOf('desk365.io') > -1) {
        trackEvent('Outbound Demo', 'Live Demo Visited', href);
      }
      // Social / contact
      else if (href.indexOf('linkedin.com') > -1) {
        trackEvent('Contact', 'LinkedIn Profile Click', href);
      } else if (href.indexOf('mailto:') > -1) {
        trackEvent('Contact', 'Email Click', href);
      }
    }, true);
  }

  // 9. Optional Google Analytics 4 forwarder
  function loadGoogleAnalyticsIfConfigured() {
    var gaId = localStorage.getItem(GA_KEY);
    if (!gaId || window.__ga_loaded) return;
    window.__ga_loaded = true;

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', gaId);
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      trackPageView();
      setupClickTracking();
      loadGoogleAnalyticsIfConfigured();
    });
  } else {
    trackPageView();
    setupClickTracking();
    loadGoogleAnalyticsIfConfigured();
  }

  // Expose global helper
  window.KamalishAnalytics = {
    getData: getAnalyticsData,
    trackEvent: trackEvent,
    resetData: function() {
      localStorage.removeItem(STORAGE_KEY);
    }
  };
})();
