import { Calendar, Cake, MapPin, Users } from 'lucide-react';

import SkillsList from './SkillsList';

import type { OrganizationPosting, PostingSkill } from '../../../server/src/db/tables';
import type { ReactNode } from 'react';

interface PostingCardProps {
  posting: OrganizationPosting & { skills: PostingSkill[] };
  footer?: ReactNode;
}

function PostingCard({ posting, footer }: PostingCardProps) {
  return (
    <div className="card bg-base-100 shadow-md border border-base-200 hover:shadow-lg transition-shadow">
      <div className="card-body">
        <h2 className="card-title text-primary text-lg mb-2">{posting.title}</h2>
        <p className="text-sm opacity-80 mb-4 line-clamp-2">{posting.description}</p>

        <div className="space-y-3 text-sm mb-4">
          <p className="flex items-center gap-2">
            <MapPin size={16} className="text-primary flex-shrink-0" />
            <span>{posting.location_name}</span>
          </p>

          {posting.end_timestamp
            ? (
                <div className="flex gap-3 items-start">
                  <div className="flex flex-col items-center flex-shrink-0 mt-1">
                    <Calendar size={16} className="text-primary flex-shrink-0" />
                    <div className="w-0.5 h-6 bg-primary my-0.5" />
                    <Calendar size={16} className="text-primary flex-shrink-0" />
                  </div>
                  <div className="flex flex-col gap-1 flex-grow">
                    <div>
                      <p className="text-xs opacity-70 font-semibold">START</p>
                      <span className="text-xs">
                        {new Date(posting.start_timestamp).toLocaleDateString()}
                        {' '}
                        {new Date(posting.start_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs opacity-70 font-semibold">END</p>
                      <span className="text-xs">
                        {new Date(posting.end_timestamp).toLocaleDateString()}
                        {' '}
                        {new Date(posting.end_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            : (
                <p className="flex items-center gap-2">
                  <Calendar size={16} className="text-primary flex-shrink-0" />
                  <div>
                    <p className="text-xs opacity-70 font-semibold">START</p>
                    <span className="text-xs">
                      {new Date(posting.start_timestamp).toLocaleDateString()}
                      {' '}
                      {new Date(posting.start_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </p>
              )}

          <div className="flex gap-3">
            {posting.max_volunteers && (
              <p className="flex items-center gap-1">
                <Users size={16} className="text-primary flex-shrink-0" />
                <span>
                  0/
                  {posting.max_volunteers}
                </span>
              </p>
            )}
            {posting.minimum_age && (
              <p className="flex items-center gap-1">
                <Cake size={16} className="text-primary flex-shrink-0" />
                <span>
                  {posting.minimum_age}
                  +
                </span>
              </p>
            )}
          </div>
        </div>

        {posting.skills && posting.skills.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold opacity-70">REQUIRED SKILLS</p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <SkillsList skills={posting.skills} />
            </div>
          </div>
        )}

        {footer && (
          <div className="pt-4 border-t border-base-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default PostingCard;
