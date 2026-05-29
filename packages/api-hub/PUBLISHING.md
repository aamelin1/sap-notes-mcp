# Publishing to npmjs

## Preflight

1. Confirm the package name is still available:

   ```bash
   npm view sap-api-hub-mcp
   ```

   A `404` means the name is free.

2. Verify the publish tarball:

   ```bash
   npm run publish:check
   ```

   Expect ~32 files: `dist/**`, `README.md`, `env.example`, `LICENSE`, `package.json`. No `.env`, token caches, `src/`, or `node_modules/`.

3. Log in to npm (one-time per machine):

   ```bash
   npm login
   npm whoami
   ```

4. Bump `version` in `package.json` for each release (`npm version patch|minor|major` is fine).

## Publish

```bash
npm publish --access public
```

`prepack` rebuilds `dist/` automatically. `prepublishOnly` runs a final build guard.

## After publish

Smoke-test the installed CLI:

```bash
npm install -g sap-api-hub-mcp@<version>
npx playwright install chromium
sap-api-hub-mcp
```

Configure MCP clients with the `sap-api-hub-mcp` binary and explicit `ENV_FILE` / `API_HUB_TOKEN_CACHE_FILE` paths outside `node_modules`.

## Repository metadata

This package is developed in the [`sap-mcp-servers`](https://github.com/marianfoo/sap-mcp-servers)
monorepo. Its `package.json` `repository` points there with `"directory": "packages/api-hub"`; keep
`bugs`/`homepage` aligned with the monorepo. See the repo-root **AGENTS.md** for the workspace
publish flow (`npm publish -w sap-api-hub-mcp`).
