#!/usr/bin/env bash
# Builds the sap-notes .mcpb bundle for Claude Desktop.
# Prereqs: npm install + npm run build at the repo root; npm i -g @anthropic-ai/mcpb (or use npx).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
NOTES="$ROOT/packages/notes"
STAGE="$(mktemp -d)/sap-notes"
mkdir -p "$STAGE/server"

# 1. pack the workspace auth dependency as a tarball
(cd "$ROOT/packages/auth" && npm pack --quiet --pack-destination "$STAGE/server")
mv "$STAGE/server"/marianfoo-sap-mcp-auth-*.tgz "$STAGE/server/sap-mcp-auth.tgz"

# 2. stage compiled server + minimal package.json pointing at the tarball
cp -r "$NOTES/dist" "$STAGE/server/dist"
node -e "
const p = require('$NOTES/package.json');
const pkg = { name: p.name, version: p.version, type: p.type, main: p.main,
  dependencies: { ...p.dependencies, '@marianfoo/sap-mcp-auth': 'file:./sap-mcp-auth.tgz' } };
require('fs').writeFileSync('$STAGE/server/package.json', JSON.stringify(pkg, null, 2));
"
(cd "$STAGE/server" && npm install --omit=dev --no-audit --no-fund)

# 3. manifest + pack
cp "$NOTES/mcpb/manifest.json" "$STAGE/manifest.json"
cp "$NOTES/mcpb/icon.png" "$STAGE/icon.png"
VERSION=$(node -p "require('$STAGE/manifest.json').version")
OUT="${1:-$NOTES/sap-notes-$VERSION.mcpb}"
npx --yes @anthropic-ai/mcpb pack "$STAGE" "$OUT"
echo "Bundle: $OUT"
