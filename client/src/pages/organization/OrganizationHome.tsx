import { Plus, MapPin, Calendar, Users, Cake, Edit, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import requestServer from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type { OrganizationPosting, PostingSkill } from '../../../../server/src/db/tables';

const SKILL_COLORS = ['badge-primary', 'badge-secondary', 'badge-accent', 'badge-info'];

type PostingWithSkills = OrganizationPosting & { skills: PostingSkill[] };

function OrganizationHome() {
  const navigate = useNavigate();
  const [expandedSkills, setExpandedSkills] = useState<Record<string, boolean>>({});

  const { data: postings, loading, error } = useAsync(
    async () => {
      const response = await requestServer<{ posting: PostingWithSkills[] }>(
        '/organization/posting',
        { method: 'GET' },
        true,
      );
      return response.posting;
    },
    true,
  );

  return (
    <div className="grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <h3 className="text-3xl font-extrabold tracking-tight mb-6">
          Organization Home
        </h3>

        <button
          className="btn btn-primary mb-6"
          onClick={() => navigate('posting')}
        >
          <Plus className="w-4 h-4" />
          Create New Posting
        </button>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error.message}</span>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        )}

        {!loading && (!postings || postings.length === 0) && (
          <div className="alert">
            <span>No postings yet. Create your first posting to get started!</span>
          </div>
        )}

        {!loading && postings && postings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {postings.map(posting => (
              <div key={posting.id} className="card bg-base-100 shadow-md border border-base-200 hover:shadow-lg transition-shadow">
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
                              <div className="w-0.5 h-6 bg-primary my-0.5"></div>
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
                        {posting.skills.length > 3 && (
                          <div className="flex items-center gap-2">
                            {!expandedSkills[posting.id] && (
                              <span className="text-xs font-semibold text-primary">
                                {posting.skills.length - 3}
                              </span>
                            )}
                            <button
                              onClick={() => setExpandedSkills(prev => ({
                                ...prev,
                                [posting.id]: !prev[posting.id],
                              }))}
                              className="text-primary hover:opacity-70 flex-shrink-0 cursor-pointer"
                            >
                              {expandedSkills[posting.id]
                                ? <ChevronUp size={16} />
                                : <ChevronDown size={16} />}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        {(expandedSkills[posting.id] ? posting.skills : posting.skills.slice(0, 3)).map((skill, index) => (
                          <span key={skill.id} className={`badge gap-1 text-white font-medium ${SKILL_COLORS[index % SKILL_COLORS.length]} badge-sm`}>
                            {skill.name}
                          </span>
                        ))}
                        {!expandedSkills[posting.id] && posting.skills.length > 3 && (
                          <span className="text-xs opacity-70 font-semibold">...</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="card-actions pt-4 border-t border-base-200">
                    <button className="btn btn-sm btn-outline flex-1 gap-1">
                      <Edit size={14} />
                      Edit
                    </button>
                    <button className="btn btn-sm btn-outline btn-error flex-1 gap-1">
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OrganizationHome;
