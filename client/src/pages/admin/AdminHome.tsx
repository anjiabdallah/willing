import { useEffect, useState } from 'react';
import requestServer from '../../requestServer';
import type { OrganizationRequest } from '../../../../server/src/db/types';

function AdminHome() {
  const [organizationRequests, setOrganizationRequests] = useState<OrganizationRequest[]>([]);

  useEffect(() => {
    (async () => {
      const res = await requestServer<{
        organizationRequests: OrganizationRequest[];
      }>('/admin/getOrganizationRequests', {}, true);

      setOrganizationRequests(res.organizationRequests);
    })();
  }, []);

  return (
    <p>
      Admin Home
      {organizationRequests.join(', ')}
    </p>
  );
}

export default AdminHome;
