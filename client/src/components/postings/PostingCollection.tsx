import { usePostingViewMode } from '../../hooks/usePostingViewMode';
import LoadingList from '../LoadingList';
import PostingCard from '../PostingCard';
import PostingList from '../PostingList';

import type { PostingWithContext } from '../../../../server/src/types';
import type { ReactNode } from 'react';

type PostingCollectionProps = {
  postings: PostingWithContext[];
  loading?: boolean;
  showCrisis?: boolean;
  crisisTagClickable?: boolean;
  crisisBasePath?: string;
  variant?: 'volunteer' | 'organization';
  showOrganizationName?: boolean;
  cardsContainerClassName?: string;
  listContainerClassName?: string;
  cardItemClassName?: string;
  listItemClassName?: string;
  emptyState?: ReactNode;
};

function PostingCollection({
  postings,
  loading = false,
  showCrisis = true,
  crisisTagClickable = true,
  crisisBasePath = '/volunteer/crises',
  variant = 'volunteer',
  showOrganizationName,
  cardsContainerClassName,
  listContainerClassName,
  cardItemClassName,
  listItemClassName,
  emptyState = null,
}: PostingCollectionProps) {
  const { viewMode } = usePostingViewMode();

  if (postings.length === 0) {
    if (loading) {
      return <LoadingList count={3} />;
    }
    return <>{emptyState}</>;
  }

  const isCards = viewMode === 'cards';
  const containerClassName = isCards ? cardsContainerClassName : listContainerClassName;

  const items = postings.map(posting => (
    <div
      key={posting.id}
      className={isCards ? `h-full min-h-[24rem] self-stretch flex flex-col ${cardItemClassName ?? ''}` : listItemClassName}
    >
      {isCards
        ? (
            <PostingCard
              posting={posting}
              showCrisis={showCrisis}
              crisisTagClickable={crisisTagClickable}
              crisisBasePath={crisisBasePath}
              fillHeight={isCards}
            />
          )
        : (
            <PostingList
              posting={posting}
              showCrisis={showCrisis}
              crisisTagClickable={crisisTagClickable}
              crisisBasePath={crisisBasePath}
              variant={variant}
              showOrganizationName={showOrganizationName}
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
