import type { Logger } from './types.js';

function write(prefix: string, message: string, args: unknown[]): void {
  const suffix = args.length ? ` ${args.map(a => (typeof a === 'string' ? a : safeJson(a))).join(' ')}` : '';
  const time = new Date().toISOString().substring(11, 19);
  process.stderr.write(`[${time}] ${prefix}${message}${suffix}\n`);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Stderr fallback logger used when the host does not inject one. */
export const defaultLogger: Logger = {
  warn: (message, ...args) => write('', message, args),
  error: (message, ...args) => write('ERROR: ', message, args),
  info: (message, ...args) => write('INFO: ', message, args),
  debug: () => {}
};
