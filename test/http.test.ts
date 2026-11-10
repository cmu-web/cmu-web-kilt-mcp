import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/http";
import { KitSource } from "../src/kit";
import { fakeCdn } from "./helpers";

const app = createApp(new KitSource(fakeCdn().fetch));
const rpc = (body: object) =>
  request(app)
    .post("/mcp")
    .set("Accept", "application/json, text/event-stream")
    .set("Content-Type", "application/json")
    .send(body);

describe("HTTP", () => {
  it("initializes and calls a tool without a session", async () => {
    const init = await rpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" },
      },
    });
    expect(init.status).toBe(200);
    expect(init.body.result.serverInfo.name).toBe("cmu-web-kilt");
    expect(init.headers["mcp-session-id"]).toBeUndefined();

    const call = await rpc({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get_component", arguments: { id: "file-picker" } },
    });
    expect(call.status).toBe(200);
    expect(call.body.result.content[0].text).toMatch(/File Drop Zone/);
  });

  it("only takes POST", async () => {
    const res = await request(app).get("/mcp");
    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe("POST");
  });

  it("answers a health check", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
  });
});
