/* =============================================================
   Portfolio content editor.
   Edits content/site.json in memory, keeps a draft in localStorage
   (which the live site reads for preview), and exports the file.
   ============================================================= */
(function () {
  'use strict';

  var DRAFT_KEY = 'kamalish.site.draft';
  var ROOT = '../';
  var data = null;
  var dirty = false;
  var dirHandle = null;                       // project folder, once connected

  var canPickDir = typeof window.showDirectoryPicker === 'function';
  var saveTimer = null;
  var saving = false;

  /* ------------------------------------ remember the folder (IndexedDB)
     Directory handles survive a reload, so the folder only has to be
     picked once ever. On later visits we silently reclaim permission.  */
  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open('kamalish-cms', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function idbPut(k, v) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction('kv', 'readwrite');
        t.objectStore('kv').put(v, k);
        t.oncomplete = res;
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function idbGet(k) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction('kv', 'readonly');
        var q = t.objectStore('kv').get(k);
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { rej(q.error); };
      });
    });
  }

  /* ------------------------------------------- project folder access
     With the folder connected we can write uploads straight into
     assets/ and save content/site.json in place - no manual copying.
     Without it we fall back to embedding small files in the JSON.     */
  function slugFile(name) {
    return String(name).trim().toLowerCase()
      .replace(/[^a-z0-9.\-_]+/g, '-')
      .replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  function connectFolder() {
    if (!canPickDir) {
      alert('This browser cannot open a project folder.\n\n' +
            'Chrome or Edge support it. In other browsers, put files in assets/ ' +
            'yourself and type the path.');
      return Promise.reject();
    }
    return window.showDirectoryPicker({ mode: 'readwrite' }).then(function (h) {
      dirHandle = h;
      idbPut('dir', h).catch(function () {});   // remember for next time
      paintFolder();
      toast('Connected to "' + h.name + '" - changes now save automatically');
      return h;
    }).catch(function (e) {
      if (e && e.name !== 'AbortError') alert('Could not open that folder: ' + e.message);
      throw e;
    });
  }

  // Re-use the stored handle. 'granted' = silent; 'prompt' needs a click.
  function restoreFolder() {
    if (!canPickDir || !window.indexedDB) return Promise.resolve(false);
    return idbGet('dir').then(function (h) {
      if (!h || !h.queryPermission) return false;
      return h.queryPermission({ mode: 'readwrite' }).then(function (p) {
        if (p === 'granted') { dirHandle = h; return true; }
        if (p === 'prompt') { window.__pendingDir = h; }
        return false;
      });
    }).catch(function () { return false; });
  }

  function reclaimFolder() {                   // called from a click
    var h = window.__pendingDir;
    if (!h) return connectFolder();
    return h.requestPermission({ mode: 'readwrite' }).then(function (p) {
      if (p !== 'granted') return connectFolder();
      dirHandle = h;
      window.__pendingDir = null;
      paintFolder();
      toast('Reconnected to "' + h.name + '"');
      return h;
    });
  }

  function subDir(path) {                     // 'assets/decks' -> handle
    return path.split('/').filter(Boolean).reduce(function (p, part) {
      return p.then(function (h) { return h.getDirectoryHandle(part, { create: true }); });
    }, Promise.resolve(dirHandle));
  }

  function writeInto(path, name, blob) {
    return subDir(path).then(function (dir) {
      return dir.getFileHandle(name, { create: true });
    }).then(function (fh) {
      return fh.createWritable();
    }).then(function (w) {
      return w.write(blob).then(function () { return w.close(); });
    });
  }

  function paintFolder() {
    var b = $('#btnFolder');
    if (!b) return;
    if (dirHandle) {
      b.textContent = '✓ ' + dirHandle.name;
      b.classList.remove('btn--ghost');
      b.classList.add('btn--mint');
      b.title = 'Saving into this folder automatically';
    } else if (window.__pendingDir) {
      b.textContent = 'Reconnect folder';
      b.title = 'Click to restore access to ' + window.__pendingDir.name;
    }
    var s = $('#btnSaveProject');
    if (s) {
      s.disabled = !dirHandle;
      s.title = dirHandle ? 'Write content/site.json now'
                          : 'Connect the project folder first';
      s.style.opacity = dirHandle ? '' : '.45';
    }
  }

  function status(msg, tone) {
    var d = $('#dirty');
    if (!d) return;
    d.hidden = !msg;
    d.textContent = msg || '';
    d.style.background = tone === 'ok' ? 'var(--mint)'
                       : tone === 'bad' ? 'var(--coral)' : 'var(--yellow)';
    d.style.color = tone === 'bad' ? '#fff' : 'var(--ink)';
  }

  /* Write content/site.json in place. Debounced so typing does not thrash
     the disk, and the draft is cleared so the site reads the real file. */
  function saveToProject() {
    if (!dirHandle || saving) return Promise.resolve();
    saving = true;
    status('saving…');
    return writeInto('content', 'site.json',
                     new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      .then(function () {
        saving = false;
        dirty = false;
        localStorage.removeItem(DRAFT_KEY);
        status('saved to project', 'ok');
        setTimeout(function () { if (!dirty) status(''); }, 2200);
      })
      .catch(function (e) {
        saving = false;
        status('save failed - ' + e.message, 'bad');
      });
  }

  function scheduleSave() {
    if (!dirHandle) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveToProject, 900);
  }

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var el = function (tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };

  /* ------------------------------------------------------ schema */
  var TEXT = 'text', AREA = 'textarea', URLF = 'url', IMG = 'image',
      STRS = 'strings', PAIRS = 'pairs', FILE = 'file';

  var SCHEMA = [
    {
      id: 'profile', label: 'Profile', kind: 'object', path: ['profile'],
      fields: [
        { k: 'name',        t: TEXT, label: 'Name (hero, one line)' },
        { k: 'eyebrow',     t: TEXT, label: 'Eyebrow line' },
        { k: 'headline',    t: TEXT, label: 'Headline' },
        { k: 'intro',       t: AREA, label: 'Intro paragraph' },
        { k: 'portrait',    t: IMG,  label: 'Portrait image' },
        { k: 'email',       t: TEXT, label: 'Email' },
        { k: 'phone',       t: TEXT, label: 'Phone (shown)' },
        { k: 'phoneHref',   t: TEXT, label: 'Phone (dial format)', hint: 'e.g. +918778941986' },
        { k: 'linkedin',    t: URLF, label: 'LinkedIn URL' },
        { k: 'resume',      t: FILE, label: 'Resume PDF', dir: 'assets', ext: '.pdf',
          accept: 'application/pdf', pickLabel: 'Upload resume',
          emptyNote: 'the download button will not work.' },
        { k: 'footerShout', t: AREA, label: 'Footer headline', hint: 'one line per row' }
      ]
    },
    {
      id: 'software', label: 'Software', kind: 'list', path: ['software'],
      titleKey: 'title', addLabel: '+ Add software',
      blank: function () {
        return { slug: 'new-software', title: 'New software', kind: 'Web app',
                 badge: 'Web app', cover: 'assets/img/wireframe-placeholder.svg',
                 colour: 'yellow', summary: '', cardDesc: '', problem: '',
                 shipped: [], role: '', link: '', linkLabel: 'Visit the site',
                 linkNote: '', facts: [], tags: [] };
      },
      fields: [
        { k: 'title',     t: TEXT, label: 'Title' },
        { k: 'slug',      t: TEXT, label: 'Slug (URL)', hint: 'lowercase, dashes. Changing this changes the page URL.' },
        { k: 'kind',      t: TEXT, label: 'Kind (detail page label)' },
        { k: 'badge',     t: TEXT, label: 'Badge (card label)' },
        { k: 'colour',    t: TEXT, label: 'Card colour', hint: 'yellow | mint | lilac' },
        { k: 'cover',     t: IMG,  label: 'Cover image' },
        { k: 'cardDesc',  t: AREA, label: 'Short description (cards)' },
        { k: 'summary',   t: AREA, label: 'Summary (detail page lede)' },
        { k: 'problem',   t: AREA, label: 'The problem' },
        { k: 'shipped',   t: STRS, label: 'What shipped (bullets)' },
        { k: 'role',      t: AREA, label: 'My role' },
        { k: 'link',      t: URLF, label: 'Website link', hint: 'leave empty to show "to be added"' },
        { k: 'linkLabel', t: TEXT, label: 'Link button text' },
        { k: 'linkNote',  t: TEXT, label: 'Link note', hint: 'e.g. desk365.io' },
        { k: 'facts',     t: PAIRS, label: 'Fact list', pk: 'k', pv: 'v' },
        { k: 'tags',      t: STRS, label: 'Tags' }
      ]
    },
    {
      id: 'decks', label: 'Decks', kind: 'list', path: ['decks'],
      titleKey: 'title', addLabel: '+ Add deck',
      blank: function () {
        return { title: 'New deck', badge: '', cover: 'assets/img/deck-tic.svg', desc: '', file: '' };
      },
      fields: [
        { k: 'title', t: TEXT, label: 'Title' },
        { k: 'badge', t: TEXT, label: 'Badge' },
        { k: 'cover', t: IMG,  label: 'Cover image' },
        { k: 'desc',  t: AREA, label: 'Description' },
        { k: 'file',  t: FILE, label: 'Deck PDF', dir: 'assets/decks', ext: '.pdf',
          accept: 'application/pdf', pickLabel: 'Upload PDF',
          emptyNote: 'the card will show "Deck file to be added".' }
      ]
    },
    {
      id: 'wfBuilt', label: 'Wireframes: built', kind: 'list', path: ['wireframes', 'built'],
      titleKey: 'title', addLabel: '+ Add wireframe',
      blank: function () { return { title: 'New wireframe', badge: '', desc: '', image: 'assets/img/wireframe-placeholder.svg', file: '' }; },
      fields: [
        { k: 'title', t: TEXT, label: 'Title' },
        { k: 'badge', t: TEXT, label: 'Badge' },
        { k: 'image', t: IMG,  label: 'Image' },
        { k: 'desc',  t: AREA, label: 'Description' },
        { k: 'file',  t: FILE, label: 'Sheets (PDF, optional)', dir: 'assets/wireframes', ext: '.pdf',
          accept: 'application/pdf', pickLabel: 'Upload PDF',
          emptyNote: 'the tile will not be clickable.' }
      ]
    },
    {
      id: 'wfSketches', label: 'Wireframes: sketches', kind: 'list', path: ['wireframes', 'sketches'],
      titleKey: 'title', addLabel: '+ Add sketch',
      blank: function () { return { title: 'New sketch set', badge: 'Sketch', desc: '', image: 'assets/img/wireframe-placeholder.svg', file: '' }; },
      fields: [
        { k: 'title', t: TEXT, label: 'Project' },
        { k: 'badge', t: TEXT, label: 'Badge', hint: 'e.g. 7 sheets' },
        { k: 'image', t: IMG,  label: 'Cover image' },
        { k: 'desc',  t: AREA, label: 'Description' },
        { k: 'file',  t: FILE, label: 'Merged sheets (PDF)', dir: 'assets/wireframes', ext: '.pdf',
          accept: 'application/pdf', pickLabel: 'Upload PDF',
          emptyNote: 'the tile will not be clickable.' }
      ]
    },
    {
      id: 'experience', label: 'Experience', kind: 'list', path: ['experience'],
      titleKey: 'role', addLabel: '+ Add role',
      blank: function () { return { role: 'New role', org: '', from: '', to: '', text: '', tags: [] }; },
      fields: [
        { k: 'role', t: TEXT, label: 'Role' },
        { k: 'org',  t: TEXT, label: 'Organisation' },
        { k: 'from', t: TEXT, label: 'From' },
        { k: 'to',   t: TEXT, label: 'To' },
        { k: 'text', t: AREA, label: 'Description' },
        { k: 'tags', t: STRS, label: 'Tags' }
      ]
    },
    {
      id: 'capabilities', label: 'What I do', kind: 'list', path: ['capabilities'],
      titleKey: 'title', addLabel: '+ Add capability',
      blank: function () { return { key: 'Xx', title: 'New capability', desc: '' }; },
      fields: [
        { k: 'key',   t: TEXT, label: 'Monogram', hint: 'two letters' },
        { k: 'title', t: TEXT, label: 'Title' },
        { k: 'desc',  t: TEXT, label: 'Description' }
      ]
    },
    {
      id: 'stats', label: 'Stats', kind: 'list', path: ['stats'],
      titleKey: 'label', addLabel: '+ Add stat',
      blank: function () { return { value: '0', prefix: '', suffix: '+', label: 'New stat' }; },
      fields: [
        { k: 'value',  t: TEXT, label: 'Number', hint: 'digits only - it counts up' },
        { k: 'prefix', t: TEXT, label: 'Prefix' },
        { k: 'suffix', t: TEXT, label: 'Suffix' },
        { k: 'label',  t: TEXT, label: 'Label' }
      ]
    },
    {
      id: 'toolkit', label: 'Toolkit', kind: 'strings', path: ['toolkit'],
      label2: 'Tools shown in the What I do band'
    }
  ];

  /* --------------------------------------------------- utilities */
  function at(path) {
    var o = data;
    for (var i = 0; i < path.length; i++) {
      if (o[path[i]] == null) o[path[i]] = (i === path.length - 1) ? [] : {};
      o = o[path[i]];
    }
    return o;
  }
  function setAt(path, val) {
    var o = data;
    for (var i = 0; i < path.length - 1; i++) o = o[path[i]];
    o[path[path.length - 1]] = val;
  }
  function markDirty() {
    dirty = true;
    if (dirHandle) { status('unsaved changes'); scheduleSave(); }
    else { status('unsaved changes'); }
  }
  function toast(msg) {
    var t = $('.adm-toast') || document.body.appendChild(el('div', 'adm-toast'));
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('is-on'); }, 2400);
  }

  /* ------------------------------------------------ field widgets */
  function field(label, hint, control) {
    var w = el('div', 'adm-field');
    if (label) w.appendChild(el('label', null, label));
    w.appendChild(control);
    if (hint) w.appendChild(el('p', 'adm-hint', hint));
    return w;
  }

  function textInput(obj, f) {
    var i = document.createElement(f.t === AREA ? 'textarea' : 'input');
    if (f.t !== AREA) i.type = (f.t === URLF ? 'url' : 'text');
    i.value = obj[f.k] == null ? '' : obj[f.k];
    i.addEventListener('input', function () { obj[f.k] = i.value; markDirty(); });
    return field(f.label, f.hint, i);
  }

  function imageInput(obj, f) {
    var wrap = el('div', 'adm-img');
    var prev = el('div', 'adm-img__prev');
    var img = el('img');
    img.alt = '';
    prev.appendChild(img);

    var ctl = el('div', 'adm-img__ctl');
    var path = el('input');
    path.type = 'text';
    path.style.cssText = 'width:100%;font-family:var(--ff-mono);font-size:12.5px;padding:9px 11px;background:var(--paper);border:2.5px solid var(--ink);border-radius:9px';
    path.value = obj[f.k] || '';

    var refresh = function () {
      var v = obj[f.k] || '';
      img.src = /^(https?:|data:|\/)/.test(v) ? v : ROOT + v;
    };
    path.addEventListener('input', function () { obj[f.k] = path.value; refresh(); markDirty(); });

    var row = el('div');
    row.style.cssText = 'display:flex;gap:8px;margin-top:9px;flex-wrap:wrap';

    var up = el('button', 'adm-mini', 'Upload image');
    up.type = 'button';
    var file = el('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.hidden = true;
    var hint = el('p', 'adm-hint');
    var setHint = function () {
      hint.textContent = dirHandle
        ? 'Uploads are copied into assets/img/ in your project.'
        : 'Uploading embeds the image in site.json. Connect the project folder to copy it into assets/img/ instead.';
    };
    setHint();

    up.addEventListener('click', function () {
      if (!dirHandle && canPickDir) {
        if (confirm('Connect your project folder so images are copied into assets/img/?\n\n' +
                    'Cancel to embed the image inside site.json instead.')) {
          connectFolder().then(function () { setHint(); file.click(); }, function () {});
          return;
        }
      }
      file.click();
    });

    file.addEventListener('change', function () {
      var fl = file.files && file.files[0];
      if (!fl) return;
      var name = slugFile(fl.name);

      if (dirHandle) {
        writeInto('assets/img', name, fl).then(function () {
          obj[f.k] = 'assets/img/' + name;
          path.value = obj[f.k];
          refresh();
          markDirty();
          toast('Saved assets/img/' + name);
        }).catch(function (e) { alert('Could not write the image: ' + e.message); });
        file.value = '';
        return;
      }

      if (fl.size > 900 * 1024) {
        if (!confirm('That image is ' + Math.round(fl.size / 1024) + ' KB. Embedding it will bloat site.json.\n\nBetter: connect the project folder, or put the file in assets/img/ and type its path.\n\nEmbed anyway?')) { file.value = ''; return; }
      }
      var fr = new FileReader();
      fr.onload = function () {
        obj[f.k] = fr.result;
        path.value = '(embedded) ' + name;
        refresh();
        markDirty();
      };
      fr.readAsDataURL(fl);
      file.value = '';
    });

    row.appendChild(up);
    row.appendChild(file);
    ctl.appendChild(path);
    ctl.appendChild(row);
    ctl.appendChild(hint);

    wrap.appendChild(prev);
    wrap.appendChild(ctl);
    refresh();
    return field(f.label, null, wrap);
  }

  function stringsInput(arrHolder, key, label, hint) {
    var wrap = el('div');
    var chips = el('div', 'adm-chips');
    var draw = function () {
      chips.innerHTML = '';
      (arrHolder[key] || []).forEach(function (s, i) {
        var c = el('span', 'adm-chip');
        c.appendChild(document.createTextNode(s));
        var x = el('button', null, '×');
        x.type = 'button';
        x.setAttribute('aria-label', 'Remove ' + s);
        x.addEventListener('click', function () {
          arrHolder[key].splice(i, 1); draw(); markDirty();
        });
        c.appendChild(x);
        chips.appendChild(c);
      });
    };
    draw();

    var row = el('div');
    row.style.cssText = 'display:flex;gap:8px';
    var inp = el('input');
    inp.type = 'text';
    inp.placeholder = 'Add and press Enter';
    inp.style.cssText = 'flex:1;padding:10px 12px;background:var(--paper);border:2.5px solid var(--ink);border-radius:9px;font-size:14px';
    var add = function () {
      var v = inp.value.trim();
      if (!v) return;
      if (!arrHolder[key]) arrHolder[key] = [];
      arrHolder[key].push(v);
      inp.value = '';
      draw();
      markDirty();
    };
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); add(); }
    });
    var b = el('button', 'adm-mini', 'Add');
    b.type = 'button';
    b.addEventListener('click', add);
    row.appendChild(inp);
    row.appendChild(b);

    wrap.appendChild(chips);
    wrap.appendChild(row);
    return field(label, hint, wrap);
  }

  function pairsInput(obj, f) {
    var wrap = el('div');
    var body = el('div');
    var draw = function () {
      body.innerHTML = '';
      (obj[f.k] || []).forEach(function (p, i) {
        var r = el('div');
        r.style.cssText = 'display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-bottom:8px';
        [f.pk, f.pv].forEach(function (kk) {
          var inp = el('input');
          inp.type = 'text';
          inp.value = p[kk] || '';
          inp.placeholder = kk === f.pk ? 'Label' : 'Value';
          inp.style.cssText = 'padding:9px 11px;background:var(--paper);border:2.5px solid var(--ink);border-radius:8px;font-size:14px;min-width:0';
          inp.addEventListener('input', function () { p[kk] = inp.value; markDirty(); });
          r.appendChild(inp);
        });
        var x = el('button', 'adm-mini adm-mini--danger', '×');
        x.type = 'button';
        x.addEventListener('click', function () { obj[f.k].splice(i, 1); draw(); markDirty(); });
        r.appendChild(x);
        body.appendChild(r);
      });
    };
    draw();
    var add = el('button', 'adm-mini', '+ Add row');
    add.type = 'button';
    add.addEventListener('click', function () {
      if (!obj[f.k]) obj[f.k] = [];
      var o = {}; o[f.pk] = ''; o[f.pv] = '';
      obj[f.k].push(o); draw(); markDirty();
    });
    wrap.appendChild(body);
    wrap.appendChild(add);
    return field(f.label, f.hint, wrap);
  }

  /* Pick a real file. Connected folder -> copied into the project and the
     path is filled in. Not connected -> embed it (small files only). */
  function fileInput(obj, f) {
    var wrap = el('div');

    var path = el('input');
    path.type = 'text';
    path.style.cssText = 'width:100%;font-family:var(--ff-mono);font-size:12.5px;padding:10px 12px;background:var(--paper);border:2.5px solid var(--ink);border-radius:9px';
    path.value = obj[f.k] || '';
    path.placeholder = f.dir + '/filename' + (f.ext || '');
    path.addEventListener('input', function () { obj[f.k] = path.value; markDirty(); });

    var status = el('p', 'adm-hint');
    var setStatus = function (msg, ok) {
      status.textContent = msg;
      status.style.color = ok ? '#1c7a4a' : '';
      status.style.opacity = '1';
    };
    var describe = function () {
      var v = obj[f.k] || '';
      if (!v) setStatus('No file yet - ' + (f.emptyNote || 'nothing will be linked.'));
      else if (v.indexOf('data:') === 0) setStatus('Embedded in site.json (' + Math.round(v.length / 1400) + ' KB)');
      else setStatus('Linked to ' + v, true);
    };

    var row = el('div');
    row.style.cssText = 'display:flex;gap:8px;margin-top:9px;flex-wrap:wrap';

    var pick = el('button', 'adm-mini', f.pickLabel || 'Upload file');
    pick.type = 'button';
    var input = el('input');
    input.type = 'file';
    input.accept = f.accept || '';
    input.hidden = true;

    pick.addEventListener('click', function () {
      if (!dirHandle && canPickDir) {
        if (confirm('Connect your project folder so the file can be copied into it automatically?\n\n' +
                    'Cancel to embed the file inside site.json instead (only sensible for small files).')) {
          connectFolder().then(function () { input.click(); }, function () {});
          return;
        }
      }
      input.click();
    });

    input.addEventListener('change', function () {
      var fl = input.files && input.files[0];
      if (!fl) return;
      var name = slugFile(fl.name);

      if (dirHandle) {
        setStatus('Copying ' + name + ' …');
        writeInto(f.dir, name, fl).then(function () {
          obj[f.k] = f.dir + '/' + name;
          path.value = obj[f.k];
          markDirty();
          describe();
          toast('Saved ' + f.dir + '/' + name);
        }).catch(function (e) {
          setStatus('Could not write the file: ' + e.message);
        });
        input.value = '';
        return;
      }

      var kb = Math.round(fl.size / 1024);
      if (fl.size > 1500 * 1024) {
        alert('That file is ' + kb + ' KB - too big to embed in site.json.\n\n' +
              'Connect your project folder (Chrome/Edge), or copy it into ' +
              f.dir + '/ yourself and type the path.');
        input.value = '';
        return;
      }
      if (!confirm('Embed ' + name + ' (' + kb + ' KB) inside site.json?\n\n' +
                   'It will work, but it makes the content file bigger.')) { input.value = ''; return; }
      var fr = new FileReader();
      fr.onload = function () {
        obj[f.k] = fr.result;
        path.value = '(embedded) ' + name;
        markDirty();
        describe();
      };
      fr.readAsDataURL(fl);
      input.value = '';
    });

    var clear = el('button', 'adm-mini adm-mini--danger', 'Clear');
    clear.type = 'button';
    clear.addEventListener('click', function () {
      obj[f.k] = '';
      path.value = '';
      markDirty();
      describe();
    });

    row.appendChild(pick);
    row.appendChild(input);
    row.appendChild(clear);

    wrap.appendChild(path);
    wrap.appendChild(row);
    wrap.appendChild(status);
    describe();
    return field(f.label, f.hint, wrap);
  }

  function renderField(obj, f) {
    if (f.t === FILE)  return fileInput(obj, f);
    if (f.t === IMG)   return imageInput(obj, f);
    if (f.t === STRS)  return stringsInput(obj, f.k, f.label, f.hint);
    if (f.t === PAIRS) return pairsInput(obj, f);
    return textInput(obj, f);
  }

  /* --------------------------------------------------- sections */
  function buildPane(sec) {
    var pane = el('div', 'adm-pane');
    pane.id = 'pane-' + sec.id;

    if (sec.kind === 'object') {
      var card = el('div', 'adm-card');
      var h = el('div', 'adm-card__head');
      h.appendChild(el('h2', null, sec.label));
      card.appendChild(h);
      var o = at(sec.path);
      sec.fields.forEach(function (f) { card.appendChild(renderField(o, f)); });
      pane.appendChild(card);
      return pane;
    }

    if (sec.kind === 'strings') {
      var c2 = el('div', 'adm-card');
      var h2 = el('div', 'adm-card__head');
      h2.appendChild(el('h2', null, sec.label));
      c2.appendChild(h2);
      var parent = data;
      for (var i = 0; i < sec.path.length - 1; i++) parent = parent[sec.path[i]];
      c2.appendChild(stringsInput(parent, sec.path[sec.path.length - 1], '', sec.label2));
      pane.appendChild(c2);
      return pane;
    }

    // list
    var host = el('div');
    var arr = at(sec.path);

    var draw = function () {
      host.innerHTML = '';
      arr.forEach(function (item, i) {
        var card = el('div', 'adm-card');
        var head = el('div', 'adm-card__head');
        head.appendChild(el('span', 'idx', String(i + 1)));
        head.appendChild(el('h2', null, item[sec.titleKey] || 'Untitled'));

        var sp = el('div', 'sp');
        var mkBtn = function (txt, cls, fn, disabled) {
          var b = el('button', 'adm-mini' + (cls || ''), txt);
          b.type = 'button';
          b.disabled = !!disabled;
          if (disabled) b.style.opacity = '.35';
          else b.addEventListener('click', fn);
          return b;
        };
        sp.appendChild(mkBtn('↑', '', function () {
          arr.splice(i - 1, 0, arr.splice(i, 1)[0]); draw(); markDirty();
        }, i === 0));
        sp.appendChild(mkBtn('↓', '', function () {
          arr.splice(i + 1, 0, arr.splice(i, 1)[0]); draw(); markDirty();
        }, i === arr.length - 1));
        sp.appendChild(mkBtn('Duplicate', '', function () {
          arr.splice(i + 1, 0, JSON.parse(JSON.stringify(item))); draw(); markDirty();
        }));
        sp.appendChild(mkBtn('Delete', ' adm-mini--danger', function () {
          if (confirm('Delete "' + (item[sec.titleKey] || 'this item') + '"?')) {
            arr.splice(i, 1); draw(); markDirty();
          }
        }));
        head.appendChild(sp);
        card.appendChild(head);

        sec.fields.forEach(function (f) { card.appendChild(renderField(item, f)); });
        host.appendChild(card);
      });

      var add = el('button', 'adm-add', sec.addLabel);
      add.type = 'button';
      add.addEventListener('click', function () {
        arr.push(sec.blank());
        draw();
        markDirty();
        host.lastChild.previousSibling.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      host.appendChild(add);
    };

    draw();
    pane.appendChild(host);
    return pane;
  }

  function build() {
    var nav = $('#admNav'), panes = $('#admPanes');
    nav.innerHTML = '';
    panes.innerHTML = '';

    SCHEMA.forEach(function (sec, i) {
      var b = el('button', i === 0 ? 'is-on' : '', sec.label);
      b.type = 'button';
      b.addEventListener('click', function () {
        nav.querySelectorAll('button').forEach(function (x) { x.classList.remove('is-on'); });
        panes.querySelectorAll('.adm-pane').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        $('#pane-' + sec.id).classList.add('is-on');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      nav.appendChild(b);

      var pane = buildPane(sec);
      if (i === 0) pane.classList.add('is-on');
      panes.appendChild(pane);
    });
  }

  /* ----------------------------------------------------- actions */
  function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    dirty = false;
    status('');
  }

  $('#btnFolder').addEventListener('click', function () {
    reclaimFolder().then(function () { build(); saveToProject(); }, function () {});
  });

  $('#btnSaveProject').addEventListener('click', function () {
    clearTimeout(saveTimer);
    saveToProject().then(function () {
      toast('content/site.json written - commit and push to publish');
    });
  });

  $('#btnPreview').addEventListener('click', function () {
    // Connected: the real file is already current, so preview the real site.
    // Not connected: fall back to a browser-local draft.
    var ready = dirHandle ? (clearTimeout(saveTimer), saveToProject())
                          : Promise.resolve(saveDraft());
    ready.then(function () {
      window.open(ROOT + 'index.html', '_blank');
    });
  });

  $('#btnDownload').addEventListener('click', function () {
    // Only keep a browser draft when there is no folder; otherwise the draft
    // would shadow the file we are already writing for real.
    if (!dirHandle) saveDraft();
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'site.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('Downloaded - replace content/site.json, then push');
  });

  $('#btnReload').addEventListener('click', function () {
    if (!confirm('Discard your local draft and reload the published content/site.json?')) return;
    localStorage.removeItem(DRAFT_KEY);
    location.reload();
  });

  window.addEventListener('beforeunload', function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  /* -------------------------------------------------------- boot */
  var draft = null;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) {}

  restoreFolder().then(function (reconnected) {
    // With the folder back, content/site.json is the source of truth again -
    // a stale draft would silently shadow it.
    if (reconnected) { draft = null; localStorage.removeItem(DRAFT_KEY); }

    return (draft
      ? Promise.resolve(draft)
      : fetch(ROOT + 'content/site.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
    ).then(function (d) {
      data = d;
      build();
      paintFolder();
      if (!canPickDir) {
        var b = $('#btnFolder');
        b.disabled = true;
        b.style.opacity = '.4';
        b.title = 'Needs Chrome or Edge';
      }
      if (reconnected) toast('Folder reconnected - edits save automatically');
      else if (draft) toast('Loaded your unpublished draft');
    });
  }).catch(function (err) {
    document.querySelector('.adm-wrap').innerHTML =
      '<p class="load-error">Could not load content/site.json - ' + err.message +
      '. Serve the site over http, not file://.</p>';
  });
})();
