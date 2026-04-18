import { Flag, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import Alert from '../../components/Alert';
import Button from '../../components/Button';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import ReportHeader from '../../components/reporting/ReportHeader';
import ReportMessage from '../../components/reporting/ReportMessage';
import { REPORT_TYPE_OPTIONS } from '../../components/reporting/reportType.constants';
import requestServer from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type { AdminReportsResponse } from '../../../../server/src/api/types';

type ReportsScope = 'all' | 'organization' | 'volunteer';
type ReportType = 'all' | 'scam' | 'impersonation' | 'harassment' | 'inappropriate_behavior' | 'other';
type ReportsSortBy = 'created_at';
type ReportsSortDir = 'asc' | 'desc';

type ReportsFilters = {
  scope: ReportsScope;
  reportType: ReportType;
  search: string;
  sortBy: ReportsSortBy;
  sortDir: ReportsSortDir;
};

const defaultFilters: ReportsFilters = {
  scope: 'all',
  reportType: 'all',
  search: '',
  sortBy: 'created_at',
  sortDir: 'desc',
};
const reportsFiltersStorageKey = 'admin-reports-filters';

function AdminReports() {
  const navigate = useNavigate();
  const [initialFilters] = useState<ReportsFilters>(() => {
    if (typeof window === 'undefined') return defaultFilters;
    const raw = window.sessionStorage.getItem(reportsFiltersStorageKey);
    if (!raw) return defaultFilters;

    try {
      const parsed = JSON.parse(raw) as Partial<ReportsFilters>;
      return { ...defaultFilters, ...parsed };
    } catch {
      return defaultFilters;
    }
  });

  const [filters, setFilters] = useState<ReportsFilters>(initialFilters);
  const [activeFilters, setActiveFilters] = useState<ReportsFilters>(initialFilters);

  const fetchReports = useCallback(async (nextFilters: ReportsFilters) => {
    const query: Record<string, string> = {
      scope: nextFilters.scope,
      sortBy: nextFilters.sortBy,
      sortDir: nextFilters.sortDir,
    };

    if (nextFilters.reportType !== 'all') {
      query.reportType = nextFilters.reportType;
    }

    if (nextFilters.search.trim()) {
      query.search = nextFilters.search.trim();
    }

    return await requestServer<AdminReportsResponse>('/admin/reports', {
      includeJwt: true,
      query,
    });
  }, []);

  const {
    data,
    loading,
    error,
    trigger,
  } = useAsync(fetchReports, { immediate: false, notifyOnError: false });

  const hasPendingChanges = useMemo(() => JSON.stringify(filters) !== JSON.stringify(activeFilters), [filters, activeFilters]);
  const hasAnyChangesFromDefault = useMemo(() => (
    JSON.stringify(filters) !== JSON.stringify(defaultFilters)
    || JSON.stringify(activeFilters) !== JSON.stringify(defaultFilters)
  ), [filters, activeFilters]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveFilters(filters);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(reportsFiltersStorageKey, JSON.stringify(filters));
    }
    void trigger(filters);
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setActiveFilters(defaultFilters);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(reportsFiltersStorageKey);
    }
    void trigger(defaultFilters);
  };

  const refreshCurrentReports = () => {
    void trigger(activeFilters);
  };

  useEffect(() => {
    if (!data && !loading && !error) {
      void trigger(activeFilters);
    }
  }, [activeFilters, data, error, loading, trigger]);

  const organizationReports = data?.organizationReports ?? [];
  const volunteerReports = data?.volunteerReports ?? [];
  const hasFetchedReports = data !== undefined || error !== undefined;
  const mergedReports = useMemo(() => {
    const rows = [
      ...(activeFilters.scope !== 'volunteer'
        ? organizationReports.map(report => ({ type: 'organization' as const, report }))
        : []),
      ...(activeFilters.scope !== 'organization'
        ? volunteerReports.map(report => ({ type: 'volunteer' as const, report }))
        : []),
    ];

    rows.sort((left, right) => {
      const leftTime = new Date(left.report.created_at).getTime();
      const rightTime = new Date(right.report.created_at).getTime();
      const order = leftTime - rightTime;
      return activeFilters.sortDir === 'asc' ? order : -order;
    });

    return rows;
  }, [activeFilters.scope, activeFilters.sortDir, organizationReports, volunteerReports]);

  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        subtitle="Review organization and volunteer reports submitted by users."
        icon={Flag}
      />

      {error && (
        <Alert color="error" className="mb-6">
          <p>{error.message || 'Failed to load reports.'}</p>
          <div>
            <Button
              type="button"
              size="sm"
              style="outline"
              Icon={RotateCcw}
              onClick={refreshCurrentReports}
            >
              Retry
            </Button>
          </div>
        </Alert>
      )}

      <Card title="Filters" description="Filter and sort reports before review." className="mb-6">
        <form className="space-y-4" onSubmit={applyFilters}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="label" htmlFor="reports-scope">
                <span className="label-text">Scope</span>
              </label>
              <select
                id="reports-scope"
                className="select select-bordered w-full"
                value={filters.scope}
                onChange={event => setFilters(prev => ({ ...prev, scope: event.target.value as ReportsScope }))}
              >
                <option value="all">All reports</option>
                <option value="organization">Organization reports</option>
                <option value="volunteer">Volunteer reports</option>
              </select>
            </div>

            <div>
              <label className="label" htmlFor="reports-type">
                <span className="label-text">Report Type</span>
              </label>
              <select
                id="reports-type"
                className="select select-bordered w-full"
                value={filters.reportType}
                onChange={event => setFilters(prev => ({ ...prev, reportType: event.target.value as ReportType }))}
              >
                <option value="all">All types</option>
                {REPORT_TYPE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="reports-search">
                <span className="label-text">Search</span>
              </label>
              <input
                id="reports-search"
                type="text"
                className="input input-bordered w-full"
                placeholder="Search title, message, names, emails"
                value={filters.search}
                onChange={event => setFilters(prev => ({ ...prev, search: event.target.value }))}
              />
            </div>

            <div>
              <label className="label" htmlFor="reports-sort">
                <span className="label-text">Sort</span>
              </label>
              <select
                id="reports-sort"
                className="select select-bordered w-full"
                value={`${filters.sortBy}|${filters.sortDir}`}
                onChange={(event) => {
                  const [sortBy, sortDir] = event.target.value.split('|') as [ReportsSortBy, ReportsSortDir];
                  setFilters(prev => ({ ...prev, sortBy, sortDir }));
                }}
              >
                <option value="created_at|desc">Newest first</option>
                <option value="created_at|asc">Oldest first</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              color="ghost"
              Icon={RotateCcw}
              onClick={resetFilters}
              disabled={!hasAnyChangesFromDefault}
            >
              Reset
            </Button>
            <Button
              type="submit"
              color="primary"
              disabled={!hasPendingChanges}
            >
              Apply Filters
            </Button>
          </div>
        </form>
      </Card>

      {((!hasFetchedReports || loading) && !data)
        ? (
            <div className="space-y-3">
              <div className="h-28 w-full rounded-xl skeleton" />
              <div className="h-28 w-full rounded-xl skeleton" />
              <div className="h-28 w-full rounded-xl skeleton" />
            </div>
          )
        : data && mergedReports.length === 0
          ? (
              <EmptyState
                Icon={Flag}
                title="No reports found"
                description="There are no reports matching your filters. Check back later or adjust your search criteria."
              />
            )
          : (
              <div className="space-y-3">
                {mergedReports.map(({ type, report }) => {
                  const subjectName = type === 'organization'
                    ? report.reported_organization.name
                    : `${report.reported_volunteer.first_name} ${report.reported_volunteer.last_name}`;

                  const detailsPath = type === 'organization'
                    ? `/admin/reports/organization/${report.id}`
                    : `/admin/reports/volunteer/${report.id}`;

                  return (
                    <div
                      key={`${type}-${report.id}`}
                      className="rounded-xl border border-base-300 bg-base-100 p-4 flex flex-col items-start"
                    >
                      <ReportHeader
                        compact
                        createdAt={report.created_at}
                        reportTitle={report.title}
                        subjectName={subjectName}
                        scopeLabel={type === 'organization' ? 'Organization' : 'Volunteer'}
                      />
                      <ReportMessage message={report.message} className="mb-3" />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => navigate(detailsPath)}
                      >
                        View Details
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
    </PageContainer>
  );
}

export default AdminReports;
