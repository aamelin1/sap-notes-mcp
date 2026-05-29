import { SapWebAuthenticator, type AuthConfig, type ServiceProfile } from '@marianfoo/sap-mcp-auth';
import type { ServerConfig } from './types.js';
import { logger } from './logger.js';

/**
 * Build a SapWebAuthenticator configured for the SAP Business Accelerator Hub.
 * API Hub mints app cookies on api.sap.com and scopes the session header to that
 * domain (falling back to all cookies when none match).
 */
export function createApiHubAuthenticator(config: ServerConfig): SapWebAuthenticator {
  const authConfig: AuthConfig = {
    authMethod: config.authMethod,
    sapUsername: config.sapUsername,
    sapPassword: config.sapPassword,
    pfxPath: config.pfxPath,
    pfxPassphrase: config.pfxPassphrase,
    sapLoginUrl: config.sapLoginUrl ?? 'https://me.sap.com/home',
    mfaTimeout: config.mfaTimeout,
    maxSessionAgeH: config.maxCookieAgeH,
    headful: config.headful,
    tokenCacheFile: config.tokenCacheFile,
    ssoStorageStateFile: config.ssoStorageStateFile,
    logger
  };

  const profile: ServiceProfile = {
    serviceName: 'SAP API Hub',
    appUrl: `${config.apiHubBaseUrl}/api/salesorder/overview`,
    cookieScope: { type: 'domain', includes: 'api.sap.com', fallbackToAll: true },
    expectedHost: 'api.sap.com'
  };

  return new SapWebAuthenticator(authConfig, profile);
}
