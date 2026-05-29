import pino from 'pino';

const logLevel = process.env.LOG_LEVEL || 'info';
const isMcpMode = !process.stdin.isTTY || !process.stdout.isTTY || process.env.MCP_MODE === 'true';

const stringify = (obj?: unknown) => {
  if (obj === undefined) return '';
  try {
    return ` ${JSON.stringify(obj)}`;
  } catch {
    return ` ${String(obj)}`;
  }
};

const createMcpLogger = () => ({
  warn: (msg: string, obj?: unknown) => {
    process.stderr.write(`[${new Date().toISOString().substring(11, 19)}] ${msg}${stringify(obj)}\n`);
  },
  error: (msg: string, obj?: unknown) => {
    process.stderr.write(`[${new Date().toISOString().substring(11, 19)}] ERROR: ${msg}${stringify(obj)}\n`);
  },
  info: (msg: string, obj?: unknown) => {
    if (logLevel === 'debug' || logLevel === 'info') {
      process.stderr.write(`[${new Date().toISOString().substring(11, 19)}] INFO: ${msg}${stringify(obj)}\n`);
    }
  },
  debug: (msg: string, obj?: unknown) => {
    if (logLevel === 'debug') {
      process.stderr.write(`[${new Date().toISOString().substring(11, 19)}] DEBUG: ${msg}${stringify(obj)}\n`);
    }
  }
});

export const logger = isMcpMode ? createMcpLogger() : pino({
  level: logLevel,
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  } : undefined,
  base: { service: 'sap-api-hub-mcp' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['password', 'sapPassword', 'pfxPassphrase', 'token', 'access_token', '*.password', '*.sapPassword', '*.pfxPassphrase', '*.token'],
    censor: '[REDACTED]'
  }
});
