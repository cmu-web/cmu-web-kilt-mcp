// The MCP server: read-only tools over the kit's data for a release.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";
import { checkHtml } from "./check";
import { KitError, KitSource, type Component, type Kit } from "./kit";

const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8")) as {
  version: string;
};

const SETUPS = ["cascade", "other-cms", "apps", "django", "node", "prototype"] as const;
const SETUP_NAMES: Record<(typeof SETUPS)[number], string> = {
  cascade: "a Cascade site",
  "other-cms": "Drupal or another CMS on CMU's template",
  apps: "a web app (any stack)",
  django: "a Django app",
  node: "a Node app",
  prototype: "a prototype or mockup, linked from the CDN",
};

const INSTRUCTIONS = `The Carnegie Mellon Web Kilt adds components and app conventions to CMU's web template (www.cmu.edu/common/standard-v6). Docs: https://webkilt.andrew.cmu.edu/.

Use it like this:
- Set up: get_install for the project's setup. Load CMU's template first, then the kit (cmu-cms.css, then cmu-app.css for apps), then the project's own styles. Pin one exact kit version; production apps keep a local copy.
- Build pages: search_components, then get_component for its markup. Use the template's and the kit's classes instead of writing new CSS for what they already have. Components labeled App use cmu-app on <body>; Script ones use cmu-app.js at the end of <body>.
- Write text: get_conventions (AP style, Title Case for headings and buttons, links go somewhere and buttons do something).
- Before finishing: check_html on the pages you changed.

Every tool takes an optional version (like 0.4.0); it defaults to the latest release.`;

const version = z
  .string()
  .optional()
  .describe('A kit release, like "0.4.0". Defaults to the latest.');

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

function text(s: string): CallToolResult {
  return { content: [{ type: "text", text: s }] };
}

function failure(e: unknown): CallToolResult {
  const message = e instanceof KitError ? e.message : `Something went wrong: ${String(e)}`;
  return { content: [{ type: "text", text: message }], isError: true };
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ldquo: "\u201C",
  rdquo: "\u201D",
  lsquo: "\u2018",
  rsquo: "\u2019",
  hellip: "\u2026",
  mdash: "\u2014",
  ndash: "\u2013",
  times: "\u00D7",
  rsaquo: "\u203A",
  copy: "\u00A9",
};

/** kit.json's prose can carry HTML entities from the docs; agents get plain text */
export function plain(s: string): string {
  return s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#")
      return String.fromCodePoint(
        e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1),
      );
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function firstSentence(s: string): string {
  const m = /^.*?[.!?](\s|$)/s.exec(s.split("\n")[0]);
  return (m ? m[0] : s.split("\n")[0]).trim();
}

function find(kit: Kit, idOrName: string): Component | undefined {
  const key = idOrName.trim().toLowerCase();
  return kit.components.find((c) => c.id === key || c.name.toLowerCase() === key);
}

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every word has to start a word somewhere; words in the name or id count most */
function matches(c: Component, words: string[]): number {
  const hay = [c.id, c.name, c.page, plain(c.description), ...c.classes].join(" ").toLowerCase();
  const title = `${c.id} ${c.name}`.toLowerCase();
  let score = 0;
  for (const w of words) {
    const re = new RegExp(`(^|[^a-z0-9])${escape(w)}`);
    if (!re.test(hay)) return 0;
    score += re.test(title) ? 3 : 1;
  }
  return score;
}

export function describeComponent(kit: Kit, c: Component): string {
  const lines = [
    `# ${c.name}`,
    "",
    `Kit ${kit.version}, ${c.page} page: ${c.url}`,
    "",
    `Labels: ${c.labels.map((l) => `${l} (${kit.labels[l] ?? ""})`).join("; ")}`,
    "",
    plain(c.description),
  ];
  if (c.notes.length) lines.push("", "Notes:", ...c.notes.map((n) => `- ${plain(n)}`));
  if (c.classes.length) lines.push("", `Classes: ${c.classes.join(", ")}`);
  c.examples.forEach((ex, i) =>
    lines.push("", c.examples.length > 1 ? `Example ${i + 1}:` : "Example:", "```html", ex, "```"),
  );
  return lines.join("\n");
}

export function createServer(source: KitSource): McpServer {
  const server = new McpServer(
    { name: "cmu-web-kilt", title: "Carnegie Mellon Web Kilt", version: pkg.version },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "search_components",
    {
      title: "Search Components",
      description:
        "Lists the kit's components (and the template's, labeled Template) that match a search, with their labels and docs links. With no query, lists them all.",
      inputSchema: {
        query: z.string().optional().describe('Words to look for, like "upload file" or "tabs".'),
        label: z
          .enum(["Template", "CMS", "App", "Script", "Icons"])
          .optional()
          .describe("Only components with this label."),
        version,
      },
      annotations: READ_ONLY,
    },
    async ({ query, label, version: v }) => {
      try {
        const kit = await source.get(v);
        const words = (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
        const hits = kit.components
          .filter((c) => !label || c.labels.includes(label))
          .map((c) => ({ c, score: words.length ? matches(c, words) : 1 }))
          .filter((h) => h.score > 0)
          .sort((a, b) => b.score - a.score);
        if (!hits.length)
          return text(
            `No components in kit ${kit.version} match${query ? ` "${query}"` : ""}${label ? ` with the ${label} label` : ""}. Try fewer or different words, or search with no query to list them all.`,
          );
        return text(
          [
            `${hits.length} of ${kit.components.length} components in kit ${kit.version}. Use get_component with an id for its markup.`,
            "",
            ...hits.map(
              ({ c }) =>
                `- ${c.name} (id: ${c.id}; ${c.labels.join(", ")}): ${firstSentence(plain(c.description))} ${c.url}`,
            ),
          ].join("\n"),
        );
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "get_component",
    {
      title: "Get a Component",
      description:
        "One component's full description, what it requires (its labels), its classes and example markup to copy.",
      inputSchema: {
        id: z
          .string()
          .describe('The component\'s id or name, from search_components, like "drop".'),
        version,
      },
      annotations: READ_ONLY,
    },
    async ({ id, version: v }) => {
      try {
        const kit = await source.get(v);
        const c = find(kit, id);
        if (c) return text(describeComponent(kit, c));
        const words = id
          .toLowerCase()
          .split(/[\s-]+/)
          .filter(Boolean);
        const close = kit.components
          .map((x) => ({ x, s: Math.max(...words.map((w) => matches(x, [w]))) }))
          .filter((h) => h.s > 0)
          .sort((a, b) => b.s - a.s)
          .slice(0, 5)
          .map((h) => `${h.x.name} (${h.x.id})`);
        return {
          ...text(
            `Kit ${kit.version} has no component "${id}".${close.length ? ` Close: ${close.join(", ")}.` : ""} Use search_components to find one.`,
          ),
          isError: true,
        };
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "get_install",
    {
      title: "Get Install Steps",
      description:
        "The code to add the kit to a project, for one kind of setup, with the files and their loading order.",
      inputSchema: {
        setup: z.enum(SETUPS).describe(
          Object.entries(SETUP_NAMES)
            .map(([k, d]) => `${k}: ${d}`)
            .join("; "),
        ),
        version,
      },
      annotations: READ_ONLY,
    },
    async ({ setup, version: v }) => {
      try {
        const kit = await source.get(v);
        const snippets = kit.install[setup] ?? [];
        const files = Object.entries(kit.files).map(([f, url]) => `- ${f}: ${url}`);
        return text(
          [
            `# Kit ${kit.version} in ${SETUP_NAMES[setup]}`,
            "",
            "Load CMU's template first, then cmu-cms.css, then cmu-app.css (apps only), then the project's own styles; cmu-app.js goes at the end of <body>.",
            "",
            ...snippets.flatMap((s, i) => [
              snippets.length > 1 ? `Step ${i + 1}:` : "Code:",
              "```",
              s,
              "```",
              "",
            ]),
            "The kit's files at this version:",
            ...files,
            "",
            `More: ${kit.docs}install.html`,
          ].join("\n"),
        );
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "get_conventions",
    {
      title: "Get Conventions",
      description:
        "The kit's rules for class names, writing (AP style, Title Case, names), headings, links and buttons, messages, colors, images and accessibility.",
      inputSchema: {
        topic: z
          .string()
          .optional()
          .describe('One topic, like "links" or "headings". Omit for all of them.'),
        version,
      },
      annotations: READ_ONLY,
    },
    async ({ topic, version: v }) => {
      try {
        const kit = await source.get(v);
        const key = topic?.trim().toLowerCase();
        const picked = key
          ? kit.conventions.filter((c) => c.id === key || c.heading.toLowerCase().includes(key))
          : kit.conventions;
        if (!picked.length)
          return {
            ...text(
              `No convention matches "${topic}". Topics: ${kit.conventions.map((c) => c.heading).join(", ")}.`,
            ),
            isError: true,
          };
        return text(
          [
            `Conventions, kit ${kit.version} (${kit.docs}conventions.html)`,
            ...picked.flatMap((c) => ["", `## ${plain(c.heading)}`, "", plain(c.text)]),
          ].join("\n"),
        );
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "check_html",
    {
      title: "Check HTML",
      description:
        "Checks a page or a fragment for kit mistakes: cmu- classes or data-cmu- hooks the kit doesn't have and, for a whole page, missing files, the cmu-app body class and the loading order.",
      inputSchema: {
        html: z.string().describe("The HTML to check: a whole page or a fragment."),
        version,
      },
      annotations: READ_ONLY,
    },
    async ({ html, version: v }) => {
      try {
        const kit = await source.get(v);
        const result = checkHtml(kit, html);
        const found = result.components.map((c) => c.name).join(", ");
        const lines = [
          result.findings.some((f) => f.level === "error")
            ? `Problems found, checked against kit ${result.version}:`
            : `No problems found, checked against kit ${result.version}.`,
        ];
        for (const f of result.findings) lines.push(`- ${f.level}: ${f.message}`);
        if (found) lines.push("", `Components on it: ${found}.`);
        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: { ...result },
        };
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerPrompt(
    "set-up-kit",
    {
      title: "Set Up the Web Kilt",
      description: "Adds the Carnegie Mellon Web Kilt to the project you're working in.",
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Set up the Carnegie Mellon Web Kilt in this project. Use the cmu-web-kilt tools: get_install for this kind of project, search_components and get_component for any page you change, get_conventions for wording, and check_html on the result. Load CMU's template first, then the kit, then the project's own styles. Pin the kit to its current version, keep a local copy for a production app, and use the kit's classes instead of writing new CSS for what it already has.",
          },
        },
      ],
    }),
  );

  return server;
}
