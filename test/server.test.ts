import { describe, expect, it } from "vitest";
import { KitSource } from "../src/kit";
import { connect, fakeCdn, textOf } from "./helpers";

describe("tools", () => {
  it("lists five read-only tools and a prompt", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "check_html",
      "get_component",
      "get_conventions",
      "get_install",
      "search_components",
    ]);
    expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(["set-up-kit"]);
    expect(client.getInstructions()).toMatch(/Load CMU's template first/);
  });

  it("searches components, best match first", async () => {
    const client = await connect();
    const out = textOf(
      await client.callTool({ name: "search_components", arguments: { query: "drop zone" } }),
    );
    expect(out.split("\n")[2]).toMatch(/File Drop Zone/);
    const app = textOf(
      await client.callTool({ name: "search_components", arguments: { label: "Icons" } }),
    );
    expect(app).toMatch(/Icons/);
    const none = await client.callTool({
      name: "search_components",
      arguments: { query: "xyzzy" },
    });
    expect(textOf(none)).toMatch(/No components/);
  });

  it("gets a component's markup", async () => {
    const client = await connect();
    const out = textOf(
      await client.callTool({ name: "get_component", arguments: { id: "field-button" } }),
    );
    expect(out).toMatch(/^# Field With a Button/);
    expect(out).toMatch(/cmu-field-button/);
    expect(out).toMatch(/```html/);
    const byName = textOf(
      await client.callTool({ name: "get_component", arguments: { id: "Field With a Button" } }),
    );
    expect(byName).toMatch(/^# Field With a Button/);
  });

  it("suggests close components for an unknown id", async () => {
    const client = await connect();
    const res = await client.callTool({ name: "get_component", arguments: { id: "file upload" } });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toMatch(/File Drop Zone/);
  });

  it("gives install steps for a setup", async () => {
    const client = await connect();
    const out = textOf(
      await client.callTool({ name: "get_install", arguments: { setup: "apps" } }),
    );
    expect(out).toMatch(/cmu-web-kilt-0\.4\.0\/css\/cmu-app\.css/);
    expect(out).toMatch(/Load CMU's template first/);
  });

  it("gives one convention or all", async () => {
    const client = await connect();
    const links = textOf(
      await client.callTool({ name: "get_conventions", arguments: { topic: "links" } }),
    );
    expect(links).toMatch(/## Buttons and Links/);
    expect(links).not.toMatch(/## Colors/);
    const bad = await client.callTool({ name: "get_conventions", arguments: { topic: "poetry" } });
    expect(bad.isError).toBe(true);
  });

  it("matches whole words and gives plain text", async () => {
    const client = await connect();
    const tap = textOf(
      await client.callTool({ name: "search_components", arguments: { query: "tap" } }),
    );
    expect(tap.split("\n")[2]).toMatch(/ID Tap/);
    const inside = textOf(
      await client.callTool({ name: "search_components", arguments: { query: "ropdown" } }),
    );
    expect(inside).toMatch(/No components/);
    const headings = textOf(
      await client.callTool({ name: "get_conventions", arguments: { topic: "headings" } }),
    );
    expect(headings).not.toMatch(/&[a-z]+;/);
    expect(headings).toMatch(/\u201CWho Can See the Syllabi\?\u201D/);
  });

  it("reports an old version as an error, not a crash", async () => {
    const client = await connect();
    const res = await client.callTool({
      name: "search_components",
      arguments: { version: "0.2.0" },
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toMatch(/0\.3\.0 and later/);
  });
});

describe("link previews", () => {
  // 0.5.0's files, with a kit.json that has 0.7.0's previews
  const withPreviews = () => {
    const { fetch } = fakeCdn("0.5.0");
    return new KitSource(async (url) => {
      const body = await fetch(url);
      if (!url.endsWith("/docs/kit.json")) return body;
      const data = JSON.parse(body);
      data.previews = [
        { id: "what", heading: "What People See", text: "- Title: Name the page and the site." },
        {
          id: "tags",
          heading: "Open Graph Tags",
          text: 'Add the tags:\n<meta property="og:title" content="A"> <meta property="og:image" content="B">',
        },
      ];
      return JSON.stringify(data);
    });
  };

  it("serves them as a conventions topic, the tags on their own lines", async () => {
    const client = await connect(withPreviews());
    for (const topic of ["link previews", "Open Graph", "og tags"]) {
      const out = textOf(
        await client.callTool({ name: "get_conventions", arguments: { topic, version: "0.5.0" } }),
      );
      expect(out).toMatch(/^Link Previews \/ Open Graph, kit 0\.5\.0/);
      expect(out).toMatch(/## Open Graph Tags/);
      expect(out).toContain('<meta property="og:title" content="A">\n<meta property="og:image"');
    }
  });

  it("points to the topic from all conventions and from a search", async () => {
    const client = await connect(withPreviews());
    const all = textOf(
      await client.callTool({ name: "get_conventions", arguments: { version: "0.5.0" } }),
    );
    expect(all).not.toMatch(/## Open Graph Tags/);
    expect(all).toMatch(/topic "link previews"/);
    const search = textOf(
      await client.callTool({
        name: "search_components",
        arguments: { query: "open graph", version: "0.5.0" },
      }),
    );
    expect(search).toMatch(/get_conventions with the topic "link previews"/);
  });

  it("sends older releases to their component", async () => {
    const client = await connect();
    const out = textOf(
      await client.callTool({ name: "get_conventions", arguments: { topic: "link previews" } }),
    );
    expect(out).toMatch(/as a component: search_components with "Open Graph"/);
  });
});
