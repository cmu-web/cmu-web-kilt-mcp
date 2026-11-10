// The hosted server (the container's command): Streamable HTTP on PORT, at
// MCP_PATH (default /mcp), behind the web server at webkilt.andrew.cmu.edu.
import { createApp } from "./http";
import { KitSource } from "./kit";

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
const path = process.env.MCP_PATH || "/mcp";

createApp(new KitSource(), path).listen(port, host, () =>
  console.log(`cmu-web-kilt-mcp on http://${host}:${port}${path}`),
);
