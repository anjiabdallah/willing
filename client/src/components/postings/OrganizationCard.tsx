import { Link } from 'react-router-dom';

import Card from '../Card.tsx';
import OrganizationProfilePicture from '../OrganizationProfilePicture.tsx';

import type { VolunteerOrganizationSearchResult } from '../../../../server/src/api/types.ts';

type OrganizationCardProps = {
  organization: VolunteerOrganizationSearchResult;
};

function OrganizationCard({ organization }: OrganizationCardProps) {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <OrganizationProfilePicture
          organizationName={organization.name}
          organizationId={organization.id}
          logoPath={organization.logo_path}
          size={48}
          className="shrink-0"
        />

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold">
            <Link to={`/organization/${organization.id}`} className="link link-primary link-hover no-underline hover:underline">
              {organization.name}
            </Link>
          </h3>
          <p className="text-sm text-base-content/70 mt-1">
            {organization.location_name || 'Location not set'}
          </p>
        </div>

        <span className="badge badge-secondary text-sm py-2 whitespace-nowrap">
          {organization.posting_count}
          {' '}
          postings
        </span>
      </div>

      <p className="text-sm text-base-content/70 mt-3 line-clamp-3 ml-1">
        {organization.description || 'No description provided.'}
      </p>
    </Card>
  );
}

export default OrganizationCard;
