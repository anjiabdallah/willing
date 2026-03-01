import { Eye } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PostingCard from '../../components/PostingCard';
import requestServer from '../../utils/requestServer';

import type { OrganizationPosting, PostingSkill } from '../../../../server/src/db/tables';

type PostingWithOrganization = OrganizationPosting & {
  organization_name: string;
  skills: PostingSkill[];
};

interface GetPostingsResponse {
  postings: PostingWithOrganization[];
}

function VolunteerHome() {
  const navigate = useNavigate();
  const [postings, setPostings] = useState<PostingWithOrganization[]>([]);
  const [filters, setFilters] = useState({
    location: '',
    skill: '',
    startDate: '',
    endDate: '',
  });

  const fetchPostings = useCallback(async () => {
    const query = new URLSearchParams();

    if (filters.location)
      query.append('location_name', filters.location);

    if (filters.skill)
      query.append('skill', filters.skill);

    if (filters.startDate)
      query.append('start_timestamp', filters.startDate);

    if (filters.endDate)
      query.append('end_timestamp', filters.endDate);

    const url = '/volunteer/posting?' + query.toString();

    const res = await requestServer<GetPostingsResponse>(url, {}, true);

    setPostings(res.postings);
  }, [filters]);

  useEffect(() => {
    fetchPostings();
    // run once on mount; filters are applied via the button
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <h3 className="text-3xl font-extrabold tracking-tight mb-6">
          Volunteer Home
        </h3>

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
          <button
            className="btn btn-sm btn-primary"
            disabled={!filters.location && !filters.skill && !filters.startDate && !filters.endDate}
            onClick={fetchPostings}
          >
            Apply Filters
          </button>
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
