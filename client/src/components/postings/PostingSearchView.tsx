import { RotateCcw, Search, TextSearch, type LucideIcon } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import requestServer from '../../utils/requestServer.ts';
import useAsync from '../../utils/useAsync';
import Alert from '../Alert.tsx';
import Button from '../Button.tsx';
import CalendarInfo from '../CalendarInfo.tsx';
import PageHeader from '../layout/PageHeader.tsx';
import Loading from '../Loading.tsx';
import PostingCard from '../PostingCard.tsx';

import type { VolunteerPostingSearchResponse } from '../../../../server/src/api/types.ts';
import type { PostingWithContext } from '../../../../server/src/types.ts';

export type PostingSearchFilters = {
  search: string;
  startDate: string;
  endDate: string;
};

type PostingSearchViewProps = {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  badge?: ReactNode;
  showBack?: boolean;
  defaultBackTo?: string;
  initialFilters?: Partial<PostingSearchFilters>;
  emptyMessage?: string;
  filterPostings?: (postings: PostingWithContext[]) => PostingWithContext[];
  fetchUrl?: string;
};

const applyDateFilter = (
  postings: PostingWithContext[],
  startDate: string,
  endDate: string,
) => {
  return postings.filter((posting) => {
    if (startDate && posting.start_timestamp) {
      const postingStart = new Date(posting.start_timestamp).toISOString().split('T')[0];
      if (postingStart < startDate) return false;
    }
    if (endDate && posting.end_timestamp) {
      const postingEnd = new Date(posting.end_timestamp).toISOString().split('T')[0];
      if (postingEnd > endDate) return false;
    }
    return true;
  });
};

const applyTextSearch = (
  postings: PostingWithContext[],
  normalizedSearch: string,
) => {
  if (!normalizedSearch) {
    return postings;
  }

  const andParts = normalizedSearch
    .split(/\s+and\s+/i)
    .map(part => part.trim())
    .filter(Boolean);
  const orParts = normalizedSearch
    .split(/\s+or\s+/i)
    .map(part => part.trim())
    .filter(Boolean);

  const terms = andParts.length > 1
    ? andParts
    : orParts.length > 1
      ? orParts
      : [normalizedSearch];

  const useAndMode = andParts.length > 1;

  return postings.filter((posting) => {
    const locationText = posting.location_name.toLowerCase();
    const skillTexts = posting.skills.map(skill => skill.name.toLowerCase());

    const matchesTerm = (term: string) => {
      const locationMatch = locationText.includes(term);
      const skillMatch = skillTexts.some(skill => skill.includes(term));
      return locationMatch || skillMatch;
    };

    return useAndMode
      ? terms.every(matchesTerm)
      : terms.some(matchesTerm);
  });
};

function PostingSearchView({
  title,
  subtitle,
  icon = TextSearch,
  badge,
  showBack = false,
  defaultBackTo,
  initialFilters,
  emptyMessage = 'No postings found yet',
  filterPostings,
  fetchUrl,
}: PostingSearchViewProps) {
  const defaultFilters = useMemo<PostingSearchFilters>(() => ({
    search: '',
    startDate: '',
    endDate: '',
    ...initialFilters,
  }), [initialFilters]);

  const [postings, setPostings] = useState<PostingWithContext[]>([]);
  const [filters, setFilters] = useState<PostingSearchFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { trigger: fetchPostingsRequest } = useAsync(
    async (url: string) => requestServer<VolunteerPostingSearchResponse>(url, { includeJwt: true }),
    { notifyOnError: true },
  );

  const fetchPostings = useCallback(async (activeFilters: PostingSearchFilters) => {
    const baseUrl = fetchUrl ?? '/volunteer/posting';
    const query = new URLSearchParams();

    if (!fetchUrl) {
      if (activeFilters.startDate) query.append('start_timestamp', activeFilters.startDate);
      if (activeFilters.endDate) query.append('end_timestamp', activeFilters.endDate);
    }

    const url = query.size > 0 ? `${baseUrl}?${query.toString()}` : baseUrl;

    setLoading(true);
    setError(null);

    try {
      const response = await fetchPostingsRequest(url);
      const normalizedSearch = activeFilters.search.trim().toLowerCase();

      let result = applyTextSearch(response.postings, normalizedSearch);
      if (fetchUrl) {
        result = applyDateFilter(result, activeFilters.startDate, activeFilters.endDate);
      }
      const finalPostings = filterPostings ? filterPostings(result) : result;

      setPostings(finalPostings);
    } catch (fetchError) {
      setPostings([]);
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to load postings';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [fetchPostingsRequest, fetchUrl, filterPostings]);

  useEffect(() => {
    void fetchPostings(defaultFilters);
  }, [defaultFilters]);

  const resetFilters = () => {
    setFilters(defaultFilters);
    void fetchPostings(defaultFilters);
  };

  const hasActiveFilters = Boolean(filters.search || filters.startDate || filters.endDate);

  return (
    <div className="p-6 md:container mx-auto">
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        badge={badge}
        showBack={showBack}
        defaultBackTo={defaultBackTo}
      />

      <div className="mb-6 rounded-box border border-base-300 bg-base-100 p-4 shadow-sm">
        <h4 className="mb-3 text-lg font-semibold">Filter</h4>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void fetchPostings(filters);
          }}
        >
          <div className="mb-3 flex flex-wrap gap-4">
            <label className="input input-bordered flex w-full items-center gap-2 md:w-96">
              <Search className="h-4 w-4 opacity-70" />
              <input
                type="text"
                className="grow"
                placeholder="Search by location or skill (use AND / OR)"
                value={filters.search}
                onChange={event => setFilters({ ...filters, search: event.target.value })}
              />
            </label>

            <CalendarInfo
              startValue={filters.startDate}
              endValue={filters.endDate}
              onStartChange={(value: string) => setFilters({ ...filters, startDate: value })}
              onEndChange={(value: string) => setFilters({ ...filters, endDate: value })}
              inputType="date"
              startPlaceholder="Start Date"
              endPlaceholder="End Date"
            />
          </div>

          <div className="flex gap-3">
            <Button
              color="primary"
              type="submit"
              disabled={!hasActiveFilters}
              Icon={Search}
            >
              Apply Filters
            </Button>

            <Button
              type="button"
              color="ghost"
              disabled={!hasActiveFilters}
              onClick={resetFilters}
              Icon={RotateCcw}
            >
              Reset Filters
            </Button>
          </div>
        </form>
      </div>

      {error && <div className="mb-4 text-sm text-base-content/70">Unable to load postings.</div>}

      {loading
        ? (
            <div className="flex justify-center py-10">
              <Loading size="lg" />
            </div>
          )
        : postings.length === 0
          ? (
              <Alert>
                {emptyMessage}
              </Alert>
            )
          : (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
                {postings.map(posting => (
                  <PostingCard
                    key={posting.id}
                    posting={posting}
                  />
                ))}
              </div>
            )}
    </div>
  );
}

export default PostingSearchView;
