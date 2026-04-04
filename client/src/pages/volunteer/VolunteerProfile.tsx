import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  Brain,
  Building2,
  Calendar,
  Clock3,
  Edit3,
  Mail,
  Mars,
  Venus,
  FileText,
  RefreshCcw,
  Save,
  Trash2,
  Upload,
  X,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { volunteerAccountSchema } from '../../../../server/src/db/tables';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ColumnLayout from '../../components/layout/ColumnLayout';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import LinkButton from '../../components/LinkButton';
import Loading from '../../components/Loading';
import PostingList from '../../components/PostingList';
import SkillsInput from '../../components/skills/SkillsInput';
import SkillsList from '../../components/skills/SkillsList';
import useNotifications from '../../notifications/useNotifications';
import { FormField } from '../../utils/formUtils';
import requestServer, { SERVER_BASE_URL } from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type { VolunteerProfileResponse } from '../../../../server/src/api/types';
import type { PostingWithContext } from '../../../../server/src/types';

const DESCRIPTION_MAX_LENGTH = 300;

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})/;

const getDateParts = (value: string) => {
  const match = value.match(DATE_ONLY_REGEX);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { year, month, day };
};

const profileFormSchema = volunteerAccountSchema.omit({
  id: true,
  password: true,
  email: true,
  profile_vector: true,
  experience_vector: true,
  created_at: true,
  updated_at: true,
  is_disabled: true,
  is_deleted: true,
  token_version: true,
}).extend({
  description: z.string().max(
    DESCRIPTION_MAX_LENGTH,
    `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`,
  ),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

const getDateInputValue = (value: string) => {
  const dateParts = getDateParts(value);
  if (!dateParts) return '';
  return `${dateParts.year}-${String(dateParts.month).padStart(2, '0')}-${String(dateParts.day).padStart(2, '0')}`;
};

const toTimeString = (value: Date) => `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
const toDateFromParts = (dateValue: Date | string, timeValue?: string) => {
  const datePart = getDateInputValue(String(dateValue));
  if (!datePart) return new Date(Number.NaN);
  const timePart = (timeValue ?? '00:00').slice(0, 5) || '00:00';
  return new Date(`${datePart}T${timePart}`);
};

const DEFAULT_SINGLE_DAY_HOURS = 5;

const getExperienceDurationInHours = (
  startDateValue: Date | string,
  startTimeValue: string,
  endDateValue?: Date | string,
  endTimeValue?: string,
) => {
  const startDate = toDateFromParts(startDateValue, startTimeValue);
  if (Number.isNaN(startDate.getTime())) return 0;

  const endDate = endDateValue ? toDateFromParts(endDateValue, endTimeValue) : null;
  if (!endDate || Number.isNaN(endDate.getTime())) return DEFAULT_SINGLE_DAY_HOURS;

  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  const diffInMs = endDay.getTime() - startDay.getTime();
  const dayCount = diffInMs < 0 ? 1 : Math.floor(diffInMs / (24 * 60 * 60 * 1000)) + 1;

  const startHourOfDay = startDate.getHours()
    + (startDate.getMinutes() / 60)
    + (startDate.getSeconds() / 3600);
  const endHourOfDay = endDate.getHours()
    + (endDate.getMinutes() / 60)
    + (endDate.getSeconds() / 3600);

  const dailyHours = endHourOfDay - startHourOfDay;
  const safeDailyHours = dailyHours > 0 ? dailyHours : DEFAULT_SINGLE_DAY_HOURS;

  return safeDailyHours * dayCount;
};

function VolunteerProfile() {
  const [profile, setProfile] = useState<VolunteerProfileResponse | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAllExperiences, setShowAllExperiences] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cvBusy, setCvBusy] = useState(false);
  const notifications = useNotifications();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    mode: 'onTouched',
    defaultValues: {
      first_name: '',
      last_name: '',
      date_of_birth: '',
      gender: 'male',
      description: '',
    },
  });

  const loadProfileRequest = useCallback(async () => {
    const response = await requestServer<VolunteerProfileResponse>(
      '/volunteer/profile',
      { includeJwt: true },
    );
    setProfile(response);
    setShowAllExperiences(false);
    setSkills(response.skills);
    form.reset({
      first_name: response.volunteer.first_name,
      last_name: response.volunteer.last_name,
      date_of_birth: getDateInputValue(response.volunteer.date_of_birth),
      gender: response.volunteer.gender,
      description: response.volunteer.description ?? '',
    });
  }, [form]);

  const {
    loading,
    error: fetchError,
    trigger: loadProfile,
  } = useAsync<void, []>(loadProfileRequest, {
    notifyOnError: true,
  });

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const { trigger: updateProfile } = useAsync(
    async (data: {
      gender: 'male' | 'female' | 'other';
      description: string;
      skills: string[];
    }) => requestServer<VolunteerProfileResponse>('/volunteer/profile', {
      method: 'PUT',
      body: data,
      includeJwt: true,
    }),
    { notifyOnError: true },
  );

  const { trigger: uploadCv } = useAsync(
    async (formData: FormData) => requestServer<VolunteerProfileResponse>('/volunteer/profile/cv', {
      method: 'POST',
      body: formData,
      includeJwt: true,
    }),
    { notifyOnError: true },
  );

  const { trigger: deleteCv } = useAsync(
    async () => requestServer<VolunteerProfileResponse>('/volunteer/profile/cv', {
      method: 'DELETE',
      includeJwt: true,
    }),
    { notifyOnError: true },
  );

  const { trigger: getCvPreviewBlob } = useAsync(
    async () => {
      const response = await fetch(`${SERVER_BASE_URL}/volunteer/profile/cv/preview`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('jwt')}`,
        },
      });

      if (!response.ok) {
        let message = 'Failed to load CV';

        try {
          const errorBody = await response.json() as { error?: string; message?: string };
          message = errorBody.message ?? errorBody.error ?? message;
        } catch {
          // Ignore JSON parsing errors and fall back to the default message.
        }

        throw new Error(message);
      }

      return response.blob();
    },
    { notifyOnError: true },
  );

  const formValues = form.watch();

  const volunteerName = useMemo(
    () => `${formValues.first_name || ''} ${formValues.last_name || ''}`.trim(),
    [formValues.first_name, formValues.last_name],
  );

  const initials = useMemo(() => {
    const nameParts = volunteerName.trim().split(/\s+/).filter(Boolean);
    return nameParts
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  }, [volunteerName]);

  const formattedDateOfBirth = useMemo(() => {
    if (!formValues.date_of_birth) return '-';

    const dateParts = getDateParts(formValues.date_of_birth);
    if (!dateParts) return formValues.date_of_birth;

    const parsed = new Date(dateParts.year, dateParts.month - 1, dateParts.day);
    if (Number.isNaN(parsed.getTime())) return formValues.date_of_birth;

    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [formValues.date_of_birth]);

  const formattedGender = useMemo(() => {
    if (formValues.gender === 'male') return 'Male';
    if (formValues.gender === 'female') return 'Female';
    return 'Other';
  }, [formValues.gender]);

  const genderBadgeStyles = useMemo(() => {
    if (formValues.gender === 'male') return 'badge-info';
    if (formValues.gender === 'female') return 'badge-secondary';
    return 'badge-accent';
  }, [formValues.gender]);

  const visibleCompletedExperiences = useMemo(() => {
    if (!profile) return [];
    if (showAllExperiences) return profile.completed_experiences;
    return profile.completed_experiences.slice(0, 2);
  }, [profile, showAllExperiences]);

  const visibleExperiencePostings = useMemo<PostingWithContext[]>(() => (
    visibleCompletedExperiences.map((experience) => {
      const startDate = toDateFromParts(experience.start_date, experience.start_time);
      const endDate = experience.end_date ? toDateFromParts(experience.end_date, experience.end_time) : null;
      const safeStartDate = Number.isNaN(startDate.getTime()) ? new Date() : startDate;
      const safeEndDate = endDate && !Number.isNaN(endDate.getTime()) ? endDate : null;

      return {
        id: experience.posting_id,
        organization_id: experience.organization_id,
        title: experience.posting_title,
        description: '',
        latitude: undefined,
        longitude: undefined,
        max_volunteers: undefined,
        start_date: safeStartDate,
        start_time: toTimeString(safeStartDate),
        end_date: safeEndDate ?? safeStartDate,
        end_time: safeEndDate ? toTimeString(safeEndDate) : toTimeString(safeStartDate),
        minimum_age: undefined,
        automatic_acceptance: experience.automatic_acceptance,
        is_closed: experience.is_closed,
        allows_partial_attendance: false,
        location_name: experience.location_name,
        created_at: safeStartDate,
        updated_at: safeStartDate,
        crisis_id: undefined,
        skills: [],
        organization_name: experience.organization_name,
        organization_logo_path: experience.organization_logo_path ?? undefined,
        crisis_name: experience.crisis_name,
        enrollment_count: experience.enrollment_count,
        application_status: 'none',
      };
    })
  ), [visibleCompletedExperiences]);

  const hasHiddenCompletedExperiences = useMemo(() => {
    if (!profile) return false;
    return profile.completed_experiences.length >= 3;
  }, [profile]);

  const totalCompletedHours = useMemo(() => {
    if (!profile) return 0;

    return profile.completed_experiences.reduce((total, experience) => (
      total + getExperienceDurationInHours(
        experience.start_date,
        experience.start_time,
        experience.end_date,
        experience.end_time,
      )
    ), 0);
  }, [profile]);

  const onSave = form.handleSubmit(async (data) => {
    if (!isEditMode || !profile) return;

    try {
      setSaving(true);

      const response = await updateProfile({
        gender: data.gender,
        description: data.description,
        skills,
      });

      setProfile(response);
      setSkills(response.skills);
      form.reset({
        first_name: response.volunteer.first_name,
        last_name: response.volunteer.last_name,
        date_of_birth: getDateInputValue(response.volunteer.date_of_birth),
        gender: response.volunteer.gender,
        description: response.volunteer.description ?? '',
      });
      notifications.push({
        type: 'success',
        message: 'Profile changes saved.',
      });
      setIsEditMode(false);
    } finally {
      setSaving(false);
    }
  });

  const onCancelEdit = useCallback(() => {
    if (!profile) return;
    form.reset({
      first_name: profile.volunteer.first_name,
      last_name: profile.volunteer.last_name,
      date_of_birth: getDateInputValue(profile.volunteer.date_of_birth),
      gender: profile.volunteer.gender,
      description: profile.volunteer.description ?? '',
    });
    setSkills(profile.skills);
    setIsEditMode(false);
  }, [form, profile]);

  const onUploadCv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      notifications.push({
        type: 'warning',
        message: 'Only PDF files are allowed.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setCvBusy(true);

      const formData = new FormData();
      formData.append('cv', file);

      const response = await uploadCv(formData);

      setProfile(response);
      notifications.push({
        type: 'success',
        message: 'CV uploaded successfully.',
      });
    } finally {
      setCvBusy(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const onDeleteCv = async () => {
    try {
      setCvBusy(true);

      const response = await deleteCv();

      setProfile(response);
      notifications.push({
        type: 'success',
        message: 'CV removed successfully.',
      });
    } finally {
      setCvBusy(false);
    }
  };

  const onViewCv = async () => {
    try {
      setCvBusy(true);

      const fileBlob = await getCvPreviewBlob();
      const previewUrl = URL.createObjectURL(fileBlob);
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
    } finally {
      setCvBusy(false);
    }
  };

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
          <Button className="mt-4" style="outline" onClick={() => void loadProfile()} Icon={RefreshCcw}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="grow bg-base-200">
        <div className="p-6 md:container mx-auto">
          <Alert color="warning">
            Profile not found.
          </Alert>
        </div>
      </div>
    );
  }

  const avatarUrl = '';

  return (
    <PageContainer>
      <PageHeader
        title="Profile"
        subtitle="Manage your details, availability, and focus areas."
        icon={FileText}
        actions={(
          <>
            <LinkButton to="/volunteer/certificate" color="secondary" className="btn btn-outline">
              <FileText size={16} />
              Generate Certificate
            </LinkButton>
            {isEditMode
              ? (
                  <Button color="primary" style="outline" onClick={onCancelEdit} loading={saving} Icon={X}>
                    Cancel
                  </Button>
                )
              : (
                  <Button color="primary" style="outline" onClick={() => setIsEditMode(true)} Icon={Edit3}>
                    Edit Profile
                  </Button>
                )}
            {isEditMode && (
              <Button color="primary" onClick={onSave} loading={saving} Icon={Save}>
                Save Changes
              </Button>
            )}
          </>
        )}
      />

      <ColumnLayout
        sidebar={(
          <Card>
            <div className="flex items-center gap-4">
              <div className="avatar">
                {avatarUrl
                  ? (
                      <div className="rounded-full w-20">
                        <img src={avatarUrl} alt={`${volunteerName} avatar`} />
                      </div>
                    )
                  : (
                      <div className="bg-primary text-primary-content rounded-full w-20 flex items-center justify-center">
                        <span className="text-2xl">{initials || 'V'}</span>
                      </div>
                    )}
              </div>
              <div>
                <h4 className="text-xl font-bold">{volunteerName}</h4>
                <div className="mt-1">
                  <span className={`badge badge-sm gap-1 ${genderBadgeStyles}`}>
                    {formValues.gender === 'male' && <Mars size={12} />}
                    {formValues.gender === 'female' && <Venus size={12} />}
                    {formValues.gender === 'other' && <span className="font-bold">*</span>}
                    {formattedGender}
                  </span>
                </div>
              </div>
            </div>

            <div className="divider my-4" />

            {isEditMode
              ? (
                  <div className="space-y-3">
                    <div className={saving ? 'pointer-events-none opacity-70' : ''}>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">First Name</label>
                        <input
                          type="text"
                          className="input input-bordered w-full opacity-80"
                          value={profile.volunteer.first_name}
                          disabled
                          readOnly
                        />
                      </div>
                    </div>
                    <div className={saving ? 'pointer-events-none opacity-70' : ''}>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Last Name</label>
                        <input
                          type="text"
                          className="input input-bordered w-full opacity-80"
                          value={profile.volunteer.last_name}
                          disabled
                          readOnly
                        />
                      </div>
                    </div>
                    <div className={saving ? 'pointer-events-none opacity-70' : ''}>
                      <FormField
                        form={form}
                        name="gender"
                        label="Gender"
                        selectOptions={[
                          { label: 'Male', value: 'male' },
                          { label: 'Female', value: 'female' },
                          { label: 'Other', value: 'other' },
                        ]}
                      />
                    </div>
                    <div className={saving ? 'pointer-events-none opacity-70' : ''}>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Email</label>
                        <div className="input input-bordered w-full flex items-center gap-2 opacity-80">
                          <Mail size={16} />
                          <span className="truncate">{profile.volunteer.email}</span>
                        </div>
                      </div>
                    </div>
                    <div className={saving ? 'pointer-events-none opacity-70' : ''}>
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Date of Birth</label>
                        <input
                          type="text"
                          className="input input-bordered w-full opacity-80"
                          value={formattedDateOfBirth}
                          disabled
                          readOnly
                        />
                      </div>
                    </div>
                  </div>
                )
              : (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="opacity-70 flex items-center gap-2">
                        <Mail size={14} />
                        Email
                      </span>
                      <span className="font-medium text-right break-all">
                        {profile.volunteer.email}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="opacity-70 flex items-center gap-2">
                        <Calendar size={14} />
                        Date of Birth
                      </span>
                      <span className="font-medium text-right">{formattedDateOfBirth}</span>
                    </div>
                  </div>
                )}

            <div className="mt-4">
              <label className="text-sm font-semibold text-base-content mb-2 block">Description</label>
              {isEditMode
                ? (
                    <>
                      <textarea
                        id="volunteer-description"
                        className="textarea textarea-bordered w-full"
                        {...form.register('description')}
                        disabled={saving}
                        rows={4}
                        maxLength={DESCRIPTION_MAX_LENGTH}
                      />
                      <p
                        className={`block min-h-5 text-xs mt-1 ${
                          form.formState.errors.description ? 'text-error' : 'invisible'
                        }`}
                      >
                        {form.formState.errors.description?.message || 'placeholder'}
                      </p>
                      <p className="text-xs opacity-60 mt-1 text-right">
                        {formValues.description?.length || 0}
                        /
                        {DESCRIPTION_MAX_LENGTH}
                      </p>
                    </>
                  )
                : (
                    <p className="text-sm opacity-80 whitespace-pre-wrap wrap-break-word">
                      {formValues.description || 'No description added yet.'}
                    </p>
                  )}
            </div>
          </Card>
        )}
      >
        <Card padding={false}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-0 gap-y-3">
            <div className="stat place-items-center">
              <div className="stat-title text-base">Completed Postings</div>
              <div className="stat-value text-2xl text-primary/80 inline-flex w-full items-center justify-center gap-2">
                <Users className="h-6 w-6 shrink-0 stroke-current" />
                <span>{profile.experience_stats.total_completed_experiences}</span>
              </div>
            </div>
            <div className="stat place-items-center">
              <div className="stat-title text-base">Hours Completed</div>
              <div className="stat-value text-2xl text-primary/80 inline-flex w-full items-center justify-center gap-2">
                <Clock3 className="h-6 w-6 shrink-0 stroke-current" />
                <span>{totalCompletedHours.toFixed(1)}</span>
              </div>
            </div>
            <div className="stat place-items-center">
              <div className="stat-title text-base">Organizations</div>
              <div className="stat-value text-2xl text-primary/80 inline-flex w-full items-center justify-center gap-2">
                <Building2 className="h-6 w-6 shrink-0 stroke-current" />
                <span>{profile.experience_stats.organizations_supported}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card padding={false}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-0 gap-y-3">
            <div className="stat place-items-center h-full grid-rows-[auto,1fr]">
              <div className="stat-title text-base">Crisis-Related</div>
              <div className="stat-value text-2xl text-primary/80 flex w-full items-center justify-center gap-2 self-center">
                <AlertTriangle className="h-6 w-6 shrink-0 stroke-current" />
                <span>{profile.experience_stats.crisis_related_experiences}</span>
              </div>
            </div>
            <div className="stat place-items-center h-full grid-rows-[auto,1fr]">
              <div className="stat-title text-base">Total Skills Used</div>
              <div className="stat-value text-2xl text-primary/80 flex w-full items-center justify-center gap-2 self-center">
                <Brain className="h-6 w-6 shrink-0 stroke-current" />
                <span>{profile.experience_stats.total_skills_used}</span>
              </div>
            </div>
            <div className="stat place-items-center h-full grid-rows-[auto,1fr]">
              <div className="stat-title text-base">Most Volunteered Crisis</div>
              <div className="stat-value text-lg text-primary/80 flex w-full min-w-0 items-center justify-center gap-2 px-2 self-center">
                <span className="max-w-full text-center whitespace-normal break-words leading-tight overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                  {profile.experience_stats.most_volunteered_crisis ?? 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Skills"
          description="Add skills to highlight your expertise."
        >
          {isEditMode
            ? (
                <SkillsInput skills={skills} setSkills={setSkills} />
              )
            : (
                <SkillsList skills={skills} enableLimit={false} />
              )}
        </Card>

        <Card
          title="Previous Experiences"
          description="Past volunteering experiences completed through the platform."
        >
          {profile.completed_experiences.length === 0
            ? (
                <div className="alert alert-soft mt-4">
                  <span className="text-sm">No completed experiences to show yet.</span>
                </div>
              )
            : (
                <div className="mt-4 space-y-3">
                  {visibleExperiencePostings.map(posting => (
                    <PostingList
                      key={posting.id}
                      posting={posting}
                      showCrisis={false}
                      volunteerOutsideMetaAt1700
                    />
                  ))}

                  {hasHiddenCompletedExperiences && (
                    <div className="flex justify-center pt-1">
                      <button
                        type="button"
                        className="badge badge-outline badge-primary px-4 py-3"
                        onClick={() => setShowAllExperiences(current => !current)}
                      >
                        {showAllExperiences
                          ? 'Show less'
                          : `Show more (${profile.completed_experiences.length - 2} more)`}
                      </button>
                    </div>
                  )}
                </div>
              )}
        </Card>

        <Card
          title="CV"
          description="Upload your CV as a PDF with up to 3 pages."
        >
          <div className="flex flex-col gap-3">
            {profile.volunteer.cv_path
              ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      color="primary"
                      type="button"
                      style="soft"
                      onClick={onViewCv}
                      disabled={cvBusy}
                      Icon={FileText}
                    >
                      View Current CV
                    </Button>

                    <Button
                      type="button"
                      color="error"
                      style="soft"
                      onClick={onDeleteCv}
                      disabled={cvBusy}
                      Icon={Trash2}
                    >
                      Remove CV
                    </Button>
                  </div>
                )
              : (
                  <Alert style="soft">
                    No CV uploaded yet.
                  </Alert>
                )}

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={onUploadCv}
              disabled={cvBusy}
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                style="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={cvBusy}
                Icon={Upload}
              >
                Upload CV
              </Button>

              <span className="text-xs opacity-60">
                PDF only, up to 3 pages, up to 5MB.
              </span>
            </div>
          </div>
        </Card>
      </ColumnLayout>
    </PageContainer>
  );
}
export default VolunteerProfile;
