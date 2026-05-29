import { mkdir, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { createRoadmapAuthenticator } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import { SapRoadmapApiClient } from '../src/roadmap-api.js';

const config = loadConfig();
const authenticator = createRoadmapAuthenticator(config);
const client = new SapRoadmapApiClient(config);

const outputPath = resolve(process.env.ROADMAP_EXPORT_PATH || 'docs/workzone-roadmap.md');
const query = {
  q: process.env.ROADMAP_EXPORT_QUERY || 'work zone',
  range: process.env.ROADMAP_EXPORT_RANGE || config.defaultRange,
  filters: []
};
const includeDetails = process.env.ROADMAP_EXPORT_INCLUDE_DETAILS !== 'false';

try {
  const { cookieHeader: token } = await authenticator.ensureSession();
  const response = await client.search(query, token);
  const detailsById = new Map();

  if (includeDetails) {
    for (const id of [...new Set(client.flattenSearchResponse(response).map(item => item.id))]) {
      try {
        detailsById.set(id, await client.details(id, token));
      } catch (error) {
        console.warn(`Failed to fetch detail for ${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  const markdown = client.toMarkdown(response, query, detailsById);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, markdown, 'utf-8');

  console.log(`Wrote ${client.flattenSearchResponse(response).length} roadmap item(s) to ${outputPath}`);
} finally {
  await authenticator.destroy();
}
