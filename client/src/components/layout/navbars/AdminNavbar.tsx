import { AlertCircle, ChevronDown, ClipboardCheck, Flag, Home, LogOut, Settings, ShieldUser } from 'lucide-react';
import { useCallback, useContext } from 'react';
import { NavLink } from 'react-router-dom';

import Navbar from './Navbar';
import AuthContext from '../../../auth/AuthContext';
import { useAdmin } from '../../../auth/useUsers';

function AdminNavbar() {
  const auth = useContext(AuthContext);
  const admin = useAdmin();

  const handleLogout = useCallback(() => {
    (document.activeElement as HTMLElement)?.blur();
    auth.logout();
  }, [auth]);

  const softTabStyle = ({ isActive }: { isActive: boolean }) =>
    `btn btn-md border-none rounded-lg font-bold transition-all ${
      isActive
        ? 'bg-primary/10 text-primary hover:bg-primary/20'
        : 'btn-ghost opacity-70 hover:opacity-100'
    }`;

  return (
    <Navbar
      center={admin && (
        <>
          <NavLink to="/admin" end className={softTabStyle}>
            <Home size={20} />
            Home
          </NavLink>
          <NavLink to="/admin/requests" className={softTabStyle}>
            <ClipboardCheck size={20} />
            Requests
          </NavLink>
          <NavLink to="/admin/crises" className={softTabStyle}>
            <AlertCircle size={20} />
            Crises
          </NavLink>
          <NavLink to="/admin/reports" className={softTabStyle}>
            <Flag size={20} />
            Reports
          </NavLink>
          <NavLink to="/admin/settings" className={softTabStyle}>
            <Settings size={20} />
            Settings
          </NavLink>
        </>
      )}
      right={admin && (
        <div className="dropdown dropdown-bottom dropdown-end">
          <div tabIndex={0} role="button" className="btn btn-ghost m-1">
            <ShieldUser size={20} />
            <span className="hidden sm:inline">
              {`${admin.first_name} ${admin.last_name}`}
            </span>
            <ChevronDown size={14} className="opacity-50" />
          </div>
          <ul tabIndex={-1} className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm">
            <span className="sm:hidden inline mx-2 my-4 opacity-50">
              {`${admin.first_name} ${admin.last_name}`}
            </span>
            <li>
              <button onClick={handleLogout}>
                <LogOut size={16} />
                Logout
              </button>
            </li>
          </ul>
        </div>
      )}
    />
  );
}

export default AdminNavbar;
