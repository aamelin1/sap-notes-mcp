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

/**
 * Set SAP_NOTES_SKIP_BROWSER_PROVISION=1 where the Playwright cache is filled by
 * something other than this server — CI, or a container image that bakes the
 * browsers in. Without it, merely starting the server begins a ~200 MB download.
 * Logins still need Chromium; skipping only suppresses the automatic install.
 */
function provisioningDisabled(): boolean {
  const flag = process.env.SAP_NOTES_SKIP_BROWSER_PROVISION;
  return flag === '1' || flag?.toLowerCase() === 'true';
}

export function ensureChromiumReady(): Promise<void> {
  if (provisioningDisabled()) {
    return Promise.resolve();
  }
  if (!provisionPromise) {
    provisionPromise = provision().catch(error => {
      provisionPromise = null; // allow retry on next call
      throw error;
    });
  }
  return provisionPromise;
}

/** Both binaries are required: full Chromium for headful (MFA) logins and
 *  chromium-headless-shell, which Playwright uses for headless mode. */
const REQUIRED_BROWSERS = ['chromium', 'chromium-headless-shell'];

function loadRegistry(): any {
  const requireFromHere = createRequire(import.meta.url);
  const requireFromPlaywright = createRequire(requireFromHere.resolve('playwright/package.json'));
  let coreBundle: any;
  try {
    coreBundle = requireFromPlaywright('playwright-core/lib/coreBundle');
  } catch {
    const pwCoreDir = dirname(requireFromPlaywright.resolve('playwright-core/package.json'));
    coreBundle = requireFromPlaywright(join(pwCoreDir, 'lib', 'coreBundle.js'));
  }
  const registry = coreBundle?.registry?.registry;
  if (!registry || typeof registry.install !== 'function' || typeof registry.findExecutable !== 'function') {
    throw new Error('playwright registry API not found (playwright internals changed?)');
  }
  return registry;
}

function missingBrowsers(): string[] {
  try {
    const registry = loadRegistry();
    return REQUIRED_BROWSERS.filter(name => {
      const exe = registry.findExecutable(name);
      const p = exe?.executablePath?.();
      return !p || !existsSync(p);
    });
  } catch {
    // Registry unavailable — fall back to checking full Chromium only.
    try {
      const p = chromium.executablePath();
      return p && existsSync(p) ? [] : [...REQUIRED_BROWSERS];
    } catch {
      return [...REQUIRED_BROWSERS];
    }
  }
}

async function provision(): Promise<void> {
  const missing = missingBrowsers();
  if (missing.length === 0) {
    logger.debug('Chromium and headless shell already installed');
    return;
  }

  logger.warn(`Playwright browsers missing (${missing.join(', ')}) — downloading now (one-time, ~200-300 MB). This may take a few minutes...`);

  // Strategy order matters: in-process needs no child process at all;
  // a node found on PATH is a real node binary; process.execPath comes last
  // because inside Claude Desktop it is an Electron binary that may refuse
  // to run as node (crashes with SIGTRAP before reaching the CLI).
  const failures: string[] = [];

  try {
    await installInProcess();
  } catch (error) {
    failures.push(`in-process: ${describe(error)}`);
    logger.warn(`In-process Chromium install failed (${describe(error)}); trying the Playwright CLI`);

    const nodeCandidates = [...findPathNodes(), process.execPath];
    let installed = false;
    for (const nodeBin of nodeCandidates) {
      try {
        await installViaCli(nodeBin);
        installed = true;
        break;
      } catch (cliError) {
        failures.push(`CLI via ${nodeBin}: ${describe(cliError)}`);
        logger.warn(`Chromium install via ${nodeBin} failed (${describe(cliError)})`);
      }
    }
    if (!installed) {
      throw new Error(
        `Chromium download failed. If you are behind a corporate proxy, set HTTPS_PROXY or PLAYWRIGHT_DOWNLOAD_HOST. ` +
        `Attempts: ${failures.join(' | ')}`
      );
    }
  }

  const stillMissing = missingBrowsers();
  if (stillMissing.length > 0) {
    throw new Error(
      `Browser download reported success but ${stillMissing.join(', ')} still not found. ` +
      'Try running "npx playwright install chromium" manually, or set PLAYWRIGHT_BROWSERS_PATH ' +
      'if your browsers live in a non-default location.'
    );
  }
  logger.warn('Playwright browser download completed');
}

async function installInProcess(): Promise<void> {
  const registry = loadRegistry();
  const executables = REQUIRED_BROWSERS.map(name => registry.findExecutable(name)).filter(Boolean);
  if (executables.length === 0) throw new Error('chromium is not known to the playwright registry');

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
    await registry.install(executables, false);
  } finally {
    process.stdout.write = realWrite;
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Real node binaries on PATH (unlike process.execPath, which may be Electron). */
function findPathNodes(): string[] {
  const exe = process.platform === 'win32' ? 'node.exe' : 'node';
  const seen: string[] = [];
  for (const dir of (process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':')) {
    if (!dir) continue;
    const candidate = join(dir, exe);
    if (existsSync(candidate) && !seen.includes(candidate)) seen.push(candidate);
  }
  return seen.slice(0, 3); // a couple of candidates is plenty
}

function installViaCli(nodeBinary: string): Promise<void> {
  const requireFromHere = createRequire(import.meta.url);
  const cliPath = join(dirname(requireFromHere.resolve('playwright/package.json')), 'cli.js');

  return new Promise<void>((resolveInstall, rejectInstall) => {
    const child = spawn(nodeBinary, [cliPath, 'install', 'chromium'], {
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
          `exit code ${code}, signal ${signal}, last output: ${tail.slice(-300)}`
        ));
      }
    });
  });
}
