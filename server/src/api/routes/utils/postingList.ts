import { sql } from 'kysely';

import { getSingleQueryValue } from './queryValue.ts';
import { hasPostingEnded } from '../../../services/posting/postingTime.ts';

export type PostingSortDir = 'asc' | 'desc';
export type SharedPostingSortBy = 'start_date' | 'created_at' | 'title';

export type PostingDateTimeFilters = {
  startDateFrom?: Date;
  endDateTo?: Date;
  startTimeFrom?: string;
  endTimeTo?: string;
};

type PostingDateValue = Date | string | null | undefined;

type PostingSortLike = {
  id?: number;
  has_ended?: boolean;
  title?: string | null | undefined;
  start_date?: PostingDateValue;
  start_time?: string | null | undefined;
  end_date: PostingDateValue;
  end_time?: string | null;
  created_at?: PostingDateValue | undefined;
};

type PostingSearchLike = {
  title: string;
  description: string;
  location_name: string;
  organization_name?: string | null;
  skills: Array<{ name: string }>;
};

type PostingQueryLike = {
  where: (...args: unknown[]) => PostingQueryLike;
  orderBy: (...args: unknown[]) => PostingQueryLike;
};

const endedLastOrderExpression = sql<number>`CASE
  WHEN posting.end_date IS NOT NULL
   AND posting.end_time IS NOT NULL
   AND to_timestamp(
     to_char(posting.end_date, 'YYYY-MM-DD') || ' ' || posting.end_time,
     'YYYY-MM-DD HH24:MI'
   ) < now()
  THEN 1
  ELSE 0
END`;

const normalizeDateKey = (value: PostingDateValue): string | null => {
  if (!value) return null;

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
};

const normalizeTimeKey = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return value.slice(0, 8);
};

const normalizeTimestampKey = (value: PostingDateValue): string | null => {
  if (!value) return null;

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  return value.toISOString();
};

const normalizeSearchText = (value: string): string => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ');

export const normalizeSearchTerms = (value: string): string[] => normalizeSearchText(value)
  .split(' ')
  .filter(Boolean);

const tokenizeSearchField = (value: string): string[] => normalizeSearchTerms(value);

const escapeRegexTerm = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildSearchRegexPattern = (term: string): string => `(^|[^a-z0-9])${escapeRegexTerm(term)}([^a-z0-9]|$)`;

const compareNullableKeys = (
  left: string | null,
  right: string | null,
  sortDir: PostingSortDir,
): number => {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  const result = left.localeCompare(right);
  return sortDir === 'asc' ? result : -result;
};

const comparePostingEndStatus = (left: PostingSortLike, right: PostingSortLike): number => {
  const leftEnded = left.has_ended ?? hasPostingEnded(left);
  const rightEnded = right.has_ended ?? hasPostingEnded(right);

  if (leftEnded === rightEnded) {
    return 0;
  }

  return leftEnded ? 1 : -1;
};

const parseDateBoundary = (value: string | undefined): Date | undefined => {
  if (!value) return undefined;

  const parsedDate = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
};

export const parsePostingDateTimeFilters = (query: Record<string, unknown>): PostingDateTimeFilters => {
  const startDateFrom = parseDateBoundary(getSingleQueryValue(query.start_date_from));
  const endDateTo = parseDateBoundary(getSingleQueryValue(query.end_date_to));
  const startTimeFrom = getSingleQueryValue(query.start_time_from);
  const endTimeTo = getSingleQueryValue(query.end_time_to);

  const filters: PostingDateTimeFilters = {};

  if (startDateFrom) filters.startDateFrom = startDateFrom;
  if (endDateTo) filters.endDateTo = endDateTo;
  if (startTimeFrom) filters.startTimeFrom = startTimeFrom;
  if (endTimeTo) filters.endTimeTo = endTimeTo;

  return filters;
};

export const applyPostingDateTimeFilters = <Q extends PostingQueryLike>(
  query: Q,
  filters: PostingDateTimeFilters,
): Q => {
  let nextQuery = query;

  if (filters.startDateFrom) {
    nextQuery = nextQuery.where('posting.start_date', '>=', filters.startDateFrom) as Q;
  }

  if (filters.endDateTo) {
    nextQuery = nextQuery
      .where('posting.end_date', 'is not', null)
      .where('posting.end_date', '<=', filters.endDateTo) as Q;
  }

  if (filters.startTimeFrom) {
    nextQuery = nextQuery.where('posting.start_time', '>=', filters.startTimeFrom) as Q;
  }

  if (filters.endTimeTo) {
    nextQuery = nextQuery
      .where('posting.end_time', 'is not', null)
      .where('posting.end_time', '<=', filters.endTimeTo) as Q;
  }

  return nextQuery;
};

export const matchesPostingDateTimeFilters = <T extends Pick<PostingSortLike, 'start_date' | 'start_time' | 'end_date' | 'end_time'>>(
  posting: T,
  filters: PostingDateTimeFilters,
): boolean => {
  const postingStartDateKey = normalizeDateKey(posting.start_date);
  const postingEndDateKey = normalizeDateKey(posting.end_date);
  const startDateFilterKey = normalizeDateKey(filters.startDateFrom);
  const endDateFilterKey = normalizeDateKey(filters.endDateTo);
  const postingStartTimeKey = normalizeTimeKey(posting.start_time);
  const postingEndTimeKey = normalizeTimeKey(posting.end_time);
  const startTimeFilterKey = normalizeTimeKey(filters.startTimeFrom);
  const endTimeFilterKey = normalizeTimeKey(filters.endTimeTo);

  if (startDateFilterKey && (!postingStartDateKey || postingStartDateKey < startDateFilterKey)) {
    return false;
  }

  if (endDateFilterKey && (!postingEndDateKey || postingEndDateKey > endDateFilterKey)) {
    return false;
  }

  if (startTimeFilterKey && (!postingStartTimeKey || postingStartTimeKey < startTimeFilterKey)) {
    return false;
  }

  if (endTimeFilterKey && (!postingEndTimeKey || postingEndTimeKey > endTimeFilterKey)) {
    return false;
  }

  return true;
};

export const matchesPostingSearch = <T extends PostingSearchLike>(posting: T, search: string): boolean => {
  if (!search) return true;

  const terms = normalizeSearchTerms(search);

  const searchableTokens = [
    posting.title,
    posting.description,
    posting.location_name,
    posting.organization_name ?? '',
    ...posting.skills.map(skill => skill.name),
  ].flatMap(tokenizeSearchField);

  const searchableText = normalizeSearchText([
    posting.title,
    posting.description,
    posting.location_name,
    posting.organization_name ?? '',
    ...posting.skills.map(skill => skill.name),
  ].join(' '));

  const normalizedSearchableText = searchableText.replace(/\s+/g, '');

  return terms.every(term => (
    searchableTokens.some(token => token.includes(term))
    || normalizedSearchableText.includes(term)
  ));
};

export const sortPostingsBySharedSort = <T extends PostingSortLike>(
  postings: T[],
  sortBy: SharedPostingSortBy,
  sortDir: PostingSortDir,
): T[] => [...postings].sort((left, right) => {
  const endedCompare = comparePostingEndStatus(left, right);
  if (endedCompare !== 0) {
    return endedCompare;
  }

  switch (sortBy) {
    case 'created_at':
    {
      const createdAtCompare = compareNullableKeys(
        normalizeTimestampKey(left.created_at),
        normalizeTimestampKey(right.created_at),
        sortDir,
      );

      if (createdAtCompare !== 0) {
        return createdAtCompare;
      }

      const leftId = left.id ?? 0;
      const rightId = right.id ?? 0;
      return sortDir === 'asc' ? leftId - rightId : rightId - leftId;
    }
    case 'title': {
      return compareNullableKeys(
        left.title ?? '',
        right.title ?? '',
        sortDir,
      );
    }
    case 'start_date':
    default: {
      const dateCompare = compareNullableKeys(
        normalizeDateKey(left.start_date),
        normalizeDateKey(right.start_date),
        sortDir,
      );

      if (dateCompare !== 0) {
        return dateCompare;
      }

      return compareNullableKeys(
        normalizeTimeKey(left.start_time),
        normalizeTimeKey(right.start_time),
        sortDir,
      );
    }
  }
});

export const applyPostingEndedLastSort = <Q extends PostingQueryLike>(query: Q): Q => (
  query.orderBy(endedLastOrderExpression, 'asc') as Q
);

export const applySharedPostingSort = <Q extends PostingQueryLike>(
  query: Q,
  sortBy: SharedPostingSortBy,
  sortDir: PostingSortDir,
): Q => {
  const endedSortedQuery = applyPostingEndedLastSort(query);

  switch (sortBy) {
    case 'created_at':
      return endedSortedQuery
        .orderBy('posting.created_at', sortDir)
        .orderBy('posting.id', sortDir) as Q;
    case 'title':
      return endedSortedQuery
        .orderBy('posting.title', sortDir)
        .orderBy('posting.id', sortDir) as Q;
    case 'start_date':
    default:
      return endedSortedQuery
        .orderBy('posting.start_date', sortDir)
        .orderBy('posting.start_time', sortDir) as Q;
  }
};
