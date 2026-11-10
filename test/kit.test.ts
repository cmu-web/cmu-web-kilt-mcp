import { describe, expect, it } from "vitest";
import { KitSource, classesIn, compareVersions, hooksIn } from "../src/kit";
import { fakeCdn } from "./helpers";

describe("KitSource", () => {
  it("loads the latest release from jsDelivr", async () => {
    const cdn = fakeCdn();
    const kit = await new KitSource(cdn.fetch).get();
    expect(kit.version).toBe("0.4.0");
    expect(kit.components.length).toBeGreaterThan(90);
    expect(kit.cssClasses.has("cmu-field-button")).toBe(true);
    expect(kit.hooks.has("data-cmu-copy")).toBe(true);
    expect(cdn.calls.some((u) => u.endsWith("@0.4.0/docs/kit.json"))).toBe(true);
  });

  it("keeps each version and checks for a newer release at most hourly", async () => {
    let now = 0;
    const cdn = fakeCdn();
    const source = new KitSource(cdn.fetch, () => now);
    await source.get("latest");
    await source.get("0.4.0");
    await source.get();
    expect(cdn.calls.filter((u) => u.includes("/resolved"))).toHaveLength(1);
    expect(cdn.calls.filter((u) => u.endsWith("kit.json"))).toHaveLength(1);
    now = 2 * 60 * 60 * 1000;
    await source.get();
    expect(cdn.calls.filter((u) => u.includes("/resolved"))).toHaveLength(2);
  });

  it("explains versions it can't serve", async () => {
    const source = new KitSource(fakeCdn().fetch);
    await expect(source.get("latest-ish")).rejects.toThrow(/isn't a version/);
    await expect(source.get("0.2.7")).rejects.toThrow(/0\.3\.0 and later/);
    await expect(source.get("9.9.9")).rejects.toThrow(/no kit release 9\.9\.9/);
  });

  it("tries again after a failed load", async () => {
    let fail = true;
    const cdn = fakeCdn();
    const source = new KitSource(async (url) => {
      if (fail && url.endsWith("kit.json")) throw new Error("down");
      return cdn.fetch(url);
    });
    await expect(source.get("0.4.0")).rejects.toThrow();
    fail = false;
    await expect(source.get("0.4.0")).resolves.toMatchObject({ version: "0.4.0" });
  });
});

describe("helpers", () => {
  it("compares versions", () => {
    expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareVersions("0.3.0", "0.3.0")).toBe(0);
  });
  it("finds classes and hooks", () => {
    expect([...classesIn(".cmu-a, #x .cmu-b:hover{} .other{}")]).toEqual(["cmu-a", "cmu-b"]);
    expect([...hooksIn('q("[data-cmu-tap]"); a.getAttribute("data-cmu-copy")')]).toEqual([
      "data-cmu-tap",
      "data-cmu-copy",
    ]);
  });
});
