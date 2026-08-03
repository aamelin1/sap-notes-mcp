import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

/**
 * The server version, taken from the package manifest.
 *
 * It used to be written out by hand in every place that needed it, and drifted:
 * serverInfo kept reporting 0.4.5 after the package had been bumped, so clients
 * were told the wrong version. One source now.
 *
 * package.json sits one level above the compiled output in both layouts we ship:
 * packages/notes/package.json next to packages/notes/dist in the repository, and
 * server/package.json next to server/dist inside the .mcpb bundle, which
 * build-mcpb.sh writes there for exactly this kind of lookup.
 */
function readVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const manifest = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
    if (typeof manifest.version === 'string' && manifest.version.length > 0) {
      return manifest.version;
    }
  } catch {
    // Deliberately quiet: this runs while the stdio transport is being set up, so
    // writing anything here risks the protocol channel. The sentinel below is
    // recognisable enough to diagnose from a client that reports it.
  }
  return '0.0.0-unknown';
}

export const SERVER_VERSION = readVersion();
