// Converts a Tiptap JSON document to an HTML string.
// No Tiptap dependency needed — just a recursive node walker.

interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TiptapNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: TiptapMark[];
  content?: TiptapNode[];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyMarks(text: string, marks: TiptapMark[]): string {
  return marks.reduce((acc, mark) => {
    switch (mark.type) {
      case "bold":      return `<strong>${acc}</strong>`;
      case "italic":    return `<em>${acc}</em>`;
      case "underline": return `<u>${acc}</u>`;
      case "strike":    return `<s>${acc}</s>`;
      case "code":      return `<code>${acc}</code>`;
      case "link": {
        const href = (mark.attrs?.href as string) || "#";
        const external = href.startsWith("http");
        const rel = external ? ' target="_blank" rel="noopener noreferrer"' : "";
        // PDF links render as a download button with a file icon (the old CMS
        // exposed these as "Preuzmite katalog" buttons).
        if (/\.pdf(\?|#|$)/i.test(href)) {
          const icon =
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg>';
          return (
            `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" ` +
            'style="display:inline-flex;align-items:center;gap:8px;background:#496800;color:#fff;' +
            'padding:10px 20px;border-radius:4px;font-size:14px;font-weight:600;letter-spacing:0.03em;' +
            `text-decoration:none;margin:4px 0">${icon}<span>${acc}</span></a>`
          );
        }
        return `<a href="${escapeHtml(href)}"${rel}>${acc}</a>`;
      }
      default: return acc;
    }
  }, text);
}

function renderChildren(node: TiptapNode): string {
  return (node.content ?? []).map(renderNode).join("");
}

// Inline style for block nodes (paragraph/heading) — carries text alignment
// (TextAlign extension) and indentation (custom Indent extension) the editor stores.
function blockStyle(node: TiptapNode): string {
  const styles: string[] = [];
  const align = node.attrs?.textAlign as string | undefined;
  if (align && align !== "left") styles.push(`text-align:${align}`);
  const indent = node.attrs?.indent as number | undefined;
  if (indent && indent > 0) styles.push(`margin-left:${indent * 24}px`);
  return styles.length ? ` style="${styles.join(";")}"` : "";
}

function renderNode(node: TiptapNode): string {
  if (node.type === "text") {
    const escaped = escapeHtml(node.text ?? "");
    return node.marks?.length ? applyMarks(escaped, node.marks) : escaped;
  }
  if (node.type === "hardBreak") return "<br />";
  if (node.type === "horizontalRule") return "<hr />";
  if (node.type === "image") {
    const src = node.attrs?.src as string | undefined;
    if (!src) return "";
    const alt = escapeHtml((node.attrs?.alt as string) || "");
    const align = node.attrs?.alignment as string | undefined;
    const alignStyle: Record<string, string> = {
      center: "display:block;margin-left:auto;margin-right:auto",
      left: "float:left;margin-right:12px;margin-bottom:8px",
      right: "float:right;margin-left:12px;margin-bottom:8px",
    };
    const w = node.attrs?.width;
    const h = node.attrs?.height;
    const styles = ["max-width:100%", "border-radius:4px"];
    // Only force height:auto when no explicit height is set, otherwise it would
    // override an author-chosen height and ignore the resize.
    if (h == null) styles.push("height:auto");
    if (align && alignStyle[align]) styles.push(alignStyle[align]);
    const dims =
      (w != null ? ` width="${Number(w)}"` : "") + (h != null ? ` height="${Number(h)}"` : "");
    return `<img src="${escapeHtml(src)}" alt="${alt}"${dims} style="${styles.join(";")}" />`;
  }

  const inner = renderChildren(node);

  switch (node.type) {
    case "doc":        return inner;
    case "paragraph":  return inner ? `<p${blockStyle(node)}>${inner}</p>` : "<p><br /></p>";
    case "heading": {
      const lvl = (node.attrs?.level as number) || 2;
      return `<h${lvl}${blockStyle(node)}>${inner}</h${lvl}>`;
    }
    case "bulletList":  return `<ul>${inner}</ul>`;
    case "orderedList": return `<ol>${inner}</ol>`;
    case "listItem":    return `<li>${inner}</li>`;
    case "blockquote":  return `<blockquote>${inner}</blockquote>`;
    case "codeBlock": {
      const lang = node.attrs?.language as string | undefined;
      const cls = lang ? ` class="language-${lang}"` : "";
      return `<pre><code${cls}>${inner}</code></pre>`;
    }
    default: return inner;
  }
}

export function tiptapToHtml(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  return renderNode(doc as TiptapNode);
}
