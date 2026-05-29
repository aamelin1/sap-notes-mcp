import pino from 'pino';

const logLevel = process.env.LOG_LEVEL || 'info';
const isMcpMode = !process.stdin.isTTY || !process.stdout.isTTY || process.env.MCP_MODE === 'true';

const createMcpLogger = () => ({
  warn: (msg: string, obj?: unknown) => {
    const suffix = obj ? ` ${JSON.stringify(obj)}` : '';
    process.stderr.write(`[${new Date().toISOString().substring(11, 19)}] ${msg}${suffix}\n`);
  },
  error: (msg: string, obj?: unknown) => {
    const suffix = obj ? ` ${JSON.stringify(obj)}` : '';
    process.stderr.write(`[${new Date().toISOString().substring(11, 19)}] ERROR: ${msg}${suffix}\n`);
  },
  info: (msg: string, obj?: unknown) => {
    if (logLevel === 'debug' || logLevel === 'info') {
      const suffix = obj ? ` ${JSON.stringify(obj)}` : '';
      process.stderr.write(`[${new Date().toISOString().substring(11, 19)}] INFO: ${msg}${suffix}\n`);
    }
  },
  debug: (msg: string, obj?: unknown) => {
    if (logLevel === 'debug') {
      const suffix = obj ? ` ${JSON.stringify(obj)}` : '';
      process.stderr.write(`[${new Date().toISOString().substring(11, 19)}] DEBUG: ${msg}${suffix}\n`);
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
  base: { service: 'sap-roadmap-mcp' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['password', 'sapPassword', 'pfxPassphrase', 'token', 'access_token', '*.password', '*.sapPassword', '*.pfxPassphrase', '*.token'],
    censor: '[REDACTED]'
  }
});
