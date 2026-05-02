import ReportType from './ReportType';

import type { LucideIcon } from 'lucide-react';

type ReportHeaderProps = {
  createdAt: string | Date;
  reportTitle: string;
  subjectName?: string;
  scopeLabel?: string;
  Icon?: LucideIcon;
  compact?: boolean;
  className?: string;
};

const formatReportedDate = (createdAt: string | Date) => new Date(createdAt).toLocaleString(undefined, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function ReportHeader({
  createdAt,
  reportTitle,
  subjectName,
  scopeLabel,
  Icon,
  compact = false,
  className = '',
}: ReportHeaderProps) {
  const formattedDate = formatReportedDate(createdAt);

  if (compact) {
    return (
      <div className={`mb-3 flex w-full items-start justify-between gap-3 ${className}`.trim()}>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={18} className="text-primary shrink-0" />}
          {subjectName && <h3 className="text-base font-semibold">{subjectName}</h3>}
          <ReportType title={reportTitle} />
          {!Icon && scopeLabel && <span className="badge badge-accent badge-outline">{scopeLabel}</span>}
        </div>
        <span className="text-xs text-base-content/60 whitespace-nowrap">{formattedDate}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-base-300 bg-base-100 p-4 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={18} className="text-primary shrink-0" />}
          {subjectName
            ? <h3 className="text-base font-semibold">{subjectName}</h3>
            : <span className="text-sm font-semibold">Report Details</span>}
        </div>
        <span className="text-xs text-base-content/60 whitespace-nowrap">{formattedDate}</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm font-semibold">Report Type</span>
        <ReportType title={reportTitle} size="lg" />
        {!Icon && scopeLabel && <span className="badge badge-accent badge-outline">{scopeLabel}</span>}
      </div>
    </div>
  );
}

export default ReportHeader;
