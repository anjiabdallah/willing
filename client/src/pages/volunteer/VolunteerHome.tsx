import { Search, TextSearch } from 'lucide-react';
import { useEffect, useState } from 'react';

import CalendarInfo from '../../components/CalendarInfo.tsx';
import PageHeader from '../../components/layout/PageHeader';
import PostingCard from '../../components/PostingCard';
import requestServer from '../../utils/requestServer';

import type { VolunteerPostingSearchResponse } from '../../../../server/src/api/types';
import type { PostingWithSkillsAndOrgName } from '../../../../server/src/types';

function VolunteerHome() {
  const [postings, setPostings] = useState<PostingWithSkillsAndOrgName[]>([]);
  const [filters, setFilters] = useState<{
    search: string;
    startDate: string;
    endDate: string;
  }>({
    search: '',
    startDate: '',
    endDate: '',
  });

  const fetchPostings = async (useFilters?: typeof filters) => {
    const f = useFilters ?? filters;
    const query = new URLSearchParams();

    if (f.startDate)
      query.append('start_timestamp', f.startDate);
    if (f.endDate)
      query.append('end_timestamp', f.endDate);

    const url = '/volunteer/posting?' + query.toString();

    const res = await requestServer<VolunteerPostingSearchResponse>(url, { includeJwt: true });

    const normalizedSearch = f.search.trim().toLowerCase();
    if (!normalizedSearch) {
      setPostings(res.postings);
      return;
    }

    const andParts = normalizedSearch
      .split(/\s+and\s+/i)
      .map(part => part.trim())
      .filter(Boolean);
    const orParts = normalizedSearch
      .split(/\s+or\s+/i)
      .map(part => part.trim())
      .filter(Boolean);

    const terms = andParts.length > 1
      ? andParts
      : orParts.length > 1
        ? orParts
        : [normalizedSearch];

    const useAndMode = andParts.length > 1;

    const filtered = res.postings.filter((posting) => {
      const locationText = posting.location_name.toLowerCase();
      const skillTexts = posting.skills.map((skill: { name: string }) => skill.name.toLowerCase());

      const matchesTerm = (term: string) => {
        const locationMatch = locationText.includes(term);
        const skillMatch = skillTexts.some((skill: string) => skill.includes(term));
        return locationMatch || skillMatch;
      };

      return useAndMode
        ? terms.every(matchesTerm)
        : terms.some(matchesTerm);
    });

    setPostings(filtered);
  };

  useEffect(() => {
    fetchPostings();
  }, []);

  const resetFilters = () => {
    const reset = { search: '', startDate: '', endDate: '' };
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
        />

        <div className="mb-4">
          <h4 className="text-lg font-semibold mb-2">Filter</h4>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void fetchPostings();
            }}
          >
            <div className="flex flex-wrap gap-4 mb-2">
              <label className="input input-bordered flex items-center gap-2 w-full md:w-96">
                <Search className="h-4 w-4 opacity-70" />
                <input
                  type="text"
                  className="grow"
                  placeholder="Search by location or skill (use AND / OR)"
                  value={filters.search}
                  onChange={e => setFilters({ ...filters, search: e.target.value })}
                />
              </label>

              <CalendarInfo
                startValue={filters.startDate}
                endValue={filters.endDate}
                onStartChange={(value: string) => setFilters({ ...filters, startDate: value })}
                onEndChange={(value: string) => setFilters({ ...filters, endDate: value })}
                inputType="date"
                startPlaceholder="Start Date"
                endPlaceholder="End Date"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={!filters.search && !filters.startDate && !filters.endDate}
              >
                Apply Filters
              </button>

              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={!filters.search && !filters.startDate && !filters.endDate}
                onClick={resetFilters}
              >
                Reset Filters
              </button>
            </div>
          </form>
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
                    organization={{
                      name: posting.organization_name,
                      id: posting.organization_id,
                    }}
                  />
                ))}
              </div>
            )}
      </div>
    </div>
  );
}

export default VolunteerHome;
