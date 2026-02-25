import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

interface SkillsListProps {
  skills: string[] | { name: string }[];
  action?: React.ComponentType<{ skill: string; index: number }>;
  enableLimit?: boolean;
  limit?: number;
}

const SKILL_COLORS = ['badge-primary', 'badge-secondary', 'badge-accent', 'badge-info'];
const getSkillColor = (_skill: string, index: number) => {
  return SKILL_COLORS[index % SKILL_COLORS.length];
};

export default function SkillsList({ skills, action: Action, enableLimit = true, limit = 5 }: SkillsListProps) {
  const [expanded, setExpanded] = useState(false);
  const displayedSkills = useMemo(() => {
    if (!enableLimit) return skills.map(s => typeof s === 'string' ? s : s.name);
    return skills.map(s => typeof s === 'string' ? s : s.name).slice(0, expanded ? skills.length : limit);
  }, [skills, enableLimit, limit, expanded]);

  if (skills.length === 0) {
    return (
      <p className="text-xs italic text-base-content/60 mt-3">
        Add skills to help volunteers find your posting.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {displayedSkills.map((skill, index) => (
        <span
          key={skill}
          className={`badge gap-1 text-white font-medium text-xs ${getSkillColor(skill, index)}`}
        >
          {skill}
          {Action && <Action skill={skill} index={index} />}
        </span>
      ))}
      {enableLimit && skills.length > limit && (

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="badge gap-1 text-xs font-semibold text-base-content transition-all duration-300 cursor-pointer"
        >
          {expanded
            ? (
                <>
                  Show Less
                  <ChevronLeft size={12} strokeWidth={3} />
                </>
              )
            : (
                <>
                  {skills.length - limit}
                  {' '}
                  more
                  <ChevronRight size={12} strokeWidth={3} />
                </>
              )}
        </button>
      )}
    </div>
  );
}
