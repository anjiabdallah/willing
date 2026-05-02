import { usePostingViewMode } from '../hooks/usePostingViewMode';

interface LoadingListProps {
  count?: number;
}

export default function LoadingList({ count = 3 }: LoadingListProps) {
  const { viewMode } = usePostingViewMode();
  const items = Array.from({ length: count }, (_, i) => i);

  if (viewMode === 'list') {
    return (
      <div className="flex flex-col gap-4">
        {items.map(i => (
          <div key={i} className="relative overflow-visible">
            <article className="collapse collapse-arrow relative border border-base-300 bg-base-100 shadow-sm">
              <input type="checkbox" />
              <div className="collapse-title z-10 flex items-center gap-3 pr-12 min-h-18">
                <div className="skeleton w-11 h-11 rounded-full shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-2">
                    <div className="min-w-0 lg:row-span-2 lg:flex lg:self-stretch lg:flex-col lg:justify-start">
                      <div className="skeleton h-5 w-3/4 mb-1" />
                      <div className="skeleton h-3 w-1/2 mt-1" />
                    </div>
                    <div className="skeleton h-5 w-16" />
                    <div className="skeleton h-5 w-16" />
                    <div className="skeleton h-5 w-16" />
                  </div>
                </div>
              </div>
            </article>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-3">
      {items.map(i => (
        <div key={i} className="card bg-base-100 shadow-md border border-base-300 min-h-96">
          <div className="p-4 md:p-5 mt-1 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="skeleton w-12 h-12 rounded-full shrink-0" />
              <div className="min-w-0">
                <div className="skeleton h-5 w-32 mb-1" />
                <div className="skeleton h-3 w-24" />
              </div>
            </div>
            <div className="skeleton h-6 w-20" />
          </div>
          <div className="pt-4 pb-3 border-t border-base-200">
            <div className="px-4 md:px-5 flex justify-between items-start text-sm gap-6 pt-2">
              <div className="skeleton h-4 w-full" />
            </div>
          </div>
          <div className="px-4 md:px-5 mt-auto border-t border-base-200 pt-3 pb-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-10 w-full" />
            </div>
          </div>
          <div className="px-4 md:px-5 pb-4 border-t border-base-200 pt-4">
            <div className="flex gap-2">
              <div className="skeleton h-6 w-16 rounded-full" />
              <div className="skeleton h-6 w-16 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
