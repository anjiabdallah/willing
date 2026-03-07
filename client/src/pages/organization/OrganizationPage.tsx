import { Outlet } from 'react-router';

import { OrganizationOnly } from '../../auth/guards';
import OrganizationNavbar from '../../components/layout/navbars/OrganizationNavbar';

function OrganizationPage() {
  return (
    <OrganizationOnly>
      <main className="h-screen flex flex-col">
        <OrganizationNavbar />
        <Outlet />
      </main>
    </OrganizationOnly>
  );
}

export default OrganizationPage;
