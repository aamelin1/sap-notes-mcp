# SAP Notes MCP

An [MCP](https://modelcontextprotocol.io/) server that lets AI assistants (Claude Desktop, Cursor, VS Code) search and read **SAP Notes / KBAs** from me.sap.com — full note text plus metadata: validity ranges, support packages, references, prerequisites, and correction instructions.

This is a maintained fork of [marianfoo/sap-mcp-servers](https://github.com/marianfoo/sap-mcp-servers) (archived), trimmed down to the Notes server and packaged as a **one-click `.mcpb` bundle** for Claude Desktop.

> [!CAUTION]
> This server uses private SAP APIs behind authentication. Check whether your use complies with SAP's Terms of Service. It requires a valid SAP S-user with access to me.sap.com.

## What's different from the upstream

- **Self-healing sessions.** When SAP invalidates the session (typically after ~12h), the server now detects it, deletes *both* session artifacts (`token-cache.json` and the browser storage state), re-authenticates, and retries the request — automatically. Upstream returned a useless "requires browser access" stub instead, and a bug overwrote the storage state with a logged-out session, making recovery impossible without manual file deletion.
- **Automatic Chromium download.** On first run the server downloads Chromium (~170 MB, one-time) into the per-user Playwright cache. No `npx playwright install` step. Honours `HTTPS_PROXY` and `PLAYWRIGHT_DOWNLOAD_HOST` for corporate proxies/mirrors.
- **`.mcpb` bundle for Claude Desktop.** Install with a double click, enter your S-user and password in the config dialog — done. One platform-independent file for Windows and macOS.
- **Clean stdio.** dotenv v17 promo output no longer leaks into the MCP protocol channel.

## Install (Claude Desktop)

1. Download the latest [**sap-notes.mcpb**](https://github.com/aamelin1/sap-notes-mcp/releases/latest/download/sap-notes.mcpb) (or build it yourself, see below).
2. Double-click the file (or drag it into Claude Desktop → Settings → Extensions).
3. Enter your **SAP S-user** (e-mail or S-number) and **password** when prompted.
4. Ask Claude something like *"Find SAP Notes about OData gateway error 415"*. The first call downloads Chromium and logs in — allow a couple of minutes; every call after that is fast.

If your S-user has MFA, the first login opens a visible browser window — complete the challenge there once; the session is then cached.

## Tools

| Tool | What it does |
|------|--------------|
| `search` | Search SAP Notes by keywords, error text, component, or note number |
| `fetch` | Retrieve a note's full content and metadata by ID; `includeCorrections=true` adds detailed ABAP correction instructions (affected objects, prerequisites) |

## Configuration

Credentials come from the `.mcpb` config dialog, or from environment variables when running the server manually:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SAP_USERNAME` / `SAP_PASSWORD` | yes* | — | S-user credentials |
| `PFX_PATH` / `PFX_PASSPHRASE` | yes* | — | Alternative: SAP Passport certificate |
| `TOKEN_CACHE_FILE` | no | `./token-cache.json` | Session cookie cache (the bundle sets `~/.sap-mcp/token-cache.json`) |
| `SAP_SSO_STORAGE_STATE` | no | `~/.sap-mcp/sso-storage-state.json` | Shared browser session state |
| `MAX_JWT_AGE_H` | no | `12` | Session cache lifetime, hours |
| `HEADFUL` | no | `false` | Show the browser window (debugging, MFA) |
| `LOG_LEVEL` | no | `info` | `debug`, `info`, `warn`, `error` |
| `PLAYWRIGHT_DOWNLOAD_HOST` | no | — | Internal mirror for the Chromium download |

\* one pair required: username+password **or** certificate.

## Build from source

Requires Node.js ≥ 18.

```bash
git clone https://github.com/aamelin1/sap-notes-mcp.git
cd sap-notes-mcp
npm install
npm run build          # builds packages/auth, then packages/notes
npm run build:mcpb     # produces packages/notes/sap-notes-<version>.mcpb
```

Useful checks (need real credentials in the environment or a `.env` file):

```bash
cd packages/notes
npm run test:auth      # login flow only
npm run test:api       # search + fetch end to end
```

## Repository layout

```
packages/
├── auth/    # shared SAP web authentication (Playwright login, cookie & SSO state cache)
└── notes/   # the MCP server itself (stdio + HTTP transports) and the .mcpb packaging
    └── mcpb/  # manifest.json + build-mcpb.sh
```

## How sessions work

The server logs into me.sap.com with Playwright once, then reuses the session via two artifacts: an HTTP cookie cache (`TOKEN_CACHE_FILE`) and a Playwright storage state (`SAP_SSO_STORAGE_STATE`). Both are treated as a single unit: on any expired-session signal they are deleted together, a fresh login runs, and the failed request is retried once. There is nothing to babysit — no cron jobs or manual re-logins.

## Credits & license

Original work by [Marian Zeis](https://github.com/marianfoo) — thank you! Licensed under [Apache 2.0](LICENSE), as is this fork.
