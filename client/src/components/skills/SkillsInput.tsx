import { Plus, X } from 'lucide-react';
import { useState, useCallback } from 'react';

import SkillsList from './SkillsList';

interface SkillsInputProps {
  skills: string[];
  setSkills: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function SkillsInput({ skills, setSkills }: SkillsInputProps) {
  const [skillInput, setSkillInput] = useState('');

  const addSkill = useCallback(() => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills(prev => [...prev, trimmed]);
      setSkillInput('');
    }
  }, [skillInput, skills, setSkills]);

  const removeSkill = useCallback(
    (index: number) => {
      setSkills(prev => prev.filter((_, i) => i !== index));
    },
    [setSkills],
  );

  return (
    <fieldset className="fieldset w-full">
      <label className="label">
        <span className="label-text font-medium">Skills</span>
      </label>
      <div className="join w-full">
        <input
          className="input input-bordered join-item flex-grow"
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
        <button
          type="button"
          className="btn btn-square btn-primary join-item"
          onClick={addSkill}
        >
          <Plus size={20} />
        </button>
      </div>

      {skills.length === 0
        ? (
            <p className="text-xs italic text-base-content/60 mt-3">
              Add skills to help volunteers find your posting.
            </p>
          )
        : (
            <SkillsList
              skills={skills}
              action={({ index }) => (
                <button
                  type="button"
                  onClick={() => removeSkill(index)}
                  className="cursor-pointer hover:opacity-70"
                >
                  <X size={14} />
                </button>
              )}
              enableLimit={false}
            />
          )}
    </fieldset>
  );
}
