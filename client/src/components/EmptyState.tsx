import type { LucideIcon } from 'lucide-react';

type PostingEmptyStateProps = {
  title: string;
  description: string;
  Icon: LucideIcon;
  compact?: boolean;
  className?: string;
};

function EmptyState({
  title,
  description,
  Icon,
  compact = false,
  className,
}: PostingEmptyStateProps) {
  return (
    <div className={`hero bg-base-100 border border-base-300 rounded-box ${compact ? 'p-2' : 'sm:p-10 p-1'} ${className}`}>
      <div className="hero-content text-center">
        <div className="max-w-md flex flex-col items-center">
          <Icon
            size={compact ? 48 : 64}
            className={`opacity-20 ${compact ? 'mb-2' : 'mb-4'}`}
          />
          <p className="py-2 font-bold opacity-80">{title}</p>
          <p className={`opacity-60 ${compact ? 'pb-1' : 'pb-6'}`}>{description}</p>
        </div>
      </div>
    </div>
  );
}

export default EmptyState;
