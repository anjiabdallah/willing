import { Plus, ClipboardList } from 'lucide-react';

import Alert from '../../components/Alert';
import PageHeader from '../../components/layout/PageHeader';
import LinkButton from '../../components/LinkButton';
import PostingCard from '../../components/PostingCard';
import requestServer from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type { OrganizationPostingListResponse } from '../../../../server/src/api/types';

function OrganizationHome() {
  const { data: postings, loading, error } = useAsync(
    async () => {
      const response = await requestServer<OrganizationPostingListResponse>(
        '/organization/posting',
        {
          includeJwt: true,
        },
      );
      return response.postings;
    },
    { immediate: true },
  );

  return (
    <div className="grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <PageHeader
          title="My Postings"
          icon={ClipboardList}
          badge={
            postings && (
              <div className="badge badge-primary">
                {postings.length}
                {' '}
                {postings.length === 1 ? 'Posting' : 'Postings'}
              </div>
            )
          }
          actions={(
            <LinkButton
              color="primary"
              to="/organization/posting"
              Icon={Plus}
            >
              Create New Posting
            </LinkButton>
          )}
        />

        {error && <div className="mb-4 text-sm text-base-content/70">Unable to load postings.</div>}

        {loading && (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        )}

        {!loading && (!postings || postings.length === 0) && (
          <Alert>
            No postings yet. Create your first posting to get started!
          </Alert>
        )}

        {!loading && postings && postings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {postings.map(posting => (
              <PostingCard
                key={posting.id}
                posting={posting}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OrganizationHome;
