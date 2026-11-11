# Carnegie Mellon Web Kilt MCP Server

An [MCP](https://modelcontextprotocol.io/) server for the
[Carnegie Mellon Web Kilt](https://webkilt.andrew.cmu.edu/), so an AI coding
agent can set up the kit and build pages with it the way the docs describe.

It reads each kit release's own data (`docs/kit.json` and the stylesheets)
from jsDelivr, so it knows every release from 0.3.0 on and never falls
behind the docs. It only reads public docs: no sign-in, nothing stored.

## Add It to Your Agent

The hosted server is at `https://webkilt.andrew.cmu.edu/mcp` (Streamable
HTTP).

Claude Code:

```bash
claude mcp add --transport http cmu-web-kilt https://webkilt.andrew.cmu.edu/mcp
```

VS Code (`.vscode/mcp.json`):

```json
{
  "servers": {
    "cmu-web-kilt": { "type": "http", "url": "https://webkilt.andrew.cmu.edu/mcp" }
  }
}
```

Cursor and most other agents take the same address in their MCP settings.

To run it on your own computer instead, over stdio:

```bash
npx -y cmu-web-kilt-mcp
```

## Tools

| Tool                | What It Does                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_components` | Lists components that match a search, or all of them, with labels and docs links                                                                                                    |
| `get_component`     | One component's description, requirements, classes and example markup; with `framework` (React, Svelte, Vue, Rails or Django), also how to use it there, with React's markup as JSX |
| `get_install`       | The code to add the kit for a setup: Cascade, another CMS, a web app, Django, Node, React, Svelte, Vue, Rails or a prototype (each release's own list)                              |
| `get_conventions`   | Class names, AP style and Title Case, headings, buttons and links, messages, colors, images and accessibility                                                                       |
| `check_html`        | Checks a page or fragment: unknown `cmu-` classes or `data-cmu-` hooks and, for a whole page, missing files, the `cmu-app` body class and the loading order                         |

Each tool takes an optional `version`, such as `0.4.0`; it defaults to the
latest release. The server also has a `set-up-kit` prompt.

## Develop

```bash
npm install
npm run dev          # Streamable HTTP on http://localhost:3000/mcp
npm run check        # lint, format, types, tests, build
node dist/cli.js     # stdio, after npm run build
node dist/cli.js --http 3333
```

The tests answer from a copy of kit 0.4.0's files in `test/fixtures/`, so
they don't use the network.

See [DEPLOYMENT.md](DEPLOYMENT.md) for hosting.

## License

BSD 3-Clause; see [LICENSE](LICENSE).
