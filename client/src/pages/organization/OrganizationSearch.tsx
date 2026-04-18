import { useSearchParams } from 'react-router-dom';

import PostingSearchView from '../../components/postings/PostingSearchView.tsx';
import PostingViewModeToggle from '../../components/postings/PostingViewModeToggle.tsx';
import requestServer from '../../utils/requestServer.ts';
import useAsync from '../../utils/useAsync.ts';

import type { OrganizationPinnedCrisesResponse } from '../../../../server/src/api/types.ts';

function OrganizationSearch() {
  const [searchParams] = useSearchParams();
  const entityParam = searchParams.get('entity');
  const initialEntity = entityParam === 'crises' || entityParam === 'postings' || entityParam === 'organizations'
    ? entityParam
    : undefined;

  const { data: pinnedCrises } = useAsync(
    async () => {
      const response = await requestServer<OrganizationPinnedCrisesResponse>('/organization/crises/pinned', {
        includeJwt: true,
      });
      return response.crises;
    },
    { immediate: true },
  );

  return (
    <div className="grow bg-base-200">
      <PostingSearchView
        title="Search Opportunities"
        subtitle="Browse all active postings and crises across organizations."
        icon={undefined}
        showBack={false}
        actions={<PostingViewModeToggle />}
        fetchUrl="/organization/posting/discover"
        organizationsFetchUrl="/organization/organizations"
        crisisBasePath="/organization/crises"
        crisesFetchBasePath="/organization/crises"
        enableCrisisFilter
        enableOrganizationSearch
        initialFilters={initialEntity ? { entity: initialEntity } : undefined}
        crisisOptions={pinnedCrises?.map(crisis => ({
          id: crisis.id,
          name: crisis.name,
        })) ?? []}
      />
    </div>
  );
}

export default OrganizationSearch;
