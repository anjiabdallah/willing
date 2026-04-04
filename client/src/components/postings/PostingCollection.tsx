import PostingCard from '../PostingCard';
import PostingList from '../PostingList';
import { usePostingViewMode } from './PostingViewModeState';

import type { PostingWithContext } from '../../../../server/src/types';
import type { ReactNode } from 'react';

type PostingCollectionProps = {
  postings: PostingWithContext[];
  showCrisis?: boolean;
  crisisTagClickable?: boolean;
  variant?: 'volunteer' | 'organization';
  cardsContainerClassName?: string;
  listContainerClassName?: string;
  cardItemClassName?: string;
  listItemClassName?: string;
  emptyState?: ReactNode;
};

function PostingCollection({
  postings,
  showCrisis = true,
  crisisTagClickable = true,
  variant = 'volunteer',
  cardsContainerClassName,
  listContainerClassName,
  cardItemClassName,
  listItemClassName,
  emptyState = null,
}: PostingCollectionProps) {
  const { viewMode } = usePostingViewMode();

  if (postings.length === 0) {
    return <>{emptyState}</>;
  }

  const isCards = viewMode === 'cards';
  const containerClassName = isCards ? cardsContainerClassName : listContainerClassName;

  const items = postings.map(posting => (
    <div
      key={posting.id}
      className={isCards ? cardItemClassName : listItemClassName}
    >
      {isCards
        ? (
            <PostingCard
              posting={posting}
              showCrisis={showCrisis}
              crisisTagClickable={crisisTagClickable}
            />
          )
        : (
            <PostingList
              posting={posting}
              showCrisis={showCrisis}
              crisisTagClickable={crisisTagClickable}
              variant={variant}
            />
          )}
    </div>
  ));

  if (!containerClassName) {
    return <>{items}</>;
  }

  return (
    <div className={containerClassName}>
      {items}
    </div>
  );
}

export default PostingCollection;
