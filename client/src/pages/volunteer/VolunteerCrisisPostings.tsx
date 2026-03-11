import { AlertCircle } from 'lucide-react';
import { useLocation, useParams } from 'react-router-dom';

import PageHeader from '../../components/layout/PageHeader';

import type { VolunteerPinnedCrisesResponse } from '../../../../server/src/api/types';

type CrisisState = {
  crisis?: VolunteerPinnedCrisesResponse['crises'][number];
};

function VolunteerCrisisPostings() {
  const { crisisId } = useParams();
  const location = useLocation();
  const { crisis } = (location.state as CrisisState | null) ?? {};

  return (
    <div className="grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <PageHeader
          title={crisis?.name ?? `Crisis ${crisisId ?? ''}`.trim()}
          subtitle={crisis?.description ?? 'Postings for this crisis will appear here once crisis tagging is implemented.'}
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
