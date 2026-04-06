import { House } from 'lucide-react';
import { Link } from 'react-router-dom';

import Alert from '../../components/Alert';
import PageContainer from '../../components/layout/PageContainer.tsx';
import PageHeader from '../../components/layout/PageHeader.tsx';
import Loading from '../../components/Loading.tsx';
import HorizontalScrollSection from '../../components/postings/HorizontalScrollSection.tsx';
import PostingCollection from '../../components/postings/PostingCollection';
import { usePostingViewMode } from '../../components/postings/PostingViewModeState';
import PostingViewModeToggle from '../../components/postings/PostingViewModeToggle.tsx';
import requestServer from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type {
  VolunteerEnrollmentsResponse,
  VolunteerPinnedCrisesResponse,
  VolunteerPostingSearchResponse,
} from '../../../../server/src/api/types';
import type { PostingWithContext } from '../../../../server/src/types';

const RailLoadingState = () => (
  <div className="flex justify-center rounded-box border border-base-300 bg-base-100 px-6 py-12">
    <Loading size="lg" />
  </div>
);

const VerticalPostingSection = ({
  title,
  subtitle,
  action,
  hasItems,
  emptyState,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  hasItems: boolean;
  emptyState?: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <section className="space-y-4">
    <div>
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      {subtitle && (
        <p className="mt-1 opacity-70">{subtitle}</p>
      )}
    </div>

    {hasItems
      ? (
          <div className="space-y-3">
            {children}
          </div>
        )
      : emptyState}

    {action && (
      <div className="pt-1">
        {action}
      </div>
    )}
  </section>
);

const getPostingCrisisId = (posting: PostingWithContext): number | undefined => {
  const maybePosting = posting as PostingWithContext & { crisis_id?: unknown };
  return typeof maybePosting.crisis_id === 'number' ? maybePosting.crisis_id : undefined;
};

function VolunteerHome() {
  const { viewMode } = usePostingViewMode();

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
      const res = await requestServer<VolunteerPostingSearchResponse>('/volunteer/posting?include_applied=true', { includeJwt: true });
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

  const primaryForYouPostings = allAvailablePostings
    .filter(posting => !enrollmentPostingIds.has(posting.id) && !crisisPostingIds.has(posting.id));

  const fallbackForYouPostings = allAvailablePostings
    .filter(posting => !enrollmentPostingIds.has(posting.id));

  const forYouPostings = [
    ...primaryForYouPostings,
    ...fallbackForYouPostings.filter(
      posting => !primaryForYouPostings.some(primaryPosting => primaryPosting.id === posting.id),
    ),
  ].slice(0, 8);

  const crisisSectionsLoading = crisesLoading || allLoading || enrolledLoading;
  const forYouSectionLoading = allLoading || enrolledLoading;

  const forYouAction = (
    <div className="flex items-center gap-2">
      <Link to="/volunteer/for-you" className="btn btn-sm btn-primary">
        View All
      </Link>
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Home"
        subtitle="Your enrollments, pinned crises, and personalised picks - all in one place."
        icon={House}
        actions={<PostingViewModeToggle />}
      />

      <div className="space-y-10">
        {(enrolledLoading || enrolledError || (enrolledPostings?.postings.length ?? 0) > 0) && (
          viewMode === 'list'
            ? (
                <VerticalPostingSection
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
                  <PostingCollection
                    postings={enrolledPostings?.postings ?? []}
                    showCrisis
                    listItemClassName="w-full"
                  />
                </VerticalPostingSection>
              )
            : (
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
                  <PostingCollection
                    postings={enrolledPostings?.postings ?? []}
                    showCrisis
                    cardItemClassName="h-full shrink-0 snap-start md:w-md w-sm"
                  />
                </HorizontalScrollSection>
              )
        )}

        {crisesError && (
          <div className="rounded-box border border-base-300 bg-base-100 px-6 py-4 text-sm text-base-content/70">
            Unable to load pinned crises.
          </div>
        )}

        {!crisesError && featuredCrisesWithPostings.map(({ crisis, postings }) => (
          viewMode === 'list'
            ? (
                <VerticalPostingSection
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
                  <PostingCollection
                    postings={postings}
                    showCrisis
                    listItemClassName="w-full"
                  />
                </VerticalPostingSection>
              )
            : (
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
                  <PostingCollection
                    postings={postings}
                    showCrisis
                    cardItemClassName="h-full shrink-0 snap-start md:w-md w-sm"
                  />
                </HorizontalScrollSection>
              )
        ))}

        {viewMode === 'list'
          ? (
              <VerticalPostingSection
                title="For You"
                subtitle="Recommended for you."
                hasItems={!forYouSectionLoading && forYouPostings.length > 0}
                action={forYouAction}
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
                <PostingCollection
                  postings={forYouPostings}
                  showCrisis
                  listItemClassName="w-full"
                />
              </VerticalPostingSection>
            )
          : (
              <HorizontalScrollSection
                title="For You"
                subtitle="Recommended for you."
                hasItems={!forYouSectionLoading && forYouPostings.length > 0}
                action={forYouAction}
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
                <PostingCollection
                  postings={forYouPostings}
                  showCrisis
                  cardItemClassName="h-full shrink-0 snap-start md:w-md w-sm"
                />
              </HorizontalScrollSection>
            )}
      </div>
    </PageContainer>
  );
}

export default VolunteerHome;
