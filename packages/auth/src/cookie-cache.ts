import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import type { CachedToken, Logger } from './types.js';

export function loadCachedToken(file: string, logger: Logger): CachedToken | null {
  try {
    if (!existsSync(file)) return null;
    const cached = JSON.parse(readFileSync(file, 'utf-8'));
    if (typeof cached?.access_token !== 'string' || typeof cached?.expiresAt !== 'number') {
      logger.warn('Cached token has invalid structure, ignoring');
      return null;
    }
    return cached as CachedToken;
  } catch (error) {
    logger.warn('Failed to load token cache', error);
    return null;
  }
}

export function saveCachedToken(file: string, data: CachedToken, logger: Logger): void {
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 2));
    logger.warn('Cached session cookies for future use');
  } catch (error) {
    logger.warn('Failed to cache session cookies', error);
  }
}

export function removeCachedToken(file: string, logger: Logger): void {
  try {
    if (existsSync(file)) {
      unlinkSync(file);
      logger.warn('Removed cached session token');
    }
  } catch (error) {
    logger.warn('Failed to remove token cache', error);
  }
}
