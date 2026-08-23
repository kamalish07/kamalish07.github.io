/* =============================================================
   Content layer - loads content/site.json and renders each page.
   A draft saved by /admin/ (localStorage) overrides the file so
   you can preview edits before publishing.
   ============================================================= */
(function () {
  'use strict';

  var DRAFT_KEY = 'kamalish.site.draft';
  var root = document.body.getAttribute('data-root') || '';
  var page = document.body.getAttribute('data-page') || '';

  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };
  // asset paths in JSON are stored relative to the site root
  var url = function (p) {
    if (!p) return '';
    if (/^(https?:|data:|mailto:|tel:|\/)/.test(p)) return p;
    return root + p;
  };
  var $ = function (s) { return document.querySelector(s); };
  var setText = function (sel, v) { var e = $(sel); if (e) e.textContent = v; };
  var setHref = function (sel, v) { var e = $(sel); if (e) e.setAttribute('href', v); };

  window.SiteContent = {
    DRAFT_KEY: DRAFT_KEY,
    load: function () {
      var draft = null;
      try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) {}
      if (draft) return Promise.resolve(draft);
      return fetch(root + 'content/site.json', { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error('content/site.json ' + r.status);
        return r.json();
      });
    }
  };

  if (!page) return;                       // admin page renders itself

  window.SiteContent.load().then(function (d) {
    renderChrome(d);
    if (page === 'home')       renderHome(d);
    if (page === 'software')   renderSoftwareList(d);
    if (page === 'decks')      renderDecks(d);
    if (page === 'wireframes') renderWireframes(d);
    if (page === 'item') {
      renderItem(d);
      // prev/next are in-page hash links - re-render instead of reloading
      window.addEventListener('hashchange', function () {
        renderItem(d);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.dispatchEvent(new CustomEvent('content:rendered'));
      });
    }
    document.dispatchEvent(new CustomEvent('content:rendered'));
  }).catch(function (err) {
    console.error('[content]', err);
    var m = $('[data-render-error]');
    if (m) m.hidden = false;
  });

  /* ------------------------------------------------- shared chrome */
  function renderChrome(d) {
    var p = d.profile || {};
    document.querySelectorAll('[data-bind="email"]').forEach(function (e) {
      e.setAttribute('href', 'mailto:' + p.email);
      if (e.hasAttribute('data-bind-text')) e.textContent = p.email;
    });
    document.querySelectorAll('[data-bind="phone"]').forEach(function (e) {
      e.setAttribute('href', 'tel:' + (p.phoneHref || p.phone || '').replace(/\s/g, ''));
      if (e.hasAttribute('data-bind-text')) e.textContent = p.phone;
    });
    document.querySelectorAll('[data-bind="linkedin"]').forEach(function (e) {
      e.setAttribute('href', p.linkedin || '#');
    });
    document.querySelectorAll('[data-bind="resume"]').forEach(function (e) {
      e.setAttribute('href', url(p.resume));
    });
    var shout = $('[data-bind="footerShout"]');
    if (shout && p.footerShout) shout.innerHTML = esc(p.footerShout).replace(/\n/g, '<br />');
  }

  /* ------------------------------------------------------- home */
  function renderHome(d) {
    var p = d.profile || {};
    setText('[data-bind="eyebrowText"]', p.eyebrow || '');
    setText('[data-bind="name"]', p.name || '');
    setText('[data-bind="headline"]', p.headline || '');
    setText('[data-bind="intro"]', p.intro || '');
    var img = $('[data-bind="portrait"]');
    if (img) { img.src = url(p.portrait); img.alt = 'Portrait of ' + (p.name || ''); }

    var caps = $('[data-list="capabilities"]');
    if (caps) caps.innerHTML = (d.capabilities || []).map(function (c) {
      return '<li><span class="capabilities__key">' + esc(c.key) + '</span>' +
             '<b>' + esc(c.title) + '</b><i>' + esc(c.desc) + '</i></li>';
    }).join('');

    var tools = $('[data-list="toolkit"]');
    if (tools) tools.innerHTML = (d.toolkit || []).map(function (t) {
      return '<li>' + esc(t) + '</li>';
    }).join('');

    var cards = $('[data-list="software"]');
    if (cards) cards.innerHTML = (d.software || []).slice(0, 3).map(function (s, i) {
      var href = root + 'work/software/item.html?s=' + encodeURIComponent(s.slug);
      return '' +
      '<article class="card card--' + esc(s.colour || 'yellow') + ' reveal" data-reveal data-reveal-delay="' + i + '">' +
        '<div class="card__top"><span class="card__num">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="card__kind">' + esc(s.badge || '') + '</span></div>' +
        '<a class="card__media" href="' + href + '"><img src="' + url(s.cover) + '" alt="' + esc(s.title) + '" loading="lazy" /></a>' +
        '<h3 class="card__title">' + esc(s.title) + '</h3>' +
        '<p class="card__desc">' + esc(s.cardDesc || s.summary) + '</p>' +
        '<ul class="tags">' + (s.tags || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
        '<a class="card__link" href="' + href + '">View software <span aria-hidden="true">&rarr;</span></a>' +
      '</article>';
    }).join('');

    var tl = $('[data-list="experience"]');
    if (tl) tl.innerHTML = (d.experience || []).map(function (x) {
      return '' +
      '<article class="exp-row reveal" data-reveal>' +
        '<div class="exp-row__when"><span>' + esc(x.from) + '</span><i>-</i><span>' + esc(x.to) + '</span></div>' +
        '<div class="exp-row__body">' +
          '<h3 class="exp-row__role">' + esc(x.role) + '</h3>' +
          '<p class="exp-row__org">' + esc(x.org) + '</p>' +
          '<p class="exp-row__text">' + esc(x.text) + '</p>' +
          '<ul class="tags">' + (x.tags || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
        '</div>' +
      '</article>';
    }).join('');

    var st = $('[data-list="stats"]');
    if (st) st.innerHTML = (d.stats || []).map(function (s, i) {
      return '<li class="stat reveal" data-reveal data-reveal-delay="' + i + '">' +
             '<b data-count="' + esc(s.value) + '" data-prefix="' + esc(s.prefix || '') + '" data-suffix="' + esc(s.suffix || '') + '">0</b>' +
             '<span>' + esc(s.label) + '</span></li>';
    }).join('');
  }

  /* ---------------------------------------------- software list */
  function renderSoftwareList(d) {
    var g = $('[data-list="softwareGrid"]');
    if (!g) return;
    g.innerHTML = (d.software || []).map(function (s, i) {
      return '' +
      '<a class="tile reveal" data-reveal data-reveal-delay="' + i + '" href="item.html#' + encodeURIComponent(s.slug) + '">' +
        '<div class="tile__media"><img src="' + url(s.cover) + '" alt="' + esc(s.title) + '" /></div>' +
        '<span class="tile__badge">' + esc(s.badge || '') + '</span>' +
        '<h2 class="tile__title">' + esc(s.title) + '</h2>' +
        '<p class="tile__desc">' + esc(s.cardDesc || s.summary) + '</p>' +
        '<span class="tile__go">Open <span aria-hidden="true">&rarr;</span></span>' +
      '</a>';
    }).join('');
  }

  /* -------------------------------------------- software detail */
  function renderItem(d) {
    // Hash routing: fragments survive server redirects (e.g. clean-URL
    // rewrites that strip query strings). ?s= kept for older links.
    var slug = decodeURIComponent((location.hash || '').replace(/^#/, '')) ||
               new URLSearchParams(location.search).get('s');
    var list = d.software || [];
    var s = list.filter(function (x) { return x.slug === slug; })[0] || list[0];
    if (!s) return;

    document.title = s.title + ' - Kamalish';
    setText('[data-bind="itemKind"]', s.kind || '');
    setText('[data-bind="itemTitle"]', s.title || '');
    setText('[data-bind="itemSummary"]', s.summary || '');
    var cover = $('[data-bind="itemCover"]');
    if (cover) { cover.src = url(s.cover); cover.alt = s.title; }

    setText('[data-bind="itemProblem"]', s.problem || '');
    setText('[data-bind="itemRole"]', s.role || '');

    var ul = $('[data-list="itemShipped"]');
    if (ul) ul.innerHTML = (s.shipped || []).map(function (b) {
      return '<li>' + esc(b) + '</li>';
    }).join('');

    var box = $('[data-bind="itemLinkbox"]');
    if (box) {
      if (s.link) {
        box.innerHTML =
          '<span class="linkbox__label">Live website</span>' +
          '<a class="btn btn--dark" href="' + esc(s.link) + '" target="_blank" rel="noopener">' +
          esc(s.linkLabel || 'Visit the site') + ' <span aria-hidden="true">&#8599;</span></a>' +
          (s.linkNote ? '<code>' + esc(s.linkNote) + '</code>' : '');
      } else {
        box.innerHTML =
          '<span class="linkbox__label">Live website</span>' +
          '<code>' + esc(s.linkNote || 'link to be added') + '</code>';
        box.classList.add('linkbox--empty');
      }
    }

    var fl = $('[data-list="itemFacts"]');
    if (fl) fl.innerHTML = (s.facts || []).map(function (f) {
      return '<div><dt>' + esc(f.k) + '</dt><dd>' + esc(f.v) + '</dd></div>';
    }).join('');

    // prev / next
    var i = list.indexOf(s);
    var nav = $('[data-bind="itemNav"]');
    if (nav && list.length > 1) {
      var prev = list[(i - 1 + list.length) % list.length];
      var next = list[(i + 1) % list.length];
      nav.innerHTML =
        '<a class="pager pager--prev" href="#' + encodeURIComponent(prev.slug) + '">' +
        '<span>Previous</span><b>' + esc(prev.title) + '</b></a>' +
        '<a class="pager pager--next" href="#' + encodeURIComponent(next.slug) + '">' +
        '<span>Next</span><b>' + esc(next.title) + '</b></a>';
    }
  }

  /* ------------------------------------------------------ decks */
  function renderDecks(d) {
    var g = $('[data-list="decks"]');
    if (!g) return;
    g.innerHTML = (d.decks || []).map(function (k, i) {
      var inner =
        '<div class="tile__media"><img src="' + url(k.cover) + '" alt="' + esc(k.title) + '" /></div>' +
        '<span class="tile__badge">' + esc(k.badge || '') + '</span>' +
        '<h2 class="tile__title">' + esc(k.title) + '</h2>' +
        '<p class="tile__desc">' + esc(k.desc || '') + '</p>';
      if (k.file) {
        return '<a class="tile reveal" data-reveal data-reveal-delay="' + i + '" href="' + url(k.file) +
               '" target="_blank" rel="noopener">' + inner +
               '<span class="tile__go">Open deck <span aria-hidden="true">&#8599;</span></span></a>';
      }
      return '<article class="tile reveal" data-reveal data-reveal-delay="' + i + '">' + inner +
             '<span class="empty" style="padding:12px;font-size:13px">Deck file to be added</span></article>';
    }).join('');
  }

  /* ------------------------------------------------- wireframes */
  function renderWireframes(d) {
    var w = d.wireframes || {};
    var tile = function (t, cls) {
      var inner =
        '<div class="tile__media"><img src="' + url(t.image) + '" alt="' + esc(t.title) + '" /></div>' +
        '<span class="tile__badge">' + esc(t.badge || '') + '</span>' +
        '<h3 class="tile__title">' + esc(t.title) + '</h3>' +
        '<p class="tile__desc">' + esc(t.desc || '') + '</p>';
      // a sheet/PDF turns the tile into a link
      if (t.file) {
        return '<a class="tile ' + (cls || '') + ' reveal" data-reveal href="' + url(t.file) +
               '" target="_blank" rel="noopener">' + inner +
               '<span class="tile__go">Open sheets <span aria-hidden="true">&#8599;</span></span></a>';
      }
      return '<article class="tile ' + (cls || '') + ' reveal" data-reveal>' + inner + '</article>';
    };
    var b = $('[data-list="wfBuilt"]');
    if (b) b.innerHTML = (w.built || []).map(function (t) { return tile(t, ''); }).join('');
    var s = $('[data-list="wfSketches"]');
    if (s) s.innerHTML = (w.sketches || []).map(function (t) { return tile(t, 'sketch'); }).join('');
  }
})();
