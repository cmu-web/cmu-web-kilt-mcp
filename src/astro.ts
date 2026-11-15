// Astro's version of the kit's HTML examples. A copy of the conversion in the
// kit's docs (docs/js/docs.js), which its Framework tabs use; keep the two
// the same. Astro takes HTML as it is, except that braces in text start an
// expression (so they're written as {"{"} and {"}"}), and a script or style
// tag is bundled or scoped unless it's marked to stay as written.
export function toAstro(html: string): string {
  let out = "";
  let raw: string | null = null;
  html.split(/(<!--[\s\S]*?-->|<[^>]+>)/).forEach((part, i) => {
    if (i % 2) {
      const open = /^<(script|style)\b/i.exec(part);
      if (open && !/\bis:(inline|global)\b/.test(part)) {
        raw = open[1].toLowerCase();
        part = part.replace(
          /^<(script|style)/i,
          (m) => m + (raw === "script" ? " is:inline" : " is:global"),
        );
      } else if (raw && new RegExp("^</" + raw, "i").test(part)) raw = null;
      out += part;
    } else out += raw ? part : part.replace(/[{}]/g, (c) => `{"${c}"}`);
  });
  return out;
}
