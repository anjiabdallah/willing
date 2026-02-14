import * as jose from 'jose';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import Footer from '../components/Footer';
import Navbar from '../components/Navbar';

import type { Role, UserJWT } from '../../../server/src/types';

function HomePage() {
  const [role, setRole] = useState<Role>();

  useEffect(() => {
    const jwt = localStorage.getItem('jwt');
    if (!jwt) return;

    const { role: jwtRole } = jose.decodeJwt<UserJWT>(jwt);

    setRole(jwtRole);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-base-100">
      <Navbar right={
        !role
          ? <Link to="/login" className="btn btn-ghost">Login</Link>
          : <Link to={'/' + role}className="btn btn-ghost">Dashboard</Link>
      }
      />

      <main className="flex-grow flex flex-col items-center justify-center max-w-5xl mx-auto py-12 px-4">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4">Connecting volunteers to their vision of a better community</h1>
          <p className="text-xl opacity-70">Join Willing to discover local volunteering opportunities or expand your organization’s impact</p>
        </div>

        <div className="flex flex-col md:flex-row w-full gap-4">
          <div className="card bg-base-200 rounded-box grid h-64 grow place-items-center p-8 text-center border-2 border-transparent hover:border-primary transition-all">
            <h2 className="text-2xl font-bold mb-2">I want to help</h2>
            <p className="mb-6 opacity-80">Discover volunteer opportunities that match your skills.</p>
            <Link to="/volunteer/create" className="btn btn-primary btn-wide">
              Create Volunteer Account
            </Link>
          </div>

          <div className="divider md:divider-horizontal font-bold opacity-50">OR</div>

          <div className="card bg-base-200 rounded-box grid h-64 grow place-items-center p-8 text-center border-2 border-transparent hover:border-secondary transition-all">
            <h2 className="text-2xl font-bold mb-2">I want help</h2>
            <p className="mb-6 opacity-80">Request to register your organization and find volunteers.</p>
            <Link to="/organization/request" className="btn btn-secondary btn-wide">
              Request Organization Account
            </Link>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="opacity-60">Already have an account?</p>
          <Link to="/login" className="link link-primary font-semibold">Log in</Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default HomePage;
