// React's version of the kit's HTML examples, as JSX. A copy of the
// conversion in the kit's docs (docs/js/docs.js), which its Framework tabs
// use; keep the two the same.
// Attribute names: attribute names React spells its
// own way, self-closed empty elements, default values for form fields (a
// plain value or checked would make them read-only in React), style objects
// and comments
const JSX_NAMES: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  readonly: "readOnly",
  maxlength: "maxLength",
  minlength: "minLength",
  colspan: "colSpan",
  rowspan: "rowSpan",
  autocomplete: "autoComplete",
  autofocus: "autoFocus",
  inputmode: "inputMode",
  enctype: "encType",
  novalidate: "noValidate",
  formnovalidate: "formNoValidate",
  crossorigin: "crossOrigin",
  srcset: "srcSet",
  datetime: "dateTime",
  contenteditable: "contentEditable",
  spellcheck: "spellCheck",
  allowfullscreen: "allowFullScreen",
  frameborder: "frameBorder",
  referrerpolicy: "referrerPolicy",
  playsinline: "playsInline",
  "accept-charset": "acceptCharset",
  "http-equiv": "httpEquiv",
  "stroke-width": "strokeWidth",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "fill-rule": "fillRule",
  "clip-rule": "clipRule",
  "xlink:href": "xlinkHref",
};
const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;
// Attributes that are on or off; any other written without a value is an
// empty string (alt, for a decorative image)
const SWITCHES =
  /^(allowfullscreen|async|autofocus|autoplay|checked|controls|default|defer|disabled|formnovalidate|hidden|inert|loop|multiple|muted|nomodule|novalidate|open|playsinline|readonly|required|reversed|selected)$/i;
function jsxStyle(css: string): string {
  const parts = css
    .split(";")
    .map(function (d) {
      const i = d.indexOf(":");
      if (i < 0) return "";
      let name = d.slice(0, i).trim();
      const value = d.slice(i + 1).trim();
      if (!name) return "";
      if (name.indexOf("--") !== 0)
        name = name.replace(/-([a-z])/g, function (_, c) {
          return c.toUpperCase();
        });
      return JSON.stringify(name).replace(/^"([A-Za-z]\w*)"$/, "$1") + ": " + JSON.stringify(value);
    })
    .filter(Boolean);
  return "{{ " + parts.join(", ") + " }}";
}
export function toJsx(html: string): string {
  // A selected option becomes its select's defaultValue
  html = html.replace(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi, function (whole, attrs, inner) {
    let picked: string | null = null;
    inner = inner.replace(
      /<option\b([^>]*?)\s+selected(?:="[^"]*")?([^>]*)>([^<]*)/gi,
      function (_: string, before: string, after: string, label: string) {
        const value = /\bvalue="([^"]*)"/.exec(before + after);
        picked = value ? value[1] : label.trim();
        return "<option" + before + after + ">" + label;
      },
    );
    if (picked === null) return whole;
    return "<select" + attrs + ' defaultValue="' + picked + '">' + inner + "</select>";
  });
  return html
    .replace(/<!--([\s\S]*?)-->/g, function (_, c) {
      return "{/*" + c.replace(/\*\//g, "* /") + "*/}";
    })
    .replace(
      /<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g,
      function (_, tag, attrs, slash) {
        const form = /^(input|textarea|select)$/i.test(tag);
        const out = attrs.replace(
          /(\s+)([^\s=>/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g,
          function (_m: string, sp: string, name: string, value: string | undefined) {
            const lower = name.toLowerCase();
            let jsx = JSX_NAMES[lower] || name;
            if (form && lower === "value") jsx = "defaultValue";
            if (lower === "checked") jsx = "defaultChecked";
            if (lower === "style" && value)
              return sp + "style=" + jsxStyle(value.replace(/^["']|["']$/g, ""));
            if (value === undefined && !SWITCHES.test(lower) && !/^(data|aria)-/.test(lower))
              return sp + jsx + '=""';
            return sp + jsx + (value === undefined ? "" : "=" + value);
          },
        );
        return "<" + tag + out + (slash || VOID.test(tag) ? " />" : ">");
      },
    );
}
