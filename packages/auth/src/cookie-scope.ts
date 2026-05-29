import type { BrowserContext, Cookie } from 'playwright';
import type { CookieScope } from './types.js';

/** Select the cookies that make up the session header for a given service scope. */
export async function selectCookies(context: BrowserContext, scope: CookieScope): Promise<Cookie[]> {
  if (scope.type === 'url') {
    return context.cookies(scope.url);
  }

  const all = await context.cookies();
  if (scope.type === 'all') {
    return all;
  }

  const filtered = all.filter(cookie => cookie.domain.includes(scope.includes));
  if (filtered.length > 0 || !scope.fallbackToAll) {
    return filtered;
  }
  return all;
}

export function serializeCookies(cookies: Cookie[]): string {
  return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}
