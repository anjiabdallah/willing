import { FileText, MessageCircle, type LucideIcon } from 'lucide-react';

import ReportMessage from './ReportMessage';
import ReportType from './ReportType';
import Card from '../../components/Card';

type ReportDetailOverviewProps = {
  reportId: number | string;
  createdAt: string | Date;
  reportTitle: string;
  message: string;
  reporterTitle: string;
  reporterName: string;
  reporterEmail: string;
  reporterIcon: LucideIcon;
};

const formatReportedDate = (value: string | Date) => new Date(value).toLocaleString(undefined, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function ReportDetailOverview({
  reportId,
  createdAt,
  reportTitle,
  message,
  reporterTitle,
  reporterName,
  reporterEmail,
  reporterIcon: ReporterIcon,
}: ReportDetailOverviewProps) {
  return (
    <Card className="border-base-200 shadow-sm bg-base-100">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2 text-base font-bold text-base-content">
          <FileText size={20} className="text-primary shrink-0" />
          <span>Report Overview</span>
        </div>
        <ReportType title={reportTitle} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-base-content/70 mb-1">Report ID</p>
          <p className="text-sm font-semibold text-base-content">
            #
            {reportId}
          </p>
        </div>
        <div>
          <p className="text-xs text-base-content/70 mb-1">Reported On</p>
          <p className="text-sm font-semibold text-base-content">{formatReportedDate(createdAt)}</p>
        </div>
      </div>

      <hr className="border-t border-base-200 my-4" />

      <div className="flex items-center gap-2 mb-5 text-base font-bold text-base-content">
        <MessageCircle size={20} className="text-primary shrink-0" />
        <span>Message</span>
      </div>
      <ReportMessage className="min-h-0" message={message} />

      <hr className="border-t border-base-200 my-4" />

      <div className="flex items-center gap-2 mb-5 text-base font-bold text-base-content">
        <ReporterIcon size={20} className="text-primary shrink-0" />
        <span>{reporterTitle}</span>
      </div>
      <p className="text-base font-semibold text-base-content">{reporterName}</p>
      <p className="text-sm text-base-content/70">{reporterEmail}</p>
    </Card>
  );
}

export default ReportDetailOverview;
