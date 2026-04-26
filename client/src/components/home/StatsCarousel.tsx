import { Users, BriefcaseMedical, Building2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

type StatsCarouselProps = {
  totalVolunteers: number | null;
  totalOpportunities: number | null;
  totalOrganizations: number | null;
  newVolunteersThisWeek: number | null;
  newOpportunitiesThisWeek: number | null;
  newOrganizationsThisWeek: number | null;
  explorePath: string;
};

function StatsCarousel({ totalVolunteers, totalOpportunities, totalOrganizations, newVolunteersThisWeek, newOpportunitiesThisWeek, newOrganizationsThisWeek, explorePath }: StatsCarouselProps) {
  const [active, setActive] = useState(0);

  const formatWeekly = (value: number | null) => {
    const count = value ?? 0;
    return `+${count} this week`;
  };

  const cards = [
    {
      value: totalVolunteers,
      label: 'Volunteers',
      description:
        'Passionate people that are ready to support causes, apply quickly, and contribute where help is needed most.',
      detail: formatWeekly(newVolunteersThisWeek),
      Icon: Users,
    },
    {
      value: totalOpportunities,
      label: 'Opportunities',
      description:
        'Real openings from approved organizations, making it easier for volunteers to discover where they can step in and help today.',
      detail: formatWeekly(newOpportunitiesThisWeek),
      Icon: BriefcaseMedical,
    },
    {
      value: totalOrganizations,
      label: 'Organizations',
      description:
        'Trusted groups creating volunteer calls, coordinating support, and turning community effort into action.',
      detail: formatWeekly(newOrganizationsThisWeek),
      Icon: Building2,
    },
  ];

  const prev = () => setActive(i => (i - 1 + cards.length) % cards.length);
  const next = () => setActive(i => (i + 1) % cards.length);

  const leftIndex = (active - 1 + cards.length) % cards.length;
  const rightIndex = (active + 1) % cards.length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        setActive(i => (i - 1 + cards.length) % cards.length);
      } else if (event.key === 'ArrowRight') {
        setActive(i => (i + 1) % cards.length);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cards.length]);

  return (
    <div className="flex items-center justify-center gap-6">
      <button
        type="button"
        onClick={prev}
        aria-label="Show previous stat"
        className="btn btn-circle border border-base-content/10 hover:border-primary/40 hover:text-primary transition-all max-lg:absolute left-2 z-999"
      >
        ‹
      </button>

      <div className="flex items-center justify-center gap-4">
        <div
          role="button"
          tabIndex={0}
          onClick={prev}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              prev();
            }
          }}
          className="relative w-56 h-[22rem] py-12 px-5 pb-16 rounded-[1.5rem] bg-base-200 border border-base-content/10 text-center cursor-pointer scale-95 opacity-60 transition-all duration-500 hover:opacity-80"
        >
          <div className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-secondary">
            {cards[leftIndex].value != null ? cards[leftIndex].value.toLocaleString() : '...'}
          </div>
          <div className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-base-content">
            {cards[leftIndex].label}
          </div>
          <p className="mt-3 text-sm leading-7 text-base-content/80 line-clamp-3">
            {cards[leftIndex].description}
          </p>
        </div>

        <div
          className="relative w-64 h-[28rem] py-16 px-6 pb-16 rounded-[1.5rem] bg-base-200 border-2 border-primary/30 text-center scale-105 opacity-100 shadow-xl shadow-primary/10 z-10 transition-all duration-500"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-secondary">
            {cards[active].value != null ? cards[active].value.toLocaleString() : '...'}
          </div>
          <div className="mt-3 text-base font-black uppercase tracking-[0.2em] text-base-content">
            {cards[active].label}
          </div>
          <p className="mt-3 text-sm leading-7 text-base-content/80">{cards[active].description}</p>
          <div className="absolute bottom-6 left-5 right-5 flex justify-center items-center gap-2 text-sm whitespace-normal text-center">
            <span className="text-base-content/70 font-normal">{cards[active].detail}</span>
            <span className="text-base-content/70">|</span>
            <Link to={explorePath} data-testid="stats-explore-link" className="text-primary font-bold inline-flex items-center underline-offset-3 hover:underline">
              Explore
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-4 w-4"><path d="M13.172 12l-4.95-4.95 1.414-1.414L16 12l-6.364 6.364-1.414-1.414z" /></svg>
            </Link>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={next}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              next();
            }
          }}
          className="relative w-56 h-[22rem] py-12 px-5 pb-16 rounded-[1.5rem] bg-base-200 border border-base-content/10 text-center cursor-pointer scale-95 opacity-60 transition-all duration-500 hover:opacity-80"
        >
          <div className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-secondary">
            {cards[rightIndex].value != null ? cards[rightIndex].value.toLocaleString() : '...'}
          </div>
          <div className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-base-content">
            {cards[rightIndex].label}
          </div>
          <p className="mt-3 text-sm leading-7 text-base-content/80 line-clamp-3">
            {cards[rightIndex].description}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={next}
        aria-label="Show next stat"
        className="btn btn-circle border border-base-content/10 hover:border-primary/40 hover:text-primary transition-all max-lg:absolute right-2 z-999"
      >
        ›
      </button>
    </div>
  );
}

export default StatsCarousel;
