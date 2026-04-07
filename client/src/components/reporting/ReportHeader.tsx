import ReportType from './ReportType';

type ReportHeaderProps = {
  createdAt: string | Date;
  reportTitle: string;
  subjectName?: string;
  scopeLabel?: string;
  compact?: boolean;
  className?: string;
};

const formatReportedDate = (createdAt: string | Date) => new Date(createdAt).toLocaleString();

function ReportHeader({
  createdAt,
  reportTitle,
  subjectName,
  scopeLabel,
  compact = false,
  className = '',
}: ReportHeaderProps) {
  const formattedDate = formatReportedDate(createdAt);

  if (compact) {
    return (
      <div className={`mb-3 flex w-full items-start justify-between gap-3 ${className}`.trim()}>
        <div className="flex items-center gap-2">
          {subjectName && <h3 className="text-base font-semibold">{subjectName}</h3>}
          <ReportType title={reportTitle} />
          {scopeLabel && <span className="badge badge-accent badge-outline">{scopeLabel}</span>}
        </div>
        <span className="text-xs text-base-content/60 whitespace-nowrap">{formattedDate}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-base-300 bg-base-100 p-4 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3">
        {subjectName
          ? <h3 className="text-base font-semibold">{subjectName}</h3>
          : <span className="text-sm font-semibold">Report Details</span>}
        <span className="text-xs text-base-content/60 whitespace-nowrap">{formattedDate}</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm font-semibold">Report Type</span>
        <ReportType title={reportTitle} size="lg" />
        {scopeLabel && <span className="badge badge-accent badge-outline">{scopeLabel}</span>}
      </div>
    </div>
  );
}

export default ReportHeader;
