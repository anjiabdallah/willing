import { ClipboardCheck, Inbox, RotateCcw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import Button from '../../components/Button';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import OrganizationRequestReviewCard from '../../components/OrganizationRequestReviewCard';
import requestServer from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type { AdminOrganizationRequestsResponse } from '../../../../server/src/api/types';

type OrganizationRequestSortBy = 'created_at' | 'name';
type OrganizationRequestSortDir = 'asc' | 'desc';

type OrganizationRequestFilters = {
  search: string;
  sortBy: OrganizationRequestSortBy;
  sortDir: OrganizationRequestSortDir;
};

type OrganizationRequestSortOptionValue
  = | 'created_at_desc'
    | 'created_at_asc'
    | 'name_asc'
    | 'name_desc';

type OrganizationRequestSortOption = {
  value: OrganizationRequestSortOptionValue;
  label: string;
  sortBy: OrganizationRequestSortBy;
  sortDir: OrganizationRequestSortDir;
};

const organizationRequestSortOptions: OrganizationRequestSortOption[] = [
  { value: 'created_at_desc', label: 'Newest requests', sortBy: 'created_at', sortDir: 'desc' },
  { value: 'created_at_asc', label: 'Oldest requests', sortBy: 'created_at', sortDir: 'asc' },
  { value: 'name_asc', label: 'Name (A-Z)', sortBy: 'name', sortDir: 'asc' },
  { value: 'name_desc', label: 'Name (Z-A)', sortBy: 'name', sortDir: 'desc' },
];

const defaultFilters: OrganizationRequestFilters = {
  search: '',
  sortBy: 'created_at',
  sortDir: 'desc',
};
const requestsFiltersStorageKey = 'admin-requests-filters';

function AdminRequests() {
  const [initialFilters] = useState<OrganizationRequestFilters>(() => {
    if (typeof window === 'undefined') return defaultFilters;
    const raw = window.sessionStorage.getItem(requestsFiltersStorageKey);
    if (!raw) return defaultFilters;

    try {
      const parsed = JSON.parse(raw) as Partial<OrganizationRequestFilters>;
      return { ...defaultFilters, ...parsed };
    } catch {
      return defaultFilters;
    }
  });

  const [filters, setFilters] = useState<OrganizationRequestFilters>(initialFilters);
  const [activeFilters, setActiveFilters] = useState<OrganizationRequestFilters>(initialFilters);

  const getOrganizationRequests = useCallback(async (nextFilters: OrganizationRequestFilters) => {
    const query: Record<string, string> = {};

    if (nextFilters.search.trim()) {
      query.search = nextFilters.search.trim();
    }

    const res = await requestServer<AdminOrganizationRequestsResponse>('/admin/getOrganizationRequests', {
      includeJwt: true,
      query,
    });
    return res.organizationRequests;
  }, []);

  const {
    data: organizationRequests,
    trigger: refreshOrganizationRequests,
  } = useAsync(getOrganizationRequests, { immediate: false });

  useEffect(() => {
    void refreshOrganizationRequests(activeFilters);
  }, [activeFilters, refreshOrganizationRequests]);

  const hasPendingChanges = useMemo(() => JSON.stringify(filters) !== JSON.stringify(activeFilters), [filters, activeFilters]);
  const hasAnyChangesFromDefault = useMemo(() => (
    JSON.stringify(filters) !== JSON.stringify(defaultFilters)
    || JSON.stringify(activeFilters) !== JSON.stringify(defaultFilters)
  ), [filters, activeFilters]);

  const sortedOrganizationRequests = useMemo(() => {
    if (!organizationRequests) {
      return null;
    }

    const sorted = [...organizationRequests];

    if (activeFilters.sortBy === 'name') {
      sorted.sort((left, right) => {
        const comparison = left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
        return activeFilters.sortDir === 'asc' ? comparison : -comparison;
      });
      return sorted;
    }

    sorted.sort((left, right) => {
      const leftTime = new Date(left.created_at).getTime();
      const rightTime = new Date(right.created_at).getTime();
      const timeComparison = leftTime - rightTime;

      if (timeComparison !== 0) {
        return activeFilters.sortDir === 'asc' ? timeComparison : -timeComparison;
      }

      const idComparison = left.id - right.id;
      return activeFilters.sortDir === 'asc' ? idComparison : -idComparison;
    });

    return sorted;
  }, [organizationRequests, activeFilters]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveFilters(filters);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(requestsFiltersStorageKey, JSON.stringify(filters));
    }
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setActiveFilters(defaultFilters);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(requestsFiltersStorageKey);
    }
  };

  const refreshCurrentRequests = useCallback(
    async () => refreshOrganizationRequests(activeFilters),
    [activeFilters, refreshOrganizationRequests],
  );

  const selectedSortOption = organizationRequestSortOptions.find(option => option.sortBy === filters.sortBy && option.sortDir === filters.sortDir)
    ?? organizationRequestSortOptions[0];

  const onSortChange = (value: OrganizationRequestSortOptionValue) => {
    const nextOption = organizationRequestSortOptions.find(option => option.value === value);
    if (!nextOption) return;

    setFilters(prev => ({
      ...prev,
      sortBy: nextOption.sortBy,
      sortDir: nextOption.sortDir,
    }));
  };

  return (
    <PageContainer>
      <PageHeader
        title="Organization Requests"
        subtitle="Review pending onboarding submissions from organizations."
        icon={ClipboardCheck}
        badge={
          sortedOrganizationRequests
            ? (
                <div className="badge badge-primary">
                  {sortedOrganizationRequests.length}
                  {' '}
                  Pending
                </div>
              )
            : (
                <div className="w-22 h-6 skeleton" />
              )
        }
      />

      {sortedOrganizationRequests
        ? (sortedOrganizationRequests.length > 0
            ? (
                <>
                  <Card
                    title="Filters"
                  >
                    <form className="space-y-4" onSubmit={applyFilters}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                        <div className="flex-2">
                          <label className="label" htmlFor="organization-requests-search">
                            <span className="label-text">Search</span>
                          </label>
                          <label className="input input-bordered flex w-full items-center gap-2">
                            <Search className="h-4 w-4 opacity-70" />
                            <input
                              id="organization-requests-search"
                              type="text"
                              className="w-full min-w-0"
                              placeholder="Search name, email, location"
                              value={filters.search}
                              onChange={event => setFilters(prev => ({ ...prev, search: event.target.value }))}
                            />
                          </label>
                        </div>

                        <div className="flex-1">
                          <label className="label" htmlFor="organization-requests-sort">
                            <span className="label-text">Sort By</span>
                          </label>
                          <select
                            id="organization-requests-sort"
                            className="select select-bordered w-full"
                            value={selectedSortOption.value}
                            onChange={event => onSortChange(event.target.value as OrganizationRequestSortOptionValue)}
                          >
                            {organizationRequestSortOptions.map(option => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>

                      </div>

                      <div className="flex flex-wrap gap-3">
                        <div className="flex-1" />

                        <Button type="button" color="ghost" onClick={resetFilters} disabled={!hasAnyChangesFromDefault} Icon={RotateCcw}>Reset</Button>

                        <Button
                          color="primary"
                          type="submit"
                          disabled={!hasPendingChanges}
                          layout="wide"
                          Icon={Search}
                        >
                          Search
                        </Button>
                      </div>
                    </form>
                  </Card>
                  <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
                    {sortedOrganizationRequests.map((request, index) => (
                      <OrganizationRequestReviewCard
                        request={request}
                        refreshOrganizationRequests={refreshCurrentRequests}
                        key={`${activeFilters.sortBy}-${activeFilters.sortDir}-${index}-${request.id}`}
                      />
                    ))}
                  </div>
                </>
              )
            : (
                <EmptyState
                  Icon={Inbox}
                  title="All caught up!"
                  description="No organization requests found at this time."
                />
              )
          )
        : (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
              <div className="card shadow-sm border border-base-200 skeleton h-169">
              </div>
              <div className="card shadow-sm border border-base-200 skeleton h-169">
              </div>
              <div className="card shadow-sm border border-base-200 skeleton h-169">
              </div>
            </div>
          )}
    </PageContainer>
  );
}

export default AdminRequests;
