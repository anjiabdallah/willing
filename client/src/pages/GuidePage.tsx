import {
  AlertTriangle,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  CircleCheck,
  ClipboardCheck,
  Clock,
  FileText,
  Flame,
  Globe,
  Hammer,
  Heart,
  Lock,
  MapPin,
  Megaphone,
  Paperclip,
  Search,
  Send,
  ShieldCheck,
  Users,
  Unlock,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';

import AuthContext from '../auth/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';
import Footer from '../components/layout/Footer';
import UserNavbar from '../components/layout/navbars/UserNavbar';
import PageContainer from '../components/layout/PageContainer';
import LinkButton from '../components/LinkButton';

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'volunteers', label: 'For Volunteers' },
  { id: 'organizations', label: 'For Organizations' },
  { id: 'postings', label: 'Postings Explained' },
  { id: 'crises', label: 'Crises' },
  { id: 'certificates', label: 'Certificates' },
  { id: 'faq', label: 'FAQ' },
];

const getOffsetTopRelativeToContainer = (el: HTMLElement, container: HTMLElement) => {
  let offset = 0;
  let current = el;

  while (current && current !== container) {
    offset += current.offsetTop;
    current = current.offsetParent as HTMLElement;
  }

  return offset;
};

function GuidePage() {
  const auth = useContext(AuthContext);
  const [activeSection, setActiveSection] = useState('overview');
  const activeSectionRef = useRef('overview');
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const sectionScrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      scrollContainerRef.current?.scrollTo({
        top: el.offsetTop - 86,
        behavior: 'smooth',
      });
      activeSectionRef.current = id;
      setActiveSection(id);
    }
  };

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    setActiveSection('overview');
    activeSectionRef.current = 'overview';
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      let current = sections[0].id;

      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (!el) continue;

        const elTop = getOffsetTopRelativeToContainer(el, container);

        if (container.scrollTop >= elTop - container.clientHeight * 0.3) {
          current = section.id;
        }
      }

      if (current !== activeSectionRef.current) {
        activeSectionRef.current = current;
        setActiveSection(current);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const timelineStepsVolunteer = useMemo(
    () => [
      {
        id: 'create-account',
        icon: UserPlus,
        title: 'Create your account',
        description: 'Sign up as a volunteer. Fill in your name, email, and age, and verify your email',
      },
      {
        id: 'build-profile',
        icon: ClipboardCheck,
        title: 'Build your profile & add skills',
        description: 'Add the skills you bring to the table, add a description about who you are, and attach your cv',
      },
      {
        id: 'discover-postings',
        icon: Search,
        title: 'Discover postings',
        description: 'Browse all opportunities. Filter by crisis, date range, required skills, or location to find what fits you best',
      },
      {
        id: 'apply-posting',
        icon: Send,
        title: 'Apply to a posting',
        description: 'Hit apply and optionally include a message explaining why you\'re a great fit. You can apply to multiple postings at once',
      },
      {
        id: 'accepted-attend',
        icon: CheckCircle2,
        title: 'Get accepted & attend',
        description: 'For open postings you\'re enrolled immediately. For review-based postings, wait for the organization to accept you. Show up on time and contribute',
      },
      {
        id: 'marked-attended',
        icon: Calendar,
        title: 'Get marked as attended',
        description: 'After the event, the organization marks you as attended. This is what counts toward your certificate hours.',
      },
      {
        id: 'generate-certificate',
        icon: Award,
        title: 'Generate your certificate',
        description: 'Once eligible, generate a verified certificate showing your hours, the organizations you helped, and the signatures',
      },
    ],
    [],
  );

  const timelineStepsOrganization = useMemo(
    () => [
      {
        id: 'request-account',
        icon: Paperclip,
        title: 'Request an account',
        description: 'Submit your organization\'s details and contact info. Your request goes to the Willing admin for review',
      },
      {
        id: 'admin-approval',
        icon: ShieldCheck,
        title: 'Wait for admin approval',
        description: 'The admin reviews your request and either approves or rejects it. You\'ll be notified either way',
      },
      {
        id: 'setup-profile',
        icon: Users,
        title: 'Set up your profile',
        description: 'Add your organization logo, a signatory name and position, and upload a signature image. These appear on volunteer certificates',
      },
      {
        id: 'min-hours',
        icon: Clock,
        title: 'Set a minimum hours threshold',
        description: 'Define the minimum number of volunteer hours required before a volunteer becomes eligible for a certificate from your organization',
      },
      {
        id: 'create-postings',
        icon: Megaphone,
        title: 'Create postings',
        description: 'Publish volunteer opportunities with a title, description, time window, location, required skills, optional minimum age, and optional volunteer cap',
      },
      {
        id: 'enrollment-type',
        icon: Unlock,
        title: 'Choose open or review-based enrollment',
        description: 'Decide whether applicants are accepted automatically (open) or require your manual review (review-based). You can also close a posting at any time to stop new applications',
      },
      {
        id: 'review-applications',
        icon: ClipboardCheck,
        title: 'Review applications',
        description: 'For review-based postings, see each applicant\'s profile, skills, and message. Accept or reject individually',
      },
      {
        id: 'mark-attendance',
        icon: CheckCircle2,
        title: 'Mark attendance',
        description: 'After the event, mark which enrolled volunteers actually showed up. Only attended volunteers count toward certificates',
      },
    ],
    [],
  );

  const getTimelineStep = (step: { id: string; icon: LucideIcon; title: string; description: string }, index: number) => {
    const SideIcon = step.icon;
    const isLeft = index % 2 === 0;

    return (
      <div key={step.id} className="mb-10">
        <div className="lg:grid lg:grid-cols-12 lg:items-center">
          {isLeft
            ? (
                <div className="lg:col-span-5 lg:text-right">
                  <Card className="inline-block max-w-lg hover:shadow-lg transition" padding>
                    <h3 className="font-bold text-lg mb-1">{step.title}</h3>
                    <p className="text-sm opacity-75">{step.description}</p>
                  </Card>
                </div>
              )
            : (
                <div className="lg:col-span-5" />
              )}

          <div className="lg:col-span-2 flex justify-center items-center relative">
            <div className="absolute h-full border-l-2 border-dashed border-primary-focus top-2 bottom-0" />
            <div className="relative z-10 bg-linear-to-br from-primary to-secondary rounded-full p-3 shadow-lg text-white">
              <SideIcon size={20} />
            </div>
          </div>

          {isLeft
            ? (
                <div className="lg:col-span-5" />
              )
            : (
                <div className="lg:col-span-5 lg:text-left">
                  <Card className="inline-block max-w-lg hover:shadow-lg transition" padding>
                    <h3 className="font-bold text-lg mb-1">{step.title}</h3>
                    <p className="text-sm opacity-75">{step.description}</p>
                  </Card>
                </div>
              )}
        </div>
      </div>
    );
  };

  return (
    <main className="h-screen flex flex-col">
      <UserNavbar />
      <div ref={scrollContainerRef} className="overflow-y-scroll flex-1">
        <PageContainer>
          <div className="flex w-full gap-6">
            <aside className="hidden lg:block sticky top-4 h-[calc(100vh-4.5rem)] overflow-y-auto shrink-0 w-64 p-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-base-content/60 mb-3">Guide navigation</h2>
              <ul className="space-y-2">
                {sections.map(section => (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => sectionScrollTo(section.id)}
                      className={`w-full text-left py-2 px-3 rounded-lg text-sm transition duration-150 cursor-pointer ${activeSection === section.id ? 'bg-linear-to-r from-primary to-secondary text-white' : 'hover:bg-base-300 text-base-content'}`}
                    >
                      {section.label}
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            <main className="grow">
              <div className="lg:hidden sticky top-12 z-20 bg-base-100 py-2 border-b border-base-300">
                <div className="flex gap-2 px-2 overflow-x-auto scrollbar-hide">
                  {sections.map(section => (
                    <button
                      type="button"
                      key={`mobile-${section.id}`}
                      onClick={() => sectionScrollTo(section.id)}
                      className={`btn btn-xs rounded-full normal-case ${activeSection === section.id ? 'btn-primary' : 'btn-ghost'}`}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
              </div>

              <section className="relative rounded-3xl bg-base-100 p-10 text-base-content overflow-visible mb-2">
                <div className="absolute inset-0 opacity-12">
                  <Heart className="absolute top-8 left-8 text-primary" size={42} />
                  <ShieldCheck className="absolute top-16 right-12 text-secondary" size={46} />
                  <Award className="absolute bottom-12 left-28 text-secondary" size={38} />
                  <Send className="absolute bottom-16 right-32 text-indigo-400" size={30} />
                </div>
                <div className="relative z-10 max-w-4xl">
                  <h1 className="text-3xl md:text-5xl font-black leading-[1.1] pb-2 mb-2 bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
                    Your Complete Guide to Willing
                  </h1>
                  <p className="text-lg md:text-xl opacity-90 max-w-3xl mb-6">
                    Learn how the platform works — from signing up to earning your first certificate.
                  </p>
                </div>
              </section>

              <section id="overview" className="mt-6 bg-base-200 rounded-3xl p-6 lg:p-10">
                <h2 className="text-3xl font-black mb-6 bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">Platform Overview — What Is Willing?</h2>
                <div className="grid gap-4 md:grid-cols-3 mb-8">
                  <Card
                    title="Volunteers"
                    description="People who want to make an impact and earn verified recognition."
                    Icon={Users}
                    color="primary"
                    className="hover:shadow-lg transition"
                  />
                  <Card
                    title="Organizations"
                    description="Verified cause-driven organizations that publish opportunities."
                    Icon={Building2}
                    color="secondary"
                    className="hover:shadow-lg transition"
                  />
                  <Card
                    title="Opportunities"
                    description="Real-world volunteering projects sorted by urgency, skills, and location."
                    Icon={Megaphone}
                    color="accent"
                    className="hover:shadow-lg transition"
                  />
                </div>
              </section>

              <section id="volunteers" className="py-20 bg-base-100 rounded-3xl p-6 lg:p-10 mb-10">
                <h2 className="text-3xl font-black mb-8 bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">Volunteer Journey</h2>
                <div className="card p-6">
                  <div className="relative">
                    <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 border-l-2 border-dashed border-primary-focus" />
                    <div className="flex flex-col lg:space-y-0">
                      {timelineStepsVolunteer.map((step, index) => getTimelineStep(step, index))}
                    </div>
                  </div>
                </div>
              </section>

              <section id="organizations" className="py-20 bg-base-100 rounded-3xl p-6 lg:p-10 mb-10">
                <h2 className="text-3xl font-black mb-8 bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">Organization Journey</h2>
                <div className="card p-6">
                  <div className="relative">
                    <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 border-l-2 border-dashed border-primary-focus" />
                    <div className="flex flex-col lg:space-y-0">
                      {timelineStepsOrganization.map((step, index) => getTimelineStep(step, index))}
                    </div>
                  </div>
                </div>
              </section>

              <section id="postings" className="py-20 bg-base-100 rounded-3xl p-6 lg:p-10 mb-10">
                <h2 className="text-3xl font-black mb-8 bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">Postings Explained — Deep Dive</h2>
                <div className="grid gap-4 lg:grid-cols-3 mb-10">
                  <Card className="hover:shadow-lg transition border border-primary!" title="Open vs Review-Based" description="Postings that are open allow volunteers to be automatically accepted when they apply to a posting. Review-based postings require manual acceptance by the organization itself" Icon={Unlock} color="primary" padding>
                    <div className="badge badge-primary mb-2">Open / Review</div>
                  </Card>
                  <Card className="hover:shadow-lg transition border border-secondary!" title="Partial vs Full" description="Partial commitment allows volunteers to select specific days that they wanna volunteer in and commit to. Full commitment means volunteers must commit to all days of the posting if they sign up to it" Icon={Users} color="secondary" padding>
                    <div className="badge badge-secondary mb-2">Flexible Engagement</div>
                  </Card>
                  <Card className="hover:shadow-lg transition border border-accent!" title="Closed Posting" description="Closed postings mean that the opportunity is no longer accepting new applications, but existing enrollments remain unaffected. Organizations can manually close postings" Icon={Lock} color="accent" padding>
                    <div className="badge badge-accent mb-2">No Longer Accepting</div>
                  </Card>
                </div>

                <h3 className="text-xl font-bold mb-4">Posting Fields — What&apos;s Inside a Posting?</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-10">
                  {[
                    { icon: FileText, label: 'Title & Description' },
                    { icon: Calendar, label: 'Start & End Date/Time' },
                    { icon: MapPin, label: 'Location' },
                    { icon: Hammer, label: 'Required Skills' },
                    { icon: Users, label: 'Max Volunteers (optional)' },
                    { icon: ShieldCheck, label: 'Minimum Age (optional)' },
                    { icon: AlertTriangle, label: 'Linked Crisis (optional)' },
                    { icon: CircleCheck, label: 'Commitment (full / partial)' },
                    { icon: Lock, label: 'Status (open / closed)' },
                  ].map(field => (
                    <Card key={field.label} className="hover:shadow-lg transition" padding>
                      <div className="flex items-center gap-2 mb-1 text-base-content font-bold">
                        <field.icon size={18} className="text-base-content" />
                        <span>{field.label}</span>
                      </div>
                    </Card>
                  ))}
                </div>

                <h3 className="text-xl font-bold mb-4">Enrollment vs Application — What&apos;s the difference?</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="hover:shadow-lg transition" title="Application" description="What a volunteer submits. Includes an optional message. Pending until approved." Icon={Paperclip} />
                  <Card className="hover:shadow-lg transition" title="Enrollment" description="A confirmed spot. Automatic for open postings, or after org acceptance for review-based." Icon={CheckCircle2} />
                </div>
              </section>

              <section id="crises" className="py-20 bg-base-200 rounded-3xl p-6 lg:p-10 mb-10">
                <div className="mb-6">
                  <h2 className="text-3xl font-black bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">Crisis Events: Real situations, urgent action</h2>
                </div>

                <div className="mb-6">
                  <h3 className="font-bold">What is a crisis?</h3>
                  <p className="text-base-content/80">A crisis is a specific real-world event that requires immediate action and help. The Willing admin can create crises and pin them to highlight urgency. Pinned crises appear on the voluntees home page. Organizations can add crises as tags to their postings</p>
                </div>

                <h3 className="font-bold mb-3">Why it matters</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="hover:shadow-lg transition" title="Speed" description="Connecting organizations and volunteers for urgent situations that require immediate attention" Icon={Flame} />
                  <Card className="hover:shadow-lg transition" title="Context" description="Organizations frame why help is needed, and relate their postings to a larger context" Icon={Globe} />
                  <Card className="hover:shadow-lg transition" title="Impact" description="Crisis-linked postings track collective response and are able to make a bigger impact" Icon={Users} />
                </div>
              </section>

              <section id="certificates" className="py-20 bg-base-100 rounded-3xl p-6 lg:p-10 mb-10">
                <div className="mb-6">
                  <h2 className="text-3xl font-black bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">Verified Certificates of Participation</h2>
                </div>

                <div className="mb-6">
                  <h3 className="font-bold">What is a certificate?</h3>
                  <p className="text-base-content/80">A certificate is generated by the volunteer and documents their total hours of service. It includes volunteer name, eligible organizations, hours per organization, org signatory details, org signature, and admin signature. It can be shared via unique public URL and verified by anyone — employers, universities, institutions.</p>
                </div>

                <div className="mb-6">
                  <h3 className="font-bold">Eligibility — When can a volunteer generate one?</h3>
                  <ul className="list-disc pl-5 text-base-content/80 space-y-1">
                    <li>The volunteer has been marked as attended in at least one enrollment</li>
                    <li>The volunteer meets the threshold (minimum number of required hours) for an organization(s)</li>
                  </ul>
                  <p className="text-sm text-base-content/70 mt-2">Only eligible organizations appear on the generated certificate; ineligible ones are excluded silently.</p>
                </div>

                <div>
                  <h3 className="font-bold">Verification</h3>
                  <p className="text-base-content/80">Certificates have unique URLs and can be viewed read-only by anyone. No account is required to confirm authenticity.</p>
                </div>
              </section>

              <section id="faq" className="py-10 bg-base-200 rounded-3xl p-6 lg:p-10 mb-10">
                <h2 className="text-3xl font-black mb-6 bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">Frequently Asked Questions</h2>
                <div className="space-y-2">
                  {[
                    ['What\'s the difference between an open and review-based posting?', 'Open postings mean you are automatically accepted when you apply; review-based postings need manual approval from the organization itself.'],
                    ['Can I apply to multiple postings at the same time?', 'Yes — apply for as many opportunities as you like, as long as you can attend them.'],
                    ['What happens if I apply to a review-based posting and get rejected?', 'If you apply to a review-based posting and get rejected, you get an email of rejection. You can imrpove your profile and apply again, and you can apply to other postings.'],
                    ['How does the organization know I attended?', 'Organizations mark attendance after an event, and only marked attendances are eligible for certificates.'],
                    ['What do I need before I can generate a certificate, and how do I generate it?', 'To be eligible for a certificate generation you must apply and attend at least one posting, and the organization must mark you as present. Once that is done, you can go to your profile and see what organizations you are eligible to add to your certificate (where you meet the min number of hours required), and then select at most 4 organizations that you want to appear on your certificate, and press generate certificate. '],
                    ['Can my certificate be faked or tampered with?', 'No — every certificate is signed and verifiable via a unique token. To verify someone\'s certificate, simply ask for the token, go to the end of the homepage and enter it there.'],
                    ['What happens if an organization hasn\'t set up their signature yet?', 'That organization will be excluded from your certificate until they complete setup.'],
                    ['Is Willing free to use?', 'Yes — Willing is free for volunteers and organizations as a community platform.'],
                  ].map(([q, a], i) => (
                    <div key={q} className="collapse collapse-arrow border border-base-300 bg-base-100 rounded-box">
                      <input type="checkbox" defaultChecked={i === 0} />
                      <div className="collapse-title text-base font-bold">{q}</div>
                      <div className="collapse-content text-base-content/80"><p>{a}</p></div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="py-6 grid gap-4 md:grid-cols-2 mb-10">
                <Card
                  color="primary"
                  title="Start volunteering today"
                  description="Find your first opportunity, apply, and start earning certificate hours."
                >
                  {auth.user?.role === 'admin'
                    ? (
                        <Button disabled color="primary">Admin Account Active</Button>
                      )
                    : auth.user?.role === 'organization'
                      ? (
                          <Button disabled color="primary">Organization Account Active</Button>
                        )
                      : auth.user?.role === 'volunteer'
                        ? (
                            <LinkButton to="/volunteer" color="primary">Go to Dashboard</LinkButton>
                          )
                        : (
                            <LinkButton to="/volunteer/create" color="primary">Get Started</LinkButton>
                          )}
                </Card>
                <Card
                  color="secondary"
                  title="Register your organization"
                  description="Publish your first posting and start matching with local volunteers."
                >
                  {auth.user?.role === 'admin'
                    ? (
                        <Button disabled color="secondary">Admin Account Active</Button>
                      )
                    : auth.user?.role === 'volunteer'
                      ? (
                          <Button disabled color="secondary">Volunteer Account Active</Button>
                        )
                      : auth.user?.role === 'organization'
                        ? (
                            <LinkButton to="/organization" color="secondary">Go to Dashboard</LinkButton>
                          )
                        : (
                            <LinkButton to="/organization/request" color="secondary">Register</LinkButton>
                          )}
                </Card>
              </section>
            </main>
          </div>
        </PageContainer>
        <Footer />
      </div>
    </main>
  );
}

export default GuidePage;
