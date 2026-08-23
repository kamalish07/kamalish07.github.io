# Kamalish — Neo Brutalist Portfolio

Static site. No build step, no dependencies. Open `index.html` or serve the folder.

```bash
npx --yes serve -l 4321 .
```

## Structure

```
index.html
assets/
  css/style.css     tokens + all sections (numbered sections in the file)
  js/main.js        reveals, scroll-drawn flow line, timeline rail, counters, nav
  img/*.svg         placeholder artwork
```

## Editing content (CMS)

Open **`/admin/`** in a browser while the site is served. Everything on the site
comes from `content/site.json`, and the editor edits that file.

### One-time setup

Click **Connect project folder** (Chrome/Edge) and pick this repo's folder.
The handle is stored in IndexedDB, so it is remembered on later visits - you
will not be asked again.

From then on it is automatic:

- Typing saves itself into `content/site.json` (debounced ~1s)
- Uploaded images are copied into `assets/img/`
- Uploaded PDFs are copied into `assets/decks/` (deck) or `assets/` (resume)
- The status pill in the bar shows `saving…` then `saved to project`

To publish:

```bash
git add . && git commit -m "Update content" && git push
```

### Buttons

- **Connect project folder** - one-time; shows `✓ <folder>` once linked
- **Save & preview** - saves, then opens the site in a new tab
- **Save to project** - force an immediate write
- **Download site.json** - fallback if you cannot use folder access
- **Discard** - drop the local draft and reload the published file

Without folder access, uploads are embedded into `site.json` as data URIs -
fine for small images, refused above 1.5 MB.

Adding software needs no new HTML file - every product renders through
`work/software/item.html#<slug>`.

## Pages

```
/                                 home
/work/product-decks/              deck grid
/work/wireframes/                 built wireframes + rough sketches
/work/software/                   software list
/work/software/item.html#<slug>   any software detail page
/admin/                           content editor
```

Content lives in `content/site.json`. The pages are shells; `assets/js/content.js`
fills them in. Because it uses `fetch`, the site must be served over http -
opening `index.html` from the filesystem will show a "content could not load"
banner.

## Placeholders to replace

| What | Where |
|---|---|
| Portrait image | `assets/img/portrait.svg` - swap for a real photo |
| Billing site URL | `work/software/billing/index.html`, the `.linkbox` (marked TODO) |
| Deck PDFs | `assets/decks/` - only RIVA is in; Flipkart, Chanakyaneeti, TIC are marked "Deck file to be added" |
| Wireframe images | `assets/img/wireframe-placeholder.svg` used for all 6 tiles in `work/wireframes/` |
| Wireframe titles | the 6 tiles in `work/wireframes/` still have placeholder copy |

## Theme tokens

All colour/border/shadow values live in `:root` at the top of `style.css`.
Changing `--coral`, `--yellow`, `--blue`, `--mint`, `--lilac` re-themes the whole site.

## Motion

Everything respects `prefers-reduced-motion`. Scroll work is batched into a single
`requestAnimationFrame` loop in `main.js`.
