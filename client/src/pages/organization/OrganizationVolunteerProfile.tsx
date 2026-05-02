import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Building2, Calendar, Clock3, Download, FileText, Flag, Mail, Mars, Users, Venus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import zod from 'zod';

import Alert from '../../components/Alert';
import Button from '../../components/Button';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import IconButton from '../../components/IconButton';
import ColumnLayout from '../../components/layout/ColumnLayout';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import Loading from '../../components/Loading';
import PostingCollection from '../../components/postings/PostingCollection';
import PostingViewModeToggle from '../../components/postings/PostingViewModeToggle';
import ReportForm from '../../components/reporting/ReportForm';
import { DEFAULT_REPORT_TYPE, REPORT_TYPE_VALUES } from '../../components/reporting/reportType.constants';
import SkillsList from '../../components/skills/SkillsList';
import useNotifications from '../../notifications/useNotifications';
import requestServer, { SERVER_BASE_URL } from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type { OrganizationReportVolunteerResponse, OrganizationVolunteerProfileResponse } from '../../../../server/src/api/types';
import type { PostingWithContext } from '../../../../server/src/types';

const toTimeString = (value: Date) => `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
const toDateFromParts = (dateValue: Date | string, timeValue?: string) => {
  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) return new Date(Number.NaN);
  const year = parsedDate.getUTCFullYear();
  const month = `${parsedDate.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${parsedDate.getUTCDate()}`.padStart(2, '0');
  const timePart = (timeValue ?? '00:00').slice(0, 5) || '00:00';
  return new Date(`${year}-${month}-${day}T${timePart}`);
};

const reportVolunteerSchema = zod.object({
  title: zod.enum(REPORT_TYPE_VALUES),
  message: zod.string().trim().min(1, 'Message is required').max(1000, 'Message must be at most 1000 characters'),
});

type ReportVolunteerFormData = zod.infer<typeof reportVolunteerSchema>;

function OrganizationVolunteerProfile() {
  const { volunteerId } = useParams<{ volunteerId: string }>();
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const notifications = useNotifications();
  const reportForm = useForm<ReportVolunteerFormData>({
    resolver: zodResolver(reportVolunteerSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      title: DEFAULT_REPORT_TYPE,
      message: '',
    },
  });
  const {
    data,
    loading,
    error,
    trigger,
  } = useAsync<OrganizationVolunteerProfileResponse, []>(
    async () => {
      if (!volunteerId) throw new Error('Volunteer ID is missing.');
      return requestServer<OrganizationVolunteerProfileResponse>(`/organization/volunteer/${volunteerId}`, {
        includeJwt: true,
      });
    },
    { immediate: true, notifyOnError: true },
  );

  const { trigger: requestCvFile } = useAsync(
    async (requestedVolunteerId: string) => {
      const token = localStorage.getItem('jwt');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${SERVER_BASE_URL}/organization/volunteer/${requestedVolunteerId}/cv`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let message = 'Failed to load CV';
        try {
          const errorBody = await response.json() as { error?: string; message?: string };
          message = errorBody.message ?? errorBody.error ?? message;
        } catch {
          // ignore non-JSON error payloads
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameFromHeader = contentDisposition?.match(/filename="([^"]+)"/)?.[1];

      return {
        blob,
        filename: filenameFromHeader ?? `volunteer-${requestedVolunteerId}-cv.pdf`,
      };
    },
    { notifyOnError: true },
  );

  const {
    loading: submittingReport,
    trigger: submitVolunteerReport,
  } = useAsync(async (reportData: ReportVolunteerFormData) => {
    if (!volunteerId) throw new Error('Volunteer ID is missing.');

    await requestServer<OrganizationReportVolunteerResponse>(`/organization/volunteer/${volunteerId}/report`, {
      method: 'POST',
      includeJwt: true,
      body: reportData,
    });
  }, { notifyOnError: false });
  const canSubmitReport = reportForm.formState.isValid && !submittingReport;

  const profile = data?.profile;

  const volunteerName = useMemo(() => {
    if (!profile) return '';
    return `${profile.volunteer.first_name} ${profile.volunteer.last_name}`.trim();
  }, [profile]);

  const initials = useMemo(() => {
    if (!profile) return '';
    return `${profile.volunteer.first_name.charAt(0)}${profile.volunteer.last_name.charAt(0)}`.toUpperCase();
  }, [profile]);

  const formattedDateOfBirth = useMemo(() => {
    if (!profile) return '-';
    const parsed = new Date(profile.volunteer.date_of_birth);
    if (Number.isNaN(parsed.getTime())) return profile.volunteer.date_of_birth;
    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [profile]);

  const formattedGender = useMemo(() => {
    if (!profile) return '';
    if (profile.volunteer.gender === 'male') return 'Male';
    if (profile.volunteer.gender === 'female') return 'Female';
    return 'Other';
  }, [profile]);

  const genderBadgeStyles = useMemo(() => {
    if (!profile) return '';
    if (profile.volunteer.gender === 'male') return 'badge-info';
    if (profile.volunteer.gender === 'female') return 'badge-secondary';
    return 'badge-accent';
  }, [profile]);

  const experiencePostings = useMemo<PostingWithContext[]>(() => {
    if (!profile) return [];

    return profile.completed_experiences.map((experience) => {
      const startDate = toDateFromParts(experience.start_date, experience.start_time);
      const endDate = experience.end_date ? toDateFromParts(experience.end_date, experience.end_time) : null;
      const safeStartDate = Number.isNaN(startDate.getTime()) ? new Date() : startDate;
      const safeEndDate = endDate && !Number.isNaN(endDate.getTime()) ? endDate : null;

      return {
        id: experience.posting_id,
        organization_id: experience.organization_id,
        title: experience.posting_title,
        description: '',
        latitude: null,
        longitude: null,
        max_volunteers: null,
        start_date: safeStartDate,
        start_time: toTimeString(safeStartDate),
        end_date: safeEndDate ?? safeStartDate,
        end_time: safeEndDate ? toTimeString(safeEndDate) : toTimeString(safeStartDate),
        minimum_age: null,
        automatic_acceptance: experience.automatic_acceptance,
        is_closed: experience.is_closed,
        allows_partial_attendance: false,
        location_name: experience.location_name,
        created_at: safeStartDate,
        updated_at: safeStartDate,
        crisis_id: null,
        skills: [],
        organization_name: experience.organization_name,
        organization_logo_path: experience.organization_logo_path ?? null,
        crisis_name: experience.crisis_name,
        enrollment_count: experience.enrollment_count,
        application_status: 'none',
      };
    });
  }, [profile]);

  const viewCv = async () => {
    if (!volunteerId) return;
    const { blob } = await requestCvFile(volunteerId);
    const previewUrl = URL.createObjectURL(blob);
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
  };

  const downloadCv = async () => {
    if (!volunteerId) return;
    const { blob, filename } = await requestCvFile(volunteerId);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const closeReportModal = () => {
    if (submittingReport) return;
    setReportModalOpen(false);
  };

  const openReportModal = () => {
    reportForm.reset({
      title: DEFAULT_REPORT_TYPE,
      message: '',
    });
    setReportModalOpen(true);
  };

  const submitReportForm = reportForm.handleSubmit(async (reportData) => {
    reportForm.clearErrors('root');

    try {
      await submitVolunteerReport(reportData);
      notifications.push({
        type: 'success',
        message: 'Report submitted successfully.',
      });
      closeReportModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit report.';
      reportForm.setError('root', {
        type: 'server',
        message,
      });
    }
  });

  if (loading && !profile) {
    return (
      <div className="grow bg-base-200">
        <div className="p-6 md:container mx-auto">
          <div className="flex justify-center mt-8">
            <Loading size="xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="grow bg-base-200">
        <div className="p-6 md:container mx-auto">
          <Alert color="error">
            {error.message || 'Failed to load volunteer profile.'}
          </Alert>
          <button className="btn btn-outline mt-4" onClick={() => { void trigger(); }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <PageContainer>
      <PageHeader
        title={volunteerName || 'Volunteer'}
        subtitle="Review volunteer profile and application details."
        icon={FileText}
        showBack
        defaultBackTo="/organization"
        actions={(
          <Button
            color="error"
            style="outline"
            type="button"
            Icon={Flag}
            onClick={openReportModal}
            size="sm"
          >
            Report volunteer
          </Button>
        )}
      />

      <ColumnLayout
        sidebar={(
          <Card>
            <div className="flex items-center gap-4">
              <div className="avatar">
                <div className="bg-primary text-primary-content rounded-full w-20 flex items-center justify-center">
                  <span className="text-2xl">{initials || 'V'}</span>
                </div>
              </div>
              <div>
                <h4 className="text-xl font-bold">{volunteerName}</h4>
                <div className="mt-1">
                  <span className={`badge badge-sm gap-1 ${genderBadgeStyles}`}>
                    {profile.volunteer.gender === 'male' && <Mars size={12} />}
                    {profile.volunteer.gender === 'female' && <Venus size={12} />}
                    {profile.volunteer.gender === 'other' && <span className="font-bold">*</span>}
                    {formattedGender}
                  </span>
                </div>
              </div>
            </div>

            <div className="divider my-4" />

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="opacity-70 flex items-center gap-2">
                  <Mail size={14} />
                  Email
                </span>
                <span className="font-medium text-right break-all">{profile.volunteer.email}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="opacity-70 flex items-center gap-2">
                  <Calendar size={14} />
                  Date of Birth
                </span>
                <span className="font-medium text-right">{formattedDateOfBirth}</span>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-sm font-semibold text-base-content mb-2 block">Description</label>
              <p className="text-sm opacity-80 whitespace-pre-wrap wrap-break-word">
                {profile.volunteer.description || 'No description added yet.'}
              </p>
            </div>

            <div className="mt-4">
              {profile.volunteer.cv_path
                ? (
                    <div className="flex items-center gap-2">
                      <Button type="button" color="primary" style="soft" onClick={() => { void viewCv(); }} Icon={FileText}>
                        View User CV
                      </Button>
                      <IconButton
                        type="button"
                        color="primary"
                        style="outline"
                        Icon={Download}
                        onClick={() => { void downloadCv(); }}
                        aria-label="Download CV"
                        title="Download CV"
                      />
                    </div>
                  )
                : (
                    <p className="text-sm opacity-70">No CV uploaded by this volunteer.</p>
                  )}
            </div>
          </Card>
        )}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-0 gap-y-3">
          <div className="stat place-items-center bg-base-100 shadow-md rounded-2xl sm:rounded-l-2xl sm:rounded-r-none">
            <div className="stat-title text-base">Completed Postings</div>
            <div className="stat-value text-2xl text-primary/80 inline-flex w-full items-center justify-center gap-2">
              <Users className="h-6 w-6 shrink-0 stroke-current" />
              <span>{profile.experience_stats.total_completed_experiences}</span>
            </div>
          </div>
          <div className="stat place-items-center bg-base-100 shadow-md rounded-2xl sm:rounded-none">
            <div className="stat-title text-base">Hours Completed</div>
            <div className="stat-value text-2xl text-primary/80 inline-flex w-full items-center justify-center gap-2">
              <Clock3 className="h-6 w-6 shrink-0 stroke-current" />
              <span>{profile.experience_stats.total_hours_completed.toFixed(1)}</span>
            </div>
          </div>
          <div className="stat place-items-center bg-base-100 shadow-md rounded-2xl sm:rounded-r-2xl sm:rounded-l-none">
            <div className="stat-title text-base">Organizations</div>
            <div className="stat-value text-2xl text-primary/80 inline-flex w-full items-center justify-center gap-2">
              <Building2 className="h-6 w-6 shrink-0 stroke-current" />
              <span>{profile.experience_stats.organizations_supported}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-0 gap-y-3">
          <div className="stat place-items-center bg-base-100 shadow-md rounded-2xl sm:rounded-l-2xl sm:rounded-r-none">
            <div className="stat-title text-base">Crisis-Related</div>
            <div className="stat-value text-2xl text-primary/80 inline-flex w-full items-center justify-center gap-2">
              <AlertTriangle className="h-6 w-6 shrink-0 stroke-current" />
              <span>{profile.experience_stats.crisis_related_experiences}</span>
            </div>
          </div>
          <div className="stat place-items-center bg-base-100 shadow-md rounded-2xl sm:rounded-none">
            <div className="stat-title text-base">Total Skills Used</div>
            <div className="stat-value text-2xl text-primary/80 inline-flex w-full items-center justify-center gap-2">
              <FileText className="h-6 w-6 shrink-0 stroke-current" />
              <span>{profile.experience_stats.total_skills_used}</span>
            </div>
          </div>
          <div className="stat min-w-0 place-items-center bg-base-100 shadow-md rounded-2xl sm:rounded-r-2xl sm:rounded-l-none">
            <div className="stat-title w-full text-center text-base">Most Volunteered Crisis</div>
            <div className="stat-value text-lg text-primary/80 flex w-full min-w-0 items-center justify-center gap-2 px-2">
              <span className="max-w-full text-center whitespace-normal break-words leading-tight overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                {profile.experience_stats.most_volunteered_crisis ?? 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <Card
          title="Skills"
          description="Volunteer skill set."
        >
          <SkillsList skills={profile.skills} enableLimit={false} />
        </Card>

        <Card
          title="Previous Experiences"
          description="Past volunteering experiences completed through the platform."
        >
          {profile.completed_experiences.length === 0
            ? (
                <EmptyState
                  title="No completed experiences to show"
                  description="This volunteer hasn't completed any opportunities yet."
                  Icon={Building2}
                  compact
                  className="mt-4"
                />
              )
            : (
                <div className="mt-4 space-y-3">
                  <div className="flex justify-end">
                    <PostingViewModeToggle />
                  </div>

                  <PostingCollection
                    postings={experiencePostings}
                    showCrisis={false}
                    variant="organization"
                    showOrganizationName={true}
                    cardsContainerClassName="grid grid-cols-1 gap-6"
                    listContainerClassName="space-y-3"
                  />
                </div>
              )}
        </Card>
      </ColumnLayout>

      <ReportForm
        open={reportModalOpen}
        heading="Report Volunteer"
        form={reportForm}
        onClose={closeReportModal}
        onSubmit={submitReportForm}
        messagePlaceholder="Describe what happened and why you are reporting this volunteer."
        submitLabel="Report volunteer"
        submitting={submittingReport}
        submitDisabled={!canSubmitReport}
        maxMessageLength={1000}
      />
    </PageContainer>
  );
}

export default OrganizationVolunteerProfile;
