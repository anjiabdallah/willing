import { AlertTriangle, ArrowRight, ClipboardCheck, Flag, Home } from 'lucide-react';
import { useCallback } from 'react';

import Card from '../../components/Card';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import LinkButton from '../../components/LinkButton';
import { DOMAIN_COLORS } from '../../constants';
import requestServer from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type {
  AdminCrisesResponse,
  AdminOrganizationRequestsResponse,
  AdminReportsResponse,
} from '../../../../server/src/api/types';

function AdminHome() {
  const getOrganizationRequests = useCallback(async () => {
    const res = await requestServer<AdminOrganizationRequestsResponse>('/admin/getOrganizationRequests', { includeJwt: true });
    return res.organizationRequests;
  }, []);

  const getCrises = useCallback(async () => {
    const res = await requestServer<AdminCrisesResponse>('/admin/crises', { includeJwt: true });
    return res.crises;
  }, []);

  const getReports = useCallback(async () => {
    const res = await requestServer<AdminReportsResponse>('/admin/reports', { includeJwt: true });
    return res;
  }, []);

  const { data: organizationRequests } = useAsync(getOrganizationRequests, { immediate: true });
  const { data: crises } = useAsync(getCrises, { immediate: true });
  const { data: reports } = useAsync(getReports, { immediate: true });

  const pinnedCrises = crises?.filter(crisis => crisis.pinned) ?? [];
  const totalReports = (reports?.organizationReports.length ?? 0) + (reports?.volunteerReports.length ?? 0);

  return (
    <PageContainer>
      <PageHeader
        title="Home"
        subtitle="Quick overview of requests and active crises."
        icon={Home}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Organization Requests"
          description="Review pending organization onboarding requests and approve or reject each submission."
          color={DOMAIN_COLORS.request}
          Icon={ClipboardCheck}
          right={
            !organizationRequests
              ? <div className="skeleton w-16 h-6" />
              : (
                  <span className={`badge badge-${DOMAIN_COLORS.pending} badge-outline inline-flex items-center gap-1`}>
                    {organizationRequests.length}
                    {' '}
                    Pending
                  </span>
                )
          }
        >
          <LinkButton
            to="/admin/requests"
            style="outline"
            size="sm"
            Icon={ArrowRight}
            className="ml-auto"
          >
            Open Requests
          </LinkButton>
        </Card>

        <Card
          title="Crises"
          color={DOMAIN_COLORS.crisis}
          coloredText={true}
          description={
            crises === undefined
              ? 'Loading crisis overview...'
              : pinnedCrises.length > 0
                ? `Pinned (${pinnedCrises.length}): ${pinnedCrises.map(crisis => crisis.name).join(', ')}`
                : 'No crises are pinned right now.'
          }
          Icon={AlertTriangle}
          right={
            !crises
              ? <div className="skeleton w-16 h-6" />
              : (
                  <span className={`badge badge-${DOMAIN_COLORS.crisis} badge-outline inline-flex items-center gap-1`}>
                    {crises.length}
                    {' '}
                    Total
                  </span>
                )
          }
        >
          <LinkButton
            to="/admin/crises"
            style="outline"
            size="sm"
            Icon={ArrowRight}
            className="ml-auto"
          >
            Open Crises
          </LinkButton>
        </Card>

        <Card
          title="Reports"
          description="Review reports submitted by volunteers and organizations and take moderation actions."
          color={DOMAIN_COLORS.report}
          Icon={Flag}
          right={
            !reports
              ? <div className="skeleton w-16 h-6" />
              : (
                  <span className="badge badge-error badge-outline inline-flex items-center gap-1">
                    {totalReports}
                    {' '}
                    Total
                  </span>
                )
          }
        >
          <LinkButton
            to="/admin/reports"
            style="outline"
            size="sm"
            Icon={ArrowRight}
            className="ml-auto"
          >
            Open Reports
          </LinkButton>
        </Card>
      </div>
    </PageContainer>
  );
}

export default AdminHome;
