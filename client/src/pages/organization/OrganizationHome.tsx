import { Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import PostingCard from '../../components/PostingCard';
import requestServer from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type { OrganizationPosting, PostingSkill } from '../../../../server/src/db/tables';

type PostingWithSkills = OrganizationPosting & { skills: PostingSkill[] };

function OrganizationHome() {
  const navigate = useNavigate();

  const { data: postings, loading, error } = useAsync(
    async () => {
      const response = await requestServer<{ posting: PostingWithSkills[] }>(
        '/organization/posting',
        { method: 'GET' },
        true,
      );
      return response.posting;
    },
    true,
  );

  return (
    <div className="grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <h3 className="text-3xl font-extrabold tracking-tight mb-6">
          Organization Home
        </h3>

        <button
          className="btn btn-primary mb-6"
          onClick={() => navigate('posting')}
        >
          <Plus className="w-4 h-4" />
          Create New Posting
        </button>

        {error && (
          <div className="alert alert-error mb-4">
            <span>{error.message}</span>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        )}

        {!loading && (!postings || postings.length === 0) && (
          <div className="alert">
            <span>No postings yet. Create your first posting to get started!</span>
          </div>
        )}

        {!loading && postings && postings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {postings.map(posting => (
              <PostingCard
                key={posting.id}
                posting={posting}
                footer={(
                  <div className="card-actions gap-2">
                    <button
                      className="btn btn-sm w-full gap-2"
                      onClick={() => navigate(`/organization/posting/${posting.id}`)}
                    >
                      <Eye size={16} />
                      <span className="group-hover:font-semibold">View Details</span>
                    </button>
                  </div>
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OrganizationHome;
