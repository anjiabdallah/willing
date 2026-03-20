import { zodResolver } from '@hookform/resolvers/zod';
import { Send, MapPin, Edit3, Users, ShieldCheck, LockOpen, Lock, Tag } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';

import PageHeader from '../../components/layout/PageHeader';
import Loading from '../../components/Loading';
import LocationPicker from '../../components/LocationPicker';
import SkillsInput from '../../components/skills/SkillsInput';
import { ToggleButton } from '../../components/ToggleButton';
import { organizationPostingFormSchema, type OrganizationPostingFormData } from '../../schemas/auth';
import { executeAndShowError, FormField, FormRootError } from '../../utils/formUtils';
import requestServer from '../../utils/requestServer';
import { useOrganization } from '../../utils/useUsers';

import type { OrganizationCrisesResponse, OrganizationPostingCreateResponse } from '../../../../server/src/api/types';

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

export default function OrganizationPostingCreate() {
  const account = useOrganization();
  const navigate = useNavigate();

  const form = useForm<OrganizationPostingFormData>({
    resolver: zodResolver(organizationPostingFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      automatic_acceptance: true,
    },
  });

  const [skills, setSkills] = useState<string[]>([]);
  const [selectedCrisisId, setSelectedCrisisId] = useState<number | undefined>(undefined);
  const [crises, setCrises] = useState<OrganizationCrisesResponse['crises']>([]);
  const [crisesError, setCrisesError] = useState<string | null>(null);
  const [loadingCrises, setLoadingCrises] = useState(true);
  const [position, setPosition] = useState<[number, number]>([33.90192863620578, 35.477959277880416]);
  const startTimestamp = useWatch({ control: form.control, name: 'start_timestamp' }) ?? '';
  const endTimestamp = useWatch({ control: form.control, name: 'end_timestamp' }) ?? '';
  const startDateTimeParts = splitDateTimeInput(startTimestamp);
  const endDateTimeParts = splitDateTimeInput(endTimestamp);

  useEffect(() => {
    const loadCrises = async () => {
      try {
        setLoadingCrises(true);
        setCrisesError(null);
        const response = await requestServer<OrganizationCrisesResponse>('/organization/crises', {
          includeJwt: true,
        });
        setCrises(response.crises);
      } catch (error) {
        setCrisesError(error instanceof Error ? error.message : 'Failed to load crisis tags');
      } finally {
        setLoadingCrises(false);
      }
    };

    loadCrises();
  }, []);

  const submit = form.handleSubmit(async (data) => {
    console.log('Form submitted with data:', data);
    await executeAndShowError(form, async () => {
      if (!account?.id) {
        throw new Error('Organization account not found. Please log in again.');
      }

      const payload = {
        title: data.title.trim(),
        description: data.description.trim(),
        location_name: data.location_name.trim(),
        latitude: position[0],
        longitude: position[1],
        start_date: data.start_timestamp.split('T')[0],
        start_time: data.start_timestamp.split('T')[1],
        end_date: data.end_timestamp ? data.end_timestamp.split('T')[0] : undefined,
        end_time: data.end_timestamp ? data.end_timestamp.split('T')[1] : undefined,
        max_volunteers: data.max_volunteers ? Number(data.max_volunteers) : undefined,
        minimum_age: data.minimum_age ? Number(data.minimum_age) : undefined,
        automatic_acceptance: data.automatic_acceptance,
        skills: skills.length > 0 ? skills : undefined,
        crisis_id: selectedCrisisId,
      };

      console.log('Submitting posting payload:', payload);

      const response = await requestServer<OrganizationPostingCreateResponse>('/organization/posting', {
        method: 'POST',
        body: payload,
        includeJwt: true,
      });

      console.log('Posting created successfully:', response);
      navigate('/organization');
    });
  });

  const onMapPositionPick = useCallback((coords: [number, number], name?: string) => {
    setPosition(coords);
    if (name && !form.getFieldState('location_name').isDirty) {
      form.setValue('location_name', name);
    }
  }, [form]);

  return (
    <div className="grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <PageHeader
          title="Create Posting"
          showBack
          defaultBackTo="/organization"
        />

        <div className="card bg-base-100 w-full shadow-2xl">
          <form
            className="card-body space-y-6"
            onSubmit={(e) => {
              console.log('Form onSubmit event fired, form errors:', form.formState.errors);
              submit(e);
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                label="Location Name"
                name="location_name"
                type="text"
                placeholder="e.g. Downtown Community Center"
                Icon={MapPin}
              />
            </div>

            <FormField
              form={form}
              label="Description"
              name="description"
              type="textarea"
              placeholder="Describe the opportunity"
            />

            <div className="space-y-4">

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
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
                  </div>

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

                  <SkillsInput skills={skills} setSkills={setSkills} />

                  <div className="rounded-box border border-base-300 bg-base-200/50 p-4">
                    <div className="mb-3">
                      <h4 className="font-semibold inline-flex items-center gap-2">
                        <Tag size={16} className="text-accent" />
                        Crisis Tag
                      </h4>
                      <p className="text-xs opacity-70 mt-1">Optional. Select a crisis tag for this posting. Pinned tags appear first.</p>
                    </div>

                    <select
                      className="select select-bordered w-full"
                      value={selectedCrisisId ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setSelectedCrisisId(value ? Number(value) : undefined);
                      }}
                      disabled={loadingCrises || form.formState.isSubmitting}
                    >
                      <option value="">No crisis tag</option>
                      {crises.map(crisis => (
                        <option key={crisis.id} value={crisis.id}>
                          {crisis.name}
                          {!crisis.pinned ? ' (Unpinned)' : ''}
                        </option>
                      ))}
                    </select>

                    {loadingCrises && <p className="text-xs opacity-70 mt-2">Loading crisis tags...</p>}
                    {crisesError && <p className="text-xs text-error mt-2">{crisesError}</p>}
                  </div>

                  <ToggleButton
                    form={form}
                    name="automatic_acceptance"
                    label="Posting Type"
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
                </div>

                <div className="lg:col-span-1 flex flex-col">
                  <fieldset className="fieldset h-full flex flex-col">
                    <label className="label">
                      <span className="label-text font-medium">Pin Location on Map</span>
                    </label>
                    <div className="grow min-h-[32rem]">
                      <LocationPicker
                        position={position}
                        setPosition={onMapPositionPick}
                        className="h-full"
                      />
                    </div>
                  </fieldset>
                </div>
              </div>
            </div>

            <FormRootError form={form} />

            <button
              type="submit"
              className="btn btn-primary flex items-center gap-2 mt-6"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? <Loading />
                : (
                    <>
                      <Send size={18} />
                      Create Posting
                    </>
                  )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
