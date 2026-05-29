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
        return `<a href="${escapeHtml(href)}"${rel}>${acc}</a>`;
      }
      default: return acc;
    }
  }, text);
}

function renderChildren(node: TiptapNode): string {
  return (node.content ?? []).map(renderNode).join("");
}

function renderNode(node: TiptapNode): string {
  if (node.type === "text") {
    const escaped = escapeHtml(node.text ?? "");
    return node.marks?.length ? applyMarks(escaped, node.marks) : escaped;
  }
  if (node.type === "hardBreak") return "<br />";
  if (node.type === "horizontalRule") return "<hr />";

  const inner = renderChildren(node);

  switch (node.type) {
    case "doc":        return inner;
    case "paragraph":  return inner ? `<p>${inner}</p>` : "<p><br /></p>";
    case "heading": {
      const lvl = (node.attrs?.level as number) || 2;
      return `<h${lvl}>${inner}</h${lvl}>`;
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
