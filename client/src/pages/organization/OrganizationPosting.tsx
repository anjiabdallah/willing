import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Send, X, MapPin, Edit3, Users, ShieldCheck } from 'lucide-react';
import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import Loading from '../../components/Loading';
import LocationPicker from '../../components/LocationPicker';
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
  const [skillInput, setSkillInput] = useState('');
  const [position, setPosition] = useState<[number, number]>([33.90192863620578, 35.477959277880416]);

  const addSkill = useCallback(() => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills(prev => [...prev, trimmed]);
      setSkillInput('');
    }
  }, [skillInput, skills]);

  const removeSkill = useCallback((skill: string) => {
    setSkills(prev => prev.filter(s => s !== skill));
  }, []);

  const submit = form.handleSubmit(async (data) => {
    await executeAndShowError(form, async () => {
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

      await requestServer<{ success: boolean; posting: unknown }>('/organization/posting', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      }, true);

      navigate('/organization');
    });
  });

  return (
    <div className="flex-grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <h2 className="text-3xl font-extrabold tracking-tight mb-6">Create Posting</h2>

        <div className="card bg-base-100 w-full shadow-2xl">
          <form className="card-body space-y-4" onSubmit={submit}>
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

            <div>
              <label className="label">
                <span className="label-text font-medium">Pin Location on Map</span>
              </label>
              <LocationPicker position={position} setPosition={setPosition} />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                label="Minimum Age"
                name="minimum_age"
                type="number"
                placeholder="Optional"
                Icon={ShieldCheck}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                form={form}
                label="Start Time"
                name="start_timestamp"
                type="datetime-local"
              />

              <FormField
                form={form}
                label="End Time"
                name="end_timestamp"
                type="datetime-local"
              />
            </div>

            <div>
              <label className="label">
                <span className="label-text font-medium">Skills (optional)</span>
              </label>
              <div className="flex gap-2">
                <input
                  className="input input-bordered flex-1"
                  placeholder="e.g. First Aid"
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                />
                <button type="button" className="btn btn-outline self-center" onClick={addSkill}>
                  <Plus size={16} />
                  {' '}
                  Add
                </button>
              </div>
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {skills.map(skill => (
                    <span key={skill} className="badge badge-primary gap-1">
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} className="cursor-pointer">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  {...form.register('is_open')}
                />
                <span>Open for volunteers</span>
              </label>
            </div>

            <FormRootError form={form} />

            <button
              type="submit"
              className="btn btn-primary flex items-center gap-2 mt-4"
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
