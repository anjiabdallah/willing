import { AlertCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';

import PageHeader from '../../components/layout/PageHeader';
import requestServer from '../../utils/requestServer';

import type { VolunteerPinnedCrisesResponse } from '../../../../server/src/api/types';

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

    const loadPinnedCrisis = async () => {
      try {
        const response = await requestServer<VolunteerPinnedCrisesResponse>('/volunteer/crises/pinned', { includeJwt: true });
        const match = response.crises.find(item => item.id === parsedCrisisId);
        if (!cancelled) {
          setResolvedCrisis(match);
        }
      } catch {
        if (!cancelled) {
          setResolvedCrisis(undefined);
        }
      }
    };

    loadPinnedCrisis();

    return () => {
      cancelled = true;
    };
  }, [crisis, parsedCrisisId]);

  return (
    <div className="grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <PageHeader
          title={resolvedCrisis?.name ?? 'Crisis'}
          subtitle={resolvedCrisis?.description ?? 'Postings for this crisis will appear here once crisis tagging is implemented.'}
          icon={AlertCircle}
          showBack
          defaultBackTo="/volunteer"
        />

        <div className="mt-6 alert bg-base-100 shadow-sm">
          <span>This page is gonna be empty for now, i'll implement this later</span>
        </div>
      </div>
    </div>
  );
}

export default VolunteerCrisisPostings;
