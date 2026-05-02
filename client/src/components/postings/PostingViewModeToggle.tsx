import { LayoutGrid, List } from 'lucide-react';

import { usePostingViewMode } from '../../hooks/usePostingViewMode';

function PostingViewModeToggle() {
  const { viewMode, setViewMode } = usePostingViewMode();

  return (
    <div className="join">
      <button
        type="button"
        className={`join-item btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline'}`}
        onClick={() => setViewMode('cards')}
        aria-pressed={viewMode === 'cards'}
      >
        <LayoutGrid size={14} />
        <span className="max-lg:hidden">Cards</span>
      </button>
      <button
        type="button"
        className={`join-item btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'}`}
        onClick={() => setViewMode('list')}
        aria-pressed={viewMode === 'list'}
      >
        <List size={14} />
        <span className="max-lg:hidden">List</span>
      </button>
    </div>
  );
}

export default PostingViewModeToggle;
