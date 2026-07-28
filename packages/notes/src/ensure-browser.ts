import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { chromium } from 'playwright';
import { logger } from './logger.js';

/**
 * Ensures the Playwright Chromium browser is installed before it is needed.
 *
 * The npm package ships without browser binaries; on a fresh machine (e.g. after
 * installing the .mcpb bundle) Chromium must be downloaded once (~170 MB) into
 * the per-user Playwright cache (%LOCALAPPDATA%\ms-playwright on Windows,
 * ~/Library/Caches/ms-playwright on macOS). This module does that download
 * lazily and exactly once per process, using the Playwright CLI bundled in
 * node_modules — no npx or global installs required.
 *
 * The download honours HTTPS_PROXY and PLAYWRIGHT_DOWNLOAD_HOST (internal
 * mirror) from the environment.
 *
 * Call sites should `await ensureChromiumReady()` before any code path that
 * launches a browser. The promise is memoized; a failed attempt resets it so
 * the next tool call can retry.
 */
let provisionPromise: Promise<void> | null = null;

export function ensureChromiumReady(): Promise<void> {
  if (!provisionPromise) {
    provisionPromise = provision().catch(error => {
      provisionPromise = null; // allow retry on next call
      throw error;
    });
  }
  return provisionPromise;
}

function installedExecutable(): string | null {
  try {
    const p = chromium.executablePath();
    return p && existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

async function provision(): Promise<void> {
  const existing = installedExecutable();
  if (existing) {
    logger.debug(`Chromium already installed: ${existing}`);
    return;
  }

  logger.warn('Chromium for Playwright not found — downloading it now (one-time, ~170 MB). This may take a few minutes...');

  const requireFromHere = createRequire(import.meta.url);
  const cliPath = requireFromHere.resolve('playwright/cli.js');

  await new Promise<void>((resolveInstall, rejectInstall) => {
    const child = spawn(process.execPath, [cliPath, 'install', 'chromium', '--no-shell'], {
      // stdout MUST NOT leak to the parent's stdout: in stdio MCP mode that
      // channel carries the protocol. Capture and forward to our stderr logger.
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env
    });

    let tail = '';
    const onData = (buf: Buffer) => {
      const text = buf.toString();
      tail = (tail + text).slice(-2000);
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (trimmed) logger.debug(`[playwright install] ${trimmed}`);
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('error', rejectInstall);
    child.on('exit', code => {
      if (code === 0) {
        resolveInstall();
      } else {
        rejectInstall(new Error(
          `Chromium download failed (playwright install exited with code ${code}). ` +
          `If you are behind a corporate proxy, set HTTPS_PROXY or PLAYWRIGHT_DOWNLOAD_HOST. ` +
          `Last output: ${tail.slice(-500)}`
        ));
      }
    });
  });

  const installed = installedExecutable();
  if (!installed) {
    throw new Error('Chromium download reported success but the executable was not found. Try running "npx playwright install chromium" manually.');
  }
  logger.warn(`Chromium download completed: ${installed}`);
}
