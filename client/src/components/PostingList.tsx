import { AlertTriangle, Ban, Cake, Calendar, CalendarX2, CheckCircle2, ClipboardList, Clock, ExternalLink, LockOpen, MapPin, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import OrganizationProfilePicture from './OrganizationProfilePicture';
import { DOMAIN_COLORS } from '../constants';
import { formatCardDate, formatTime12Hour, hasPostingEnded, isPostingFullyBooked, normalizeTimestamp } from './postings/postingUtils';
import useNow from './postings/useNow.ts';
import SkillsList from './skills/SkillsList';
import { toIsoDate, toLocalDateTime } from '../utils/timeUtils.ts';

import type { PostingWithContext } from '../../../server/src/types';

interface PostingListProps {
  posting: PostingWithContext;
  showCrisis?: boolean;
  crisisTagClickable?: boolean;
  crisisBasePath?: string;
  variant?: 'volunteer' | 'organization';
  compactOrganizationLayout?: boolean;
  volunteerOutsideMetaAt1700?: boolean;
  showOrganizationName?: boolean;
}

function PostingList({
  posting,
  showCrisis = true,
  crisisTagClickable = true,
  crisisBasePath = '/volunteer/crises',
  variant = 'volunteer',
  compactOrganizationLayout = false,
  volunteerOutsideMetaAt1700 = false,
  showOrganizationName = variant === 'volunteer',
}: PostingListProps) {
  const postingDetailsPath = `/posting/${posting.id}`;
  const hasOrganizationName = Boolean(posting.organization_name);

  const startDt = normalizeTimestamp(posting.start_date);
  const endDt = normalizeTimestamp(posting.end_date);
  const hasEndDate = Boolean(endDt);

  const now = useNow();
  const hasEnded = useMemo(
    () => Boolean(posting.has_ended || hasPostingEnded(posting, now)),
    [now, posting],
  );

  const startLocalDate = posting.start_time
    ? toLocalDateTime(posting.start_time.slice(0, 5), toIsoDate(posting.start_date) ?? '')
    : null;
  const endLocalDate = posting.end_time && posting.end_date
    ? toLocalDateTime(posting.end_time.slice(0, 5), toIsoDate(posting.end_date) ?? '')
    : null;
  const startDateStr = startLocalDate
    ? formatCardDate(new Date(`${startLocalDate.date}T00:00:00Z`))
    : (formatCardDate(startDt) || 'TBA');
  const endDateStr = endLocalDate
    ? formatCardDate(new Date(`${endLocalDate.date}T00:00:00Z`))
    : (formatCardDate(endDt) || 'TBA');
  const startTimeStr = formatTime12Hour(posting.start_time || '', toIsoDate(posting.start_date))
    || (startDt
      ? startDt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
      : 'TBA');
  const endTimeStr = formatTime12Hour(posting.end_time || '', toIsoDate(posting.end_date ?? posting.start_date))
    || (endDt
      ? endDt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
      : 'TBA');

  const volunteerFilled = posting.enrollment_count ?? 0;
  const volunteerCountText = posting.max_volunteers
    ? `${volunteerFilled}/${posting.max_volunteers}`
    : `${volunteerFilled}`;
  const locationText = posting.location_name || 'TBA';
  const isPostingFull = isPostingFullyBooked(posting);

  const statusTag = hasEnded
    ? (
        <span className="badge badge-sm badge-neutral inline-flex items-center gap-1">
          <CalendarX2 size={12} />
          Ended
        </span>
      )
    : posting.is_closed
      ? (
          <span className="badge badge-sm badge-error inline-flex items-center gap-1">
            <Ban size={12} />
            Closed
          </span>
        )
      : posting.application_status === 'pending'
        ? (
            <span className={`badge badge-${DOMAIN_COLORS.pending} badge-sm inline-flex items-center gap-1`}>
              <Clock size={12} />
              Pending
            </span>
          )
        : posting.application_status === 'registered'
          ? (
              <span className={`badge badge-${DOMAIN_COLORS.enrollment} badge-sm inline-flex items-center gap-1`}>
                <CheckCircle2 size={12} />
                Enrolled
              </span>
            )
          : isPostingFull
            ? (
                <span className="badge badge-sm badge-error inline-flex items-center gap-1">
                  <Users size={12} />
                  Full
                </span>
              )
            : posting.automatic_acceptance
              ? (
                  <span className="badge badge-sm badge-primary inline-flex items-center gap-1">
                    <LockOpen size={12} />
                    Open
                  </span>
                )
              : (
                  <span className="badge badge-sm badge-secondary inline-flex items-center gap-1 whitespace-nowrap">
                    <ClipboardList size={12} />
                    Review Based
                  </span>
                );

  const organizationMetaGridClasses = compactOrganizationLayout
    ? 'min-[1700px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] min-[1700px]:grid-rows-2'
    : '2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-rows-2';
  const organizationTitleColumnClasses = compactOrganizationLayout
    ? 'min-[1700px]:row-span-2 min-[1700px]:flex min-[1700px]:self-stretch min-[1700px]:flex-col'
    : '2xl:row-span-2 2xl:flex 2xl:self-stretch 2xl:flex-col';
  const organizationTitleAlignmentClasses = compactOrganizationLayout
    ? (hasOrganizationName ? 'min-[1700px]:justify-start' : 'min-[1700px]:justify-center')
    : (hasOrganizationName ? '2xl:justify-start' : '2xl:justify-center');
  const outsideMetaLabelVisibleClass = variant === 'organization'
    ? (compactOrganizationLayout ? 'min-[1700px]:inline-flex' : '2xl:inline-flex')
    : (volunteerOutsideMetaAt1700 ? 'min-[1700px]:inline-flex' : 'lg:inline-flex');
  const outsideMetaValueVisibleClass = variant === 'organization'
    ? (compactOrganizationLayout ? 'min-[1700px]:block' : '2xl:block')
    : (volunteerOutsideMetaAt1700 ? 'min-[1700px]:block' : 'lg:block');
  const insideMetaVisibleClass = variant === 'organization'
    ? (compactOrganizationLayout ? 'block min-[1700px]:hidden' : '2xl:hidden')
    : (volunteerOutsideMetaAt1700 ? 'min-[1700px]:hidden' : 'lg:hidden');
  const organizationTagInlineClass = compactOrganizationLayout
    ? 'block min-[1700px]:hidden'
    : 'block 2xl:hidden';
  const organizationTagBelowClass = compactOrganizationLayout
    ? 'hidden min-[1700px]:block'
    : 'hidden 2xl:block';
  const volunteerTagNearTitleClass = volunteerOutsideMetaAt1700
    ? 'block min-[1700px]:hidden'
    : 'block lg:hidden 2xl:block';
  const volunteerTagNearOrganizationClass = volunteerOutsideMetaAt1700
    ? 'hidden min-[1700px]:block'
    : 'hidden lg:block 2xl:hidden';

  const crisisTagContent = (
    <>
      <AlertTriangle size={14} />
      <span className="truncate max-w-40 font-semibold" title={posting.crisis_name ?? undefined}>{posting.crisis_name}</span>
    </>
  );

  return (

    <div className="relative overflow-visible">
      {showCrisis && posting.crisis_name && posting.crisis_id && (
        crisisTagClickable
          ? (
              <Link
                to={`${crisisBasePath}/${posting.crisis_id}/postings`}
                onClick={event => event.stopPropagation()}
                className="absolute -top-2 right-1 z-20 pointer-events-auto inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-sm text-accent-content shadow-sm rotate-3 transition-transform duration-200 hover:rotate-0"
              >
                {crisisTagContent}
              </Link>
            )
          : (
              <span className="absolute -top-2 right-1 z-20 inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-sm text-accent-content shadow-sm rotate-3">
                {crisisTagContent}
              </span>
            )
      )}

      <article className="collapse collapse-arrow relative border border-base-300 bg-base-100 shadow-sm hover:shadow-md transition-shadow">
        <input type="checkbox" />

        <div className="collapse-title z-10 pointer-events-none flex items-center gap-3 pr-12">
          <div className="relative shrink-0 pointer-events-auto">
            <OrganizationProfilePicture
              organizationName={posting.organization_name ?? 'Organization'}
              organizationId={posting.organization_id}
              logoPath={posting.organization_logo_path}
              size={44}
              linkToOrganizationPage
              linkClassName="avatar avatar-placeholder"
              onLinkClick={event => event.stopPropagation()}
            />
          </div>

          <div className="min-w-0 flex-1 relative">
            <div className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 ${variant === 'organization' ? organizationMetaGridClasses : 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-2'}`}>
              <div
                className={`min-w-0 ${variant === 'organization' ? organizationTitleColumnClasses : 'lg:row-span-2 lg:flex lg:self-stretch lg:flex-col'} ${variant === 'organization' ? organizationTitleAlignmentClasses : (hasOrganizationName ? 'lg:justify-start' : 'lg:justify-center')}`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Link
                    to={postingDetailsPath}
                    onClick={event => event.stopPropagation()}
                    className="link link-primary link-hover no-underline hover:underline inline-flex min-w-0 items-center gap-2 pointer-events-auto"
                  >
                    <span className="truncate text-lg font-semibold leading-tight text-primary" title={posting.title}>
                      {posting.title}
                    </span>
                    <ExternalLink size={14} />
                  </Link>

                  {variant === 'organization' && (
                    <div className={`shrink-0 opacity-100 ${organizationTagInlineClass}`}>{statusTag}</div>
                  )}

                  {variant === 'volunteer' && (
                    <div className={`shrink-0 opacity-100 ${volunteerTagNearTitleClass}`}>{statusTag}</div>
                  )}
                </div>

                {variant === 'organization' && (
                  <div className="mt-1 flex min-w-0 items-center gap-2">
                    {showOrganizationName && posting.organization_name && (
                      <Link
                        to={`/organization/${posting.organization_id}`}
                        onClick={event => event.stopPropagation()}
                        className="pointer-events-auto text-primary link link-hover no-underline hover:underline text-xs self-start"
                      >
                        {posting.organization_name}
                      </Link>
                    )}
                    <div className={`shrink-0 opacity-100 ${organizationTagBelowClass}`}>{statusTag}</div>
                  </div>
                )}

                {variant === 'volunteer' && (
                  <div className="mt-1 flex min-w-0 items-center gap-2">
                    {posting.organization_name && (
                      <Link
                        to={`/organization/${posting.organization_id}`}
                        onClick={event => event.stopPropagation()}
                        className="pointer-events-auto text-primary link link-hover no-underline hover:underline text-xs self-start"
                      >
                        {posting.organization_name}
                      </Link>
                    )}
                    <div className={`shrink-0 opacity-100 ${volunteerTagNearOrganizationClass}`}>{statusTag}</div>
                  </div>
                )}
              </div>

              <span className={`-ml-8 hidden items-center gap-1.5 justify-self-start text-sm opacity-70 ${outsideMetaLabelVisibleClass}`}>
                <Calendar size={14} className="shrink-0 text-primary" />
                Date
              </span>

              <span className={`-ml-8 hidden items-center gap-1.5 justify-self-start text-sm opacity-70 ${outsideMetaLabelVisibleClass}`}>
                <Clock size={14} className="shrink-0 text-primary" />
                Time
              </span>

              <span className={`-ml-8 hidden items-center gap-1.5 justify-self-start text-sm opacity-70 ${outsideMetaLabelVisibleClass}`}>
                <MapPin size={14} className="shrink-0 text-primary" />
                Location
              </span>

              <span
                className={`-ml-8 hidden min-w-0 truncate justify-self-start pr-1 text-xs font-medium text-base-content ${outsideMetaValueVisibleClass}`}
                title={hasEndDate ? `${startDateStr} - ${endDateStr}` : startDateStr}
              >
                {hasEndDate ? `${startDateStr} - ${endDateStr}` : startDateStr}
              </span>

              <span
                className={`-ml-8 hidden min-w-0 truncate justify-self-start pr-1 text-xs font-medium text-base-content ${outsideMetaValueVisibleClass}`}
                title={hasEndDate ? `${startTimeStr} - ${endTimeStr}` : startTimeStr}
              >
                {hasEndDate ? `${startTimeStr} - ${endTimeStr}` : startTimeStr}
              </span>

              <span
                className={`-ml-8 hidden min-w-0 truncate justify-self-start text-xs font-medium text-base-content ${outsideMetaValueVisibleClass}`}
                title={locationText}
              >
                {locationText}
              </span>
            </div>
          </div>
        </div>

        <div className="collapse-content pt-0">
          <div className={`mb-3 space-y-1 text-sm ${insideMetaVisibleClass}`}>
            <div className="inline-flex items-center gap-2">
              <Calendar size={14} className="text-primary" />
              <span className="opacity-70">Date:</span>
              <span className="font-medium text-base-content pr-3">{hasEndDate ? `${startDateStr} - ${endDateStr}` : startDateStr}</span>
            </div>

            <div className="inline-flex items-center gap-2">
              <Clock size={14} className="text-primary" />
              <span className="opacity-70">Time:</span>
              <span className="font-medium text-base-content pr-3">{hasEndDate ? `${startTimeStr} - ${endTimeStr}` : startTimeStr}</span>
            </div>

            <div className="inline-flex items-center gap-2">
              <MapPin size={14} className="text-primary" />
              <span className="opacity-70">Location:</span>
              <span className="font-medium text-base-content">{locationText}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="inline-flex items-center gap-2">
              <Users size={14} className="text-primary" />
              <span className="opacity-70">Volunteers:</span>
              <span className="font-medium text-base-content">{volunteerCountText}</span>
            </div>

            {posting.minimum_age && (
              <div className="inline-flex items-center gap-2">
                <Cake size={14} className="text-primary" />
                <span className="opacity-70">Age:</span>
                <span className="font-medium text-base-content">
                  {posting.minimum_age}
                  +
                </span>
              </div>
            )}
          </div>

          {posting.skills && posting.skills.length > 0 && (
            <div className="mt-3">
              <p className="text-xs opacity-70 mb-2">Skills</p>
              <SkillsList skills={posting.skills} limit={6} />
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

export default PostingList;
