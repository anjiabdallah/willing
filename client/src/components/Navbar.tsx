import type { ReactNode } from 'react';

function Navbar({ right }: { right?: ReactNode }) {
  return (
    <div className="navbar bg-base-100 shadow-md">
      <div className="flex-1">
        <a className="btn btn-ghost text-xl" href="/">
          <img src="/willing.svg" className="h-6" alt="Willing Logo" />
          Willing
        </a>
      </div>
      <div className="flex-none">
        { right }
      </div>
    </div>
  );
}

export default Navbar;
