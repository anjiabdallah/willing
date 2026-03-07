import { useContext } from 'react';

import AdminNavbar from './AdminNavbar';
import EmptyNavbar from './EmptyNavbar';
import OrganizationNavbar from './OrganizationNavbar';
import VolunteerNavbar from './VolunteerNavbar';
import AuthContext from '../../../auth/AuthContext';

function UserNavbar() {
  const auth = useContext(AuthContext);
  const role = auth.user?.role;

  if (!role) return <EmptyNavbar />;

  if (role === 'volunteer') {
    return <VolunteerNavbar />;
  }

  if (role === 'organization') {
    return <OrganizationNavbar />;
  }

  if (role === 'admin') {
    return <AdminNavbar />;
  }
}

export default UserNavbar;
