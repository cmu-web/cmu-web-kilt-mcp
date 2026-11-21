# Deployment

## Release Files

Each version tag (e.g., `0.3.0`) publishes a container image,
`ghcr.io/cmu-web/cmu-web-kilt-mcp`, built for `linux/amd64`, with these tags:

| Image Tag      | What                                      |
| -------------- | ----------------------------------------- |
| `X.Y.Z`        | The build of version tag `X.Y.Z`          |
| `latest`       | The most recent version-tag build         |
| `sha-<commit>` | A build identified by its short commit ID |

The image runs `dist/index.js`, which serves Streamable HTTP to MCP clients.
The CLI's stdio mode is for clients that start their own process; see
[Development](DEVELOPMENT.md#run-it-with-an-agent). There's no npm package:
`package.json` defines the `cmu-web-kilt-mcp` command, but nothing publishes
it to npm.

## Install

### In a Container

```sh
docker run -d --name web-kilt-mcp \
  -p 127.0.0.1:3000:3000 \
  ghcr.io/cmu-web/cmu-web-kilt-mcp:latest
```

Podman takes the same flags. For a deployment, replace `:latest` with the
release's digest, so the image is explicit, and keep the previous digest for
rolling back. The loopback port sits behind a reverse proxy (below).

To build the image from a checkout instead:

```sh
docker build --target test .
docker build -t localhost/web-kilt-mcp:latest .
```

With Podman, add `--format docker` to the second command; the image's health
check needs Docker's format. Use the local image name in the run command.

### Configuration

| Variable   | Default                           | Purpose                                        |
| ---------- | --------------------------------- | ---------------------------------------------- |
| `PORT`     | `3000`                            | Listening port inside the container            |
| `HOST`     | `0.0.0.0`                         | Listening address inside the container         |
| `MCP_PATH` | `/mcp`                            | Exact path accepting MCP POST requests         |
| `DOCS_URL` | `https://webkilt.andrew.cmu.edu/` | Where the docs are served, one line per number |

The server links each release to its template line's docs: `DOCS_URL` plus
the major version (e.g., `0/` for 0.x), whatever URLs the release's
`kit.json` has.

Pass settings with `-e NAME=value`. Keep the container's port mapping and the
proxy route consistent with any changes, and leave `HOST` reachable from the
container network when publishing a port.

The server uses outbound HTTPS to `cdn.jsdelivr.net` for kit files and to
`data.jsdelivr.com` to find the latest version. There are no accounts, API
keys, database or saved files. Requests don't share MCP sessions, so several
copies can serve requests side by side; each keeps its own in-memory cache of
releases.

### Behind a Reverse Proxy

The public endpoint is `https://webkilt.andrew.cmu.edu/mcp`. Route that exact
path to the service while the rest of the site serves the docs. With nginx on
the same host as the published port:

```nginx
location = /mcp {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    client_max_body_size 1m;
}
```

Adjust the upstream port if needed. The exact match leaves the site's other
routes alone. The server accepts POST at the MCP path; GET and DELETE return
405, since there's no event stream or session to manage, so opening `/mcp` in
a browser isn't a health check.

### Update

Run the new release's digest in place of the old one, then verify the service
(below). If it fails, go back to the previous digest. A new kit release
normally needs no update here, as long as its data format stays the same.

## Verify the Service

Check the local process:

```sh
curl --fail --show-error http://127.0.0.1:3000/healthz
```

It returns `ok`. The image's health check requests it every 30 seconds, with
a five-second timeout and a 10-second grace period at startup. A runtime that
ignores the Dockerfile's health check needs the same check set up itself.

The health check doesn't fetch kit data. After a deployment, connect an MCP
client through the public endpoint, confirm it finds the tools and call
`get_component` with an exact kit version. That checks the proxy, the MCP
transport and access to the CDN together. Also try a call without `version`,
to check finding the latest version.

| Symptom                           | Check                                                          |
| --------------------------------- | -------------------------------------------------------------- |
| `/healthz` fails                  | The container's state, its listening port and its logs         |
| MCP POST returns 404              | The proxy route and `MCP_PATH`, including the exact path       |
| GET `/mcp` returns 405            | Expected; use an MCP client to test a tool call                |
| Health passes but tool calls fail | Outbound access to the CDN, and whether the kit release exists |
| The latest kit looks old          | The latest version is cached for up to an hour in each process |

`docker logs --tail 100 web-kilt-mcp` shows recent output. Restarting clears
the caches but doesn't change a release's files on the CDN.
