import { describe, expect, it } from "vitest";
import { toJsx } from "../src/jsx";
import { connect, textOf } from "./helpers";

describe("toJsx", () => {
  it("spells attributes React's way and closes empty elements", () => {
    expect(toJsx('<label for="a" class="b">A</label><input id="a" tabindex="0">')).toBe(
      '<label htmlFor="a" className="b">A</label><input id="a" tabIndex="0" />',
    );
  });
  it("makes form values defaults, so the fields stay editable", () => {
    expect(toJsx('<input value="ac00"><input type="checkbox" checked>')).toBe(
      '<input defaultValue="ac00" /><input type="checkbox" defaultChecked />',
    );
    expect(toJsx('<select><option>A</option><option value="b" selected>B</option></select>')).toBe(
      '<select defaultValue="b"><option>A</option><option value="b">B</option></select>',
    );
  });
  it("keeps an empty alt empty, and switches as switches", () => {
    expect(toJsx('<img src="x.png" alt><button disabled data-cmu-copy="#t">')).toBe(
      '<img src="x.png" alt="" /><button disabled data-cmu-copy="#t">',
    );
  });
  it("turns styles into objects and comments into JSX comments", () => {
    expect(toJsx('<!-- Note --><div style="max-width: 20rem; --cmu-x: 1">')).toBe(
      '{/* Note */}<div style={{ maxWidth: "20rem", "--cmu-x": "1" }}>',
    );
  });
});

describe("frameworks", () => {
  it("gives a component's written framework steps", async () => {
    const client = await connect();
    const out = textOf(
      await client.callTool({
        name: "get_component",
        arguments: { id: "sort", framework: "svelte", version: "0.5.0" },
      }),
    );
    expect(out).toMatch(/## In Svelte 5/);
    expect(out).toMatch(/cmu-sort-move/);
    expect(out).toMatch(/```svelte/);
  });

  it("gives other components' markup in the framework's form", async () => {
    const client = await connect();
    const out = textOf(
      await client.callTool({
        name: "get_component",
        arguments: { id: "field-button", framework: "React", version: "0.5.0" },
      }),
    );
    expect(out).toMatch(/Nothing more to do in React/);
    expect(out).toMatch(/<div className="cmu-field-button">/);
    expect(out).toMatch(/```jsx/);
  });

  it("works for releases from before the framework notes", async () => {
    const client = await connect();
    const out = textOf(
      await client.callTool({
        name: "get_component",
        arguments: { id: "field-button", framework: "Rails", version: "0.4.0" },
      }),
    );
    expect(out).toMatch(/## In Rails 7\.2 and Later/);
    expect(out).toMatch(/use this markup in a view/);
  });

  it("names the frameworks it covers for one it doesn't", async () => {
    const client = await connect();
    const res = await client.callTool({
      name: "get_component",
      arguments: { id: "sort", framework: "Angular", version: "0.5.0" },
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toMatch(/covers React, Svelte, Vue, Rails, Django/);
  });

  it("reads setups from the release, the new framework ones included", async () => {
    const client = await connect();
    const react = textOf(
      await client.callTool({
        name: "get_install",
        arguments: { setup: "react", version: "0.5.0" },
      }),
    );
    expect(react).toMatch(/a React app/);
    expect(react).toMatch(/\/src\/main\.jsx/);
    const none = await client.callTool({
      name: "get_install",
      arguments: { setup: "react", version: "0.4.0" },
    });
    expect(none.isError).toBe(true);
    expect(textOf(none)).toMatch(/It has: cascade, other-cms, apps/);
  });
});
