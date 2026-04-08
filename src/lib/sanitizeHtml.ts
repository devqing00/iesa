import DOMPurify from "isomorphic-dompurify";

export function sanitizeRichHtml(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
  });

  // Enforce safe rel values for any user-authored links that open a new tab.
  return sanitized.replace(/<a\b([^>]*?)target=("|')_blank\2([^>]*)>/gi, (full, before, quote, after) => {
    const attrs = `${before}${after}`;
    const relMatch = attrs.match(/\brel=("|')([^"']*)\1/i);
    if (!relMatch) {
      return full.replace(/>$/, ` rel=${quote}noopener noreferrer${quote}>`);
    }

    const relQuote = relMatch[1];
    const relTokens = relMatch[2].split(/\s+/).filter(Boolean);
    const relSet = new Set(relTokens.map((token: string) => token.toLowerCase()));
    relSet.add("noopener");
    relSet.add("noreferrer");
    const mergedRel = Array.from(relSet).join(" ");
    return full.replace(/\brel=("|')[^"']*\1/i, `rel=${relQuote}${mergedRel}${relQuote}`);
  });
}
