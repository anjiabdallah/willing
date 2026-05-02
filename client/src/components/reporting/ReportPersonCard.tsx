import Card from '../../components/Card';

import type { LucideIcon } from 'lucide-react';

type ReportPersonCardProps = {
  title: string;
  name: string;
  email: string;
  Icon: LucideIcon;
};

function ReportPersonCard({ title, name, email, Icon }: ReportPersonCardProps) {
  return (
    <Card className="border-base-200 shadow-sm bg-base-100">
      <div className="flex items-center gap-2 mb-5 text-base font-bold text-base-content">
        <Icon size={20} className="text-primary shrink-0" />
        <span>{title}</span>
      </div>
      <p className="text-base font-semibold text-base-content">{name}</p>
      <p className="text-sm text-base-content/70">{email}</p>
    </Card>
  );
}

export default ReportPersonCard;
