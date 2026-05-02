import { Flag, Building2, User, RotateCcw } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import Alert from '../../components/Alert';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ColumnLayout from '../../components/layout/ColumnLayout';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import Loading from '../../components/Loading';
import ReportActionPanel from '../../components/reporting/ReportActionPanel';
import ReportDetailOverview from '../../components/reporting/ReportDetailOverview';
import ReportPersonCard from '../../components/reporting/ReportPersonCard';
import requestServer from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type { AdminGetOrganizationReportResponse, AdminGetVolunteerReportResponse } from '../../../../server/src/api/types';

type ReportType = 'organization' | 'volunteer';

function AdminReportDetail() {
  const navigate = useNavigate();
  const { reportType, reportId } = useParams<{ reportType: ReportType; reportId: string }>();
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    const endpoint = reportType === 'organization'
      ? `/admin/reports/organization/${reportId}`
      : `/admin/reports/volunteer/${reportId}`;

    return await requestServer<AdminGetOrganizationReportResponse | AdminGetVolunteerReportResponse>(endpoint, {
      includeJwt: true,
    });
  }, [reportType, reportId]);

  const {
    data: report,
    loading,
    error,
    trigger: refresh,
  } = useAsync(fetchReport, { immediate: true, notifyOnError: false });

  if (!reportType || !reportId || !['organization', 'volunteer'].includes(reportType)) {
    return (
      <PageContainer>
        <Alert color="error">
          <p>Invalid report type or ID.</p>
        </Alert>
      </PageContainer>
    );
  }

  const handleAcceptReport = async () => {
    if (!report || !reportId) return;

    try {
      setIsActionInProgress(true);
      setActionError(null);

      await requestServer(`/admin/reports/${reportType}/${reportId}/accept`, {
        method: 'POST',
        includeJwt: true,
      });

      navigate('/admin/reports');
    } catch {
      setActionError('Failed to disable account and resolve report. Please try again.');
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleRejectReport = async () => {
    if (!reportId) return;

    try {
      setIsActionInProgress(true);
      setActionError(null);

      await requestServer(`/admin/reports/${reportType}/${reportId}/reject`, {
        method: 'POST',
        includeJwt: true,
      });

      navigate('/admin/reports');
    } catch {
      setActionError('Failed to delete report. Please try again.');
    } finally {
      setIsActionInProgress(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-12">
          <Loading />
        </div>
      </PageContainer>
    );
  }

  if (error || !report) {
    return (
      <PageContainer>
        <Alert color="error" className="mb-6">
          <p>{error?.message || 'Failed to load report.'}</p>
          <div>
            <Button
              type="button"
              size="sm"
              style="outline"
              Icon={RotateCcw}
              onClick={() => void refresh()}
            >
              Retry
            </Button>
          </div>
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={reportType === 'organization' ? 'Organization Report' : 'Volunteer Report'}
        subtitle="Review the report details, reporter information, and resolve the report."
        icon={Flag}
        showBack
        defaultBackTo="/admin/reports"
      />

      <ColumnLayout
        sidebar={(
          <Card title="Actions" description="Disable account or delete report without disabling." color="primary">
            <ReportActionPanel
              actionError={actionError}
              isActionInProgress={isActionInProgress}
              onAccept={() => { void handleAcceptReport(); }}
              onReject={() => { void handleRejectReport(); }}
              acceptLabel="Disable Account"
              rejectLabel="Delete Report"
              warningMessage="Disabling an account also resolves the report."
              confirmDisableMessage="Are you sure? This will disable the reported account and resolve this report."
            />
          </Card>
        )}
      >
        <div className="space-y-6">
          <ReportDetailOverview
            reportId={report.id}
            createdAt={report.created_at}
            reportTitle={report.title || 'Scam'}
            message={report.message}
            reporterTitle={('reported_organization' in report) ? 'Reporter (Volunteer)' : 'Reporter (Organization)'}
            reporterName={('reported_organization' in report)
              ? `${report.reporter_volunteer.first_name} ${report.reporter_volunteer.last_name}`
              : report.reporter_organization.name}
            reporterEmail={('reported_organization' in report)
              ? report.reporter_volunteer.email
              : report.reporter_organization.email}
            reporterIcon={Building2}
          />

          {'reported_organization' in report
            ? (
                <ReportPersonCard
                  title="Reported Organization"
                  name={report.reported_organization.name}
                  email={report.reported_organization.email}
                  Icon={Building2}
                />
              )
            : (
                <ReportPersonCard
                  title="Reported Volunteer"
                  name={`${report.reported_volunteer.first_name} ${report.reported_volunteer.last_name}`}
                  email={report.reported_volunteer.email}
                  Icon={User}
                />
              )}
        </div>
      </ColumnLayout>
    </PageContainer>
  );
}

export default AdminReportDetail;
