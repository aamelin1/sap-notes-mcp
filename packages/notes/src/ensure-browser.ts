import { existsSync } from 'fs';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { chromium } from 'playwright';
import { logger } from './logger.js';

/**
 * Ensures the Playwright Chromium browser is installed before it is needed.
 *
 * The npm package ships without browser binaries; on a fresh machine (e.g. after
 * installing the .mcpb bundle) Chromium must be downloaded once (~200 MB) into
 * the per-user Playwright cache (%LOCALAPPDATA%\ms-playwright on Windows,
 * ~/Library/Caches/ms-playwright on macOS).
 *
 * Two strategies, in order:
 *
 * 1. IN-PROCESS via playwright-core's internal registry API. No child process at
 *    all — this matters inside Claude Desktop, where process.execPath may be an
 *    Electron binary rather than plain node, and spawning it kills the child
 *    ("exited with code null"). The registry prints download progress to STDOUT,
 *    which in stdio MCP mode carries the protocol, so stdout is filtered during
 *    the install: JSON-RPC frames (lines starting with '{') pass through,
 *    everything else is diverted to the stderr logger.
 *
 * 2. CLI child process fallback (playwright's cli.js) with ELECTRON_RUN_AS_NODE=1
 *    so an Electron execPath still behaves as node.
 *
 * The download honours HTTPS_PROXY and PLAYWRIGHT_DOWNLOAD_HOST.
 * The promise is memoized; a failed attempt resets it so the next call retries.
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

  logger.warn('Chromium for Playwright not found — downloading it now (one-time, ~200 MB). This may take a few minutes...');

  try {
    await installInProcess();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn(`In-process Chromium install failed (${msg}); falling back to the Playwright CLI`);
    await installViaCli();
  }

  const installed = installedExecutable();
  if (!installed) {
    throw new Error(
      'Chromium download reported success but the executable was not found. ' +
      'Try running "npx playwright install chromium" manually, or set PLAYWRIGHT_BROWSERS_PATH ' +
      'if your browsers live in a non-default location.'
    );
  }
  logger.warn(`Chromium download completed: ${installed}`);
}

async function installInProcess(): Promise<void> {
  const requireFromHere = createRequire(import.meta.url);
  // Resolve playwright-core exactly the way the installed playwright package would.
  const requireFromPlaywright = createRequire(requireFromHere.resolve('playwright/package.json'));
  let coreBundle: any;
  try {
    // exports map allows the extensionless specifier...
    coreBundle = requireFromPlaywright('playwright-core/lib/coreBundle');
  } catch {
    // ...and an absolute file path bypasses the exports map entirely.
    const pwCoreDir = dirname(requireFromPlaywright.resolve('playwright-core/package.json'));
    coreBundle = requireFromPlaywright(join(pwCoreDir, 'lib', 'coreBundle.js'));
  }
  const registry = coreBundle?.registry?.registry;
  if (!registry || typeof registry.install !== 'function' || typeof registry.findExecutable !== 'function') {
    throw new Error('playwright registry API not found (playwright internals changed?)');
  }
  const executable = registry.findExecutable('chromium');
  if (!executable) throw new Error('chromium is not known to the playwright registry');

  // Divert non-protocol stdout writes (download progress) to the stderr logger.
  const realWrite = process.stdout.write.bind(process.stdout);
  const filteredWrite: typeof process.stdout.write = (chunk: any, ...rest: any[]) => {
    const text = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : String(chunk);
    if (text.trimStart().startsWith('{')) {
      return realWrite(chunk, ...rest);
    }
    const line = text.replace(/[\r\n]+/g, ' ').trim();
    if (line) logger.debug(`[chromium download] ${line}`);
    // Deliver callbacks if provided, as a well-behaved write() would.
    const cb = rest.find(a => typeof a === 'function');
    if (cb) cb();
    return true;
  };

  process.stdout.write = filteredWrite;
  try {
    await registry.install([executable], false);
  } finally {
    process.stdout.write = realWrite;
  }
}

function installViaCli(): Promise<void> {
  const requireFromHere = createRequire(import.meta.url);
  const cliPath = join(dirname(requireFromHere.resolve('playwright/package.json')), 'cli.js');

  return new Promise<void>((resolveInstall, rejectInstall) => {
    const child = spawn(process.execPath, [cliPath, 'install', 'chromium', '--no-shell'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
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
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolveInstall();
      } else {
        rejectInstall(new Error(
          `Chromium download failed (exit code ${code}, signal ${signal}). ` +
          `If you are behind a corporate proxy, set HTTPS_PROXY or PLAYWRIGHT_DOWNLOAD_HOST. ` +
          `Last output: ${tail.slice(-500)}`
        ));
      }
    });
  });
}
