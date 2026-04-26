import { Calendar, Clock } from 'lucide-react';

type PostingDateTimeProps = {
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  className?: string;
};

function PostingDateTime({
  startDate,
  endDate,
  startTime,
  endTime,
  className,
}: PostingDateTimeProps) {
  const hasEndDate = Boolean(endDate) && endDate !== startDate;
  const hasEndTime = Boolean(endTime) && endTime !== startTime;
  const effectiveDateLabel = 'DATE';
  const effectiveTimeLabel = 'TIME';

  return (
    <div className={className}>
      <div className="flex items-center gap-3 grow h-22">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center shrink-0 mt-1">
            <Calendar size={16} className="text-primary" />
            {hasEndDate && <div className="w-0.5 h-6 bg-primary my-1" />}
            {hasEndDate && <Calendar size={16} className="text-primary" />}
          </div>
          <div>
            <div className="text-sm">
              <p className="text-xs opacity-70">{effectiveDateLabel}</p>
              <p className="font-medium">{startDate || 'TBA'}</p>
            </div>
            {hasEndDate && (
              <div className="mt-3 text-sm">
                <p className="font-medium">{endDate || 'TBA'}</p>
              </div>
            )}
          </div>
        </div>

        <div className="grow" />

        <div className="flex items-start gap-3">
          <div className="text-right">
            <div className="text-sm">
              <p className="text-xs opacity-70">{effectiveTimeLabel}</p>
              <p className="font-medium">{startTime || '—'}</p>
            </div>
            {hasEndTime && (
              <div className="mt-3 text-sm">
                <p className="font-medium">{endTime || '—'}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center shrink-0 mt-1">
            <Clock size={16} className="text-primary" />
            <div className="w-0.5 h-6 bg-primary my-1" />
            <Clock size={16} className="text-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default PostingDateTime;
