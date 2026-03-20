import { AlertCircle, ArrowRight, ClipboardCheck, LayoutDashboard } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router';

import PageHeader from '../../components/layout/PageHeader';
import requestServer from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type {
  AdminCrisesResponse,
  AdminOrganizationRequestsResponse,
} from '../../../../server/src/api/types';

function AdminHome() {
  const getOrganizationRequests = useCallback(async () => {
    const res = await requestServer<AdminOrganizationRequestsResponse>('/admin/getOrganizationRequests', { includeJwt: true });
    return res.organizationRequests;
  }, []);

  const getCrises = useCallback(async () => {
    const res = await requestServer<AdminCrisesResponse>('/admin/crises', { includeJwt: true });
    return res.crises;
  }, []);

  const { data: organizationRequests } = useAsync(getOrganizationRequests, { immediate: true });
  const { data: crises } = useAsync(getCrises, { immediate: true });

  const pinnedCrises = crises?.filter(crisis => crisis.pinned) ?? [];

  return (
    <div className="grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <PageHeader
          title="Admin Dashboard"
          subtitle="Quick overview of requests and active crises."
          icon={LayoutDashboard}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <h3 className="card-title">
                  <ClipboardCheck size={20} />
                  Organization Requests
                </h3>
                {!organizationRequests
                  ? <div className="skeleton w-16 h-6" />
                  : (
                      <span className="badge badge-primary">
                        {organizationRequests.length}
                        {' '}
                        Pending
                      </span>
                    )}
              </div>

              <p className="text-sm opacity-70">
                Review incoming organization applications and approve or reject requests.
              </p>

              <div className="card-actions justify-end">
                <Link to="/admin/requests" className="btn btn-outline btn-sm">
                  Open Requests
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <h3 className="card-title">
                  <AlertCircle size={20} />
                  Crises
                </h3>
                {!crises
                  ? <div className="skeleton w-16 h-6" />
                  : (
                      <span className="badge badge-secondary">
                        {crises.length}
                        {' '}
                        Total
                      </span>
                    )}
              </div>

              <p className="text-sm opacity-70">
                {crises === undefined
                  ? 'Loading pinned crises...'
                  : pinnedCrises.length > 0
                    ? `Pinned (${pinnedCrises.length}): ${pinnedCrises.map(crisis => crisis.name).join(', ')}`
                    : 'No pinned crisis at the moment.'}
              </p>

              <div className="card-actions justify-end">
                <Link to="/admin/crises" className="btn btn-outline btn-sm">
                  Open Crises
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminHome;
