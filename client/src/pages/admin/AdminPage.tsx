import { Outlet } from 'react-router';

import { AdminOnly } from '../../auth/guards';
import AdminNavbar from '../../components/layout/navbars/AdminNavbar';

function AdminPage() {
  return (
    <AdminOnly>
      <main className="h-screen flex flex-col">
        <AdminNavbar />
        <Outlet />
      </main>
    </AdminOnly>
  );
}

export default AdminPage;
