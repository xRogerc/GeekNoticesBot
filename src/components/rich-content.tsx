import DOMPurify from "dompurify";
import { useMemo } from "react";

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "s", "u", "code", "pre",
  "h1", "h2", "h3", "h4",
  "ul", "ol", "li",
  "blockquote", "a", "hr", "span",
];
const ALLOWED_ATTR = ["href", "target", "rel", "class"];

function looksLikeHtml(s: string) {
  return /<\/?(p|h[1-6]|ul|ol|li|strong|em|blockquote|br|a|span|code|pre)\b/i.test(s);
}

export function RichContent({ html, className }: { html: string; className?: string }) {
  const safe = useMemo(() => {
    if (!html) return "";
    if (looksLikeHtml(html)) {
      return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
    }
    // Legacy plain-text content — preserve line breaks.
    const escaped = html
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<p>${escaped.replace(/\n/g, "<br />")}</p>`;
  }, [html]);

  return (
    <div
      className={
        "prose prose-invert max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-cyan-glow prose-strong:text-foreground text-foreground/90 " +
        (className ?? "")
      }
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}