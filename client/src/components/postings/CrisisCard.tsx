import { AlertTriangle, Pin } from 'lucide-react';
import { type ReactNode } from 'react';

import { DOMAIN_COLORS } from '../../constants';
import Card from '../Card.tsx';

import type { Crisis } from '../../../../server/src/db/tables/index.ts';

type CrisisCardProps = {
  crisis: Crisis;
  link?: string | null;
  descriptionFallback?: string;
  right?: ReactNode;
  children?: ReactNode;
};

function CrisisCard({
  crisis,
  link,
  descriptionFallback = 'No crisis details were added for this event yet.',
  right,
  children,
}: CrisisCardProps) {
  return (
    <Card
      title={crisis.name}
      description={crisis.description || descriptionFallback}
      color={DOMAIN_COLORS.crisis}
      coloredText={true}
      Icon={AlertTriangle}
      link={link === undefined ? `/volunteer/crises/${crisis.id}/postings` : link ?? undefined}
      right={right ?? (crisis.pinned
        ? <Pin size={16} className={`text-${DOMAIN_COLORS.crisis}`} />
        : undefined)}
    >
      {children}
    </Card>
  );
}

export default CrisisCard;
