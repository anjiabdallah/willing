import { AlertCircle, Pin } from 'lucide-react';
import { type ReactNode } from 'react';

import Card from '../Card.tsx';

import type { Crisis } from '../../../../server/src/db/tables/index.ts';

type CrisisCardProps = {
  crisis: Crisis;
  link?: string;
  descriptionFallback?: string;
  right?: ReactNode;
  children?: ReactNode;
};

function CrisisCard({
  crisis,
  link,
  descriptionFallback = 'No crisis description provided.',
  right,
  children,
}: CrisisCardProps) {
  return (
    <Card
      title={crisis.name}
      description={crisis.description || descriptionFallback}
      Icon={AlertCircle}
      link={link ?? `/volunteer/crises/${crisis.id}/postings`}
      right={right ?? (crisis.pinned ? <Pin size={16} className="text-primary shrink-0" /> : undefined)}
    >
      {children}
    </Card>
  );
}

export default CrisisCard;
