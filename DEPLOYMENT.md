# Deployment

## Container

Releases build `ghcr.io/cmu-web/cmu-web-kilt-mcp` (GitHub Actions, on a `v*`
tag), the same way as PlaceMellon. The image runs `node dist/index.js`:

| Variable   | Default   | What                         |
| ---------- | --------- | ---------------------------- |
| `PORT`     | `3000`    | Port to listen on            |
| `HOST`     | `0.0.0.0` | Address to listen on         |
| `MCP_PATH` | `/mcp`    | Where the MCP endpoint lives |

`GET /healthz` answers `ok`. The server keeps no state: each request stands
alone, so it can restart, or run more than one copy, at any time. It
fetches kit data from `cdn.jsdelivr.net` and `data.jsdelivr.com`, so allow
outbound HTTPS to those.

## At webkilt.andrew.cmu.edu/mcp

The docs site stays static; only `/mcp` goes to the container. An nginx
location for it:

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

## On npm

`npx cmu-web-kilt-mcp` works once the package is published to npm. The
name, scoped (`@cmu-web/...`) or not, isn't decided yet; publishing should
run from GitHub Actions on a release tag, with an npm token in the repo's
secrets.
