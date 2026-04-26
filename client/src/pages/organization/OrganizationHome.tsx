import { ClipboardList, Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import CalendarInfo from '../../components/CalendarInfo';
import EmptyState from '../../components/EmptyState';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import LinkButton from '../../components/LinkButton';
import PostingCollection from '../../components/postings/PostingCollection';
import {
  buildSharedPostingQuery,
  hasSharedAdvancedPostingFilters,
  organizationPostingSortOptions,
  resolveOrganizationPostingSortOption,
  toOrganizationPostingSortOptionValue,
  type OrganizationPostingSortBy,
  type OrganizationPostingSortOptionValue,
  type PostingSortDir,
  type SharedPostingFilterFields,
} from '../../components/postings/postingFilterConfig';
import PostingFiltersCard from '../../components/postings/PostingFiltersCard';
import PostingViewModeToggle from '../../components/postings/PostingViewModeToggle';
import { FormField } from '../../utils/formUtils';
import requestServer from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';
import { useOrganization } from '../../utils/useUsers';

import type {
  OrganizationCrisesResponse,
  OrganizationGetMeResponse,
  OrganizationPostingListResponse,
} from '../../../../server/src/api/types';
import type { PostingWithContext } from '../../../../server/src/types';

type OrganizationPostingFilters = SharedPostingFilterFields & {
  sortBy: OrganizationPostingSortBy;
  sortDir: PostingSortDir;
  hideFull: boolean;
  crisisId: 'all' | `${number}`;
};

type OrganizationPostingFilterFormValues = Omit<OrganizationPostingFilters, 'sortBy' | 'sortDir'> & {
  sortOption: OrganizationPostingSortOptionValue;
};

const defaultFilters: OrganizationPostingFilters = {
  search: '',
  sortBy: 'created_at',
  sortDir: 'desc',
  hideFull: false,
  crisisId: 'all',
  startDateFrom: '',
  endDateTo: '',
  startTimeFrom: '',
  endTimeTo: '',
  postingFilter: 'all',
  organizationCertificateFilter: 'all',
};

const defaultFormValues: OrganizationPostingFilterFormValues = {
  search: defaultFilters.search,
  sortOption: toOrganizationPostingSortOptionValue(defaultFilters.sortBy, defaultFilters.sortDir),
  hideFull: defaultFilters.hideFull,
  crisisId: defaultFilters.crisisId,
  startDateFrom: defaultFilters.startDateFrom,
  endDateTo: defaultFilters.endDateTo,
  startTimeFrom: defaultFilters.startTimeFrom,
  endTimeTo: defaultFilters.endTimeTo,
  postingFilter: defaultFilters.postingFilter,
  organizationCertificateFilter: defaultFilters.organizationCertificateFilter,
};
const organizationHomeFiltersStorageKey = 'organization-home-posting-filters';

const toOrganizationPostingFilterFormValues = (
  filters: OrganizationPostingFilters,
): OrganizationPostingFilterFormValues => ({
  search: filters.search,
  sortOption: toOrganizationPostingSortOptionValue(filters.sortBy, filters.sortDir),
  hideFull: filters.hideFull,
  crisisId: filters.crisisId,
  startDateFrom: filters.startDateFrom,
  endDateTo: filters.endDateTo,
  startTimeFrom: filters.startTimeFrom,
  endTimeTo: filters.endTimeTo,
  postingFilter: filters.postingFilter,
  organizationCertificateFilter: filters.organizationCertificateFilter,
});

const fromOrganizationPostingFilterFormValues = (
  values: OrganizationPostingFilterFormValues,
): OrganizationPostingFilters => {
  const selectedSortOption = resolveOrganizationPostingSortOption(values.sortOption);

  return {
    search: values.search,
    sortBy: selectedSortOption.sortBy,
    sortDir: selectedSortOption.sortDir,
    hideFull: values.hideFull,
    crisisId: values.crisisId,
    startDateFrom: values.startDateFrom,
    endDateTo: values.endDateTo,
    startTimeFrom: values.startTimeFrom,
    endTimeTo: values.endTimeTo,
    postingFilter: values.postingFilter,
    organizationCertificateFilter: values.organizationCertificateFilter,
  };
};

function OrganizationHome() {
  const organization = useOrganization();
  const [initialFilters] = useState<OrganizationPostingFilters>(() => {
    if (typeof window === 'undefined') return defaultFilters;
    const raw = window.sessionStorage.getItem(organizationHomeFiltersStorageKey);
    if (!raw) return defaultFilters;

    try {
      const parsed = JSON.parse(raw) as Partial<OrganizationPostingFilters>;
      return { ...defaultFilters, ...parsed };
    } catch {
      return defaultFilters;
    }
  });
  const initialFormValues = useMemo(
    () => toOrganizationPostingFilterFormValues(initialFilters),
    [initialFilters],
  );

  const fetchOrganizationPostings = useCallback(
    async (nextFilters: OrganizationPostingFilters) => {
      const query = buildSharedPostingQuery(nextFilters);
      if (nextFilters.hideFull) {
        query.hide_full = 'true';
      }

      if (nextFilters.crisisId !== 'all') {
        query.crisis_id = nextFilters.crisisId;
      }

      const response = await requestServer<OrganizationPostingListResponse>(
        '/organization/posting',
        {
          includeJwt: true,
          query,
        },
      );
      return response.postings;
    },
    [],
  );

  const {
    data: postings,
    loading,
    error,
    trigger: fetchPostings,
  } = useAsync(fetchOrganizationPostings, { immediate: false });

  const { data: crises } = useAsync(
    async () => {
      const response = await requestServer<OrganizationCrisesResponse>('/organization/crises', {
        includeJwt: true,
      });
      return response.crises;
    },
    { immediate: true },
  );

  const { data: organizationMe } = useAsync(
    async () => requestServer<OrganizationGetMeResponse>('/organization/me', { includeJwt: true }),
    { immediate: true },
  );

  const applyFilters = useCallback(async (formValues: OrganizationPostingFilterFormValues) => {
    const normalizedFilters = fromOrganizationPostingFilterFormValues(formValues);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(organizationHomeFiltersStorageKey, JSON.stringify(normalizedFilters));
    }
    await fetchPostings(normalizedFilters);
  }, [fetchPostings]);

  const crisisNameById = useMemo(() => new Map((crises ?? []).map(crisis => [crisis.id, crisis.name])), [crises]);

  const postingsWithContext = useMemo<PostingWithContext[]>(() => {
    if (!postings) return [];
    const orgName = organizationMe?.organization.name ?? organization?.name ?? '';
    const orgLogoPath = organizationMe?.organization.logo_path ?? organization?.logo_path ?? null;

    return postings.map(posting => ({
      ...posting,
      organization_name: orgName,
      organization_logo_path: orgLogoPath,
      crisis_name: posting.crisis_id ? (crisisNameById.get(posting.crisis_id) ?? null) : null,
      enrollment_count: posting.enrollment_count,
      application_status: 'none',
    }));
  }, [crisisNameById, organization?.logo_path, organization?.name, organizationMe?.organization.logo_path, organizationMe?.organization.name, postings]);

  return (
    <PageContainer>
      <PageHeader
        title="My Postings"
        subtitle="Track, manage, and update your organization opportunities."
        icon={ClipboardList}
        badge={
          postings && (
            <div className="badge badge-primary">
              {postings.length}
              {' '}
              {postings.length === 1 ? 'Posting' : 'Postings'}
            </div>
          )
        }
        actions={(
          <div className="flex gap-2 items-center flex-wrap justify-end">
            <PostingViewModeToggle />
            <LinkButton
              color="primary"
              to="/organization/posting"
              Icon={Plus}
              size="sm"
            >
              Create New Posting
            </LinkButton>
          </div>
        )}
      />

      <PostingFiltersCard
        defaultValues={initialFormValues}
        resetValues={defaultFormValues}
        onApply={applyFilters}
        searchFieldName="search"
        searchPlaceholder="Search by title, description, or location"
        sortFieldName="sortOption"
        sortOptions={organizationPostingSortOptions.map(option => ({
          label: option.label,
          value: option.value,
        }))}
        extraFields={form => (
          <FormField
            form={form}
            name="postingFilter"
            label="Posting Filter"
            selectOptions={[
              { label: 'All postings', value: 'all' },
              { label: 'Open postings', value: 'open' },
              { label: 'Review-based postings', value: 'review' },
              { label: 'Full commitment', value: 'full' },
              { label: 'Partial commitment', value: 'partial' },
              { label: 'Tagged postings', value: 'tagged' },
              { label: 'Untagged postings', value: 'untagged' },
            ]}
          />
        )}
        getHasAdvancedFiltersApplied={values => (
          hasSharedAdvancedPostingFilters(values)
          || values.hideFull
          || values.crisisId !== 'all'
        )}
        renderAdvancedFields={form => (
          <>
            <div className="lg:col-span-2">
              <FormField
                form={form}
                name="crisisId"
                label="Crisis"
                selectOptions={[
                  { label: 'All Postings', value: 'all' },
                  ...(crises?.map(crisis => ({
                    label: crisis.name,
                    value: String(crisis.id),
                  })) ?? []),
                ]}
              />
            </div>

            <div className="lg:col-span-2">
              <CalendarInfo
                selectionMode="range"
                rangeLabel="Date Range"
                rangeValue={{
                  from: form.watch('startDateFrom') ?? '',
                  to: form.watch('endDateTo') ?? '',
                }}
                onRangeChange={({ from, to }) => {
                  form.setValue('startDateFrom', from, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                  form.setValue('endDateTo', to, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                }}
                className="w-full"
              />
            </div>

            <FormField
              form={form}
              name="startTimeFrom"
              label="Start Time After"
              type="time"
            />

            <FormField
              form={form}
              name="endTimeTo"
              label="End Time By"
              type="time"
            />
            <div className="lg:col-span-2 flex items-end">
              <label className="label cursor-pointer justify-start gap-3 py-0">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  {...form.register('hideFull')}
                />
                <span className="label-text">Hide full postings</span>
              </label>
            </div>
          </>
        )}
      />

      {error && <div className="mb-4 text-sm text-base-content/70">Unable to load postings.</div>}

      {loading && (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}

      {!loading && (!postings || postings.length === 0) && (
        <EmptyState
          Icon={ClipboardList}
          title="No postings yet"
          description="Create your first posting to start receiving volunteer applications."
        />
      )}

      {!loading && postingsWithContext.length > 0 && (
        <PostingCollection
          postings={postingsWithContext}
          crisisTagClickable
          crisisBasePath="/organization/crises"
          cardsContainerClassName="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        />
      )}
    </PageContainer>
  );
}

export default OrganizationHome;
