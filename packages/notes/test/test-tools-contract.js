#!/usr/bin/env node
/**
 * Checks the parts of the MCP contract that need no SAP credentials, so this is the
 * one test suite CI can run: the server starts, speaks the protocol, and advertises
 * the tools it is supposed to advertise, under the names it is supposed to use.
 *
 * The other tests in this directory (test-auth, test-sap-api, test-mcp-server) all
 * reach SAP with a personal S-user and cannot run on a shared runner.
 *
 * Worth having because the failure it catches is silent: rename a tool and every
 * client keeps working — until a prompt, skill or sibling server refers to the old
 * name. Tool names are this server's public API.
 *
 *   node test/test-tools-contract.js
 */
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
const serverEntry = join(here, '..', 'dist', 'mcp-server.js');

const EXPECTED_TOOLS = ['sap_note_fetch', 'sap_note_search'];
const TIMEOUT_MS = 30_000;

const failures = [];
function check(condition, label, detail = '') {
  console.log(`${condition ? '  ok  ' : ' FAIL '}${label}${detail ? `  — ${detail}` : ''}`);
  if (!condition) failures.push(label);
}

/** Drive one stdio session and collect the JSON-RPC responses we asked for. */
function talkToServer(requests) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverEntry], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // No credentials are involved, and a first-run browser download would add
        // minutes to a check that never opens a browser.
        SAP_NOTES_SKIP_BROWSER_PROVISION: '1',
        LOG_LEVEL: 'error',
      },
    });

    const responses = new Map();
    const stderr = [];
    let stdout = '';
    let settled = false;

    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      fn(arg);
    };

    const timer = setTimeout(
      () => finish(reject, new Error(
        `server did not answer within ${TIMEOUT_MS} ms\nstderr:\n${stderr.join('')}`)),
      TIMEOUT_MS);

    child.stderr.on('data', chunk => stderr.push(String(chunk)));
    child.on('error', error => finish(reject, error));
    child.on('exit', code => {
      if (responses.size < requests.length) {
        finish(reject, new Error(
          `server exited (code ${code}) after ${responses.size}/${requests.length} `
          + `responses\nstderr:\n${stderr.join('')}`));
      }
    });

    child.stdout.on('data', chunk => {
      stdout += chunk;
      const lines = stdout.split('\n');
      stdout = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        // stdout carries the protocol, but be tolerant of anything that slips in:
        // a stray log line here is a bug worth surviving, not worth crashing on.
        if (!trimmed.startsWith('{')) continue;
        let message;
        try {
          message = JSON.parse(trimmed);
        } catch {
          continue;
        }
        if (message.id !== undefined) responses.set(message.id, message);
        if (responses.size === requests.length) {
          finish(resolve, { responses, stderr: stderr.join('') });
        }
      }
    });

    for (const request of requests) {
      child.stdin.write(`${JSON.stringify(request)}\n`);
    }
  });
}

const { responses } = await talkToServer([
  {
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'tools-contract', version: '1' },
    },
  },
  { jsonrpc: '2.0', id: 2, method: 'tools/list' },
]);

console.log('[handshake]');
const init = responses.get(1)?.result;
check(Boolean(init), 'server answers initialize');
check(init?.serverInfo?.name === 'sap-note-search-mcp',
  'serverInfo reports the expected name', init?.serverInfo?.name);
check(init?.serverInfo?.version === pkg.version,
  'serverInfo version matches package.json',
  `serverInfo=${init?.serverInfo?.version} package.json=${pkg.version}`);

console.log('\n[tools]');
const tools = responses.get(2)?.result?.tools ?? [];
const names = tools.map(tool => tool.name).sort();
check(JSON.stringify(names) === JSON.stringify(EXPECTED_TOOLS),
  `exactly ${EXPECTED_TOOLS.join(' and ')}`, names.join(', ') || '(none)');

for (const tool of tools) {
  check(typeof tool.description === 'string' && tool.description.length > 40,
    `${tool.name} carries a description the model can route on`,
    `${tool.description?.length ?? 0} chars`);
  check(Boolean(tool.inputSchema?.properties),
    `${tool.name} declares an input schema`);
}

// The description of the search tool points at the companion server's tool by name.
// If that name changes and this one does not, the model is handed a dead reference.
const search = tools.find(tool => tool.name === 'sap_note_search');
check(!/\buse sap_help_search\b/.test(search?.description ?? '')
      || search.description.includes('sap_help_search'),
  'cross-reference to the SAP Help server names an existing tool');

console.log(`\n${failures.length === 0
  ? 'contract holds'
  : `FAILED: ${failures.length} — ${failures.join('; ')}`}`);
process.exit(failures.length === 0 ? 0 : 1);
