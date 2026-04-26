import { Outlet } from 'react-router-dom';

import UserNavbar from '../../components/layout/navbars/UserNavbar';
import { AdminOnly } from '../guards';

function AdminPage() {
  return (
    <AdminOnly redirectUrl="/admin/login">
      <main className="h-screen flex flex-col">
        <UserNavbar />
        <div className="overflow-y-scroll flex-1">
          <Outlet />
        </div>
      </main>
    </AdminOnly>
  );
}

export default AdminPage;
