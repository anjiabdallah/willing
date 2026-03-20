import { zodResolver } from '@hookform/resolvers/zod';
import {
  Calendar,
  Edit3,
  Globe,
  Lock,
  Mail,
  Mars,
  Venus,
  FileText,
  RefreshCcw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { volunteerAccountSchema } from '../../../../server/src/db/tables';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import ColumnLayout from '../../components/layout/ColumnLayout';
import PageHeader from '../../components/layout/PageHeader';
import Loading from '../../components/Loading';
import SkillsInput from '../../components/skills/SkillsInput';
import SkillsList from '../../components/skills/SkillsList';
import { ToggleButton } from '../../components/ToggleButton';
import useNotifications from '../../notifications/useNotifications';
import { FormField } from '../../utils/formUtils';
import requestServer, { SERVER_BASE_URL } from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type { VolunteerProfileResponse } from '../../../../server/src/api/types';

const DESCRIPTION_MAX_LENGTH = 300;

const profileFormSchema = volunteerAccountSchema.omit({
  id: true,
  password: true,
  email: true,
  profile_vector: true,
  experience_vector: true,
  created_at: true,
  updated_at: true,
}).extend({
  description: z.string().max(
    DESCRIPTION_MAX_LENGTH,
    `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`,
  ),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

const getDateInputValue = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

function VolunteerProfile() {
  const [profile, setProfile] = useState<VolunteerProfileResponse | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
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
      privacy: 'public',
    },
  });

  const loadProfileRequest = useCallback(async () => {
    const response = await requestServer<VolunteerProfileResponse>(
      '/volunteer/profile',
      { includeJwt: true },
    );
    setProfile(response);
    setSkills(response.skills);
    form.reset({
      first_name: response.volunteer.first_name,
      last_name: response.volunteer.last_name,
      date_of_birth: getDateInputValue(response.volunteer.date_of_birth),
      gender: response.volunteer.gender,
      description: response.volunteer.description ?? '',
      privacy: response.volunteer.privacy === 'private' ? 'private' : 'public',
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
      first_name: string;
      last_name: string;
      date_of_birth: string;
      gender: 'male' | 'female' | 'other';
      description: string;
      skills: string[];
      privacy: 'public' | 'private';
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

    const parsed = new Date(formValues.date_of_birth);
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

  const onSave = form.handleSubmit(async (data) => {
    if (!isEditMode || !profile) return;

    try {
      setSaving(true);

      const response = await updateProfile({
        first_name: data.first_name,
        last_name: data.last_name,
        date_of_birth: data.date_of_birth,
        gender: data.gender,
        description: data.description,
        skills,
        privacy: data.privacy,
      });

      setProfile(response);
      setSkills(response.skills);
      form.reset({
        first_name: response.volunteer.first_name,
        last_name: response.volunteer.last_name,
        date_of_birth: getDateInputValue(response.volunteer.date_of_birth),
        gender: response.volunteer.gender,
        description: response.volunteer.description ?? '',
        privacy: response.volunteer.privacy === 'private' ? 'private' : 'public',
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
      privacy: profile.volunteer.privacy === 'private' ? 'private' : 'public',
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
    <div className="grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <PageHeader
          title="Profile"
          subtitle="Manage your details, availability, and focus areas."
          actions={(
            <>
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

        <div className="mt-4">
          <ColumnLayout
            sidebar={(
              <div className="card bg-base-100 shadow-md mt-4">
                <div className="card-body">
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
                            <FormField form={form} name="first_name" label="First Name" />
                          </div>
                          <div className={saving ? 'pointer-events-none opacity-70' : ''}>
                            <FormField form={form} name="last_name" label="Last Name" />
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
                            <FormField
                              form={form}
                              name="date_of_birth"
                              label="Date of Birth"
                              type="date"
                              Icon={Calendar}
                            />
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
                    <label className="text-sm opacity-70 mb-2 block">Description</label>
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
                </div>
              </div>
            )}
          >
            <div className="card bg-base-100 shadow-md mt-4">
              <div className="card-body">
                <h5 className="font-bold text-lg">Skills</h5>
                <p className="text-sm opacity-70 mt-1">Add skills to highlight your expertise.</p>

                {isEditMode
                  ? (
                      <SkillsInput skills={skills} setSkills={setSkills} />
                    )
                  : (
                      <SkillsList skills={skills} enableLimit={false} />
                    )}
              </div>
            </div>

            <div className="card bg-base-100 shadow-md">
              <div className="card-body">
                <h5 className="font-bold text-lg">Previous Experiences</h5>
                <p className="text-sm opacity-70 mt-1">
                  This section will show your past volunteering experiences completed through the platform.
                </p>
                <Alert style="soft" className="mt-4">
                  No experiences to show yet.
                </Alert>
              </div>
            </div>

            <div className="card bg-base-100 shadow-md">
              <div className="card-body">
                <h5 className="font-bold text-lg">CV</h5>
                <p className="text-sm opacity-70 mt-1">
                  Upload your CV as a PDF with up to 3 pages.
                </p>

                <div className="mt-4 flex flex-col gap-3">
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
              </div>
            </div>

            <div className="card bg-base-100 shadow-md">
              <div className="card-body">
                <h5 className="font-bold text-lg">Privacy Setting</h5>
                <p className="text-sm opacity-70 mb-4">Profile visibility preference.</p>
                {isEditMode
                  ? (
                      <ToggleButton
                        form={form}
                        name="privacy"
                        label="Visibility"
                        disabled={saving}
                        options={[
                          {
                            value: 'public',
                            label: 'Public',
                            description: 'Your profile is public',
                            Icon: Globe,
                            btnColor: 'btn-primary',
                          },
                          {
                            value: 'private',
                            label: 'Private',
                            description: 'Your profile is private',
                            Icon: Lock,
                            btnColor: 'btn-secondary',
                          },
                        ]}
                      />
                    )
                  : (
                      <span
                        className={`badge gap-2 ${
                          formValues.privacy === 'private' ? 'badge-secondary' : 'badge-primary'
                        }`}
                      >
                        {formValues.privacy === 'private'
                          ? <Lock size={12} />
                          : <Globe size={12} />}
                        {formValues.privacy === 'private'
                          ? 'Private'
                          : 'Public'}
                      </span>
                    )}
              </div>
            </div>
          </ColumnLayout>
        </div>
      </div>
    </div>
  );
}
export default VolunteerProfile;
