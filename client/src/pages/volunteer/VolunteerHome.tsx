import { Eye, TextSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PageHeader from '../../components/PageHeader';
import PostingCard from '../../components/PostingCard';
import requestServer from '../../utils/requestServer';

import type { VolunteerPostingSearchResponse } from '../../../../server/src/api/types';
import type { PostingWithSkillsAndOrgName } from '../../../../server/src/types';

function VolunteerHome() {
  const navigate = useNavigate();
  const [postings, setPostings] = useState<PostingWithSkillsAndOrgName[]>([]);
  const [filters, setFilters] = useState<{
    location: string;
    skill: string;
    startDate: string;
    endDate: string;
  }>({
    location: '',
    skill: '',
    startDate: '',
    endDate: '',
  });

  const fetchPostings = async (useFilters?: typeof filters) => {
    const f = useFilters ?? filters;
    const query = new URLSearchParams();

    if (f.location)
      query.append('location_name', f.location);
    if (f.skill)
      query.append('skill', f.skill);
    if (f.startDate)
      query.append('start_timestamp', f.startDate);
    if (f.endDate)
      query.append('end_timestamp', f.endDate);

    const url = '/volunteer/posting?' + query.toString();

    const res = await requestServer<VolunteerPostingSearchResponse>(url, { includeJwt: true });

    setPostings(res.postings);
  };

  useEffect(() => {
    fetchPostings();
  }, []);

  const resetFilters = () => {
    const reset = { location: '', skill: '', startDate: '', endDate: '' };
    setFilters(reset);
    fetchPostings(reset);
  };

  return (
    <div className="grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <PageHeader
          title="Find Opportunities"
          subtitle="Browse postings and apply to opportunities that match your interests."
          icon={TextSearch}
          badge={
            postings && (
              <div className="badge badge-primary">
                {postings.length}
                {' '}
                {postings.length === 1 ? 'Opportunity' : 'Opportunities'}
              </div>
            )
          }
        />

        <div className="mb-4">
          <h4 className="text-lg font-semibold mb-2">Filter</h4>
          <div className="flex flex-wrap gap-4 mb-2">
            <input
              type="text"
              placeholder="Location"
              value={filters.location}
              onChange={e => setFilters({ ...filters, location: e.target.value })}
              className="input input-bordered"
            />
            <input
              type="text"
              placeholder="Skill"
              value={filters.skill}
              onChange={e => setFilters({ ...filters, skill: e.target.value })}
              className="input input-bordered"
            />
            <input
              type="date"
              placeholder="Start Date"
              value={filters.startDate}
              onChange={e => setFilters({ ...filters, startDate: e.target.value })}
              className="input input-bordered"
            />
            <input
              type="date"
              placeholder="End Date"
              value={filters.endDate}
              onChange={e => setFilters({ ...filters, endDate: e.target.value })}
              className="input input-bordered"
            />
          </div>
          <div className="flex gap-3">
            <button
              className="btn btn-sm btn-primary"
              disabled={!filters.location && !filters.skill && !filters.startDate && !filters.endDate}
              onClick={() => void fetchPostings()}
            >
              Apply Filters
            </button>

            <button
              className="btn btn-sm btn-ghost"
              disabled={!filters.location && !filters.skill && !filters.startDate && !filters.endDate}
              onClick={resetFilters}
            >
              Reset Filters
            </button>
          </div>
        </div>

        {postings.length === 0
          ? (
              <p>No postings found yet</p>
            )
          : (
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
                {postings.map(posting => (
                  <PostingCard
                    key={posting.id}
                    posting={posting}
                    footer={(
                      <div className="card-actions gap-2">
                        <button
                          className="btn btn-sm w-full gap-2"
                          onClick={() => navigate(`/volunteer/posting/${posting.id}`)}
                        >
                          <Eye size={16} />
                          <span>View Details</span>
                        </button>
                      </div>
                    )}
                  />
                ))}
              </div>
            )}
      </div>
    </div>
  );
}

export default VolunteerHome;
