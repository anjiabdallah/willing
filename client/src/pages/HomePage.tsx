import { Handshake, BriefcaseMedical, HandHeart, AlertTriangle, ArrowRight, Award, Building2, FileSearch, Heart, Send, ShieldCheck, Users } from 'lucide-react';
import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import AuthContext from '../auth/AuthContext';
import Button from '../components/Button';
import StatsCarousel from '../components/home/StatsCarousel';
import Footer from '../components/layout/Footer';
import UserNavbar from '../components/layout/navbars/UserNavbar';
import LinkButton from '../components/LinkButton';
import requestServer from '../utils/requestServer';

import type { PublicHomeStatsResponse } from '../../../server/src/api/types';

const proofCards = [
  {
    title: 'Easy applications',
    body: 'A simple application flow that helps volunteers apply quickly with one click and track their applications easily and clearly',
    Icon: Send,
    tone: 'secondary',
  },
  {
    title: 'Crises prioritization',
    body: 'Pinned crises help volunteers discover urgent opportunities that need immediate responses and help organizations get the right help quickly',
    Icon: AlertTriangle,
    tone: 'primary',
  },
  {
    title: 'Certificate generation',
    body: 'Verified certificates that turn effort into proof, giving volunteers something concrete after they show up and contribute',
    Icon: Award,
    tone: 'accent',
  },
  {
    title: 'Skill-based matching',
    body: 'Volunteers can discover opportunities that align more naturally with their skills, interests, and strengths. Instead of browsing through unrelated opportunities, volunteers are guided toward experiences where they can contribute meaningfully',
    Icon: Heart,
    tone: 'info',
  },
  {
    title: 'Verified organizations',
    body: 'Approval and review flows help volunteers connect with trusted organizations and give both sides more confidence in every opportunity. Verified organizations ensure that every opportunity comes from a trusted and credible source',
    Icon: ShieldCheck,
    tone: 'success',
  },
];

function HomePage() {
  const auth = useContext(AuthContext);
  const [stats, setStats] = useState<PublicHomeStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await requestServer<PublicHomeStatsResponse>('/public/home-stats', {});

        if (!isMounted)
          return;

        setStats(res);
        setLoading(false);
      } catch {
        if (!isMounted)
          return;

        setStats(null);
        setError('Failed to load stats');
        setLoading(false);
      }
    };

    void fetchStats();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-base-100">
      <UserNavbar />

      <main className="relative grow">
        <section className="bg-base-200 relative overflow-visible">

          {[
            { Icon: BriefcaseMedical, top: '71%', left: '33%', size: 42 },
            { Icon: Users, top: '39%', left: '12%', size: 40 },
            { Icon: Building2, top: '28%', left: '85%', size: 36 },
            { Icon: Heart, top: '65%', left: '6%', size: 44 },
            { Icon: ShieldCheck, top: '60%', left: '92%', size: 38 },
            { Icon: Award, top: '80%', left: '18%', size: 34 },
            { Icon: HandHeart, top: '84%', left: '50%', size: 42 },
            { Icon: Handshake, top: '75%', left: '85%', size: 36 },
            { Icon: Send, top: '10%', left: '2%', size: 32 },
          ].map(({ Icon, top, left, size }, i) => (
            <div
              key={i}
              className="absolute opacity-40 text-primary"
              style={{ top, left }}
            >
              <Icon size={size} />
            </div>
          ))}
          <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-20 px-4 pt-10 md:px-6 xl:px-8">
            <div className="px-4 pt-10 text-center md:px-6 xl:px-8">
              <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.1] mb-4 pb-2 text-transparent bg-clip-text bg-linear-to-r from-primary via-purple-500 to-secondary">
                Connecting volunteers to their
                <br />
                <span>vision of a better community</span>
              </h1>
            </div>

            <div className="relative left-1/2 -mt-10 w-screen -translate-x-1/2 overflow-visible">
              <div className="px-4 pb-24 pt-14 md:px-6 xl:px-8">
                <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
                  <div className="max-w-2xl self-start pt-2 text-right lg:justify-self-end">
                    <h2 className="text-3xl md:text-5xl font-black leading-[1.08] tracking-[-0.04em] text-base-content mt-8">
                      Volunteer and make a difference today
                    </h2>
                    <p className="mt-6 ml-auto max-w-xl text-base leading-8 text-base-content/72">
                      Discover meaningful opportunities, apply quickly, track your applications, get certificates, and contribute where your time and skills matter most
                    </p>

                    {!auth.user?.role && (
                      <div className="mt-8">
                        <Link
                          to="/login"
                          className="btn btn-primary rounded-full px-8 shadow-lg shadow-primary/20"
                          data-testid="volunteer-login-button"
                        >
                          Log In
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="card bg-base-100 rounded-4xl flex flex-col items-center justify-center min-h-80 p-10 text-center border border-base-300 hover:border-primary hover:-translate-y-2 transition-all duration-300 shadow-xl gap-3">
                    <Users className="text-primary" size={48} />
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">For Individuals</span>
                    <h2 className="text-3xl font-bold">I want to help</h2>
                    <p className="opacity-80">Discover volunteer opportunities that match your skills.</p>
                    {auth.user?.role === 'admin'
                      ? (
                          <Button
                            disabled
                            layout="wide"
                            color="primary"
                          >
                            Admin Account Active
                          </Button>
                        )
                      : auth.user?.role === 'organization'
                        ? (
                            <Button
                              disabled
                              layout="wide"
                              color="primary"
                            >
                              Organization Account Active
                            </Button>
                          )
                        : (
                            <LinkButton
                              color="primary"
                              to={auth.user?.role === 'volunteer' ? '/volunteer' : '/volunteer/create'}
                              layout="wide"
                            >
                              {auth.user?.role === 'volunteer' ? 'Go to Dashboard' : 'Create Volunteer Account'}
                            </LinkButton>
                          )}
                  </div>
                </div>
              </div>

              <div className="relative left-1/2 -mt-4 h-24 w-screen -translate-x-1/2 text-base-100">
                <svg viewBox="0 0 1440 120" className="h-full w-full fill-current" preserveAspectRatio="none">
                  <path d="M0,56L60,64C120,72,240,88,360,90.7C480,93,600,83,720,69.3C840,56,960,40,1080,42.7C1200,45,1320,67,1380,77.3L1440,88L1440,120L1380,120C1320,120,1200,120,1080,120C960,120,840,120,720,120C600,120,480,120,360,120C240,120,120,120,60,120L0,120Z" />
                </svg>
              </div>

            </div>
          </div>
        </section>

        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-20 mt-16">

          {auth.user?.role === 'admin' && (
            <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-4">
              <Link
                to="/admin"
                className="btn btn-lg rounded-full px-7 shadow-lg bg-linear-to-r from-secondary to-primary text-white border-0 hover:-translate-y-1 transition-all duration-300"
              >
                Go to Admin Dashboard
                <ArrowRight size={18} />
              </Link>
            </div>
          )}

          <div className="bg-base-100 px-4 pt-0 pb-6 md:px-6 xl:px-8">
            <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="card bg-base-200 rounded-4xl flex flex-col items-center justify-center min-h-80 p-10 text-center border border-base-300 hover:border-secondary hover:-translate-y-2 transition-all duration-300 shadow-xl gap-3">
                <Building2 className="text-secondary" size={48} />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-secondary">For Organizations</span>
                <h2 className="text-3xl font-bold">I want help</h2>
                <p className="opacity-80">Request to register your organization and find volunteers.</p>
                {auth.user?.role === 'admin'
                  ? (
                      <Button
                        disabled
                        layout="wide"
                        color="secondary"
                      >
                        Admin Account Active
                      </Button>
                    )
                  : auth.user?.role === 'volunteer'
                    ? (
                        <Button
                          disabled
                          layout="wide"
                          color="primary"
                        >
                          Volunteer Account Active
                        </Button>
                      )
                    : (
                        <LinkButton
                          to={auth.user?.role === 'organization' ? '/organization' : '/organization/request'}
                          color="secondary"
                          layout="wide"
                        >
                          {auth.user?.role === 'organization' ? 'Go to Dashboard' : 'Request Organization Account'}
                        </LinkButton>
                      )}
              </div>

              <div className="max-w-2xl self-start pt-2 lg:justify-self-end mt-8">
                <h2 className="text-3xl md:text-5xl font-black leading-[1.04] tracking-[-0.04em] text-base-content">
                  Join and find
                  <br />
                  <span className="whitespace-nowrap text-[0.9em]">passionate volunteers</span>
                </h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-base-content/72">
                  Publish volunteering opportunities, review applications easily, track volunteer attendance, and create a real difference in society
                </p>

                {!auth.user?.role && (
                  <div className="mt-8">
                    <Link
                      to="/login"
                      className="btn btn-secondary rounded-full px-8 shadow-lg shadow-secondary/20"
                    >
                      Log In
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          <section className="space-y-8 px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-4xl font-black leading-tight tracking-[-0.04em] md:text-6xl">
                <span className="text-transparent bg-clip-text bg-linear-to-r from-primary via-purple-500 to-secondary">
                  Key features
                </span>
              </h2>
            </div>

            <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-6 md:auto-rows-[minmax(14rem,auto)]">
              {proofCards.map(({ title, body, Icon, tone }, index) => (
                <div
                  key={title}
                  className={`rounded-[2rem] border bg-base-100 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.07)] transition duration-300 hover:-translate-y-1 ${
                    index === 0
                      ? 'md:col-span-2'
                      : index === 1
                        ? 'md:col-span-2'
                        : index === 2
                          ? 'md:col-span-2'
                          : index === 3
                            ? 'md:col-span-3'
                            : 'md:col-span-3'
                  } ${
                    tone === 'primary'
                      ? 'border-primary/14 hover:border-primary/30 hover:shadow-[0_0_36px_rgba(99,102,241,0.18)]'
                      : tone === 'secondary'
                        ? 'border-secondary/14 hover:border-secondary/30 hover:shadow-[0_0_36px_rgba(228,169,209,0.28)]'
                        : tone === 'success'
                          ? 'border-success/14 hover:border-success/30 hover:shadow-[0_0_36px_rgba(135,222,137,0.28)]'
                          : tone === 'info'
                            ? 'border-info/14 hover:border-info/30 hover:shadow-[0_0_36px_rgba(59,130,246,0.18)]'
                            : 'border-accent/14 hover:border-accent/30 hover:shadow-[0_0_36px_rgba(135,222,214,0.28)]'
                  }`}
                >
                  <div className="mb-5 flex items-center gap-4">
                    <div className={`inline-flex rounded-full p-3 ${
                      tone === 'primary'
                        ? 'bg-primary/15 text-primary'
                        : tone === 'secondary'
                          ? 'bg-secondary/15 text-secondary'
                          : tone === 'success'
                            ? 'bg-success/15 text-success'
                            : tone === 'info'
                              ? 'bg-info/15 text-info'
                              : 'bg-accent/15 text-accent'
                    }`}
                    >
                      <Icon size={22} />
                    </div>
                    <h3 className="text-2xl font-black leading-tight tracking-[-0.03em] text-base-content">{title}</h3>
                  </div>
                  <p className="text-sm leading-7 text-base-content/70">{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="overflow-hidden py-16">
            {loading && (
              <div className="flex w-full items-center justify-center py-4 loading-spinner">
                <span className="loading loading-spinner loading-lg text-primary" />
              </div>
            )}
            {error && (
              <div className="flex w-full items-center justify-center py-4 text-error font-bold">{error}</div>
            )}
            {!error && (
              <StatsCarousel
                totalVolunteers={stats?.totalVolunteers ?? null}
                totalOpportunities={stats?.totalOpportunities ?? null}
                totalOrganizations={stats?.totalOrganizations ?? null}
                newVolunteersThisWeek={stats?.newVolunteersThisWeek ?? null}
                newOpportunitiesThisWeek={stats?.newOpportunitiesThisWeek ?? null}
                newOrganizationsThisWeek={stats?.newOrganizationsThisWeek ?? null}
                explorePath={auth.user
                  ? auth.user.role === 'admin'
                    ? '/admin'
                    : auth.user.role === 'organization'
                      ? '/organization'
                      : '/volunteer'
                  : '/login'}
              />
            )}
          </section>
        </div>

        <div className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-6 xl:px-8 mt-12 mb-24">
          <section className="rounded-[2rem] border border-primary/25 bg-base-100 p-8 shadow-[0_18px_60px_rgba(0,0,0,0.07)] md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Public Verification</p>
                <h2 className="mt-3 text-3xl font-black leading-tight tracking-[-0.03em] text-base-content md:text-4xl">
                  Verify a Certificate
                </h2>
                <p className="mt-3 max-w-2xl text-base text-base-content/75">
                  Check certificate authenticity instantly with a verification token. No login required.
                </p>
              </div>
              <div className="md:shrink-0">
                <LinkButton
                  to="/certificate/verify"
                  color="primary"
                  layout="wide"
                  Icon={FileSearch}
                >
                  Open Verification Page
                </LinkButton>
              </div>
            </div>
          </section>
        </div>

        <div className="w-full bg-base-200">
          <svg viewBox="0 0 1440 120" className="w-full text-base-100" preserveAspectRatio="none" height="120">
            <path d="M0,56L60,64C120,72,240,88,360,90.7C480,93,600,83,720,69.3C840,56,960,40,1080,42.7C1200,45,1320,67,1380,77.3L1440,88L1440,0L1380,0C1320,0,1200,0,1080,0C960,0,840,0,720,0C600,0,480,0,360,0C240,0,120,0,60,0L0,0Z" fill="currentColor" />
          </svg>

          <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-20 md:px-6 xl:px-8">
            <section className="text-center min-h-72 flex flex-col items-center justify-center">
              <h2 className="text-4xl font-extrabold tracking-tight text-base-content">Want to Learn More?</h2>
              <p className="mt-4 text-lg text-base-content/80">Check out our guide page for full details!</p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <LinkButton
                  to="/guide"
                  color="secondary"
                  layout="wide"
                >
                  Read Our Guide
                </LinkButton>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default HomePage;
