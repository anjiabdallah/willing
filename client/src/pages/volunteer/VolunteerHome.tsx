import { useCallback, useEffect, useState } from 'react';

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
              <div className="grid md:grid-cols-2 gap-6">
                {postings.map(posting => (
                  <PostingCard posting={posting} />
                ))}
              </div>
            )}
      </div>
    </div>
  );
}

export default VolunteerHome;
