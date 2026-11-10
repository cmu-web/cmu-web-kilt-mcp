import { beforeAll, describe, expect, it } from "vitest";
import { checkHtml } from "../src/check";
import { KitSource, type Kit } from "../src/kit";
import { connect, fakeCdn, textOf } from "./helpers";

let kit: Kit;
beforeAll(async () => {
  kit = await new KitSource(fakeCdn().fetch).get();
});

const head = (extra = "") => `<!doctype html><html><head>
<link href="https://www.cmu.edu/common/standard-v6/css/main.6.7.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/gh/cmu-web/cmu-web-kilt@0.4.0/css/cmu-cms.css" rel="stylesheet">
${extra}</head>`;

describe("checkHtml", () => {
  it("passes a correct app page", () => {
    const html = `${head('<link href="https://cdn.jsdelivr.net/gh/cmu-web/cmu-web-kilt@0.4.0/css/cmu-app.css" rel="stylesheet">')}
<body class="cmu-app"><div class="cmu-field-button"><input><button class="btn">Add</button></div>
<script src="https://cdn.jsdelivr.net/gh/cmu-web/cmu-web-kilt@0.4.0/js/cmu-app.js"></script></body></html>`;
    const r = checkHtml(kit, html);
    expect(r.findings).toEqual([]);
    expect(r.components.map((c) => c.id)).toContain("field-button");
  });

  it("flags classes and hooks the kit doesn't have", () => {
    const r = checkHtml(kit, '<div class="cmu-fieldbutton" data-cmu-zap></div>');
    expect(r.findings.map((f) => f.message).join(" ")).toMatch(/no class cmu-fieldbutton/);
    expect(r.findings.map((f) => f.message).join(" ")).toMatch(/no data-cmu-zap hook/);
  });

  it("says what a fragment's page uses", () => {
    const r = checkHtml(kit, '<div class="cmu-field-button"></div>');
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ level: "note" });
    expect(r.findings[0].message).toMatch(/cmu-app on <body>/);
  });

  it("flags a missing body class, file and script", () => {
    const html = `${head()}<body><label class="cmu-drop"><input type="file"></label></body></html>`;
    const msgs = checkHtml(kit, html).findings.map((f) => f.message);
    expect(msgs.some((m) => /cmu-app\.css/.test(m))).toBe(true);
    expect(msgs.some((m) => /cmu-app class on <body>/.test(m))).toBe(true);
    expect(msgs.some((m) => /cmu-app\.js/.test(m))).toBe(true);
  });

  it("flags the kit loading before the template, and mixed versions", () => {
    const html = `<html><head>
<link href="https://cdn.jsdelivr.net/gh/cmu-web/cmu-web-kilt@0.3.1/css/cmu-cms.css" rel="stylesheet">
<link href="https://www.cmu.edu/common/standard-v6/css/main.6.7.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/gh/cmu-web/cmu-web-kilt@0.4.0/js/cmu-app.js"></script>
</head><body><p class="cmu-lead">Hi</p></body></html>`;
    const msgs = checkHtml(kit, html).findings.map((f) => f.message);
    expect(msgs.some((m) => /before the template/.test(m))).toBe(true);
    expect(msgs.some((m) => /mixes kit versions/.test(m))).toBe(true);
  });

  it("answers through the tool", async () => {
    const client = await connect();
    const out = textOf(
      await client.callTool({ name: "check_html", arguments: { html: '<p class="cmu-nope">' } }),
    );
    expect(out).toMatch(/Problems found/);
    expect(out).toMatch(/no class cmu-nope/);
  });
});
