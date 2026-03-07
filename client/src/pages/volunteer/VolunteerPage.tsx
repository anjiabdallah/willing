import { Outlet } from 'react-router';

import { VolunteerOnly } from '../../auth/guards';
import VolunteerNavbar from '../../components/layout/navbars/VolunteerNavbar';

function VolunteerPage() {
  return (
    <VolunteerOnly>
      <main className="h-screen flex flex-col">
        <VolunteerNavbar />
        <Outlet />
      </main>
    </VolunteerOnly>
  );
}

export default VolunteerPage;
