import type {
  FlattenedRoadmapItem,
  RoadmapFilterGroup,
  RoadmapInnovationDetail,
  RoadmapPeriod,
  RoadmapQuery,
  RoadmapSearchResponse,
  ServerConfig
} from './types.js';
import { logger } from './logger.js';

export class SapRoadmapApiClient {
  constructor(private config: ServerConfig) {}

  async search(query: RoadmapQuery, cookie: string): Promise<RoadmapSearchResponse> {
    return this.getJson<RoadmapSearchResponse>('/services/deliverable-search/search', query, cookie);
  }

  async filters(query: RoadmapQuery, cookie: string): Promise<RoadmapFilterGroup[]> {
    return this.getJson<RoadmapFilterGroup[]>('/services/deliverable-search/filter', query, cookie);
  }

  async periods(query: RoadmapQuery, cookie: string): Promise<RoadmapPeriod[]> {
    return this.getJson<RoadmapPeriod[]>('/services/deliverable-search/periods', query, cookie);
  }

  async details(id: string, cookie: string): Promise<RoadmapInnovationDetail> {
    const detail = await this.getJson<RoadmapInnovationDetail>(
      `/services/innovation/details/${encodeURIComponent(id)}`,
      null,
      cookie
    );

    return {
      ...detail,
      description: htmlToText(detail.description || ''),
      benefits: htmlToText(detail.benefits || '')
    };
  }

  flattenSearchResponse(response: RoadmapSearchResponse): FlattenedRoadmapItem[] {
    const byPeriodAndId = new Map<string, FlattenedRoadmapItem>();

    for (const period of response.deliverablesByPeriods || []) {
      for (const group of period.deliverableGroups || []) {
        for (const deliverable of group.deliverables || []) {
          const key = `${period.periodKey}:${deliverable.id}`;
          const existing = byPeriodAndId.get(key);

          if (existing) {
            if (!existing.groupTitles.includes(group.groupTitle)) {
              existing.groupTitles.push(group.groupTitle);
            }
            continue;
          }

          byPeriodAndId.set(key, {
            ...deliverable,
            description: htmlToText(deliverable.description || ''),
            periodKey: period.periodKey,
            periodTitle: period.periodTitle,
            groupTitles: [group.groupTitle]
          });
        }
      }
    }

    return [...byPeriodAndId.values()];
  }

  toMarkdown(
    response: RoadmapSearchResponse,
    query: RoadmapQuery,
    detailsById?: Map<string, RoadmapInnovationDetail>
  ): string {
    const items = this.flattenSearchResponse(response);
    const title = query.q ? `SAP Road Map Items for "${query.q}"` : 'SAP Road Map Items';
    const filters = query.filters?.length
      ? query.filters.map(filter => `${filter.type}=${filter.id}`).join(', ')
      : 'none';

    const lines = [
      `# ${title}`,
      '',
      `- Range: ${query.range || this.config.defaultRange}`,
      `- Filters: ${filters}`,
      `- Total deliverables: ${response.numberOfDeliverables?.total ?? items.length}`,
      `- Exported: ${new Date().toISOString()}`,
      ''
    ];

    if (items.length === 0) {
      lines.push('No roadmap items matched the query.');
      return lines.join('\n');
    }

    const itemsByPeriod = new Map<string, FlattenedRoadmapItem[]>();
    for (const item of items) {
      const key = `${item.periodKey}|||${item.periodTitle}`;
      const periodItems = itemsByPeriod.get(key) || [];
      periodItems.push(item);
      itemsByPeriod.set(key, periodItems);
    }

    for (const [periodKey, periodItems] of itemsByPeriod) {
      const [, periodTitle] = periodKey.split('|||');
      lines.push(`## ${periodTitle}`);
      lines.push('');

      for (const item of periodItems) {
        lines.push(`### ${item.title}`);
        lines.push('');
        lines.push(`- ID: ${item.id}`);
        if (item.type) lines.push(`- Type: ${item.type}`);
        if (item.deliveryStatus) lines.push(`- Status: ${item.deliveryStatus}`);
        if (item.groupTitles.length) lines.push(`- Capability / Group: ${item.groupTitles.join(', ')}`);
        if (item.tags?.length) lines.push(`- Tags: ${item.tags.map(tag => tag.name).join(', ')}`);
        const detail = detailsById?.get(item.id);
        if (detail?.benefits) {
          lines.push('');
          lines.push('**Benefits**');
          lines.push('');
          lines.push(detail.benefits);
        }
        if (item.description) {
          lines.push('');
          lines.push(item.description);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private async getJson<T>(path: string, query: RoadmapQuery | null, cookie: string): Promise<T> {
    const url = this.buildUrl(path, query);
    logger.info(`GET ${url.toString()}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'accept-language': 'en-US,en;q=0.9',
        cookie,
        referer: `${this.config.roadmapBaseUrl}/board`,
        'user-agent': 'sap-roadmap-mcp/0.1.0'
      }
    });

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`SAP Road Map API returned ${response.status}: ${text.slice(0, 300)}`);
    }

    if (contentType.includes('text/html') || text.trimStart().startsWith('<html')) {
      throw new Error('SESSION_EXPIRED: SAP Road Map API returned login HTML instead of JSON');
    }

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(`Failed to parse SAP Road Map API JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private buildUrl(path: string, query: RoadmapQuery | null): URL {
    const url = new URL(path, this.config.roadmapBaseUrl);
    const search = url.searchParams;

    if (!query) return url;

    if (query.q) search.set('q', query.q);
    search.set('range', query.range || this.config.defaultRange);

    for (const filter of query.filters || []) {
      search.append(filter.type.toUpperCase(), filter.id);
    }

    return url;
  }
}

function htmlToText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/?(ul|ol|p|div|span)[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
