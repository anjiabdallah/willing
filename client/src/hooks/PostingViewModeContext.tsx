import { type ReactNode, useMemo, useState } from 'react';

import {
  PostingViewModeContext,
  postingViewModeStorageKey,
  type PostingViewMode,
  type PostingViewModeContextValue,
} from './usePostingViewMode';

export function PostingViewModeProvider({ children }: { children: ReactNode }) {
  const [viewModeState, setViewModeState] = useState<PostingViewMode>(() => {
    if (typeof window === 'undefined') return 'cards';
    return window.localStorage.getItem(postingViewModeStorageKey) === 'list' ? 'list' : 'cards';
  });

  const setViewMode = (mode: PostingViewMode) => {
    setViewModeState(mode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(postingViewModeStorageKey, mode);
    }
  };

  const value = useMemo<PostingViewModeContextValue>(() => ({
    viewMode: viewModeState,
    setViewMode,
  }), [viewModeState]);

  return (
    <PostingViewModeContext.Provider value={value}>
      {children}
    </PostingViewModeContext.Provider>
  );
}
