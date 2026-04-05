export type PostingSortDir = 'asc' | 'desc';

export type SharedPostingSortBy = 'start_date' | 'created_at' | 'title';

type SharedPostingSortOptionValue
  = | 'start_date_asc'
    | 'start_date_desc'
    | 'created_at_desc'
    | 'title_asc'
    | 'title_desc';

export type SharedPostingFilterFields = {
  search: string;
  sortBy: string;
  sortDir: PostingSortDir;
  startDateFrom: string;
  endDateTo: string;
  startTimeFrom: string;
  endTimeTo: string;
  postingFilter: 'all' | 'open' | 'review' | 'partial' | 'full' | 'tagged' | 'untagged';
  organizationCertificateFilter: 'all' | 'enabled' | 'disabled';
};

export type OrganizationPostingSortBy = SharedPostingSortBy | 'title';
export type OrganizationPostingSortOptionValue = SharedPostingSortOptionValue | 'title_asc' | 'title_desc';

export type OrganizationPostingSortOption = {
  value: OrganizationPostingSortOptionValue;
  label: string;
  sortBy: OrganizationPostingSortBy;
  sortDir: PostingSortDir;
};

export const organizationPostingSortOptions: OrganizationPostingSortOption[] = [
  { value: 'created_at_desc', label: 'Most Recent', sortBy: 'created_at', sortDir: 'desc' },
  { value: 'start_date_asc', label: 'Start Date (Oldest)', sortBy: 'start_date', sortDir: 'asc' },
  { value: 'start_date_desc', label: 'Start Date (Newest)', sortBy: 'start_date', sortDir: 'desc' },
  { value: 'title_asc', label: 'Title (A-Z)', sortBy: 'title', sortDir: 'asc' },
  { value: 'title_desc', label: 'Title (Z-A)', sortBy: 'title', sortDir: 'desc' },
];

export type VolunteerPostingSortBy = SharedPostingSortBy | 'recommended';
export type VolunteerPostingSortOptionValue = SharedPostingSortOptionValue | 'recommended_desc';

export type VolunteerPostingSortOption = {
  value: VolunteerPostingSortOptionValue;
  label: string;
  sortBy: VolunteerPostingSortBy;
  sortDir: PostingSortDir;
};

export const volunteerPostingSortOptions: VolunteerPostingSortOption[] = [
  { value: 'created_at_desc', label: 'Most Recent', sortBy: 'created_at', sortDir: 'desc' },
  { value: 'recommended_desc', label: 'Recommended (Best Match)', sortBy: 'recommended', sortDir: 'desc' },
  { value: 'start_date_asc', label: 'Start Date (Oldest)', sortBy: 'start_date', sortDir: 'asc' },
  { value: 'start_date_desc', label: 'Start Date (Newest)', sortBy: 'start_date', sortDir: 'desc' },
  { value: 'title_asc', label: 'Title (A-Z)', sortBy: 'title', sortDir: 'asc' },
  { value: 'title_desc', label: 'Title (Z-A)', sortBy: 'title', sortDir: 'desc' },
];

const getSortOptionByFields = <
  TOption extends { sortBy: string; sortDir: PostingSortDir },
>(
  options: TOption[],
  sortBy: string,
  sortDir: PostingSortDir,
): TOption => options.find(option => option.sortBy === sortBy && option.sortDir === sortDir) ?? options[0];

export const toOrganizationPostingSortOptionValue = (
  sortBy: OrganizationPostingSortBy,
  sortDir: PostingSortDir,
): OrganizationPostingSortOptionValue => getSortOptionByFields(organizationPostingSortOptions, sortBy, sortDir).value;

export const resolveOrganizationPostingSortOption = (
  value: OrganizationPostingSortOptionValue,
): OrganizationPostingSortOption => organizationPostingSortOptions.find(option => option.value === value) ?? organizationPostingSortOptions[0];

export const toVolunteerPostingSortOptionValue = (
  sortBy: VolunteerPostingSortBy,
  sortDir: PostingSortDir,
): VolunteerPostingSortOptionValue => getSortOptionByFields(volunteerPostingSortOptions, sortBy, sortDir).value;

export const resolveVolunteerPostingSortOption = (
  value: VolunteerPostingSortOptionValue,
): VolunteerPostingSortOption => volunteerPostingSortOptions.find(option => option.value === value) ?? volunteerPostingSortOptions[0];

export const buildSharedPostingQuery = (filters: SharedPostingFilterFields): Record<string, string> => {
  const query: Record<string, string> = {
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
  };

  if (filters.search.trim()) query.search = filters.search.trim();
  if (filters.startDateFrom) query.start_date_from = filters.startDateFrom;
  if (filters.endDateTo) query.end_date_to = filters.endDateTo;
  if (filters.startTimeFrom) query.start_time_from = filters.startTimeFrom;
  if (filters.endTimeTo) query.end_time_to = filters.endTimeTo;
  if (filters.postingFilter && filters.postingFilter !== 'all') query.posting_filter = filters.postingFilter;
  if (filters.organizationCertificateFilter && filters.organizationCertificateFilter !== 'all') query.certificate_enabled = filters.organizationCertificateFilter;

  return query;
};

export const hasSharedAdvancedPostingFilters = (filters: Pick<SharedPostingFilterFields, 'startDateFrom' | 'endDateTo' | 'startTimeFrom' | 'endTimeTo' | 'postingFilter'>): boolean => Boolean(
  filters.startDateFrom
  || filters.endDateTo
  || filters.startTimeFrom
  || filters.endTimeTo
  || (filters.postingFilter && filters.postingFilter !== 'all'),
);
