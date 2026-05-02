import { AlertTriangle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import PostingSearchView from '../../components/postings/PostingSearchView.tsx';
import PostingViewModeToggle from '../../components/postings/PostingViewModeToggle.tsx';
import requestServer from '../../utils/requestServer';

import type {
  VolunteerCrisisResponse,
  VolunteerPinnedCrisesResponse,
} from '../../../../server/src/api/types';
import type { PostingWithContext } from '../../../../server/src/types';

type CrisisState = {
  crisis?: VolunteerPinnedCrisesResponse['crises'][number];
};

function VolunteerCrisisPostings() {
  const { crisisId } = useParams();
  const location = useLocation();
  const { crisis } = (location.state as CrisisState | null) ?? {};

  const [resolvedCrisis, setResolvedCrisis] = useState<VolunteerPinnedCrisesResponse['crises'][number] | undefined>(crisis);

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
        const response = await requestServer<VolunteerCrisisResponse>(`/volunteer/crises/${parsedCrisisId}`, {
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
      title={resolvedCrisis?.name ?? 'Crisis'}
      subtitle={subtitle}
      icon={AlertTriangle}
      actions={<PostingViewModeToggle />}
      showBack
      defaultBackTo="/volunteer"
      fetchUrl="/volunteer/posting?include_applied=true"
      filterPostings={filterPostingsByCrisis}
      showEntityTabs={false}
      emptyMessage="No postings found for this crisis yet."
    />
  );
}

export default VolunteerCrisisPostings;
