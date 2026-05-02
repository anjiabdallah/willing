type ReportMessageProps = {
  message: string;
  className?: string;
};

function ReportMessage({ message, className = '' }: ReportMessageProps) {
  return (
    <div className={`rounded-lg bg-base-100 border border-base-300 p-4 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-relaxed text-base-content/80 min-h-[8rem] ${className}`.trim()}>
      {message}
    </div>
  );
}

export default ReportMessage;
