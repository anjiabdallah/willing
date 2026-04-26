import { Outlet } from 'react-router-dom';

import UserNavbar from '../../components/layout/navbars/UserNavbar';
import { OrganizationOnly } from '../guards';

function OrganizationPage() {
  return (
    <OrganizationOnly>
      <main className="h-screen flex flex-col">
        <UserNavbar />
        <div className="overflow-y-scroll flex-1">
          <Outlet />
        </div>
      </main>
    </OrganizationOnly>
  );
}

export default OrganizationPage;
