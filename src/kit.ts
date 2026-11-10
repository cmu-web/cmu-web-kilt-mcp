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
  components: Component[];
  install: Record<string, string[]>;
  conventions: Convention[];
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
  private latest?: { version: string; at: number };

  constructor(
    private fetchText: Fetcher = defaultFetch,
    private now: () => number = Date.now,
  ) {}

  /** The newest release's version, checked at most once an hour */
  async latestVersion(): Promise<string> {
    if (this.latest && this.now() - this.latest.at < LATEST_TTL) return this.latest.version;
    const body = JSON.parse(await this.fetchText(RESOLVE)) as { version?: string | null };
    if (!body.version) throw new KitError("Couldn't find the kit's latest release.");
    this.latest = { version: body.version, at: this.now() };
    return body.version;
  }

  /** The kit at a version ("latest" or omitted for the newest release) */
  async get(version?: string): Promise<Kit> {
    const v = !version || version === "latest" ? await this.latestVersion() : version;
    if (!/^\d+\.\d+\.\d+$/.test(v))
      throw new KitError(`"${version}" isn't a version. Use one like 0.4.0, or "latest".`);
    if (compareVersions(v, FIRST_VERSION) < 0)
      throw new KitError(
        `This server knows ${FIRST_VERSION} and later. For ${v}, see the docs at https://webkilt.andrew.cmu.edu/.`,
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
    const data = JSON.parse(json) as KitData;
    return {
      ...data,
      cssClasses: new Set([...classesIn(cms), ...classesIn(app)]),
      hooks: hooksIn(js),
    };
  }
}
