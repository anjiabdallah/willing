import { Building2, LogOut, ChevronDown, Home, Search, Settings, User } from 'lucide-react';
import { useCallback, useContext } from 'react';
import { NavLink } from 'react-router-dom';

import Navbar from './Navbar';
import AuthContext from '../../../auth/AuthContext';
import { useOrganization } from '../../../auth/useUsers';

function OrganizationNavbar() {
  const auth = useContext(AuthContext);
  const organization = useOrganization();

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
      center={organization && (
        <>
          <NavLink to="/organization" end className={softTabStyle}>
            <Home size={20} />
            Home
          </NavLink>
          <NavLink to="/organization/search" className={softTabStyle}>
            <Search size={20} />
            Search
          </NavLink>
          <NavLink to="/organization/profile" className={softTabStyle}>
            <User size={20} />
            Profile
          </NavLink>
          <NavLink to="/organization/settings" className={softTabStyle}>
            <Settings size={20} />
            Settings
          </NavLink>
        </>
      )}
      right={organization && (
        <div className="dropdown dropdown-bottom dropdown-end">
          <div tabIndex={0} role="button" className="btn btn-ghost m-1">
            <Building2 size={18} />
            <span className="hidden sm:inline">
              {organization.name}
            </span>
            <ChevronDown size={14} className="opacity-50" />
          </div>
          <ul tabIndex={-1} className="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm">
            <span className="sm:hidden inline mx-2 my-4 opacity-50">
              {`${organization.name}`}
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

export default OrganizationNavbar;
