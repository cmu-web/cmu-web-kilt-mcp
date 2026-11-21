# Web Kilt MCP Server: Notes for AI Agents

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [DEVELOPMENT.md](DEVELOPMENT.md)
before changing anything. The rules agents most often break here:

- Component markup, installation steps and conventions come from each kit
  release's `docs/kit.json`. Never write them into the server; change them in
  the kit repository.
- `src/jsx.ts` and `src/astro.ts` copy the kit's own conversions in its
  `docs/js/docs.js`. Change both repositories together, or not at all.
- Tests read the fake CDN in `test/fixtures/` and never call jsDelivr. Add a
  fixture rather than a network call.
- In stdio mode, log to standard error only; standard output carries the MCP
  protocol.
- Run `npm run check` before calling a change done.
- Made-up people only (e.g., Andrew Carnegie, ac00).
- Follow the Web Kilt's [writing conventions](https://webkilt.andrew.cmu.edu/0/conventions.html).
- Versions use semantic versioning as plain numbers (e.g., `0.4.1`).
