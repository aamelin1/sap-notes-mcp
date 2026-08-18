# Contributing

One maintainer, no ceremony: open an issue or a pull request. This file covers what the
[README](README.md) deliberately leaves out — how to build, test and release the server.

## Repository layout

```
packages/
├── auth/    # shared SAP web authentication (Playwright login, cookie & SSO state cache)
└── notes/   # the MCP server itself (stdio + HTTP transports) and the .mcpb packaging
    └── mcpb/  # manifest.json + build-mcpb.sh
```

## Build from source

Requires Node.js ≥ 18.

```bash
git clone https://github.com/aamelin1/sap-notes-mcp.git
cd sap-notes-mcp
npm install
npm run build          # builds packages/auth, then packages/notes
npm run build:mcpb     # produces packages/notes/sap-notes-<version>.mcpb
```

## Tests

One suite needs no credentials, and it is the one CI runs on every push — across
Linux, macOS and Windows on Node 22 and 24, alongside the build and a packing check:

```bash
cd packages/notes
npm run test:contract   # server starts, speaks MCP, advertises the expected tools
```

The rest log in to me.sap.com with a personal S-user, so they stay local — an S-user
does not belong in a shared runner's secrets:

```bash
cd packages/notes
npm run test:auth      # login flow only
npm run test:api       # search + fetch end to end
npm run test:mcp       # full protocol exercise, calls the tools for real
```

Set `SAP_NOTES_SKIP_BROWSER_PROVISION=1` to stop the server downloading Chromium on
start — useful in CI, or in an image where the Playwright cache is already filled.

## Releasing

Bump the version in `packages/notes/package.json` and `packages/notes/mcpb/manifest.json`
together, add a `## [X.Y.Z]` section to [CHANGELOG.md](CHANGELOG.md), then tag and push:

```bash
git tag vX.Y.Z && git push origin vX.Y.Z
```

The workflow refuses the release unless the tag, both manifests and the changelog agree; it
then runs the build and the tool contract, packs the bundle as `sap-notes.mcpb` and attaches
it to a GitHub release whose notes come from the changelog. Everything that can invalidate a
release is checked before the release exists.

The asset name deliberately carries no version: the README hands out
`releases/latest/download/sap-notes.mcpb`, and GitHub only resolves that while the name
stays constant.
