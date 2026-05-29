export type AuthMethod = 'auto' | 'password' | 'certificate';

export interface ServerConfig {
  pfxPath?: string;
  pfxPassphrase?: string;
  sapUsername?: string;
  sapPassword?: string;
  authMethod: AuthMethod;
  mfaTimeout: number;
  maxJwtAgeH: number;
  headful: boolean;
  logLevel: string;
  roadmapBaseUrl: string;
  defaultRange: string;
  tokenCacheFile: string;
  ssoStorageStateFile?: string;
  sapLoginUrl?: string;
}

export interface RoadmapFilter {
  type: string;
  id: string;
}

export interface RoadmapQuery {
  q?: string;
  range?: string;
  filters?: RoadmapFilter[];
}

export interface RoadmapCategory {
  type: string;
  id: string;
  title: string;
  technicalType?: string;
}

export interface RoadmapFilterGroup {
  categoryTypeInformation: {
    categoryType: string;
    filterClassification?: string;
    nameSingular?: string;
    namePlural?: string;
    sequence?: number;
  };
  categoryFilters: Array<{
    category: RoadmapCategory;
    deliverablesCount: number;
    hideInFilterDropdown?: boolean;
  }>;
}

export interface RoadmapPeriod {
  key: string;
  title: string;
  keyAsFromFilter?: string;
  keyAsToFilter?: string;
  deliverableCount: number;
  semanticKey?: string;
}

export interface RoadmapDeliverableTag {
  name: string;
  filter?: RoadmapFilter;
}

export interface RoadmapDeliverable {
  id: string;
  type?: string;
  title: string;
  description?: string;
  hasMultipleProducts?: boolean;
  deliveryStatus?: string;
  availabilitySortable?: string;
  tags?: RoadmapDeliverableTag[];
}

export interface RoadmapDeliverableGroup {
  groupTitle: string;
  deliverables: RoadmapDeliverable[];
}

export interface RoadmapDeliverablesByPeriod {
  periodKey: string;
  periodTitle: string;
  deliverableGroups: RoadmapDeliverableGroup[];
  numberOfDeliverables?: RoadmapStatusCounts;
}

export interface RoadmapStatusCounts {
  total: number;
  byStatus?: Array<{
    status: string;
    count: number;
  }>;
}

export interface RoadmapSearchResponse {
  numberOfDeliverables: RoadmapStatusCounts;
  deliverablesByPeriods: RoadmapDeliverablesByPeriod[];
}

export interface FlattenedRoadmapItem extends RoadmapDeliverable {
  periodKey: string;
  periodTitle: string;
  groupTitles: string[];
}

export interface RoadmapInnovationDetail {
  id: string;
  title: string;
  description?: string;
  benefits?: string;
  features?: unknown[];
  tags?: unknown;
  relatedDeliverablesBySolutionCapability?: unknown[];
  relatedDeliverablesByBusinessRole?: unknown[];
  [key: string]: unknown;
}
