// The server over Streamable HTTP, stateless: each POST gets its own server
// and transport, so there are no sessions to keep and any instance can
// answer. The tools only read public data, so there's no sign-in.
import express, { type Express } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { KitSource } from "./kit";
import { createServer } from "./server";

export function createApp(source: KitSource, path = "/mcp"): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.post(path, async (req, res) => {
    const server = createServer(source);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      console.error("mcp:", (e as Error).message);
      if (!res.headersSent)
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal error" },
          id: null,
        });
    }
  });

  // Stateless: no event stream to open and no session to end
  app.all(path, (_req, res) => {
    res
      .status(405)
      .set("Allow", "POST")
      .json({ jsonrpc: "2.0", error: { code: -32000, message: "Use POST." }, id: null });
  });

  app.get("/healthz", (_req, res) => {
    res.type("text/plain").send("ok\n");
  });

  return app;
}
