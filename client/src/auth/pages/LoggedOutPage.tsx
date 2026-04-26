import { Outlet } from 'react-router-dom';

import UserNavbar from '../../components/layout/navbars/UserNavbar';
import { LoggedOutOnly } from '../guards';

function LoggedOutPage() {
  return (
    <LoggedOutOnly>
      <main className="h-screen flex flex-col">
        <UserNavbar />
        <div className="overflow-y-scroll flex-1">
          <Outlet />
        </div>
      </main>
    </LoggedOutOnly>
  );
}

export default LoggedOutPage;
