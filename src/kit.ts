// The kit's own data, per release: docs/kit.json (components, install
// snippets, conventions) and the class names its stylesheets define. Both
// come from jsDelivr, which serves every tagged release of the kit's repo,
// so the server never falls behind the docs, and a new kit release never
// calls for a deploy.

export interface Component {
  id: string;
  name: string;
  page: string;
  url: string;
  labels: string[];
  description: string;
  notes: string[];
  classes: string[];
  examples: string[];
  /** Hand-written framework notes (0.5.0 and later), by framework */
  frameworks?: Record<string, { text: string; code?: string }>;
}

export interface Convention {
  id: string;
  heading: string;
  text: string;
}

export interface KitData {
  name: string;
  version: string;
  docs: string;
  files: Record<string, string>;
  labels: Record<string, string>;
  /** Framework names and the versions their examples are for (0.5.0 and later) */
  frameworks?: Record<string, string>;
  components: Component[];
  install: Record<string, string[]>;
  conventions: Convention[];
  /** Link Previews / Open Graph, by section (0.7.0 and later; before, the
   * Open Graph Tags component) */
  previews?: Convention[];
}

export interface Kit extends KitData {
  /** Every cmu- class the kit's stylesheets define */
  cssClasses: Set<string>;
  /** Every data-cmu-* hook the kit's script reads */
  hooks: Set<string>;
}

export type Fetcher = (url: string) => Promise<string>;

const REPO = "cmu-web/cmu-web-kilt";
const CDN = `https://cdn.jsdelivr.net/gh/${REPO}`;
const RESOLVE = `https://data.jsdelivr.com/v1/packages/gh/${REPO}/resolved`;
/** kit.json ships with 0.3.0 and later */
export const FIRST_VERSION = "0.3.0";
const LATEST_TTL = 60 * 60 * 1000;

/** The hosted docs. Each template line's docs are under its number: 0.x
 * releases at 0/, 1.x at 1/. */
export const DEFAULT_DOCS_URL = "https://webkilt.andrew.cmu.edu/";

export class KitError extends Error {}

const defaultFetch: Fetcher = async (url) => {
  const res = await fetch(url, { headers: { "User-Agent": "cmu-web-kilt-mcp" } });
  if (!res.ok) throw new KitError(`${url} answered ${res.status}`);
  return res.text();
};

export function compareVersions(a: string, b: string): number {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/** A release's line's docs: the docs URL plus the major version */
export function lineDocs(docsUrl: string, version: string): string {
  return `${docsUrl.replace(/\/*$/, "/")}${version.split(".")[0]}/`;
}

/** A release's doc links, moved under docs. kit.json through 0.6.7 links to
 * the site's root, from before the lines; later ones may name another host. */
export function relink(data: KitData, docs: string): KitData {
  const move = (url: string) =>
    url.startsWith(data.docs) ? docs + url.slice(data.docs.length) : url;
  return {
    ...data,
    docs,
    components: data.components.map((c) => ({ ...c, url: move(c.url) })),
  };
}

/** Class names in a stylesheet that start with cmu- */
export function classesIn(css: string): Set<string> {
  return new Set([...css.matchAll(/\.(cmu-[a-z0-9-]+)/g)].map((m) => m[1]));
}

/** data-cmu-* attribute names a script mentions */
export function hooksIn(js: string): Set<string> {
  return new Set([...js.matchAll(/data-cmu-[a-z0-9-]+/g)].map((m) => m[0]));
}

export class KitSource {
  private kits = new Map<string, Promise<Kit>>();
  /** Newest release per specifier ("" for any line, "0" for line 0) */
  private latest = new Map<string, { version: string; at: number }>();

  constructor(
    private fetchText: Fetcher = defaultFetch,
    private now: () => number = Date.now,
    /** Where the docs are served, set by DOCS_URL on the hosted server */
    readonly docsUrl: string = DEFAULT_DOCS_URL,
  ) {}

  /** The newest release, of one line ("0") or of any line, checked at most
   * once an hour */
  async latestVersion(line = ""): Promise<string> {
    const cached = this.latest.get(line);
    if (cached && this.now() - cached.at < LATEST_TTL) return cached.version;
    const url = line ? `${RESOLVE}?specifier=${line}` : RESOLVE;
    const body = JSON.parse(await this.fetchText(url)) as { version?: string | null };
    if (!body.version)
      throw new KitError(
        line ? `There's no ${line}.x release yet.` : "Couldn't find the kit's newest release.",
      );
    this.latest.set(line, { version: body.version, at: this.now() });
    return body.version;
  }

  /** The kit at a version: an exact release ("0.6.9"), a line ("0.x" or "0")
   * for its newest release, or omitted ("latest") for the newest of any line */
  async get(version?: string): Promise<Kit> {
    const line = /^(\d+)(\.x)?$/.exec(version ?? "")?.[1];
    const v =
      !version || version === "latest"
        ? await this.latestVersion()
        : line !== undefined
          ? await this.latestVersion(line)
          : version;
    if (!/^\d+\.\d+\.\d+$/.test(v))
      throw new KitError(
        `"${version}" isn't a version. Pass the release your project pins, like 0.6.9, or a line, like 0.x, for that line's newest release.`,
      );
    if (compareVersions(v, FIRST_VERSION) < 0)
      throw new KitError(
        `This server knows ${FIRST_VERSION} and later. For ${v}, see the docs at ${lineDocs(this.docsUrl, v)}.`,
      );
    let kit = this.kits.get(v);
    if (!kit) {
      kit = this.load(v);
      this.kits.set(v, kit);
      // A failed load isn't cached, so the next call tries again
      kit.catch(() => this.kits.delete(v));
    }
    return kit;
  }

  private async load(v: string): Promise<Kit> {
    const base = `${CDN}@${v}`;
    // kit.json first: if it's missing, so is the release
    const json = await this.fetchText(`${base}/docs/kit.json`).catch(() => {
      throw new KitError(`There's no kit release ${v}.`);
    });
    const [cms, app, js] = await Promise.all([
      this.fetchText(`${base}/css/cmu-cms.css`),
      this.fetchText(`${base}/css/cmu-app.css`),
      this.fetchText(`${base}/js/cmu-app.js`),
    ]);
    const data = relink(JSON.parse(json) as KitData, lineDocs(this.docsUrl, v));
    return {
      ...data,
      cssClasses: new Set([...classesIn(cms), ...classesIn(app)]),
      hooks: hooksIn(js),
    };
  }
}
