import { z } from 'zod';

export const FilterInputSchema = z.object({
  type: z.string().min(1).describe('Roadmap filter category type, for example PRODUCT, PROCESS, INDUSTRY, SC, BC, BD, BA.'),
  id: z.string().min(1).describe('Roadmap filter category ID, for example a PRODUCT ID from the filters tool.')
});

export const RoadmapQueryInputSchema = {
  q: z.string().min(1).max(200).optional().describe('Search text, for example "work zone".'),
  range: z.string().min(1).default('CURRENT-LAST').describe('Roadmap date range, for example CURRENT-LAST.'),
  filters: z.array(FilterInputSchema).default([]).describe('Optional filters. Each filter becomes a query parameter such as PRODUCT=<id>.')
};

export const SearchInputSchema = {
  ...RoadmapQueryInputSchema,
  markdown: z.boolean().default(false).describe('When true, also return a Markdown document of the matching items.')
};

export const MarkdownInputSchema = {
  ...RoadmapQueryInputSchema,
  includeDetails: z.boolean().default(false).describe('When true, fetch each item detail endpoint and include available benefits in the Markdown.')
};

export const DetailInputSchema = {
  id: z.string().min(1).describe('Roadmap innovation/deliverable ID, for example 895BC1A09CB744D488A701B3736B9704.')
};
