import { Menu, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

function Navbar({ center, right }: { center?: ReactNode; right?: ReactNode }) {
  const [isCenterOpen, setIsCenterOpen] = useState(false);

  return (
    <div className="shrink-0 top-0 z-9999 relative">
      <div className="navbar bg-base-100 shadow-sm relative border-b border-base-300">
        <div className="navbar-start">
          {center && (
            <button
              type="button"
              className="btn btn-ghost btn-square md:hidden mr-1"
              onClick={() => setIsCenterOpen(value => !value)}
              aria-label="Toggle navigation menu"
              aria-expanded={isCenterOpen}
            >
              {isCenterOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          )}

          <Link className="btn btn-ghost text-xl px-2" to="/">
            <img src="/willing.svg" className="h-6" alt="Willing Logo" />
            Willing
          </Link>
        </div>
        <div className="navbar-center">
          {center && (
            <>
              <div className="hidden md:flex items-center gap-2">
                {center}
              </div>
            </>
          )}
        </div>
        <div className="navbar-end">
          { right }
        </div>
      </div>

      {center && (
        <div
          className={`${isCenterOpen ? 'flex' : 'hidden'} md:hidden absolute top-full left-0 right-0 z-50 flex-col items-stretch gap-2 border-t border-base-200 bg-base-100 px-4 py-3 shadow-md`}
          onClick={(event) => {
            const target = event.target as HTMLElement;
            if (target.closest('a, button')) {
              setIsCenterOpen(false);
            }
          }}
        >
          {center}
        </div>
      )}
    </div>
  );
}

export default Navbar;
