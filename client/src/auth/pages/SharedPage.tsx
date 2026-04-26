import { Outlet } from 'react-router-dom';

import UserNavbar from '../../components/layout/navbars/UserNavbar';
import { RolesOnly } from '../guards';

import type { Role } from '../../../../server/src/types';

function SharedPage({ roles }: { roles: Role[] }) {
  return (
    <RolesOnly roles={roles}>
      <main className="h-screen flex flex-col">
        <UserNavbar />
        <div className="overflow-y-scroll flex-1">
          <Outlet />
        </div>
      </main>
    </RolesOnly>
  );
}

export default SharedPage;
