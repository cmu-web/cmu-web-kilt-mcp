# Deployment

The hosted server exposes Streamable HTTP to MCP clients. The container
runs `dist/index.js`; the CLI's stdio mode is for clients that launch their
own process. For that setup, see [Development](DEVELOPMENT.md#run-it-with-an-agent).

## Run the Container

The image is `ghcr.io/cmu-web/cmu-web-kilt-mcp`, built for `linux/amd64`.
With Podman:

```bash
podman run -d --name web-kilt-mcp \
  -p 127.0.0.1:3000:3000 \
  ghcr.io/cmu-web/cmu-web-kilt-mcp:latest
```

The host's loopback port can sit behind a reverse proxy. For a deployment,
replace `:latest` with a recorded release digest so the selected image is
explicit. Save the previous digest for rollback.

To build from a checkout instead:

```bash
podman build --target test .
podman build --format docker -t localhost/web-kilt-mcp:latest .
```

Use the local image name in the run command. Docker can also build and run
the image; omit Podman's `--format docker` flag with Docker.

## Configuration

| Variable   | Default   | Purpose                                |
| ---------- | --------- | -------------------------------------- |
| `PORT`     | `3000`    | Listening port inside the container    |
| `HOST`     | `0.0.0.0` | Listening address inside the container |
| `MCP_PATH` | `/mcp`    | Exact path accepting MCP POST requests |

Pass settings with `-e NAME=value`. Keep the container-side port mapping
and proxy route consistent with any changes. Leave `HOST` reachable from
the container network when publishing a port.

The server uses outbound HTTPS to `cdn.jsdelivr.net` for kit files and to
`data.jsdelivr.com` to resolve the latest version. There are no accounts,
API keys, database or persistent application files. HTTP requests do not
share MCP sessions, so multiple replicas can serve requests independently.
Each process maintains its own in-memory release cache.

## Put It Behind a Reverse Proxy

The public endpoint is `https://webkilt.andrew.cmu.edu/mcp`. Route that
exact path to the service while the rest of the site serves the docs.
For nginx on the same host as the published container port:

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

Adjust the upstream port if needed. The exact match preserves the static
site's other routes. This server accepts POST at the MCP path; GET and
DELETE return 405 because there is no event stream or session to manage.
Opening `/mcp` in a browser is not a service health check.

## Verify the Service

Check the local process:

```bash
curl --fail --show-error http://127.0.0.1:3000/healthz
```

It returns `ok`. The image's health check requests this endpoint every
30 seconds, with a five-second timeout and a 10-second startup grace
period. For OCI images that omit Dockerfile health checks, configure the
equivalent in the runtime.

Health does not fetch kit data. After deployment, connect an MCP client
through the public endpoint, confirm it discovers the tools and call
`get_component` with an exact kit version. That checks the proxy, MCP
transport and CDN access together. Also try a call without `version` to
check latest-version resolution.

| Symptom                           | Check                                                             |
| --------------------------------- | ----------------------------------------------------------------- |
| `/healthz` fails                  | Container state, listening port and logs                          |
| MCP POST returns 404              | Proxy route and `MCP_PATH`, including the exact path              |
| GET `/mcp` returns 405            | Expected behavior; use an MCP client to test a tool call          |
| Health passes but tool calls fail | Outbound CDN access and whether the requested kit release exists  |
| The latest kit appears old        | Latest-version resolution is cached for up to an hour per process |

Use `podman logs --tail 100 web-kilt-mcp` for recent output. Restarting
clears process caches but does not change a release's files on the CDN.

## Publish and Roll Out a Release

The [workflow](.github/workflows/publish.yml) checks and builds on pushes
to `main`, pull requests, version tags and manual runs. It publishes the
image only for version tags, such as `0.3.0`, and manual runs, after checks
pass.

| Image Tag      | Meaning                                   |
| -------------- | ----------------------------------------- |
| `latest`       | Most recently published version-tag build |
| `X.Y.Z`        | Build of server release tag `X.Y.Z`       |
| `sha-<commit>` | Build identified by its short commit hash |

Complete [server release preparation](DEVELOPMENT.md#prepare-a-server-release),
then push `main` and the specific new version tag together. Confirm the workflow
passed and record the published image digest. A manual workflow run
publishes a commit image without moving `latest`.

Update the deployment to the new digest and run the verification above.
If it fails, restore the previous digest and investigate. Leave published
Git tags intact; fix a bad release with a new version.

The workflow publishes a container, not an npm package. `package.json`
defines the `cmu-web-kilt-mcp` executable and includes `dist/` in the npm
package, but this repository has no automated npm publishing step. Use the
hosted endpoint or a built checkout without depending on npm publication.
