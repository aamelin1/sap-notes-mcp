#!/usr/bin/env node
/**
 * Install Chromium for Playwright auth. Skipped when:
 * - PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
 * - npm lifecycle is not a normal install (e.g. pack/publish dry-run)
 */
import { execSync } from 'node:child_process';

if (process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === '1') {
  process.exit(0);
}

const lifecycle = process.env.npm_lifecycle_event;
if (lifecycle && lifecycle !== 'install' && lifecycle !== 'postinstall') {
  process.exit(0);
}

try {
  execSync('npx playwright install chromium', {
    stdio: 'inherit',
    env: process.env
  });
} catch (error) {
  console.warn(
    '[sap-roadmap-mcp] Playwright browser install failed. Run manually:\n' +
      '  npx playwright install chromium\n' +
      'Or skip auto-install with PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1'
  );
  process.exit(0);
}
