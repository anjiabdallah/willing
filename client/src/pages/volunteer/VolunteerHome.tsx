import { House } from 'lucide-react';
import { Link } from 'react-router-dom';

import Alert from '../../components/Alert';
import PageHeader from '../../components/layout/PageHeader.tsx';
import Loading from '../../components/Loading.tsx';
import PostingCard from '../../components/PostingCard';
import HorizontalScrollSection from '../../components/postings/HorizontalScrollSection.tsx';
import requestServer from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type {
  VolunteerEnrollmentsResponse,
  VolunteerPinnedCrisesResponse,
  VolunteerPostingSearchResponse,
} from '../../../../server/src/api/types';
import type { PostingWithContext } from '../../../../server/src/types';

const PostingRailCard = ({
  posting,
  showCrisis,
}: {
  posting: PostingWithContext;
  showCrisis: boolean;
}) => {
  return (
    <div className="shrink-0 snap-start md:w-md w-sm">
      <PostingCard
        posting={posting}
        showCrisis={showCrisis}
      />
    </div>
  );
};

const RailLoadingState = () => (
  <div className="flex justify-center rounded-box border border-base-300 bg-base-100 px-6 py-12">
    <Loading size="lg" />
  </div>
);

const getPostingCrisisId = (posting: PostingWithContext): number | undefined => {
  const maybePosting = posting as PostingWithContext & { crisis_id?: unknown };
  return typeof maybePosting.crisis_id === 'number' ? maybePosting.crisis_id : undefined;
};

function VolunteerHome() {
  const {
    data: enrolledPostings,
    loading: enrolledLoading,
    error: enrolledError,
  } = useAsync(
    async () => {
      const res = await requestServer<VolunteerEnrollmentsResponse>('/volunteer/posting/enrollments', { includeJwt: true });
      return res;
    },
    { immediate: true },
  );

  const {
    data: allPostings,
    loading: allLoading,
    error: allError,
  } = useAsync(
    async () => {
      const res = await requestServer<VolunteerPostingSearchResponse>('/volunteer/posting', { includeJwt: true });
      return res;
    },
    { immediate: true },
  );

  const {
    data: pinnedCrises,
    loading: crisesLoading,
    error: crisesError,
  } = useAsync(
    async () => {
      const res = await requestServer<VolunteerPinnedCrisesResponse>('/volunteer/crises/pinned', { includeJwt: true });
      return res;
    },
    { immediate: true },
  );

  const enrollmentEntries = enrolledPostings?.postings ?? [];

  const allAvailablePostings = allPostings?.postings ?? [];
  const pinnedCrisisList = pinnedCrises?.crises ?? [];

  const enrollmentPostingIds = new Set<number>(
    enrollmentEntries.map(entry => entry.id),
  );

  const postingsByCrisisId = new Map<number, PostingWithContext[]>();

  allAvailablePostings.forEach((posting) => {
    if (enrollmentPostingIds.has(posting.id)) return;

    const crisisId = getPostingCrisisId(posting);
    if (crisisId === undefined) return;

    const crisisPostings = postingsByCrisisId.get(crisisId) ?? [];
    crisisPostings.push(posting);
    postingsByCrisisId.set(crisisId, crisisPostings);
  });

  const featuredCrisesWithPostings = pinnedCrisisList
    .map(crisis => ({
      crisis,
      postings: postingsByCrisisId.get(crisis.id) ?? [],
    }))
    .filter(({ postings }) => postings.length > 0);

  const crisisPostingIds = new Set<number>();
  featuredCrisesWithPostings.forEach(({ postings }) => {
    postings.forEach((posting) => {
      crisisPostingIds.add(posting.id);
    });
  });

  const forYouPostings = allAvailablePostings
    .filter(posting => !enrollmentPostingIds.has(posting.id) && !crisisPostingIds.has(posting.id))
    .slice(0, 8);

  const crisisSectionsLoading = crisesLoading || allLoading || enrolledLoading;
  const forYouSectionLoading = allLoading || enrolledLoading;

  return (
    <div className="grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <PageHeader
          title="Home"
          subtitle="Your enrollments, pinned crises, and personalised picks - all in one place."
          icon={House}
        />

        <div className="space-y-10">

          {(enrolledLoading || enrolledError || (enrolledPostings?.postings.length ?? 0) > 0) && (
            <HorizontalScrollSection
              title="My Enrollments"
              subtitle="All postings you're currently enrolled in or have applied to."
              hasItems={!enrolledLoading && (enrolledPostings?.postings.length ?? 0) > 0}
              action={(
                <Link to="/volunteer/enrollments" className="btn btn-sm btn-primary">
                  View All
                </Link>
              )}
              emptyState={enrolledLoading
                ? <RailLoadingState />
                : enrolledError
                  ? (
                      <div className="rounded-box border border-base-300 bg-base-100 px-6 py-4 text-sm text-base-content/70">
                        Unable to load enrollments.
                      </div>
                    )
                  : null}
            >
              {(enrolledPostings?.postings ?? []).map(posting => (
                <PostingRailCard
                  key={posting.id}
                  posting={posting}
                  showCrisis
                />
              ))}
            </HorizontalScrollSection>
          )}

          {crisesError && (
            <div className="rounded-box border border-base-300 bg-base-100 px-6 py-4 text-sm text-base-content/70">
              Unable to load pinned crises.
            </div>
          )}

          {!crisesError && featuredCrisesWithPostings.map(({ crisis, postings }) => (
            <HorizontalScrollSection
              key={crisis.id}
              title={crisis.name}
              subtitle={crisis.description || 'No description provided.'}
              hasItems={!crisisSectionsLoading && postings.length > 0}
              action={(
                <Link
                  to={`/volunteer/crises/${crisis.id}/postings`}
                  state={{ crisis }}
                  className="btn btn-sm btn-primary"
                >
                  View All
                </Link>
              )}
              emptyState={crisisSectionsLoading
                ? <RailLoadingState />
                : null}
            >
              {postings.map(posting => (
                <PostingRailCard
                  key={posting.id}
                  posting={posting}
                  showCrisis
                />
              ))}
            </HorizontalScrollSection>
          ))}

          <HorizontalScrollSection
            title="For You"
            subtitle="Recommended for you."
            hasItems={!forYouSectionLoading && forYouPostings.length > 0}
            action={(
              <Link to="/volunteer/search" className="btn btn-sm btn-primary">
                View All
              </Link>
            )}
            emptyState={forYouSectionLoading
              ? <RailLoadingState />
              : allError
                ? (
                    <div className="rounded-box border border-base-300 bg-base-100 px-6 py-4 text-sm text-base-content/70">
                      Unable to load recommended postings.
                    </div>
                  )
                : (
                    <Alert>
                      No recommended postings are available yet.
                    </Alert>
                  )}
          >
            {forYouPostings.map(posting => (
              <PostingRailCard
                key={posting.id}
                posting={posting}
                showCrisis
              />
            ))}
          </HorizontalScrollSection>

        </div>
      </div>
    </div>
  );
}

export default VolunteerHome;
