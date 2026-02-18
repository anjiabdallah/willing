import { Plus, Send, X } from 'lucide-react';
import React, { useState, useCallback, useContext, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import AuthContext from '../../auth/AuthContext';
import LocationPicker from '../../components/LocationPicker';
import requestServer from '../../utils/requestServer';

import type { OrganizationAccountWithoutPassword } from '../../../../server/src/db/tables';

export default function OrganizationPosting() {
  const { restrictRoute } = useContext(AuthContext);
  const account = restrictRoute('organization', '/login') as OrganizationAccountWithoutPassword;
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [maxVolunteers, setMaxVolunteers] = useState('');
  const [minimumAge, setMinimumAge] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [position, setPosition] = useState<[number, number]>([33.90192863620578, 35.477959277880416]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (!locationName.trim() || locationName.trim().length < 2) {
      setError('Location name must be at least 2 characters');
      return;
    }
    if (!start) {
      setError('Start time is required');
      return;
    }

    const payload = {
      organization_id: account.id,
      title: title.trim(),
      description: description.trim(),
      location_name: locationName.trim(),
      latitude: position[0],
      longitude: position[1],
      start_timestamp: new Date(start).toISOString(),
      end_timestamp: end ? new Date(end).toISOString() : undefined,
      max_volunteers: maxVolunteers ? Number(maxVolunteers) : undefined,
      minimum_age: minimumAge ? Number(minimumAge) : undefined,
      is_open: isOpen,
      skills: skills.length > 0 ? skills : undefined,
    };

    setSubmitting(true);
    try {
      await requestServer<{ success: boolean; posting: unknown }>('/organization/posting', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      }, true);

      navigate('/organization');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create posting');
    } finally {
      setSubmitting(false);
    }
  }, [title, description, locationName, position, start, end, maxVolunteers, minimumAge, isOpen, skills, account.id, navigate]);

  return (
    <div className="flex-grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <h2 className="text-3xl font-extrabold tracking-tight mb-6">Create Organization Posting</h2>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
        )}

        <form className="space-y-4 bg-base-100 p-6 rounded-xl shadow" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="title" className="label">Title</label>
            <input
              id="title"
              className="input input-bordered w-full"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="label">Description</label>
            <textarea
              id="description"
              className="textarea textarea-bordered w-full"
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="location_name" className="label">Location Name</label>
            <input
              id="location_name"
              className="input input-bordered w-full"
              placeholder="e.g. Downtown Community Center"
              value={locationName}
              onChange={e => setLocationName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Pin Location on Map</label>
            <LocationPicker position={position} setPosition={setPosition} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="max_volunteers" className="label">Max Volunteers</label>
              <input
                id="max_volunteers"
                type="number"
                min={1}
                className="input input-bordered w-full"
                value={maxVolunteers}
                onChange={e => setMaxVolunteers(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="minimum_age" className="label">Minimum Age</label>
              <input
                id="minimum_age"
                type="number"
                min={0}
                className="input input-bordered w-full"
                value={minimumAge}
                onChange={e => setMinimumAge(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="start_timestamp" className="label">Start Time</label>
              <input
                id="start_timestamp"
                type="datetime-local"
                className="input input-bordered w-full"
                value={start}
                onChange={e => setStart(e.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="end_timestamp" className="label">End Time</label>
              <input
                id="end_timestamp"
                type="datetime-local"
                className="input input-bordered w-full"
                value={end}
                onChange={e => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Skills (optional)</label>
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
                checked={isOpen}
                onChange={e => setIsOpen(e.target.checked)}
              />
              <span>Open for volunteers</span>
            </label>
          </div>

          <button type="submit" className="btn btn-primary flex items-center gap-2" disabled={submitting}>
            {submitting ? <span className="loading loading-spinner loading-sm" /> : <Send size={18} />}
            {submitting ? 'Creating...' : 'Create Posting'}
          </button>
        </form>
      </div>
    </div>
  );
}
