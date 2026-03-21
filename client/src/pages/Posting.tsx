import { zodResolver } from '@hookform/resolvers/zod';
import {
  Check,
  AlertTriangle,
  Building2,
  Calendar,
  Cake,
  Edit3,
  ExternalLink,
  House,
  ListChecks,
  Lock,
  LockOpen,
  MapPin,
  RefreshCcw,
  Save,
  Send,
  ShieldCheck,
  Tag,
  Trash2,
  Users,
  SquareArrowRight,
  X,
} from 'lucide-react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';

import AuthContext from '../auth/AuthContext.tsx';
import Alert from '../components/Alert.tsx';
import Button from '../components/Button.tsx';
import CustomMessageModal from '../components/CustomMessageModal.tsx';
import ColumnLayout from '../components/layout/ColumnLayout.tsx';
import PageHeader from '../components/layout/PageHeader.tsx';
import LinkButton from '../components/LinkButton.tsx';
import Loading from '../components/Loading.tsx';
import LocationPicker from '../components/LocationPicker.tsx';
import SkillsInput from '../components/skills/SkillsInput.tsx';
import SkillsList from '../components/skills/SkillsList.tsx';
import { ToggleButton } from '../components/ToggleButton.tsx';
import VolunteerInfoCollapse from '../components/VolunteerInfoCollapse.tsx';
import useNotifications from '../notifications/useNotifications';
import { organizationPostingEditFormSchema, type OrganizationPostingEditFormData } from '../schemas/auth';
import { executeAndShowError, FormField } from '../utils/formUtils.tsx';
import requestServer from '../utils/requestServer.ts';
import useAsync from '../utils/useAsync';
import { useOrganization } from '../utils/useUsers.ts';

import type {
  OrganizationCrisisResponse,
  OrganizationCrisesResponse,
  OrganizationPostingApplicationsReponse,
  OrganizationPostingEnrollmentsResponse,
  OrganizationPostingResponse,
  OrganizationProfileResponse,
  VolunteerCrisisResponse,
  VolunteerPostingResponse,
} from '../../../server/src/api/types.ts';
import type { Crisis } from '../../../server/src/db/tables.ts';
import type { PostingApplication, PostingEnrollment, PostingWithSkills } from '../../../server/src/types.ts';

const getDateInputValue = (value: Date | string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getUTCFullYear();
  const month = `${parsed.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPreferredDateTimeInputValue = (
  dateValue: Date | string | undefined,
  timeValue: string | undefined,
) => {
  if (dateValue) {
    const datePart = getDateInputValue(dateValue);
    if (datePart) {
      const timePart = (timeValue ?? '').slice(0, 5) || '00:00';
      return `${datePart}T${timePart}`;
    }
  }

  return '';
};

const getPostingStartDateTime = (posting: PostingWithSkills) => {
  const datePart = getDateInputValue(posting.start_date);
  const timePart = (posting.start_time ?? '').slice(0, 5) || '00:00';
  return new Date(`${datePart}T${timePart}`);
};

const splitDateTimeInput = (value?: string) => {
  if (!value) return { date: '', time: '' };

  const [datePart, timePart] = value.split('T');
  return {
    date: datePart ?? '',
    time: (timePart ?? '').slice(0, 5),
  };
};

const combineDateAndTime = (date: string, time: string) => {
  if (!date) return '';
  return `${date}T${time || '00:00'}`;
};

function PostingPage() {
  const auth = useContext(AuthContext);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const isVolunteerView = auth.user?.role !== 'organization';
  const organizationAccount = useOrganization();
  const account = isVolunteerView ? null : organizationAccount;

  const [posting, setPosting] = useState<PostingWithSkills | null>(null);
  const [enrollments, setEnrollments] = useState<PostingEnrollment[]>([]);
  const [applications, setApplications] = useState<PostingApplication[]>([]);
  const [hasPendingApplication, setHasPendingApplication] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [selectedCrisisId, setSelectedCrisisId] = useState<number | undefined>(undefined);
  const [availableCrises, setAvailableCrises] = useState<OrganizationCrisesResponse['crises']>([]);
  const [currentPostingCrisis, setCurrentPostingCrisis] = useState<Crisis | undefined>(undefined);
  const [position, setPosition] = useState<[number, number]>([33.90192863620578, 35.477959277880416]);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingClosed, setTogglingClosed] = useState(false);
  const [applying, setApplying] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [processingApplicationId, setProcessingApplicationId] = useState<number | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [postingEnrollmentCount, setPostingEnrollmentCount] = useState(0);
  const [postingOrganization, setPostingOrganization] = useState<{ id: number; name: string } | null>(null);
  const notifications = useNotifications();

  const form = useForm<OrganizationPostingEditFormData>({
    resolver: zodResolver(organizationPostingEditFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      automatic_acceptance: true,
      is_closed: false,
    },
  });

  const isOpen = useWatch({
    control: form.control,
    name: 'automatic_acceptance',
    defaultValue: true,
  });
  const startTimestamp = useWatch({ control: form.control, name: 'start_timestamp' }) ?? '';
  const endTimestamp = useWatch({ control: form.control, name: 'end_timestamp' }) ?? '';
  const startDateTimeParts = splitDateTimeInput(startTimestamp);
  const endDateTimeParts = splitDateTimeInput(endTimestamp);

  const selectedCrisisName = useMemo(() => {
    if (selectedCrisisId == null) return null;
    return availableCrises.find(crisis => crisis.id === selectedCrisisId)?.name
      ?? (currentPostingCrisis?.id === selectedCrisisId ? currentPostingCrisis.name : `Crisis #${selectedCrisisId}`);
  }, [availableCrises, currentPostingCrisis, selectedCrisisId]);

  const selectedCrisis = useMemo(() => {
    if (selectedCrisisId == null) return null;
    return availableCrises.find(crisis => crisis.id === selectedCrisisId)
      ?? (currentPostingCrisis?.id === selectedCrisisId ? currentPostingCrisis : null);
  }, [availableCrises, currentPostingCrisis, selectedCrisisId]);

  const loadCrisesRequest = useCallback(async () => {
    const response = await requestServer<OrganizationCrisesResponse>('/organization/crises', {
      includeJwt: true,
    });
    setAvailableCrises(response.crises);
    return response.crises;
  }, []);

  const {
    loading: loadingCrises,
    error: crisesError,
    trigger: loadCrises,
  } = useAsync<OrganizationCrisesResponse['crises'], []>(loadCrisesRequest, {
    notifyOnError: false,
  });

  useEffect(() => {
    if (isVolunteerView) {
      setAvailableCrises([]);
      return;
    }

    void loadCrises();
  }, [isVolunteerView, loadCrises]);

  useEffect(() => {
    if (selectedCrisisId == null) {
      setCurrentPostingCrisis(undefined);
      return;
    }

    const existingMatch = availableCrises.find(crisis => crisis.id === selectedCrisisId);
    if (existingMatch) {
      setCurrentPostingCrisis(existingMatch);
      return;
    }

    if (currentPostingCrisis?.id === selectedCrisisId) {
      return;
    }

    let isCancelled = false;

    const loadCurrentCrisis = async () => {
      try {
        const response = isVolunteerView
          ? await requestServer<VolunteerCrisisResponse>(`/volunteer/crises/${selectedCrisisId}`, {
              includeJwt: true,
            })
          : await requestServer<OrganizationCrisisResponse>(`/organization/crises/${selectedCrisisId}`, {
              includeJwt: true,
            });

        if (!isCancelled) {
          setCurrentPostingCrisis(response.crisis);
        }
      } catch {
        if (!isCancelled) {
          setCurrentPostingCrisis(undefined);
        }
      }
    };

    loadCurrentCrisis();

    return () => {
      isCancelled = true;
    };
  }, [availableCrises, currentPostingCrisis?.id, isVolunteerView, selectedCrisisId]);

  const loadPostingRequest = useCallback(async () => {
    if (!id) return;

    if (isVolunteerView) {
      const postingResponse = await requestServer<VolunteerPostingResponse>(
        `/volunteer/posting/${id}`,
        { includeJwt: true },
      );

      setPosting(postingResponse.posting);
      setCurrentPostingCrisis(undefined);
      setEnrollments([]);
      setHasPendingApplication(postingResponse.posting.application_status === 'pending');
      setIsEnrolled(postingResponse.posting.application_status === 'registered');
      setPostingEnrollmentCount(postingResponse.posting.enrollment_count);
      setSkills(postingResponse.posting.skills.map(s => s.name));
      setSelectedCrisisId(postingResponse.posting.crisis_id ?? undefined);
      setPosition([
        postingResponse.posting.latitude ?? 33.90192863620578,
        postingResponse.posting.longitude ?? 35.477959277880416,
      ]);

      try {
        const organizationResponse = await requestServer<OrganizationProfileResponse>(
          `/organization/${postingResponse.posting.organization_id}`,
          { includeJwt: true },
        );

        setPostingOrganization({
          id: organizationResponse.organization.id,
          name: organizationResponse.organization.name,
        });
      } catch {
        setPostingOrganization({
          id: postingResponse.posting.organization_id,
          name: 'Organization',
        });
      }

      form.reset({
        title: postingResponse.posting.title,
        description: postingResponse.posting.description,
        location_name: postingResponse.posting.location_name,
        start_timestamp: getPreferredDateTimeInputValue(
          postingResponse.posting.start_date,
          postingResponse.posting.start_time,
        ),
        end_timestamp: getPreferredDateTimeInputValue(
          postingResponse.posting.end_date,
          postingResponse.posting.end_time,
        ) || undefined,
        max_volunteers: postingResponse.posting.max_volunteers?.toString() ?? undefined,
        minimum_age: postingResponse.posting.minimum_age?.toString() ?? undefined,
        automatic_acceptance: postingResponse.posting.automatic_acceptance,
        is_closed: postingResponse.posting.is_closed,
      });

      return;
    }

    const [postingResponse, enrollmentsResponse] = await Promise.all([
      requestServer<OrganizationPostingResponse>(`/organization/posting/${id}`, { includeJwt: true }),
      requestServer<OrganizationPostingEnrollmentsResponse>(`/organization/posting/${id}/enrollments`, { includeJwt: true }),
    ]);

    const postingWithSkills = {
      ...postingResponse.posting,
      skills: postingResponse.skills,
    };

    setPosting(postingWithSkills);
    setCurrentPostingCrisis(postingResponse.crisis);
    setEnrollments(enrollmentsResponse.enrollments);
    setPostingEnrollmentCount(enrollmentsResponse.enrollments.length);

    if (!postingResponse.posting.automatic_acceptance) {
      const applicationsResponse = await requestServer<OrganizationPostingApplicationsReponse>(
        `/organization/posting/${id}/applications`,
        { includeJwt: true },
      );
      setApplications(applicationsResponse.applications);
    }

    setIsEnrolled(false);
    setHasPendingApplication(false);
    setSkills(postingResponse.skills.map(s => s.name));
    setSelectedCrisisId(postingResponse.posting.crisis_id ?? undefined);
    setPosition([
      postingResponse.posting.latitude ?? 33.90192863620578,
      postingResponse.posting.longitude ?? 35.477959277880416,
    ]);

    setPostingOrganization(account
      ? {
          id: account.id,
          name: account.name,
        }
      : {
          id: postingResponse.posting.organization_id,
          name: 'Organization',
        });

    form.reset({
      title: postingResponse.posting.title,
      description: postingResponse.posting.description,
      location_name: postingResponse.posting.location_name,
      start_timestamp: getPreferredDateTimeInputValue(
        postingResponse.posting.start_date,
        postingResponse.posting.start_time,
      ),
      end_timestamp: getPreferredDateTimeInputValue(
        postingResponse.posting.end_date,
        postingResponse.posting.end_time,
      ) || undefined,
      max_volunteers: postingResponse.posting.max_volunteers?.toString() ?? undefined,
      minimum_age: postingResponse.posting.minimum_age?.toString() ?? undefined,
      automatic_acceptance: postingResponse.posting.automatic_acceptance,
      is_closed: postingResponse.posting.is_closed,
    });
  }, [id, form, isVolunteerView, account]);

  const {
    loading,
    error: fetchError,
    trigger: loadPosting,
  } = useAsync<void, []>(loadPostingRequest, {
    notifyOnError: true,
  });

  useEffect(() => {
    void loadPosting();
  }, [loadPosting]);

  const { trigger: updatePosting } = useAsync(
    async (postingId: string, payload: Record<string, unknown>) => requestServer<OrganizationPostingResponse>(
      `/organization/posting/${postingId}`,
      {
        method: 'PUT',
        body: payload,
        includeJwt: true,
      },
    ),
    { notifyOnError: true },
  );

  const { trigger: deletePosting } = useAsync(
    async (postingId: string) => requestServer(`/organization/posting/${postingId}`, {
      method: 'DELETE',
      includeJwt: true,
    }),
    { notifyOnError: true },
  );

  const { trigger: applyToPosting } = useAsync(
    async (postingId: string, message?: string) => requestServer(`/volunteer/posting/${postingId}/enroll`, {
      method: 'POST',
      body: {
        message,
      },
      includeJwt: true,
    }),
    { notifyOnError: true },
  );

  const { trigger: withdrawFromPosting } = useAsync(
    async (postingId: string) => requestServer(`/volunteer/posting/${postingId}/enroll`, {
      method: 'DELETE',
      includeJwt: true,
    }),
    { notifyOnError: true },
  );

  const { trigger: acceptPostingApplication } = useAsync(
    async (postingId: string, applicationId: number) => requestServer(
      `/organization/posting/${postingId}/applications/${applicationId}/accept`,
      { method: 'POST', includeJwt: true },
    ),
    { notifyOnError: true },
  );

  const { trigger: loadPostingEnrollments } = useAsync(
    async (postingId: string) => requestServer<OrganizationPostingEnrollmentsResponse>(
      `/organization/posting/${postingId}/enrollments`,
      { includeJwt: true },
    ),
    { notifyOnError: true },
  );

  const { trigger: rejectPostingApplication } = useAsync(
    async (postingId: string, applicationId: number) => requestServer(
      `/organization/posting/${postingId}/applications/${applicationId}`,
      { method: 'DELETE', includeJwt: true },
    ),
    { notifyOnError: true },
  );

  const onSave = form.handleSubmit(async (data) => {
    if (!isEditMode || !posting || !id || !account?.id) return;

    await executeAndShowError(form, async () => {
      setSaving(true);

      try {
        const payload = {
          title: data.title.trim(),
          description: data.description.trim(),
          location_name: data.location_name.trim(),
          latitude: position[0],
          longitude: position[1],
          max_volunteers: data.max_volunteers ? Number(data.max_volunteers) : undefined,
          minimum_age: data.minimum_age ? Number(data.minimum_age) : undefined,
          automatic_acceptance: data.automatic_acceptance,
          is_closed: data.is_closed,
          skills: skills.length > 0 ? skills : undefined,
          crisis_id: selectedCrisisId ?? null,
          start_date: data.start_timestamp ? data.start_timestamp.split('T')[0] : undefined,
          start_time: data.start_timestamp ? data.start_timestamp.split('T')[1] : undefined,
          end_date: data.end_timestamp ? data.end_timestamp.split('T')[0] : undefined,
          end_time: data.end_timestamp ? data.end_timestamp.split('T')[1] : undefined,
        };

        const response = await updatePosting(id, payload);

        const updatedPosting = {
          ...response.posting,
          skills: response.skills,
        };

        setPosting(updatedPosting);
        setCurrentPostingCrisis(response.crisis);
        setSkills(response.skills.map(s => s.name));
        setSelectedCrisisId(response.posting.crisis_id ?? undefined);
        notifications.push({
          type: 'success',
          message: 'Posting updated successfully.',
        });
        setIsEditMode(false);
      } finally {
        setSaving(false);
      }
    });
  });

  const onCancelEdit = useCallback(() => {
    if (!posting) return;
    form.reset({
      title: posting.title,
      description: posting.description,
      location_name: posting.location_name,
      start_timestamp: getPreferredDateTimeInputValue(posting.start_date, posting.start_time),
      end_timestamp: getPreferredDateTimeInputValue(posting.end_date, posting.end_time) || undefined,
      max_volunteers: posting.max_volunteers?.toString() ?? undefined,
      minimum_age: posting.minimum_age?.toString() ?? undefined,
      automatic_acceptance: posting.automatic_acceptance,
      is_closed: posting.is_closed,
    });
    setSkills(posting.skills.map((s: { name: string }) => s.name));
    setSelectedCrisisId(posting.crisis_id ?? undefined);
    setPosition([
      posting.latitude ?? 33.90192863620578,
      posting.longitude ?? 35.477959277880416,
    ]);
    setIsEditMode(false);
  }, [form, posting]);

  const onDelete = async () => {
    if (!id) return;
    if (!confirm('Are you sure you want to delete this posting? This action cannot be undone.')) return;

    try {
      setDeleting(true);
      await deletePosting(id);
      notifications.push({
        type: 'success',
        message: 'Posting deleted successfully.',
      });
      navigate('/organization');
    } finally {
      setDeleting(false);
    }
  };

  const onToggleClosed = async () => {
    if (!id || !posting) return;
    try {
      setTogglingClosed(true);
      const response = await updatePosting(id, { is_closed: !posting.is_closed });
      const updatedPosting = { ...response.posting, skills: response.skills };
      setPosting(updatedPosting);
      form.setValue('is_closed', response.posting.is_closed);
      notifications.push({
        type: 'success',
        message: response.posting.is_closed ? 'Posting closed successfully.' : 'Posting reopened successfully.',
      });
    } finally {
      setTogglingClosed(false);
    }
  };

  const closeApplyModal = useCallback(() => {
    setIsApplyModalOpen(false);
  }, []);

  const openApplyModal = useCallback(() => {
    if (!id || hasPendingApplication || isEnrolled) return;
    setIsApplyModalOpen(true);
  }, [id, hasPendingApplication, isEnrolled]);

  const submitApplication = useCallback(async (message?: string) => {
    if (!id || hasPendingApplication || isEnrolled) return;

    try {
      setApplying(true);

      await applyToPosting(id, message);

      setHasPendingApplication(true);
      setIsApplyModalOpen(false);
      notifications.push({
        type: 'success',
        message: 'Application submitted successfully.',
      });
    } finally {
      setApplying(false);
    }
  }, [applyToPosting, id, hasPendingApplication, isEnrolled, notifications]);

  const withdrawApplication = useCallback(async () => {
    if (!id || (!hasPendingApplication && !isEnrolled)) return;
    if (!confirm(isEnrolled ? 'Are you sure you want to leave this position?' : 'Are you sure you want to withdraw your application?')) return;

    try {
      setWithdrawing(true);

      await withdrawFromPosting(id);

      setHasPendingApplication(false);
      setIsEnrolled(false);
      notifications.push({
        type: 'success',
        message: isEnrolled ? 'Left volunteering position.' : 'Application withdrawn successfully.',
      });
    } finally {
      setWithdrawing(false);
    }
  }, [id, hasPendingApplication, isEnrolled, notifications, withdrawFromPosting]);

  const acceptApplication = useCallback(async (applicationId: number) => {
    if (!id) return;

    try {
      setProcessingApplicationId(applicationId);

      await acceptPostingApplication(id, applicationId);

      const enrollmentsResponse = await loadPostingEnrollments(id);
      setEnrollments(enrollmentsResponse.enrollments);

      setApplications(prev => prev.filter(app => app.application_id !== applicationId));
      notifications.push({
        type: 'success',
        message: 'Application accepted successfully.',
      });
    } finally {
      setProcessingApplicationId(null);
    }
  }, [acceptPostingApplication, id, loadPostingEnrollments, notifications]);

  const rejectApplication = useCallback(async (applicationId: number) => {
    if (!id) return;
    if (!confirm('Are you sure you want to reject this application?')) return;

    try {
      setProcessingApplicationId(applicationId);
      await rejectPostingApplication(id, applicationId);

      setApplications(prev => prev.filter(app => app.application_id !== applicationId));
      notifications.push({
        type: 'success',
        message: 'Application rejected.',
      });
    } finally {
      setProcessingApplicationId(null);
    }
  }, [id, notifications, rejectPostingApplication]);

  const onMapPositionPick = useCallback((coords: [number, number]) => {
    setPosition(coords);
  }, []);

  const formValues = form.watch();

  const formattedStartDate = useMemo(() => {
    if (!formValues.start_timestamp) return '-';
    const parsed = new Date(formValues.start_timestamp);
    if (Number.isNaN(parsed.getTime())) return formValues.start_timestamp;
    return parsed.toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [formValues.start_timestamp]);

  const formattedEndDate = useMemo(() => {
    if (!formValues.end_timestamp) return '-';
    const parsed = new Date(formValues.end_timestamp);
    if (Number.isNaN(parsed.getTime())) return formValues.end_timestamp;
    return parsed.toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [formValues.end_timestamp]);

  const applicationStatus = useMemo(() => {
    if (isEnrolled) {
      return {
        label: 'Accepted',
        description: 'Your application was accepted and you are enrolled in this posting.',
        badgeClassName: 'badge-success',
      };
    }

    if (hasPendingApplication) {
      return {
        label: 'Pending',
        description: 'Your application is waiting for the organization to review it.',
        badgeClassName: 'badge-warning',
      };
    }

    return {
      label: 'Not Applied',
      description: 'You have not applied to this posting yet.',
      badgeClassName: 'badge-ghost',
    };
  }, [hasPendingApplication, isEnrolled]);

  const canOpenAttendancePage = useMemo(() => {
    if (isVolunteerView || !posting) return false;
    return new Date() >= getPostingStartDateTime(posting);
  }, [isVolunteerView, posting]);

  const isPostingFull = useMemo(() => {
    if (!posting?.max_volunteers) return false;
    const currentEnrollmentCount = isVolunteerView ? postingEnrollmentCount : enrollments.length;
    return currentEnrollmentCount >= posting.max_volunteers;
  }, [isVolunteerView, postingEnrollmentCount, posting?.max_volunteers, enrollments.length]);

  if (loading) {
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

  if (fetchError) {
    return (
      <div className="grow bg-base-200">
        <div className="p-6 md:container mx-auto">
          <Alert color="error">
            {fetchError.message}
          </Alert>
          <Button
            style="outline"
            className="mt-4"
            onClick={() => void loadPosting()}
            Icon={RefreshCcw}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!posting) {
    return (
      <div className="grow bg-base-200">
        <div className="p-6 md:container mx-auto">
          <Alert color="warning">
            Posting not found.
          </Alert>
          <LinkButton style="outline" className="mt-4" to="/organization" Icon={House}>
            Back to Home
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="grow bg-base-200">
      <CustomMessageModal
        open={isApplyModalOpen}
        submitting={applying}
        onClose={closeApplyModal}
        onSubmit={submitApplication}
        placeholder="You can add an optional message to tell the organization why you're interested in this opportunity"
      />
      <div className="p-6 md:container mx-auto">
        <PageHeader
          title="Posting Details"
          subtitle={isVolunteerView ? 'Review details before applying' : 'View and manage your posting'}
          icon={ListChecks}
          showBack
          defaultBackTo={isVolunteerView ? '/volunteer' : '/organization'}
          actions={!isVolunteerView && (isEditMode
            ? (
                <>
                  <Button style="outline" onClick={onCancelEdit} disabled={saving} Icon={X}>
                    Cancel
                  </Button>
                  <Button color="primary" onClick={onSave} loading={saving} Icon={Save}>
                    Save Changes
                  </Button>
                </>
              )
            : (
                <>
                  <LinkButton
                    to={`/organization/posting/${posting.id}/attendance`}
                    color="info"
                    style="outline"
                    disabled={!canOpenAttendancePage}
                    Icon={ListChecks}
                  >
                    Attendance
                  </LinkButton>
                  <Button
                    color="primary"
                    onClick={() => setIsEditMode(true)}
                    style="outline"
                    Icon={Edit3}
                  >
                    Edit
                  </Button>
                  <Button
                    color={posting?.is_closed ? 'success' : 'warning'}
                    onClick={onToggleClosed}
                    disabled={!posting}
                    loading={togglingClosed}
                    Icon={posting?.is_closed ? LockOpen : Lock}
                  >
                    {posting?.is_closed ? 'Reopen' : 'Close'}
                  </Button>
                  <Button
                    color="error"
                    onClick={onDelete}
                    loading={deleting}
                    Icon={Trash2}
                  >
                    Delete
                  </Button>
                </>
              )
          )}
        />

        <div className="mt-6">
          <ColumnLayout
            sidebar={(
              <>
                <div className="card bg-base-100 shadow-md">
                  <div className="card-body">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <h4 className="text-xl font-bold">{formValues.title}</h4>
                      {isVolunteerView && postingOrganization && (
                        <Link
                          to={`/organization/${postingOrganization.id}`}
                          className="link link-primary link-hover font-medium text-sm inline-flex items-center gap-1.5 shrink-0"
                        >
                          <Building2 size={14} />
                          <span>{postingOrganization.name}</span>
                        </Link>
                      )}
                    </div>

                    {isEditMode
                      ? (
                          <div className="space-y-4">
                            <FormField
                              form={form}
                              label="Title"
                              name="title"
                              type="text"
                              placeholder="Enter posting title"
                              Icon={Edit3}
                            />
                            <FormField
                              form={form}
                              label="Description"
                              name="description"
                              type="textarea"
                              placeholder="Describe the opportunity"
                            />
                            <FormField
                              form={form}
                              label="Location Name"
                              name="location_name"
                              type="text"
                              placeholder="e.g. Downtown Community Center"
                              Icon={MapPin}
                            />
                            <FormField
                              form={form}
                              label="Max Volunteers"
                              name="max_volunteers"
                              type="number"
                              placeholder="Optional"
                              Icon={Users}
                            />
                            <FormField
                              form={form}
                              label="Min Age"
                              name="minimum_age"
                              type="number"
                              placeholder="Optional"
                              Icon={ShieldCheck}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <fieldset className="fieldset w-full">
                                <label className="label">
                                  <span className="label-text font-medium">Start Date</span>
                                </label>
                                <input
                                  type="date"
                                  className={`input input-bordered w-full focus:input-primary ${form.formState.errors.start_timestamp ? 'input-error' : ''}`}
                                  value={startDateTimeParts.date}
                                  onChange={(event) => {
                                    const nextValue = combineDateAndTime(event.target.value, startDateTimeParts.time);
                                    form.setValue('start_timestamp', nextValue, {
                                      shouldDirty: true,
                                      shouldTouch: true,
                                      shouldValidate: true,
                                    });
                                  }}
                                />
                                {form.formState.errors.start_timestamp?.message && (
                                  <p className="text-error text-sm mt-1">{form.formState.errors.start_timestamp.message as string}</p>
                                )}
                              </fieldset>

                              <fieldset className="fieldset w-full">
                                <label className="label">
                                  <span className="label-text font-medium">Start Time</span>
                                </label>
                                <input
                                  type="time"
                                  className="input input-bordered w-full focus:input-primary"
                                  value={startDateTimeParts.time}
                                  onChange={(event) => {
                                    const nextValue = combineDateAndTime(startDateTimeParts.date, event.target.value);
                                    form.setValue('start_timestamp', nextValue, {
                                      shouldDirty: true,
                                      shouldTouch: true,
                                      shouldValidate: true,
                                    });
                                  }}
                                />
                              </fieldset>

                              <fieldset className="fieldset w-full">
                                <label className="label">
                                  <span className="label-text font-medium">End Date</span>
                                </label>
                                <input
                                  type="date"
                                  className="input input-bordered w-full focus:input-primary"
                                  value={endDateTimeParts.date}
                                  onChange={(event) => {
                                    const nextValue = combineDateAndTime(event.target.value, endDateTimeParts.time);
                                    form.setValue('end_timestamp', nextValue || undefined, {
                                      shouldDirty: true,
                                      shouldTouch: true,
                                      shouldValidate: true,
                                    });
                                  }}
                                />
                              </fieldset>

                              <fieldset className="fieldset w-full">
                                <label className="label">
                                  <span className="label-text font-medium">End Time</span>
                                </label>
                                <input
                                  type="time"
                                  className="input input-bordered w-full focus:input-primary"
                                  value={endDateTimeParts.time}
                                  onChange={(event) => {
                                    const nextValue = combineDateAndTime(endDateTimeParts.date, event.target.value);
                                    form.setValue('end_timestamp', nextValue || undefined, {
                                      shouldDirty: true,
                                      shouldTouch: true,
                                      shouldValidate: true,
                                    });
                                  }}
                                />
                              </fieldset>
                            </div>
                          </div>
                        )
                      : (
                          <div className="space-y-4">
                            <div>
                              <label className="text-xs font-semibold opacity-70 uppercase">Description</label>
                              <p className="text-sm opacity-80 whitespace-pre-wrap">{formValues.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin size={16} className="text-primary" />
                              <span className="text-sm">{formValues.location_name}</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Calendar size={16} className="text-primary" />
                                <div>
                                  <p className="text-xs opacity-70 font-semibold">START</p>
                                  <span className="text-xs">{formattedStartDate}</span>
                                </div>
                              </div>
                              {formValues.end_timestamp && (
                                <div className="flex items-center gap-2">
                                  <Calendar size={16} className="text-primary" />
                                  <div>
                                    <p className="text-xs opacity-70 font-semibold">END</p>
                                    <span className="text-xs">{formattedEndDate}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              {formValues.max_volunteers
                                ? (
                                    <div className="flex items-center gap-2">
                                      <Users size={16} className="text-primary" />
                                      <div>
                                        <p className="text-xs opacity-70 font-semibold">MAX VOLUNTEERS</p>
                                        <span className="text-sm">{formValues.max_volunteers}</span>
                                      </div>
                                    </div>
                                  )
                                : null}
                              {formValues.minimum_age && (
                                <div className="flex items-center gap-2">
                                  <Cake size={16} className="text-primary" />
                                  <div>
                                    <p className="text-xs opacity-70 font-semibold">MIN AGE</p>
                                    <span className="text-sm">
                                      {formValues.minimum_age}
                                      +
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                  </div>
                </div>

                <div className="card bg-base-100 shadow-md">
                  <div className="card-body">
                    {isEditMode
                      ? (
                          <>
                            <div className="mb-2">
                              <h5 className="font-bold text-lg inline-flex items-center gap-2">
                                <AlertTriangle size={17} className="text-accent" />
                                Crisis Tag
                              </h5>
                              {!isVolunteerView && (
                                <p className="text-sm opacity-70">
                                  Add a crisis tag to this posting.
                                </p>
                              )}
                            </div>
                            <fieldset className="fieldset">
                              <label className="label">
                                <span className="label-text font-medium">Selected Crisis</span>
                              </label>
                              <select
                                className="select select-bordered w-full"
                                value={selectedCrisisId?.toString() ?? ''}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setSelectedCrisisId(value ? Number(value) : undefined);
                                }}
                                disabled={saving || loadingCrises}
                              >
                                <option value="">No crisis tag</option>
                                {availableCrises.map(crisis => (
                                  <option key={crisis.id} value={crisis.id.toString()}>
                                    {crisis.name}
                                    {!crisis.pinned ? ' (Unpinned)' : ''}
                                  </option>
                                ))}
                              </select>
                              {loadingCrises && <span className="label-text-alt opacity-70">Loading crisis tags...</span>}
                              {crisesError && <span className="label-text-alt text-error">{crisesError.message}</span>}
                            </fieldset>
                          </>
                        )
                      : selectedCrisisName
                        ? (
                            isVolunteerView && selectedCrisisId
                              ? (
                                  <Link
                                    to={`/volunteer/crises/${selectedCrisisId}/postings`}
                                    state={{ crisis: selectedCrisis }}
                                    className="-m-2 rounded-box bg-base-100 px-3 py-3 flex items-start justify-between gap-3 hover:bg-base-200/40 transition-colors group"
                                  >
                                    <div className="flex-1 min-w-0">
                                      <h5 className="font-bold text-lg inline-flex items-center gap-2 text-accent mb-1">
                                        <AlertTriangle size={16} />
                                        {selectedCrisisName}
                                        <ExternalLink size={13} className="opacity-60 group-hover:opacity-100 transition-opacity" />
                                      </h5>
                                      <p className="text-sm opacity-70">
                                        {selectedCrisis?.description?.trim() || 'No crisis description provided.'}
                                      </p>
                                    </div>
                                  </Link>
                                )
                              : (
                                  <div>
                                    <h5 className="font-bold text-lg inline-flex items-center gap-2 text-accent mb-1">
                                      <AlertTriangle size={17} />
                                      {selectedCrisisName}
                                    </h5>
                                    <p className="text-sm opacity-70">
                                      {selectedCrisis?.description?.trim() || 'No crisis description provided.'}
                                    </p>
                                  </div>
                                )
                          )
                        : (
                            <div>
                              <h5 className="font-bold text-lg inline-flex items-center gap-2 mb-1">
                                <AlertTriangle size={17} className="text-accent" />
                                Crisis Tag
                              </h5>
                              <p className="text-sm opacity-70">This posting is not tagged with any crisis.</p>
                            </div>
                          )}
                  </div>
                </div>

                <div className="card bg-base-100 shadow-md">
                  <div className="card-body">
                    <h5 className="font-bold text-lg inline-flex items-center gap-2">
                      {isOpen
                        ? <LockOpen size={17} className="text-primary" />
                        : <Lock size={17} className="text-secondary" />}
                      Status
                    </h5>
                    <p className="text-sm opacity-70 mb-3">Posting visibility.</p>
                    {isEditMode
                      ? (
                          <ToggleButton
                            form={form}
                            name="automatic_acceptance"
                            label="Posting Type"
                            disabled={saving}
                            options={[
                              {
                                value: true,
                                label: 'Open Posting',
                                description: 'Volunteers are accepted automatically.',
                                Icon: LockOpen,
                                btnColor: 'btn-primary',
                              },
                              {
                                value: false,
                                label: 'Review-Based',
                                description: 'Volunteers must be approved by the organization.',
                                Icon: Lock,
                                btnColor: 'btn-secondary',
                              },
                            ]}
                          />
                        )
                      : (
                          <span className={`badge gap-2 ${posting?.is_closed ? 'badge-error' : isOpen ? 'badge-primary' : 'badge-secondary'}`}>
                            {posting?.is_closed ? <Lock size={12} /> : isOpen ? <LockOpen size={12} /> : <Lock size={12} />}
                            {posting?.is_closed ? 'Closed' : isPostingFull ? 'Full' : isOpen ? 'Open' : 'Review Based'}
                          </span>
                        )}
                    <p className="text-xs opacity-70 mt-2">
                      {posting?.is_closed
                        ? 'This posting is closed and no longer accepting applications.'
                        : isOpen
                          ? 'Volunteers are accepted automatically.'
                          : 'Volunteers must be accepted by the organization.'}
                    </p>

                  </div>
                </div>

                {!isVolunteerView && (
                  <div className="card bg-base-100 shadow-md">
                    <div className="card-body">
                      <h5 className="font-bold text-lg inline-flex items-center gap-2">
                        <MapPin size={17} className="text-primary" />
                        Location
                      </h5>
                      <p className="text-sm opacity-70 mb-2">
                        {isEditMode ? 'Pick the location on the map.' : 'Posting location on map.'}
                      </p>
                      <LocationPicker
                        position={position}
                        setPosition={onMapPositionPick}
                        readOnly={!isEditMode}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          >
            {isVolunteerView && (
              <div className="card bg-base-100 shadow-md">
                <div className="card-body">
                  <h5 className="font-bold text-lg inline-flex items-center gap-2">
                    <ShieldCheck size={17} className="text-primary" />
                    Application Status
                  </h5>
                  <span className={`badge mt-1 w-fit ${applicationStatus.badgeClassName}`}>
                    {applicationStatus.label}
                  </span>
                  <p className="text-sm opacity-70 mt-2">
                    {applicationStatus.description}
                  </p>

                  <div className="mt-3 flex justify-end">
                    {isEnrolled
                      ? (
                          <Button
                            color="error"
                            style="outline"
                            onClick={withdrawApplication}
                            loading={withdrawing}
                            Icon={SquareArrowRight}
                          >
                            Leave Position
                          </Button>
                        )
                      : hasPendingApplication
                        ? (
                            <Button
                              color="error"
                              style="outline"
                              onClick={withdrawApplication}
                              loading={withdrawing}
                              Icon={SquareArrowRight}
                            >
                              Withdraw Application
                            </Button>
                          )
                        : (
                            <Button
                              color="primary"
                              onClick={openApplyModal}
                              loading={applying}
                              Icon={Send}
                            >
                              Apply
                            </Button>
                          )}
                  </div>
                </div>
              </div>
            )}

            <div className="card bg-base-100 shadow-md">
              <div className="card-body">
                <h5 className="font-bold text-lg inline-flex items-center gap-2">
                  <Tag size={17} className="text-primary" />
                  Required Skills
                </h5>
                <p className="text-sm opacity-70 mt-1">Skills needed for this opportunity.</p>

                {isEditMode
                  ? (
                      <SkillsInput skills={skills} setSkills={setSkills} />
                    )
                  : (
                      <SkillsList skills={posting.skills} enableLimit={false} />
                    )}
              </div>
            </div>

            {isVolunteerView && (
              <div className="card bg-base-100 shadow-md">
                <div className="card-body">
                  <h5 className="font-bold text-lg inline-flex items-center gap-2">
                    <MapPin size={17} className="text-primary" />
                    Location
                  </h5>
                  <p className="text-sm opacity-70 mb-2">
                    {isEditMode ? 'Pick the location on the map.' : 'Posting location on map.'}
                  </p>
                  <LocationPicker
                    position={position}
                    setPosition={onMapPositionPick}
                    readOnly={!isEditMode}
                  />
                </div>
              </div>
            )}

            {!isVolunteerView && !isOpen && (
              <div className="card bg-base-100 shadow-md">
                <div className="card-body">
                  <h4 className="text-xl font-bold mb-4">
                    Enrollment Applications
                    {' '}
                    <span className="badge badge-primary">{applications.length}</span>
                  </h4>

                  {applications.length === 0
                    ? (
                        <Alert>
                          No pending applications.
                        </Alert>
                      )
                    : (
                        <div className="space-y-2">
                          {applications.map(app => (
                            <VolunteerInfoCollapse
                              key={app.application_id}
                              volunteer={app}
                              actions={(
                                <>
                                  <Button
                                    color="success"
                                    style="soft"
                                    onClick={() => acceptApplication(app.application_id)}
                                    loading={processingApplicationId === app.application_id}
                                    Icon={Check}
                                  >
                                    Accept
                                  </Button>
                                  <Button
                                    color="error"
                                    style="soft"
                                    onClick={() => rejectApplication(app.application_id)}
                                    loading={processingApplicationId === app.application_id}
                                    Icon={X}
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                            />
                          ))}
                        </div>
                      )}
                </div>
              </div>
            )}

            {!isVolunteerView && (
              <div className="card bg-base-100 shadow-md">
                <div className="card-body">
                  <h4 className="text-xl font-bold mb-4">
                    Enrolled Volunteers
                    {' '}
                    <span className="badge badge-primary">{enrollments.length}</span>
                  </h4>

                  {enrollments.length === 0
                    ? (
                        <Alert>
                          No volunteers have enrolled yet.
                        </Alert>
                      )
                    : (
                        <div className="space-y-2">
                          {enrollments.map(volunteer => (
                            <VolunteerInfoCollapse
                              key={volunteer.enrollment_id}
                              volunteer={volunteer}
                            />
                          ))}
                        </div>
                      )}
                </div>
              </div>
            )}
          </ColumnLayout>
        </div>
      </div>
    </div>
  );
}

export default PostingPage;
