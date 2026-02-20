import { zodResolver } from '@hookform/resolvers/zod';
import {
  Calendar,
  Globe,
  Lock,
  Mail,
  Mars,
  Plus,
  Venus,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import Loading from '../../components/Loading';
import { FormField } from '../../utils/formUtils';
import requestServer from '../../utils/requestServer';
import { volunteerAccountSchema } from '../../../../server/src/db/tables';

const volunteerProfileUserSchema = volunteerAccountSchema.omit({ password: true });

type VolunteerProfileResponse = {
  volunteer: z.infer<typeof volunteerProfileUserSchema>;
  skills: string[];
};

const DESCRIPTION_MAX_LENGTH = 300;
const SKILL_BADGE_STYLES = [
  'badge-primary',
  'badge-secondary',
  'badge-accent',
  'badge-info',
] as const;

const profileFormSchema = volunteerAccountSchema.omit({ id: true, password: true })
  .extend({
    description: z.string().max(DESCRIPTION_MAX_LENGTH, `Description must be at most ${DESCRIPTION_MAX_LENGTH} characters`),
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
  const [skillInput, setSkillInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaveMessageVisible, setIsSaveMessageVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    mode: 'onTouched',
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      date_of_birth: '',
      gender: 'male',
      description: '',
      privacy: 'public',
    },
  });

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const response = await requestServer<VolunteerProfileResponse>('/volunteer/profile', {}, true);
      setProfile(response);
      setSkills(response.skills);
      setSkillInput('');
      form.reset({
        first_name: response.volunteer.first_name,
        last_name: response.volunteer.last_name,
        email: response.volunteer.email,
        date_of_birth: getDateInputValue(response.volunteer.date_of_birth),
        gender: response.volunteer.gender,
        description: response.volunteer.description ?? '',
        privacy: response.volunteer.privacy === 'private' ? 'private' : 'public',
      });
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!saveMessage) return;
    setIsSaveMessageVisible(true);

    const fadeTimeout = setTimeout(() => {
      setIsSaveMessageVisible(false);
    }, 2400);

    const removeTimeout = setTimeout(() => {
      setSaveMessage(null);
    }, 3000);

    return () => {
      clearTimeout(fadeTimeout);
      clearTimeout(removeTimeout);
    };
  }, [saveMessage]);

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

  const addSkill = useCallback(() => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;

    const exists = skills.some(skill => skill.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      setSkills(prev => [...prev, trimmed]);
      setSaveError(null);
      setSaveMessage(null);
    }

    setSkillInput('');
  }, [skillInput, skills]);

  const removeSkill = useCallback((skillToRemove: string) => {
    setSkills(prev => prev.filter(skill => skill !== skillToRemove));
    setSaveError(null);
    setSaveMessage(null);
  }, []);

  const onSave = form.handleSubmit(async (data) => {
    if (!isEditMode || !profile) return;

    try {
      setSaving(true);
      setSaveError(null);
      setSaveMessage(null);

      const response = await requestServer<VolunteerProfileResponse>(
        '/volunteer/profile',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            date_of_birth: data.date_of_birth,
            gender: data.gender,
            description: data.description,
            skills,
            privacy: data.privacy,
          }),
        },
        true,
      );

      setProfile(response);
      setSkills(response.skills);
      setSkillInput('');
      form.reset({
        first_name: response.volunteer.first_name,
        last_name: response.volunteer.last_name,
        email: response.volunteer.email,
        date_of_birth: getDateInputValue(response.volunteer.date_of_birth),
        gender: response.volunteer.gender,
        description: response.volunteer.description ?? '',
        privacy: response.volunteer.privacy === 'private' ? 'private' : 'public',
      });
      setSaveMessage('Profile changes saved.');
      setIsEditMode(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  });

  const onCancelEdit = useCallback(() => {
    if (!profile) return;
    form.reset({
      first_name: profile.volunteer.first_name,
      last_name: profile.volunteer.last_name,
      email: profile.volunteer.email,
      date_of_birth: getDateInputValue(profile.volunteer.date_of_birth),
      gender: profile.volunteer.gender,
      description: profile.volunteer.description ?? '',
      privacy: profile.volunteer.privacy === 'private' ? 'private' : 'public',
    });
    setSkills(profile.skills);
    setSkillInput('');
    setIsEditMode(false);
    setSaveError(null);
    setSaveMessage(null);
  }, [form, profile]);

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
          <div role="alert" className="alert alert-error">
            <span>{fetchError}</span>
          </div>
          <button className="btn btn-outline mt-4" onClick={loadProfile}>Retry</button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="grow bg-base-200">
        <div className="p-6 md:container mx-auto">
          <div role="alert" className="alert alert-warning">
            <span>Profile not found.</span>
          </div>
        </div>
      </div>
    );
  }

  const avatarUrl = '';

  return (
    <div className="grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-3xl font-extrabold tracking-tight">Volunteer Profile</h3>
            <p className="opacity-70 mt-1">Manage your details, availability, and focus areas.</p>
          </div>
          <div className="flex gap-2">
            {
              isEditMode
                ? (
                    <button className="btn btn-outline" onClick={onCancelEdit} disabled={saving}>
                      Cancel
                    </button>
                  )
                : (
                    <button className="btn btn-outline" onClick={() => setIsEditMode(true)}>
                      Edit Profile
                    </button>
                  )
            }
            {isEditMode && (
              <button className="btn btn-primary" onClick={onSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

        {saveMessage && (
          <div
            role="alert"
            className={`alert alert-success mt-4 transition-all duration-500 ${
              isSaveMessageVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-1'
            }`}
          >
            <span>{saveMessage}</span>
          </div>
        )}

        {saveError && (
          <div role="alert" className="alert alert-error mt-4">
            <span>{saveError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="card bg-base-100 shadow-md">
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
                          <FormField form={form} name="email" label="Email" type="email" Icon={Mail} />
                        </div>
                        <div className={saving ? 'pointer-events-none opacity-70' : ''}>
                          <FormField form={form} name="date_of_birth" label="Date of Birth" type="date" Icon={Calendar} />
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
                          <span className="font-medium text-right break-all">{formValues.email}</span>
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
                          <p className={`block min-h-5 text-xs mt-1 ${form.formState.errors.description ? 'text-error' : 'invisible'}`}>
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
                        <p className="text-sm opacity-80 whitespace-pre-wrap break-words">
                          {formValues.description || 'No description added yet.'}
                        </p>
                      )}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="card bg-base-100 shadow-md">
              <div className="card-body">
                <h5 className="font-bold text-lg">Skills</h5>
                <p className="text-sm opacity-70 mt-1">Add one skill at a time.</p>

                {isEditMode && (
                  <div className="join mt-3 w-full">
                    <input
                      className="input input-bordered join-item w-full"
                      value={skillInput}
                      onChange={e => setSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addSkill();
                        }
                      }}
                      placeholder="Type a skill"
                      disabled={saving}
                    />
                    <button className="btn btn-primary join-item" type="button" onClick={addSkill} disabled={saving || !skillInput.trim()}>
                      <Plus size={16} />
                      Add
                    </button>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {skills.length > 0
                    ? skills.map((skill, index) => (
                        <span key={skill} className={`badge gap-1 ${SKILL_BADGE_STYLES[index % SKILL_BADGE_STYLES.length]}`}>
                          {skill}
                          {isEditMode && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs p-0 h-auto min-h-0"
                              onClick={() => removeSkill(skill)}
                              disabled={saving}
                              aria-label={`Remove ${skill}`}
                            >
                              <X size={12} />
                            </button>
                          )}
                        </span>
                      ))
                    : <span className="text-sm opacity-60">No skills added yet.</span>}
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-md">
              <div className="card-body">
                <h5 className="font-bold text-lg">Previous Experiences</h5>
                <p className="text-sm opacity-70 mt-1">
                  This section will show your past volunteering experiences completed through the platform.
                </p>
                <div className="alert alert-soft mt-4">
                  <span className="text-sm">No experiences to show yet.</span>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-md">
              <div className="card-body">
                <h5 className="font-bold text-lg">Privacy Setting</h5>
                <p className="text-sm opacity-70 mb-2">Profile visibility preference.</p>
                {isEditMode
                  ? (
                      <div className="join">
                        <button
                          type="button"
                          className={`btn btn-sm join-item gap-2 ${formValues.privacy === 'public' ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => form.setValue('privacy', 'public', { shouldDirty: true, shouldTouch: true })}
                          disabled={saving}
                        >
                          <Globe size={14} />
                          Public
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm join-item gap-2 ${formValues.privacy === 'private' ? 'btn-secondary' : 'btn-outline'}`}
                          onClick={() => form.setValue('privacy', 'private', { shouldDirty: true, shouldTouch: true })}
                          disabled={saving}
                        >
                          <Lock size={14} />
                          Private
                        </button>
                      </div>
                    )
                  : (
                      <span className={`badge gap-2 ${formValues.privacy === 'private' ? 'badge-secondary' : 'badge-primary'}`}>
                        {formValues.privacy === 'private' ? <Lock size={12} /> : <Globe size={12} />}
                        {formValues.privacy === 'private' ? 'Private' : 'Public'}
                      </span>
                    )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VolunteerProfile;
