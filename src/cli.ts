#!/usr/bin/env node
// npx cmu-web-kilt-mcp: the server over stdio, for agents that start it
// themselves. With --http [port], it serves Streamable HTTP on localhost
// instead.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createApp } from "./http";
import { KitSource } from "./kit";
import { createServer } from "./server";

const args = process.argv.slice(2);
const source = new KitSource();

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: cmu-web-kilt-mcp [--http [port]]

Runs the Carnegie Mellon Web Kilt MCP server over stdio, for an agent to
start. With --http, it serves Streamable HTTP at http://127.0.0.1:<port>/mcp
(port 3333 unless given).

The hosted copy is at https://webkilt.andrew.cmu.edu/mcp.`);
} else if (args.includes("--http")) {
  const next = args[args.indexOf("--http") + 1];
  const port = Number(next && /^\d+$/.test(next) ? next : 3333);
  createApp(source).listen(port, "127.0.0.1", () =>
    console.error(`cmu-web-kilt-mcp on http://127.0.0.1:${port}/mcp`),
  );
} else {
  // stdout carries the protocol, so messages go to stderr
  void createServer(source)
    .connect(new StdioServerTransport())
    .catch((e: Error) => {
      console.error("cmu-web-kilt-mcp:", e.message);
      process.exit(1);
    });
}
