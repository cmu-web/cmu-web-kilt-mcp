// Looks over someone's HTML for kit mistakes: cmu- classes and data-cmu-
// hooks the kit doesn't have, and, for a whole page, files and body classes
// its components need, in the kit's loading order.
import type { Component, Kit } from "./kit";

export type Level = "error" | "warning" | "note";

export interface Finding {
  level: Level;
  message: string;
}

export interface CheckResult {
  version: string;
  components: { id: string; name: string; labels: string[]; url: string }[];
  findings: Finding[];
}

/** cmu- class names in a component's class list ("ul.cmu-plain" -> cmu-plain) */
function componentClasses(c: Component): string[] {
  return c.classes.flatMap((s) => s.split(/[\s.]+/)).filter((s) => s.startsWith("cmu-"));
}

function classesUsed(html: string): Set<string> {
  const out = new Set<string>();
  for (const m of html.matchAll(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi))
    for (const name of (m[1] ?? m[2]).split(/\s+/)) if (name) out.add(name);
  return out;
}

function hooksUsed(html: string): Set<string> {
  return new Set([...html.matchAll(/\b(data-cmu-[a-z0-9-]+)/gi)].map((m) => m[1].toLowerCase()));
}

function bodyClasses(html: string): Set<string> | undefined {
  const m = /<body\b[^>]*\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(html);
  if (m) return new Set((m[1] ?? m[2]).split(/\s+/));
  return /<body\b/i.test(html) ? new Set() : undefined;
}

/** Close matches, for "did you mean" */
function near(name: string, known: Iterable<string>): string[] {
  const stem = name.replace(/^cmu-/, "").split("-")[0];
  return [...known].filter((k) => k.replace(/^cmu-/, "").startsWith(stem)).slice(0, 4);
}

export function checkHtml(kit: Kit, html: string): CheckResult {
  const findings: Finding[] = [];
  const used = classesUsed(html);
  const hooks = hooksUsed(html);

  for (const name of used) {
    if (name.startsWith("cmu-") && !kit.cssClasses.has(name)) {
      const hint = near(name, kit.cssClasses);
      findings.push({
        level: "error",
        message: `The kit has no class ${name}.${hint.length ? ` Did you mean ${hint.join(", ")}?` : ""} Give your own classes your own prefix, never cmu-.`,
      });
    }
  }
  for (const hook of hooks) {
    if (!kit.hooks.has(hook))
      findings.push({ level: "error", message: `The kit's script has no ${hook} hook.` });
  }

  // Components on the page, from their kit classes
  const byClass = new Map<string, Component[]>();
  for (const c of kit.components)
    for (const name of componentClasses(c)) byClass.set(name, [...(byClass.get(name) ?? []), c]);
  const found = new Map<string, Component>();
  for (const name of used) for (const c of byClass.get(name) ?? []) found.set(c.id, c);
  const components = [...found.values()];
  const withLabel = (label: string) => components.filter((c) => c.labels.includes(label));
  const names = (cs: Component[]) => cs.map((c) => c.name).join(", ");

  const usesKit = [...used].some((n) => n.startsWith("cmu-")) || hooks.size > 0;
  const app = withLabel("App"),
    script = withLabel("Script"),
    icons = withLabel("Icons");
  const body = bodyClasses(html);
  const wholePage = body !== undefined || /<head\b/i.test(html);

  if (!wholePage) {
    if (usesKit)
      findings.push({
        level: "note",
        message:
          "This is a fragment, so its page wasn't checked. The page loads CMU's template, then cmu-cms.css" +
          (app.length ? `, cmu-app.css and cmu-app on <body> (for ${names(app)})` : "") +
          (script.length ? `, and cmu-app.js at the end of <body> (for ${names(script)})` : "") +
          (icons.length ? `; Bootstrap Icons too (for ${names(icons)})` : "") +
          ".",
      });
    return { version: kit.version, components: summary(components), findings };
  }

  const at = (re: RegExp) => {
    const m = re.exec(html);
    return m ? m.index : -1;
  };
  const template = at(/standard-v6\/css\/main[^"']*\.css/i);
  const cms = at(/cmu-cms\.css/i);
  const appCss = at(/cmu-app\.css/i);
  const appJs = at(/cmu-app\.js/i);

  if (template < 0)
    findings.push({
      level: "warning",
      message:
        "CMU's template stylesheet (standard-v6/css/main.6.7.min.css) isn't linked. The kit builds on it.",
    });
  if (usesKit && cms < 0)
    findings.push({
      level: "error",
      message: "The page uses the kit but doesn't load cmu-cms.css.",
    });
  if (template >= 0 && cms >= 0 && cms < template)
    findings.push({
      level: "error",
      message: "cmu-cms.css loads before the template's stylesheet. Load the template first.",
    });
  if (cms >= 0 && appCss >= 0 && appCss < cms)
    findings.push({ level: "error", message: "cmu-app.css loads before cmu-cms.css." });
  if (app.length) {
    if (appCss < 0)
      findings.push({
        level: "error",
        message: `${names(app)} use cmu-app.css, which isn't loaded.`,
      });
    if (body && !body.has("cmu-app") && !body.has("cmu-framed"))
      findings.push({
        level: "error",
        message: `${names(app)} use the cmu-app class on <body> (or cmu-framed on a page inside another tool).`,
      });
  }
  if ((script.length || hooks.size) && appJs < 0)
    findings.push({
      level: "error",
      message: `${script.length ? names(script) : "data-cmu- hooks"} use cmu-app.js, at the end of <body>, which isn't loaded.`,
    });
  if (icons.length && !/bootstrap-icons/i.test(html))
    findings.push({
      level: "warning",
      message: `${names(icons)} use Bootstrap Icons, whose stylesheet isn't linked.`,
    });

  const versions = new Set(
    [...html.matchAll(/cmu-web-kilt(?:@|-)(\d+\.\d+\.\d+)/g)].map((m) => m[1]),
  );
  if (versions.size > 1)
    findings.push({
      level: "error",
      message: `The page mixes kit versions: ${[...versions].join(", ")}. Use one.`,
    });
  for (const v of versions)
    if (v !== kit.version)
      findings.push({
        level: "note",
        message: `The page loads kit ${v}; this check used ${kit.version}.`,
      });

  return { version: kit.version, components: summary(components), findings };
}

function summary(cs: Component[]) {
  return cs.map((c) => ({ id: c.id, name: c.name, labels: c.labels, url: c.url }));
}
