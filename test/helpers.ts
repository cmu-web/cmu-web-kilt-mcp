import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { KitSource, type Fetcher } from "../src/kit";
import { createServer } from "../src/server";

const dir = join(__dirname, "fixtures");
const read = (f: string) => readFileSync(join(dir, f), "utf8");

/** jsDelivr, answered from test/fixtures (kit 0.4.0); other versions 404 */
export function fakeCdn(latest = "0.4.0"): { fetch: Fetcher; calls: string[] } {
  const calls: string[] = [];
  const fetch: Fetcher = async (url) => {
    calls.push(url);
    if (url.includes("/resolved")) return JSON.stringify({ version: latest });
    const m = /cmu-web-kilt@([\d.]+)\/(.+)$/.exec(url);
    if (!m || !["0.4.0", "0.5.0"].includes(m[1])) throw new Error(`404 ${url}`);
    const file = m[2].split("/").pop()!;
    // 0.5.0's files: the release with framework notes and setups
    return read(m[1] === "0.5.0" ? file.replace(/\.(\w+)$/, "-0.5.0.$1") : file);
  };
  return { fetch, calls };
}

export async function connect(source = new KitSource(fakeCdn().fetch)) {
  const server = createServer(source);
  const client = new Client({ name: "test", version: "1.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

export function textOf(result: unknown): string {
  const content = (result as { content: { type: string; text: string }[] }).content;
  return content.map((c) => c.text).join("\n");
}
