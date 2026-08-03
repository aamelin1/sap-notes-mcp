# Changelog

Notable changes to this fork. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versions up to 0.3.x were released by the upstream project,
[marianfoo/sap-mcp-servers](https://github.com/marianfoo/sap-mcp-servers) (archived).
This file starts where the fork does.

## [0.5.0] — 2026-08-03

### Changed — breaking

- The tools are renamed `search` → `sap_note_search` and `fetch` → `sap_note_fetch`.
  Generic names are a poor fit for MCP, where a server cannot know what else is
  connected: in practice these shadowed a web-search server's identically named tools
  and the model routed to whichever it happened to see. No aliases are kept — update
  anything that names a tool explicitly. Clients discover the new names themselves.

  The companion [sap-help-mcp](https://github.com/aamelin1/sap-help-mcp) took the same
  prefix in its 1.1.0, so the two now read as one family.

### Added

- CI on every push: build and a credential-free tool-contract check across Linux,
  macOS and Windows on Node 22 and 24, version agreement between `package.json` and
  the bundle manifest, and a job that packs the `.mcpb` and inspects the result. The
  fork had dropped the upstream workflows during its slim-down because they called
  scripts that no longer existed, which left Dependabot opening pull requests with
  nothing to validate them.
- `npm run test:contract` — starts the built server, completes an `initialize`
  handshake and asserts the advertised tool names, descriptions and schemas. The one
  suite that needs no S-user, which is why CI can run it. A botched rename otherwise
  fails silently: every client keeps working until something refers to the old name.
- `SAP_NOTES_SKIP_BROWSER_PROVISION=1` suppresses the automatic Chromium download.
  Starting the server otherwise begins a ~200 MB fetch, which CI does not need and
  neither does an image with the Playwright cache baked in.

### Fixed

- `serverInfo` reports the version from `package.json` instead of a number written out
  by hand in three places, which had already drifted: clients were told 0.4.5 after the
  package had been bumped.

## [0.4.5] — 2026-07-28

### Fixed

- Session files land in the user's home directory on Windows. `env.HOME` is often
  unset there, which sent the SSO storage state into the process working directory —
  potentially read-only for Claude Desktop. Falls back to `os.homedir()`, and the
  bundle manifest pins `SAP_SSO_STORAGE_STATE` explicitly.

## [0.4.1] — 2026-07-28

### Fixed

- Chromium installs in-process rather than through a child process. Inside Claude
  Desktop `process.execPath` can be an Electron binary, so spawning it for
  `playwright install` was killed outright. The install now goes through
  playwright-core's registry API, with its stdout progress diverted away from the MCP
  protocol channel; the CLI spawn remains as a fallback with `ELECTRON_RUN_AS_NODE=1`.

## [0.4.0] — 2026-07-28

First release of the fork: the repository slimmed down to the SAP Notes server and
packaged as a one-click `.mcpb` bundle for Claude Desktop.

### Fixed

- Self-healing sessions. When SAP invalidates the session (typically after ~12 h) the
  server detects it, deletes both session artifacts and re-authenticates. Upstream
  returned a "requires browser access" stub instead, and a bug overwrote the storage
  state with a logged-out session, making recovery impossible without deleting files
  by hand.
- Clean stdout: dotenv v17 promotional output no longer leaks into the MCP protocol
  channel.

[0.5.0]: https://github.com/aamelin1/sap-notes-mcp/releases/tag/v0.5.0
[0.4.5]: https://github.com/aamelin1/sap-notes-mcp/releases/tag/v0.4.5
[0.4.1]: https://github.com/aamelin1/sap-notes-mcp/releases/tag/v0.4.1
[0.4.0]: https://github.com/aamelin1/sap-notes-mcp/releases/tag/v0.4.0
