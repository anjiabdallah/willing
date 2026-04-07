import { ArrowLeft, Flag, RotateCcw } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import Alert from '../../components/Alert';
import Button from '../../components/Button';
import Card from '../../components/Card';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import Loading from '../../components/Loading';
import ReportActionPanel from '../../components/reporting/ReportActionPanel';
import ReportHeader from '../../components/reporting/ReportHeader';
import ReportMessage from '../../components/reporting/ReportMessage';
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

  const isOrganizationReport = reportType === 'organization' && 'reported_organization' in report;
  const isVolunteerReport = reportType === 'volunteer' && 'reported_volunteer' in report;

  return (
    <PageContainer>
      <div className="mb-6">
        <Button
          type="button"
          color="ghost"
          style="outline"
          Icon={ArrowLeft}
          onClick={() => navigate('/admin/reports')}
        >
          Back to Reports
        </Button>
      </div>

      <PageHeader
        title={reportType === 'organization' ? 'Organization Report' : 'Volunteer Report'}
        subtitle={`Reported on ${new Date(report.created_at).toLocaleString()}`}
        icon={Flag}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Report Details" description="Information about this report.">
            <div className="space-y-4">
              <ReportHeader
                createdAt={report.created_at}
                reportTitle={report.title}
                scopeLabel={reportType === 'organization' ? 'Organization' : 'Volunteer'}
              />

              <div>
                <label className="label">
                  <span className="label-text font-semibold">Message</span>
                </label>
                <ReportMessage message={report.message} />
              </div>

              {isOrganizationReport && (
                <div>
                  <label className="label">
                    <span className="label-text font-semibold">Reporter (Volunteer)</span>
                  </label>
                  <div className="rounded-lg bg-base-100 border border-base-300 p-4">
                    <p className="font-semibold">
                      {report.reporter_volunteer.first_name}
                      {' '}
                      {report.reporter_volunteer.last_name}
                    </p>
                    <p className="text-sm text-base-content/70">{report.reporter_volunteer.email}</p>
                  </div>
                </div>
              )}

              {isVolunteerReport && (
                <div>
                  <label className="label">
                    <span className="label-text font-semibold">Reporter (Organization)</span>
                  </label>
                  <div className="rounded-lg bg-base-100 border border-base-300 p-4">
                    <p className="font-semibold">{report.reporter_organization.name}</p>
                    <p className="text-sm text-base-content/70">{report.reporter_organization.email}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card
            title={isOrganizationReport ? 'Reported Organization' : 'Reported Volunteer'}
            description="Details of the reported account."
          >
            <div className="space-y-4">
              {isOrganizationReport && (
                <>
                  <div>
                    <label className="label">
                      <span className="label-text font-semibold">Organization Name</span>
                    </label>
                    <p className="text-lg">{report.reported_organization.name}</p>
                  </div>
                  <div>
                    <label className="label">
                      <span className="label-text font-semibold">Email</span>
                    </label>
                    <p className="text-sm">{report.reported_organization.email}</p>
                  </div>
                </>
              )}

              {isVolunteerReport && (
                <>
                  <div>
                    <label className="label">
                      <span className="label-text font-semibold">Volunteer Name</span>
                    </label>
                    <p className="text-lg">
                      {report.reported_volunteer.first_name}
                      {' '}
                      {report.reported_volunteer.last_name}
                    </p>
                  </div>
                  <div>
                    <label className="label">
                      <span className="label-text font-semibold">Email</span>
                    </label>
                    <p className="text-sm">{report.reported_volunteer.email}</p>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
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
        </div>
      </div>
    </PageContainer>
  );
}

export default AdminReportDetail;
