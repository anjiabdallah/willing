import { Outlet } from 'react-router';

import UserNavbar from './UserNavbar';

function SharedPage() {
  return (
    <main className="h-screen flex flex-col">
      <UserNavbar />
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </main>
  );
}

export default SharedPage;
