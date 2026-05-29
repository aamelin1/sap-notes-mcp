export class AuthenticationError extends Error {
  originalError?: Error;
  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'AuthenticationError';
    this.originalError = originalError;
  }
}

export class CertificateLoadError extends Error {
  constructor(certPath: string, originalError: Error) {
    super(`Failed to load certificate from ${certPath}: ${originalError.message}`);
    this.name = 'CertificateLoadError';
  }
}

export class AuthenticationTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Authentication timed out after ${timeoutMs}ms`);
    this.name = 'AuthenticationTimeoutError';
  }
}

export class BrowserNotFoundError extends Error {
  constructor(browserType: string) {
    super(`Browser ${browserType} not found or not installed`);
    this.name = 'BrowserNotFoundError';
  }
}
