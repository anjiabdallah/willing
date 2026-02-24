import { useCallback, useEffect, useState } from 'react';

import SkillsList from '../../components/SkillsList';
import requestServer from '../../utils/requestServer';

interface postingType {
  id: number;
  organization_id: number;
  title: string;
  description: string;
  location_name: string;
  start_timestamp: Date;
  end_timestamp: Date | null;
  is_open: boolean;
  organization_name: string;
  skills: { name: string }[];
}

interface getPostingsResponse {
  postings: postingType[];
}

interface Posting {
  id: number;
  title: string;
  description: string;
  location_name?: string;
  start_timestamp: string;
  end_timestamp?: string;
  skills: { name: string }[];
}

function VolunteerHome() {
  const [postings, setPostings] = useState<Posting[]>([]);
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

    const res = await requestServer<getPostingsResponse>(url, {}, true);

    const formattedPostings: Posting[] = res.postings.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      location_name: p.location_name,
      start_timestamp: new Date(p.start_timestamp).toISOString(),
      end_timestamp: p.end_timestamp
        ? new Date(p.end_timestamp).toISOString()
        : undefined,
      skills: p.skills,
    }));

    setPostings(formattedPostings);
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
                  <div
                    key={posting.id}
                    className="bg-base-100 shadow-md rounded-lg p-4 border border-base-300"
                  >
                    <h4 className="text-xl font-bold mb-2">{posting.title}</h4>
                    <p className="text-base mb-2">{posting.description}</p>

                    <p className="text-sm text-gray-500 mb-1">
                      Location:
                      {' '}
                      {posting.location_name || 'N/A'}
                    </p>

                    <p className="text-sm text-gray-500 mb-1">
                      Start:
                      {' '}
                      {new Date(posting.start_timestamp).toLocaleString()}
                    </p>

                    {posting.end_timestamp && (
                      <p className="text-sm text-gray-500 mb-1">
                        End:
                        {' '}
                        {new Date(posting.end_timestamp).toLocaleString()}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 mt-2">
                      <SkillsList skills={posting.skills} />
                    </div>
                  </div>
                ))}
              </div>
            )}
      </div>
    </div>
  );
}

export default VolunteerHome;
