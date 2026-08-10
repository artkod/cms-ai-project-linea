// ─────────────────────────────────────────────────────────────────────────────
// Legacy linea.hr HTML → TipTap document converter (product-content migration).
//
// The OLD site renders product bodies as bootstrap markup produced by its own
// page builder. This module turns one tab pane (or the "Opis proizvoda" block)
// into the TipTap JSON the CMS stores in `translations[loc].detailTabs[].content`.
//
// It ships its own tiny HTML parser: the source markup is one CMS's output, so a
// tolerant parser with auto-closing rules beats adding a dependency.
//
// Everything the storefront cannot render (modals, carousels, forms, buttons,
// scripts) is dropped; the two legacy LAYOUT idioms are recognised explicitly:
//   • an image grid  (`.widget-images`, `.product-gallery-grid`, or a `.row`
//     whose columns are all image tiles)      → a TipTap TABLE (one row of
//     image cells, optional caption paragraph under each image). The storefront
//     styles image-bearing tables as fixed-width grids, so every picture renders
//     at the same size and the captions line up.
//   • a text+image `.row` (2 columns)         → the text blocks, with the image
//     floated to the side it occupied.
// ─────────────────────────────────────────────────────────────────────────────

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const RAW_TEXT = new Set(["script", "style", "noscript", "textarea"]);
// Opening one of these implicitly closes an open <p>.
const CLOSES_P = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "table", "tr", "td", "th", "hr", "section", "blockquote", "form"]);

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  hellip: "…", laquo: "«", raquo: "»", bdquo: "„", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’",
  eacute: "é", egrave: "è", uuml: "ü", ouml: "ö", auml: "ä", deg: "°", sup2: "²", sup3: "³",
  times: "×", middot: "·", euro: "€", copy: "©", reg: "®", trade: "™", shy: "",
};

export function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-f]+|[a-z0-9]+);/gi, (m, code) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    const key = code.toLowerCase();
    return key in ENTITIES ? ENTITIES[key] : m;
  });
}

function parseAttrs(src) {
  const attrs = {};
  for (const m of src.matchAll(/([a-zA-Z_:@.-][\w:.-]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    const name = m[1].toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? "";
    attrs[name] = decodeEntities(value);
  }
  return attrs;
}

/** Parse an HTML fragment into a lightweight element tree. */
export function parseHtml(html) {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>/g;
  let last = 0;
  let m;
  const pushText = (txt) => {
    if (!txt) return;
    const decoded = decodeEntities(txt);
    if (decoded.trim() === "" && !/[ ]/.test(decoded)) {
      // keep a single space so inline runs don't glue together
      if (/\s/.test(decoded)) top().children.push({ tag: "#text", text: " " });
      return;
    }
    top().children.push({ tag: "#text", text: decoded });
  };

  while ((m = re.exec(html))) {
    pushText(html.slice(last, m.index));
    last = re.lastIndex;
    if (m[0].startsWith("<!--")) continue;
    const tag = (m[1] ?? "").toLowerCase();
    const isClose = m[0][1] === "/";

    if (isClose) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) { stack.length = i; break; }
      }
      continue;
    }

    const attrs = parseAttrs(m[2] ?? "");
    const node = { tag, attrs, children: [] };

    if (tag === "p" && top().tag === "p") stack.pop();
    else if (CLOSES_P.has(tag) && top().tag === "p") stack.pop();
    if (tag === "li" && top().tag === "li") stack.pop();
    if ((tag === "td" || tag === "th") && (top().tag === "td" || top().tag === "th")) stack.pop();
    if (tag === "tr" && top().tag === "tr") stack.pop();

    top().children.push(node);
    if (VOID.has(tag) || m[3] === "/") continue;

    if (RAW_TEXT.has(tag)) {
      const end = html.indexOf(`</${tag}`, last);
      const stop = end === -1 ? html.length : end;
      node.children.push({ tag: "#text", text: html.slice(last, stop) });
      re.lastIndex = last = stop;
      continue;
    }
    stack.push(node);
  }
  pushText(html.slice(last));
  return root;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const cls = (n) => (n.attrs?.class ?? "").split(/\s+/).filter(Boolean);
const hasCls = (n, c) => cls(n).includes(c);
const styleOf = (n) => (n.attrs?.style ?? "").toLowerCase();
const isEl = (n) => n.tag !== "#text";
const text = (t, marks) => ({ type: "text", text: t, ...(marks?.length ? { marks } : {}) });

/** Elements that never carry renderable product content. */
function isJunk(node) {
  if (!isEl(node)) return false;
  const c = cls(node);
  if (["script", "style", "noscript", "form", "button", "iframe", "input", "select", "textarea", "label"].includes(node.tag)) return true;
  // `data-toggle="modal"` marks a lightbox trigger. On a BUTTON that is chrome
  // ("Upit o proizvodu"); on an ANCHOR it wraps a gallery thumbnail, so the
  // anchor is dropped but its image is kept (handled as a transparent element).
  if (node.attrs["data-toggle"] === "modal" && node.tag !== "a") return true;
  // NB: `btn` is NOT junk on an anchor — the legacy document lists render their
  // PDF download links as `<a class="btn">` (the storefront styles those via
  // `.mx-pdf`). Chrome buttons are junk by TAG above.
  if (c.some((x) => /^(modal|carousel|sr-only|nav-tabs|tab-content-nav|breadcrumb)/.test(x))) return true;
  if (node.tag !== "a" && c.some((x) => /^btn/.test(x))) return true;
  return false;
}

/** Deep text of a subtree (whitespace-collapsed). */
export function plainText(node) {
  if (node.tag === "#text") return node.text;
  if (isJunk(node)) return "";
  if (node.tag === "br") return "\n";
  return (node.children ?? []).map(plainText).join("");
}

const squash = (s) => s.replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").trim();

function textAlign(node) {
  const a = (node.attrs?.align ?? "").toLowerCase();
  if (a === "center" || a === "right" || a === "justify") return a;
  const st = styleOf(node);
  const m = st.match(/text-align:\s*(center|right|justify)/);
  return m ? m[1] : null;
}

/** Is this heading really body text? The legacy editor had no font-size control,
 *  so it sized BODY COPY by tagging it <h5>/<h6> (usually with a
 *  font-weight:normal span). <h1>–<h4> are genuine section titles there — they
 *  often carry the same normal-weight span, so weight alone can't decide. */
function headingIsBodyText(node) {
  if (!plainText(node).trim()) return true;
  return /^h[56]$/.test(node.tag);
}

// ── inline conversion ────────────────────────────────────────────────────────

function inlineNodes(node, marks, ctx) {
  const out = [];
  const push = (n) => { if (n) out.push(n); };

  for (const child of node.children ?? []) {
    if (child.tag === "#text") {
      const t = child.text.replace(/[ \t ]+/g, " ");
      if (t) push(text(t, marks));
      continue;
    }
    if (isJunk(child)) continue;
    switch (child.tag) {
      case "br": push({ type: "hardBreak" }); break;
      case "img": { const im = imageNode(child, ctx); if (im) ctx.pendingImages.push(im); break; }
      case "strong": case "b": out.push(...inlineNodes(child, addMark(marks, { type: "bold" }), ctx)); break;
      case "em": case "i": out.push(...inlineNodes(child, addMark(marks, { type: "italic" }), ctx)); break;
      case "u": out.push(...inlineNodes(child, addMark(marks, { type: "underline" }), ctx)); break;
      case "s": case "strike": case "del": out.push(...inlineNodes(child, addMark(marks, { type: "strike" }), ctx)); break;
      case "a": {
        const href = child.attrs.href ?? "";
        if (!href || href === "#" || href.startsWith("javascript:")) { out.push(...inlineNodes(child, marks, ctx)); break; }
        out.push(...inlineNodes(child, addMark(marks, { type: "link", attrs: { href: ctx.mapHref(href), target: null } }), ctx));
        break;
      }
      default: out.push(...inlineNodes(child, marks, ctx));
    }
  }
  return out;
}

function addMark(marks, mark) {
  const list = marks ? [...marks] : [];
  if (!list.some((m) => m.type === mark.type)) list.push(mark);
  return list;
}

function trimInline(nodes) {
  const out = nodes.filter((n, i) => !(n.type === "text" && n.text.trim() === "" && (i === 0 || i === nodes.length - 1)));
  while (out.length && out[0].type === "hardBreak") out.shift();
  while (out.length && out[out.length - 1].type === "hardBreak") out.pop();
  if (out.length && out[0].type === "text") out[0] = { ...out[0], text: out[0].text.replace(/^\s+/, "") };
  const last = out.length - 1;
  if (last >= 0 && out[last].type === "text") out[last] = { ...out[last], text: out[last].text.replace(/\s+$/, "") };
  return out.filter((n) => !(n.type === "text" && n.text === ""));
}

function imageNode(node, ctx) {
  const src = ctx.mapImage(node.attrs.src ?? "");
  if (!src) return null;
  const attrs = { src, alt: (node.attrs.alt ?? "").replace(/\.(png|jpe?g|gif|webp)$/i, "").trim() };
  const w = Number(node.attrs.width);
  const h = Number(node.attrs.height);
  if (Number.isFinite(w) && w > 0) attrs.width = w;
  if (Number.isFinite(h) && h > 0) attrs.height = h;
  return { type: "image", attrs };
}

// ── layout idiom detection ───────────────────────────────────────────────────

const IMG_TILE_CAPTION_CLS = ["title", "h5"];

/** An image tile = a column/div whose only real content is one image (+ caption). */
function tileOf(node, ctx) {
  const imgs = [];
  let caption = "";
  (function walk(n) {
    if (!isEl(n)) return;
    if (isJunk(n)) return;
    if (n.tag === "img") { imgs.push(n); return; }
    if (IMG_TILE_CAPTION_CLS.some((c) => hasCls(n, c))) { caption = squash(plainText(n)); return; }
    (n.children ?? []).forEach(walk);
  })(node);
  if (imgs.length !== 1) return null;
  const stray = squash(plainText(node)).replace(caption, "").trim();
  if (stray) return null; // text beside the image → not a plain tile
  const image = imageNode(imgs[0], ctx);
  return image ? { image, caption } : null;
}

/** Grid of image tiles → a one-row TipTap table (cells = image + caption). */
function gridTable(tiles) {
  const cells = tiles.map((t) => ({
    type: "tableCell",
    content: [
      { type: "paragraph", attrs: { textAlign: "center" }, content: [t.image] },
      ...(t.caption ? [{ type: "paragraph", attrs: { textAlign: "center" }, content: [text(t.caption)] }] : []),
    ],
  }));
  return { type: "table", content: [{ type: "tableRow", content: cells }] };
}

const INLINE_TAGS = new Set(["a", "span", "strong", "b", "em", "i", "u", "s", "strike", "small", "font", "label"]);
const BLOCK_TAGS = new Set(["p", "div", "ul", "ol", "li", "table", "tr", "td", "th", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "section", "blockquote"]);

/** True when the subtree holds no block-level element (safe to render inline). */
function isInlineOnly(node) {
  for (const c of node.children ?? []) {
    if (!isEl(c)) continue;
    if (BLOCK_TAGS.has(c.tag)) return false;
    if (!isInlineOnly(c)) return false;
  }
  return true;
}

/** Float an image beside the text it shared a `.row` with. A legacy layout image
 *  had no width (its bootstrap column set it), so give it one — floated at
 *  max-width it would swallow the whole column. */
function floatImage(image, side) {
  image.attrs.alignment = side;
  if (!image.attrs.width) image.attrs.width = 340;
}

function columnsOf(node) {
  return (node.children ?? []).filter((c) => isEl(c) && !isJunk(c) && (hasCls(c, "column") || cls(c).some((x) => /^col(-|$)/.test(x))));
}

// ── block conversion ─────────────────────────────────────────────────────────

function blocksOf(node, ctx) {
  const out = [];
  const flushImages = (align) => {
    while (ctx.pendingImages.length) {
      const image = ctx.pendingImages.shift();
      if (align) image.attrs.alignment = align;
      out.push({ type: "paragraph", ...(align ? {} : { attrs: { textAlign: "center" } }), content: [image] });
    }
  };

  for (const child of node.children ?? []) {
    if (child.tag === "#text") {
      const t = squash(child.text);
      if (t) out.push({ type: "paragraph", content: [text(t)] });
      continue;
    }
    if (isJunk(child)) continue;

    switch (child.tag) {
      case "p":
      case "h1": case "h2": case "h3": case "h4": case "h5": case "h6": {
        const align = textAlign(child);
        const content = trimInline(inlineNodes(child, null, ctx));
        const isHeading = child.tag !== "p" && !headingIsBodyText(child);
        if (content.length) {
          const level = child.tag === "h1" || child.tag === "h2" ? 3 : 4;
          out.push(isHeading
            ? { type: "heading", attrs: { level, ...(align ? { textAlign: align } : {}) }, content }
            : { type: "paragraph", ...(align ? { attrs: { textAlign: align } } : {}), content });
        }
        flushImages(null);
        break;
      }
      case "br": break;
      case "hr": out.push({ type: "horizontalRule" }); break;
      case "img": {
        const im = imageNode(child, ctx);
        if (im) out.push({ type: "paragraph", attrs: { textAlign: "center" }, content: [im] });
        break;
      }
      case "ul": case "ol": {
        // A legacy `.list-group` is a DOCUMENT LIST (rows of file links), not a
        // bulleted list — its items render as buttons, so a bullet beside each
        // one is noise. Emit the rows as plain blocks.
        if (hasCls(child, "list-group")) {
          for (const li of child.children ?? []) {
            if (li.tag !== "li" || isJunk(li)) continue;
            out.push(...blocksOf(li, ctx));
          }
          break;
        }
        const items = (child.children ?? [])
          .filter((li) => li.tag === "li" && !isJunk(li))
          .map((li) => {
            const inner = blocksOf(li, ctx).filter((b) => b.type !== "horizontalRule");
            const content = inner.length ? inner : [{ type: "paragraph" }];
            return { type: "listItem", content };
          })
          .filter((li) => li.content.some((b) => (b.content ?? []).length || b.type === "table"));
        if (items.length) out.push({ type: child.tag === "ul" ? "bulletList" : "orderedList", content: items });
        break;
      }
      case "table": {
        const rows = [];
        (function walkRows(n) {
          for (const c of n.children ?? []) {
            if (!isEl(c)) continue;
            if (c.tag === "tr") {
              const cells = (c.children ?? []).filter((x) => x.tag === "td" || x.tag === "th").map((td) => {
                const inner = blocksOf(td, ctx);
                return {
                  type: td.tag === "th" ? "tableHeader" : "tableCell",
                  content: inner.length ? inner : [{ type: "paragraph" }],
                };
              });
              if (cells.length) rows.push({ type: "tableRow", content: cells });
            } else walkRows(c);
          }
        })(child);
        if (rows.length) out.push({ type: "table", content: rows });
        break;
      }
      default: {
        // An inline-only wrapper (`<a class="btn">…</a>` in the legacy document
        // lists, a stray `<span>`) carries marks that only inlineNodes applies —
        // recursing at block level would flatten a link back to plain text.
        if (INLINE_TAGS.has(child.tag) && isInlineOnly(child)) {
          // pass it as a CHILD so its own tag (the <a>) contributes its mark
          const content = trimInline(inlineNodes({ children: [child] }, null, ctx));
          if (content.length) out.push({ type: "paragraph", content });
          flushImages(null);
          break;
        }
        // ── layout idioms ──
        const columns = columnsOf(child);
        const tiles = columns.map((c) => tileOf(c, ctx));
        const isGridClass = hasCls(child, "widget-images") || hasCls(child, "product-gallery-grid");

        if (columns.length > 1 && tiles.every(Boolean)) {
          out.push(gridTable(tiles));
          break;
        }
        if (isGridClass) {
          const inner = columns.length ? columns : (child.children ?? []).filter(isEl);
          const t2 = inner.map((c) => tileOf(c, ctx)).filter(Boolean);
          if (t2.length) { out.push(gridTable(t2)); break; }
        }
        // text column + image column → text with the image floated to its side
        if (columns.length === 2) {
          const t0 = tileOf(columns[0], ctx);
          const t1 = tileOf(columns[1], ctx);
          if (t0 && !t1) {
            floatImage(t0.image, "left");
            const body = blocksOf(columns[1], ctx);
            out.push({ type: "paragraph", content: [t0.image] }, ...body);
            break;
          }
          if (t1 && !t0) {
            floatImage(t1.image, "right");
            const body = blocksOf(columns[0], ctx);
            const first = body.findIndex((b) => b.type === "paragraph" || b.type === "heading");
            const at = first === -1 ? body.length : first + (body[first]?.type === "heading" ? 1 : 0);
            body.splice(at, 0, { type: "paragraph", content: [t1.image] });
            out.push(...body);
            break;
          }
        }
        out.push(...blocksOf(child, ctx));
      }
    }
  }
  flushImages(null);
  return out;
}

function tidy(blocks) {
  const out = [];
  for (const b of blocks) {
    const empty = b.type === "paragraph" && !(b.content ?? []).length;
    if (empty) continue;
    if (b.type === "horizontalRule" && (!out.length || out[out.length - 1].type === "horizontalRule")) continue;
    out.push(b);
  }
  while (out.length && out[out.length - 1].type === "horizontalRule") out.pop();
  return out;
}

/**
 * Convert one legacy HTML fragment to a TipTap doc.
 * `opts.mapImage(src)` → the CDN url to store (return "" to drop the image).
 * `opts.mapHref(href)` → rewritten link target.
 */
export function htmlToTiptap(html, opts = {}) {
  const ctx = {
    mapImage: opts.mapImage ?? ((s) => s),
    mapHref: opts.mapHref ?? ((h) => h),
    pendingImages: [],
  };
  const tree = parseHtml(html);
  const content = tidy(blocksOf(tree, ctx));
  return content.length ? { type: "doc", content } : null;
}

/** Convert the legacy "Opis proizvoda" block to the plain-text description
 *  (paragraph per <p>, single newline for <br>). */
export function htmlToPlainDescription(html) {
  const tree = parseHtml(html);
  const paras = [];
  (function walk(node) {
    for (const child of node.children ?? []) {
      if (!isEl(child)) {
        const t = squash(child.text ?? "");
        if (t) paras.push(t);
        continue;
      }
      if (isJunk(child)) continue;
      if (["p", "h1", "h2", "h3", "h4", "h5", "h6", "div", "li"].includes(child.tag)) {
        const t = squash(plainText(child));
        if (t) paras.push(t);
      } else walk(child);
    }
  })(tree);
  return paras.join("\n\n").trim();
}

/** All image srcs referenced by a fragment (in document order, deduped). */
export function imageSources(html) {
  const seen = new Set();
  (function walk(node) {
    for (const child of node.children ?? []) {
      if (!isEl(child)) continue;
      if (isJunk(child)) continue;
      if (child.tag === "img" && child.attrs.src) seen.add(child.attrs.src);
      walk(child);
    }
  })(parseHtml(html));
  return [...seen];
}
