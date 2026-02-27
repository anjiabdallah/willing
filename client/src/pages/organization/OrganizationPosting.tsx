import { zodResolver } from '@hookform/resolvers/zod';
import { Send, MapPin, Edit3, Users, ShieldCheck, LockOpen, Lock } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';

import Loading from '../../components/Loading';
import LocationPicker from '../../components/LocationPicker';
import SkillsInput from '../../components/SkillsInput';
import { organizationPostingFormSchema, type OrganizationPostingFormData } from '../../schemas/auth';
import { executeAndShowError, FormField, FormRootError } from '../../utils/formUtils';
import requestServer from '../../utils/requestServer';
import { useOrganization } from '../../utils/useUsers';

export default function OrganizationPosting() {
  const account = useOrganization();
  const navigate = useNavigate();

  const form = useForm<OrganizationPostingFormData>({
    resolver: zodResolver(organizationPostingFormSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      is_open: true,
    },
  });

  const [skills, setSkills] = useState<string[]>([]);
  const [position, setPosition] = useState<[number, number]>([33.90192863620578, 35.477959277880416]);
  const isOpen = useWatch({
    control: form.control,
    name: 'is_open',
    defaultValue: true,
  });

  const submit = form.handleSubmit(async (data) => {
    await executeAndShowError(form, async () => {
      if (!account?.id) {
        throw new Error('Organization account not found. Please log in again.');
      }

      const payload = {
        organization_id: account.id,
        title: data.title.trim(),
        description: data.description.trim(),
        location_name: data.location_name.trim(),
        latitude: position[0],
        longitude: position[1],
        start_timestamp: new Date(data.start_timestamp).toISOString(),
        end_timestamp: data.end_timestamp ? new Date(data.end_timestamp).toISOString() : undefined,
        max_volunteers: data.max_volunteers ? Number(data.max_volunteers) : undefined,
        minimum_age: data.minimum_age ? Number(data.minimum_age) : undefined,
        is_open: data.is_open,
        skills: skills.length > 0 ? skills : undefined,
      };

      console.log('Submitting posting payload:', payload);

      const response = await requestServer<{ success: boolean; posting: unknown }>('/organization/posting', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      }, true);

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
        <h2 className="text-3xl font-extrabold tracking-tight mb-6">Create Posting</h2>

        <div className="card bg-base-100 w-full shadow-2xl">
          <form className="card-body space-y-6" onSubmit={submit}>
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      form={form}
                      label="Start Date"
                      name="start_timestamp"
                      type="datetime-local"
                    />

                    <FormField
                      form={form}
                      label="End Date"
                      name="end_timestamp"
                      type="datetime-local"
                    />
                  </div>

                  <SkillsInput skills={skills} setSkills={setSkills} />

                  <fieldset className="fieldset">
                    <label className="label">
                      <span className="label-text font-medium">Posting Type</span>
                    </label>

                    <div className="join w-full">
                      <button
                        type="button"
                        className={`btn join-item h-auto flex-1 flex-col items-start gap-1 p-4 text-left normal-case ${isOpen ? 'btn-primary' : 'bg-base-200 border-base-300'
                        }`}
                        onClick={() => form.setValue('is_open', true, { shouldDirty: true, shouldTouch: true })}
                      >
                        <div className="flex items-center gap-2 font-bold">
                          <LockOpen size={16} />
                          <span>Open Posting</span>
                        </div>
                        <p className={`text-xs font-normal leading-tight ${isOpen ? 'text-primary-content/80' : 'text-base-content/60'}`}>
                          Volunteers are accepted automatically.
                        </p>
                      </button>

                      <button
                        type="button"
                        className={`btn join-item h-auto flex-1 flex-col items-start gap-1 p-4 text-left normal-case ${!isOpen ? 'btn-secondary' : 'bg-base-200 border-base-300'
                        }`}
                        onClick={() => form.setValue('is_open', false, { shouldDirty: true, shouldTouch: true })}
                      >
                        <div className="flex items-center gap-2 font-bold">
                          <Lock size={16} />
                          <span>Review-Based</span>
                        </div>
                        <p className={`text-xs font-normal leading-tight ${!isOpen ? 'text-secondary-content/80' : 'text-base-content/60'}`}>
                          Volunteers must be approved by the organization.
                        </p>
                      </button>
                    </div>
                  </fieldset>
                </div>

                <div className="lg:col-span-1">
                  <fieldset className="fieldset">
                    <label className="label">
                      <span className="label-text font-medium">Pin Location on Map</span>
                    </label>
                    <LocationPicker position={position} setPosition={onMapPositionPick} />
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
