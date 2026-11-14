# Development

This server turns the Web Kilt's released documentation into MCP tool
responses. Work here when changing tool behavior, transport handling or
markup checks. Change component examples and installation instructions in
the [kit repository](https://github.com/cmu-web/cmu-web-kilt) instead.

## Run a Local Server

Use the Node version in [the Dockerfile](Dockerfile) for development, then
run these commands from the checkout:

```bash
npm ci
npx prek install
npm run dev
```

The development command watches TypeScript and serves Streamable HTTP at
`http://localhost:3000/mcp`. It uses the hosted server entry point, which
binds to all interfaces by default. To bind only to loopback:

```bash
HOST=127.0.0.1 npm run dev
```

Live tool calls use outbound HTTPS to jsDelivr. The server loads a
release's data on the first tool call that asks for it, not at startup.

## Where to Make Changes

| To Change                                             | Start Here                                        |
| ----------------------------------------------------- | ------------------------------------------------- |
| Tool arguments, responses or the setup prompt         | `src/server.ts`                                   |
| Release loading, latest-version resolution or caching | `src/kit.ts`                                      |
| HTML findings                                         | `src/check.ts`                                    |
| React markup conversion                               | `src/jsx.ts`                                      |
| HTTP routing and request handling                     | `src/http.ts`                                     |
| Hosted startup or the command-line entry point        | `src/index.ts` and `src/cli.ts`                   |
| Tests and released kit samples                        | `test/`                                           |
| Runtime image, CI or tooling checks                   | `Dockerfile`, `.github/workflows/` and `scripts/` |

## Follow a Tool Call

`src/http.ts` creates a server and transport for each POST request. The CLI
connects the same tool server to stdio. Both use `KitSource` to resolve a
kit version and load its data.

For an exact version, the source fetches `docs/kit.json`, both kit
stylesheets and `cmu-app.js` from that tag on jsDelivr. The JSON provides
component descriptions, examples, installation snippets and conventions.
The stylesheets and script provide the known class names and behavior
hooks used by the markup checker.

The source keeps successfully loaded releases in memory. Latest-version
resolution is cached for up to an hour; failed release loads are removed
from the cache so another call can retry. A new kit release normally goes
live with no server deployment, as long as its data format stays compatible.

Framework-specific notes come from release data when available. The server
also has fallback guidance for older releases and converts generic example
markup to JSX for React. Keep both paths working when changing the output.

## Check a Change

Add or update a focused test for behavior changes, then run:

```bash
npm run check
```

This checks Node types against the Dockerfile, linting, formatting and
TypeScript, then runs the tests and builds `dist/`. To reproduce the CI
check in its own Node environment:

```bash
podman build --target test .
```

Tests use a fake CDN backed by samples in `test/fixtures/`, including
releases before and after framework notes were added. They do not contact
jsDelivr. HTTP tests bind local ports, so the environment must allow
loopback connections.

Test tool output through the MCP client helpers in `test/helpers.ts` when
changing arguments or responses. Test `src/check.ts` findings separately
from transport behavior. A clean markup check means only that the checks
implemented here passed; review the rendered page in a browser too.

### Formatting and Hooks

Use `npm run lint:fix` and `npm run format` to apply fixes, then review the
diff. `npm run lint` and `npm run format:check` check without modifying files.
Follow the kit's [writing conventions](https://webkilt.andrew.cmu.edu/0/conventions.html)
for prose and examples.

The hooks installed during setup run linting, formatting, type checking
and the Node types check when relevant. Run `npx prek run --all-files` to
invoke them manually. Run the full check before submitting a pull request.
Branch from `main`, keep the change focused and use Conventional Commits
for commit subjects.

## Run It With an Agent

Build the checkout:

```bash
npm run build
```

For a client that starts a stdio server, set its command to `node` and its
argument to the absolute path of this checkout's `dist/cli.js`. The client
launches the process and owns its standard input and output; running it in
a terminal alone does not connect an agent.

To try the built CLI over local HTTP instead:

```bash
node dist/cli.js --http 3333
```

Connect the agent to `http://127.0.0.1:3333/mcp`. This CLI mode binds to
loopback and uses `/mcp`; the hosted entry point's environment settings are
listed in [Deployment](DEPLOYMENT.md#configuration).

Verify that the client discovers all five tools and can call
`get_component` with an explicit kit version. Keep diagnostic logging on
standard error for stdio; standard output carries the MCP protocol.

## Prepare a Server Release

The server version in `package.json` is independent of the kit releases it
reads. Start from an up-to-date `main` with passing CI and a clean working
tree. Choose a major version for incompatible tool or transport changes,
a minor version for additions or a patch for fixes.

Use `npm version major`, `minor` or `patch` with a release message, for example:

```bash
npm version patch -m "chore: release %s"
```

This updates the manifest and lockfile, creates a local commit and creates
an annotated tag named for the version, such as `0.3.0`, with no `v` prefix
(set in `.npmrc`). Review them, then follow
[Publish and Roll Out a Release](DEPLOYMENT.md#publish-and-roll-out-a-release).
A kit documentation release alone doesn't require a server version bump.
