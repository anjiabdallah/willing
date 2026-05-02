import { createContext, useContext } from 'react';

export type PostingViewMode = 'cards' | 'list';

export type PostingViewModeContextValue = {
  viewMode: PostingViewMode;
  setViewMode: (mode: PostingViewMode) => void;
};

export const postingViewModeStorageKey = 'posting-view-mode';

export const PostingViewModeContext = createContext<PostingViewModeContextValue | undefined>(undefined);

export function usePostingViewMode() {
  const context = useContext(PostingViewModeContext);
  if (!context) {
    return { viewMode: 'cards' as PostingViewMode, setViewMode: () => {} };
  }
  return context;
}
