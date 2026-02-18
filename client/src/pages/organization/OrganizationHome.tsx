import { useNavigate } from 'react-router-dom';

import requestServer from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type { OrganizationPosting } from '../../../../server/src/db/tables';

function OrganizationHome() {
  const navigate = useNavigate();

  const { data: postings, loading, error } = useAsync(
    async () => {
      const response = await requestServer<{ posting: OrganizationPosting[] }>(
        '/organization/posting',
        { method: 'GET' },
        true,
      );
      return response.posting;
    },
    true,
  );

  return (
    <div className="flex-grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <h3 className="text-3xl font-extrabold tracking-tight mb-6">
          Organization Home
        </h3>

        <button
          className="btn btn-primary mb-6"
          onClick={() => navigate('posting')}
        >
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
          <div className="grid grid-cols-3 gap-4">
            {postings.map(posting => (
              <div key={posting.id} className="card bg-base-100 shadow">
                <div className="card-body">
                  <h2 className="card-title">{posting.title}</h2>
                  <p className="text-sm opacity-80">{posting.description}</p>
                  <div className="divider my-2"></div>
                  <div className="space-y-2 text-sm">
                    <p>
                      <strong>Location:</strong>
                      {posting.location_name}
                    </p>
                    <p>
                      <strong>Start:</strong>
                      {new Date(posting.start_timestamp).toLocaleDateString()}
                    </p>
                    {posting.end_timestamp && (
                      <p>
                        <strong>End:</strong>
                        {new Date(posting.end_timestamp).toLocaleDateString()}
                      </p>
                    )}
                    {posting.max_volunteers && (
                      <p>
                        <strong>Max Volunteers:</strong>
                        {posting.max_volunteers}
                      </p>
                    )}
                    {posting.minimum_age && (
                      <p>
                        <strong>Minimum Age:</strong>
                        {posting.minimum_age}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OrganizationHome;
