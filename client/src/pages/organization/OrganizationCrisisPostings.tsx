import { AlertCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import PostingSearchView from '../../components/postings/PostingSearchView.tsx';
import PostingViewModeToggle from '../../components/postings/PostingViewModeToggle.tsx';
import requestServer from '../../utils/requestServer.ts';

import type {
  OrganizationCrisisResponse,
  OrganizationPinnedCrisesResponse,
} from '../../../../server/src/api/types.ts';
import type { PostingWithContext } from '../../../../server/src/types.ts';

type CrisisState = {
  crisis?: OrganizationPinnedCrisesResponse['crises'][number];
};

function OrganizationCrisisPostings() {
  const { crisisId } = useParams();
  const location = useLocation();
  const { crisis } = (location.state as CrisisState | null) ?? {};

  const [resolvedCrisis, setResolvedCrisis] = useState<OrganizationPinnedCrisesResponse['crises'][number] | undefined>(crisis);

  const parsedCrisisId = useMemo(() => {
    if (!crisisId) return undefined;
    const id = Number(crisisId);
    return Number.isInteger(id) && id > 0 ? id : undefined;
  }, [crisisId]);

  useEffect(() => {
    if (crisis) {
      setResolvedCrisis(crisis);
      return;
    }

    if (parsedCrisisId == null) {
      setResolvedCrisis(undefined);
      return;
    }

    let cancelled = false;

    const loadCrisis = async () => {
      try {
        const response = await requestServer<OrganizationCrisisResponse>(`/organization/crises/${parsedCrisisId}`, {
          includeJwt: true,
        });
        if (!cancelled) {
          setResolvedCrisis(response.crisis);
        }
      } catch {
        if (!cancelled) {
          setResolvedCrisis(undefined);
        }
      }
    };

    loadCrisis();

    return () => {
      cancelled = true;
    };
  }, [crisis, parsedCrisisId]);

  const subtitle = resolvedCrisis?.description
    || 'Browse and filter postings tagged under this crisis.';

  const filterPostingsByCrisis = (postings: PostingWithContext[]) => {
    if (parsedCrisisId == null) {
      return [];
    }

    return postings.filter(posting => posting.crisis_id === parsedCrisisId);
  };

  return (
    <PostingSearchView
      title={resolvedCrisis?.name ?? 'Postings'}
      subtitle={subtitle}
      icon={AlertCircle}
      actions={<PostingViewModeToggle />}
      showBack
      defaultBackTo="/organization/search?entity=crises"
      fetchUrl="/organization/posting/discover"
      crisisBasePath="/organization/crises"
      crisesFetchBasePath="/organization/crises"
      filterPostings={filterPostingsByCrisis}
      showEntityTabs={false}
      emptyMessage="No postings found for this crisis yet."
    />
  );
}

export default OrganizationCrisisPostings;
