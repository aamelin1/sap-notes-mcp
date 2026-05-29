# AGENTS.md — sap-mcp-servers monorepo

Guidance for AI agents and humans working in this repo. Read this first.

## What this repo is

An **npm-workspaces monorepo** holding three SAP MCP servers plus the shared SAP login module they
all build on. Each package is **published to npm independently under its own name** — the monorepo is
for development only.

```
sap-mcp-servers/
├── package.json            # workspaces + root scripts (build order lives here)
├── package-lock.json       # single lockfile for the whole repo — do not add per-package lockfiles
├── AGENTS.md               # this file
├── README.md               # public overview
└── packages/
    ├── auth/      @marianfoo/sap-mcp-auth   — shared SAP IAS/SSO login (Playwright). NO server.
    ├── api-hub/   sap-api-hub-mcp           — MCP server: SAP Business Accelerator Hub
    ├── roadmap/   sap-roadmap-mcp           — MCP server: SAP Road Map Explorer
    └── notes/     sap-note-search-mcp       — MCP server: SAP Notes / KBAs
```

Not in this repo: `sap-docs` (no auth) and `arc-1` (live-system tooling) — they live in their own
repos.

## The one thing to know: build order

`auth` must be built **before** the three servers — they import its compiled types/JS from
`@marianfoo/sap-mcp-auth`. The root `npm run build` already does this:

```
npm run build  ==  build auth  →  then build api-hub + roadmap + notes
```

`npm install` symlinks `@marianfoo/sap-mcp-auth` into each server from `packages/auth` (workspace
link). So you can **edit the auth module and rebuild without publishing it** — the servers pick up
local changes immediately after `npm run build` (or `npm run build:auth`). Never `npm publish` just
to test an auth change locally.

## First-time setup

```bash
git clone https://github.com/marianfoo/sap-mcp-servers.git
cd sap-mcp-servers
npm install                # all workspaces + the auth symlink + one root lockfile
npm run build              # auth first, then the three servers
npm run install:browsers   # one-time: Chromium for Playwright (also auto-runs via roadmap postinstall)
```

Node **>= 18** (developed on 22). Playwright Chromium is needed for the login flows.

## Everyday commands (run from repo root)

| Command | What it does |
| --- | --- |
| `npm run build` | Build everything in dependency order (auth → servers). |
| `npm run build:auth` | Build only `@marianfoo/sap-mcp-auth`. |
| `npm run build -w sap-roadmap-mcp` | Build a single server (auth must already be built). |
| `npm run dev -w sap-api-hub-mcp` | Watch/recompile one server (`tsx watch`). |
| `npm run typecheck` | `tsc --noEmit` across workspaces that define it. |
| `npm test` | Run each package's tests (`--if-present`). |
| `npm run serve -w sap-roadmap-mcp` | Run a built server over stdio. |

`-w <name>` targets a workspace **by its package name** (e.g. `sap-note-search-mcp`), not its folder.

## Running a server

Each server is an MCP server over **stdio** (and Notes/HTTP via `http-mcp-server.js`). Built
entrypoints:

- `packages/api-hub/dist/mcp-server.js`
- `packages/roadmap/dist/mcp-server.js`
- `packages/notes/dist/mcp-server.js` (+ `dist/http-mcp-server.js`)

For wiring them into an MCP client (Claude Code / Cursor / Codex) — including **one shared SSO login
across all three** — see the skill repo's
[`MCP_SETUP.md`](https://github.com/marianfoo/sap-api-policy-skill/blob/main/MCP_SETUP.md). Each
package's own README documents its tools.

## Shared SAP authentication

All three servers authenticate through `@marianfoo/sap-mcp-auth` (`SapWebAuthenticator`). Each server
keeps a thin `src/auth.ts` that supplies a service-specific `ServiceProfile` (which URL to open, how
to scope cookies, how to validate the session) — the login mechanics live once, in the auth package.

Env contract (read by `auth/src/auth-config.ts` → `loadAuthConfigFromEnv`):

| Var | Purpose | Default |
| --- | --- | --- |
| `AUTH_METHOD` | `auto` \| `password` \| `certificate` (`auto` prefers user/pass, falls back to PFX) | `auto` |
| `SAP_USERNAME` / `SAP_PASSWORD` | IAS form login (same SAP Universal ID / S-user for all three) | — |
| `PFX_PATH` / `PFX_PASSPHRASE` | SAP Passport client-certificate auth | — |
| `SAP_LOGIN_URL` | first page opened to trigger SSO | `https://me.sap.com/home` |
| `SAP_SSO_STORAGE_STATE` | shared SSO session file — set the **same absolute path** in all three to log in once | `~/.sap-mcp/sso-storage-state.json` |
| `MAX_JWT_AGE_H` (or `MAX_COOKIE_AGE_H`) | cached session lifetime, hours | `12` |
| `HEADFUL` | show the browser (needed for first login / MFA) | `false` |

Per-server token caches (auto-managed, never logins): `API_HUB_TOKEN_CACHE_FILE`,
`ROADMAP_TOKEN_CACHE_FILE`, `SAP_NOTES_TOKEN_CACHE_FILE`. Point these at absolute paths outside
`node_modules`.

## Secrets & safety — never commit

The root `.gitignore` blocks these; keep it that way and never force-add them:

- `.env` / `.env.*` (real credentials live here; only `env.example` is committed)
- `*.pfx`, `*.p12`, `*.pem`, `*.key`, `*.cer`, `*.crt` (SAP Passport certs)
- `*-token-cache.json`, `token-cache.json`, `sso-storage-state.json`, `storageState.json` (live SAP sessions)
- `*.log`, `debug-*.png`, `dist/`, `node_modules/`

If you ever see one staged, unstage it (`git rm --cached`) and rotate the SAP session/cert.

## Adding a new package

1. Create `packages/<name>/` with its own `package.json` (`name`, `version`, `build` script,
   `repository.directory: "packages/<name>"`).
2. Add `"packages/<name>"` to the root `package.json` `workspaces` array.
3. If it consumes auth, add `"@marianfoo/sap-mcp-auth": "^0.1.0"` to its deps and make sure the root
   `build` script builds auth before it.
4. `npm install` at the root to wire the workspace symlink + refresh the lockfile.

## Publishing

Versions are **per package**. Build, bump the one you changed, publish that workspace:

```bash
npm run build
npm version patch -w sap-roadmap-mcp
npm publish -w sap-roadmap-mcp
```

When you change `@marianfoo/sap-mcp-auth`, **publish it first**, then bump dependents only if the
change is breaking (they pin `^0.1.0`). Each server's `files` array publishes `dist/` + docs only —
source, tests, and dev scripts stay in the repo.

## Licensing

All packages are **Apache-2.0** (see each package's `LICENSE`).
