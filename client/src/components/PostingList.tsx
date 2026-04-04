import { AlertCircle, Ban, Cake, Calendar, Clock, ExternalLink, LockOpen, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router';

import OrganizationProfilePicture from './OrganizationProfilePicture';
import SkillsList from './skills/SkillsList';

import type { PostingWithContext } from '../../../server/src/types';

interface PostingListProps {
  posting: PostingWithContext;
  showCrisis?: boolean;
  crisisTagClickable?: boolean;
  variant?: 'volunteer' | 'organization';
  compactOrganizationLayout?: boolean;
  volunteerOutsideMetaAt1700?: boolean;
}

const normalizeTimestamp = (value: string | Date | undefined | null) => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatTime12Hour = (timeValue: string | undefined) => {
  if (!timeValue) return '';
  const [hoursRaw, minutesRaw] = timeValue.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return timeValue;
  const normalizedHours = ((hours % 24) + 24) % 24;
  const suffix = normalizedHours >= 12 ? 'PM' : 'AM';
  const hour12 = normalizedHours % 12 === 0 ? 12 : normalizedHours % 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

const formatCardDate = (dateValue: Date | null) => {
  if (!dateValue) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(dateValue);
};

function PostingList({
  posting,
  showCrisis = true,
  crisisTagClickable = true,
  variant = 'volunteer',
  compactOrganizationLayout = false,
  volunteerOutsideMetaAt1700 = false,
}: PostingListProps) {
  const postingDetailsPath = `/posting/${posting.id}`;
  const hasOrganizationName = Boolean(posting.organization_name);

  const startDt = normalizeTimestamp(posting.start_date);
  const endDt = normalizeTimestamp(posting.end_date);
  const hasEndDate = Boolean(endDt);

  const startDateStr = formatCardDate(startDt) || 'TBA';
  const endDateStr = formatCardDate(endDt) || 'TBA';
  const startTimeStr = formatTime12Hour(posting.start_time || '')
    || (startDt
      ? startDt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
      : 'TBA');
  const endTimeStr = formatTime12Hour(posting.end_time || '')
    || (endDt
      ? endDt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
      : 'TBA');

  const volunteerFilled = posting.enrollment_count ?? 0;
  const volunteerCountText = posting.max_volunteers
    ? `${volunteerFilled}/${posting.max_volunteers}`
    : `${volunteerFilled}`;
  const locationText = posting.location_name || 'TBA';
  const isPostingFull = Boolean(posting.max_volunteers && volunteerFilled >= posting.max_volunteers);

  const statusTag = posting.is_closed
    ? (
        <span className="badge badge-sm badge-error inline-flex items-center gap-1">
          <Ban size={12} />
          Closed
        </span>
      )
    : posting.application_status === 'pending'
      ? (
          <span className="badge badge-sm badge-warning inline-flex items-center gap-1">
            <Clock size={12} />
            Pending
          </span>
        )
      : posting.application_status === 'registered'
        ? (
            <span className="badge badge-sm badge-success inline-flex items-center gap-1">
              <Users size={12} />
              Registered
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
                <span className="badge badge-sm badge-secondary inline-flex items-center gap-1">
                  <Clock size={12} />
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
      <AlertCircle size={14} />
      <span className="truncate max-w-40 font-semibold">{posting.crisis_name}</span>
    </>
  );

  return (

    <div className="relative overflow-visible">
      {showCrisis && posting.crisis_name && posting.crisis_id && (
        crisisTagClickable
          ? (
              <Link
                to={`/volunteer/crises/${posting.crisis_id}/postings`}
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
            <Link to={`/organization/${posting.organization_id}`} onClick={event => event.stopPropagation()} className="avatar avatar-placeholder">
              <OrganizationProfilePicture
                organizationName={posting.organization_name ?? 'Organization'}
                organizationId={posting.organization_id}
                logoPath={posting.organization_logo_path}
                size={44}
              />
            </Link>
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
                    <span className="truncate text-lg font-semibold leading-tight text-primary">{posting.title}</span>
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
                  <div className={`mt-1 shrink-0 opacity-100 ${organizationTagBelowClass}`}>{statusTag}</div>
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

              <span className={`-ml-8 hidden min-w-0 truncate justify-self-start pr-1 text-xs font-medium text-base-content ${outsideMetaValueVisibleClass}`}>{hasEndDate ? `${startDateStr} - ${endDateStr}` : startDateStr}</span>

              <span className={`-ml-8 hidden min-w-0 truncate justify-self-start pr-1 text-xs font-medium text-base-content ${outsideMetaValueVisibleClass}`}>{hasEndDate ? `${startTimeStr} - ${endTimeStr}` : startTimeStr}</span>

              <span className={`-ml-8 hidden min-w-0 truncate justify-self-start text-xs font-medium text-base-content ${outsideMetaValueVisibleClass}`}>{locationText}</span>
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
