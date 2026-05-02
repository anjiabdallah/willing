import { AlertTriangle, Ban, Cake, Calendar, CalendarX2, CheckCircle2, ClipboardList, Clock, ExternalLink, LockOpen, MapPin, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import Card from './Card';
import OrganizationProfilePicture from './OrganizationProfilePicture';
import PostingDateTime from './PostingDateTime.tsx';
import { DOMAIN_COLORS } from '../constants';
import { formatCardDate, formatTime12Hour, hasPostingEnded, isPostingFullyBooked, normalizeTimestamp } from './postings/postingUtils';
import useNow from './postings/useNow.ts';
import SkillsList from './skills/SkillsList';
import { toIsoDate, toLocalDateTime } from '../utils/timeUtils.ts';

import type { PostingWithContext } from '../../../server/src/types';

interface PostingCardProps {
  posting: PostingWithContext;
  showCrisis?: boolean;
  crisisTagClickable?: boolean;
  crisisBasePath?: string;
  fillHeight?: boolean;
}

function PostingCard({
  posting,
  showCrisis = true,
  crisisTagClickable = true,
  crisisBasePath = '/volunteer/crises',
  fillHeight = false,
}: PostingCardProps) {
  const postingDetailsPath = `/posting/${posting.id}`;

  const startDateValue = posting.start_date;
  const endDateValue = posting.end_date;

  const startTimeValue = posting.start_time || '';
  const endTimeValue = posting.end_time || '';

  const startDt = normalizeTimestamp(startDateValue);
  const endDt = normalizeTimestamp(endDateValue);
  const startLocalDate = posting.start_time
    ? toLocalDateTime(posting.start_time.slice(0, 5), toIsoDate(posting.start_date) ?? '')
    : null;
  const endLocalDate = posting.end_time && posting.end_date
    ? toLocalDateTime(posting.end_time.slice(0, 5), toIsoDate(posting.end_date) ?? '')
    : null;
  const hasEndDate = Boolean(endDt);

  const now = useNow();
  const hasEnded = useMemo(
    () => Boolean(posting.has_ended || hasPostingEnded(posting, now)),
    [now, posting],
  );

  const startDateStr = startLocalDate
    ? formatCardDate(new Date(`${startLocalDate.date}T00:00:00Z`))
    : formatCardDate(startDt);
  const endDateStr = endLocalDate
    ? formatCardDate(new Date(`${endLocalDate.date}T00:00:00Z`))
    : formatCardDate(endDt);
  const startTimeStr = formatTime12Hour(startTimeValue, toIsoDate(posting.start_date))
    || (startDt ? startDt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '');
  const endTimeStr = formatTime12Hour(endTimeValue, toIsoDate(posting.end_date ?? posting.start_date))
    || (endDt ? endDt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '');
  const isSingleDayPosting = !hasEndDate || startDateStr === endDateStr;
  const shouldShowVolunteerCapacity = posting.max_volunteers != null && (!posting.allows_partial_attendance || isSingleDayPosting);
  const shouldShowVolunteerCountOnly = !shouldShowVolunteerCapacity;

  const volunteerFilled = posting.enrollment_count ?? 0;
  const volunteerPercent = posting.max_volunteers ? Math.round((volunteerFilled / posting.max_volunteers) * 100) : 0;
  const volunteerCountLabel = shouldShowVolunteerCapacity && posting.max_volunteers != null
    ? `${volunteerFilled}/${posting.max_volunteers}`
    : `${volunteerFilled}`;
  const isPostingFull = isPostingFullyBooked(posting);
  let radialColor = 'text-primary';
  if (volunteerPercent >= 100) radialColor = 'text-error';
  else if (volunteerPercent > 70) radialColor = 'text-warning';

  const crisisTagContent = (
    <>
      <AlertTriangle size={14} />
      <span className="truncate max-w-40 text-sm font-semibold" title={posting.crisis_name ?? undefined}>
        {posting.crisis_name}
      </span>
    </>
  );

  return (
    <Card padding={false} fillHeight={fillHeight} className={fillHeight ? 'h-full min-h-96' : ''}>
      {showCrisis && posting.crisis_name && posting.crisis_id && (
        crisisTagClickable
          ? (
              <Link
                to={`${crisisBasePath}/${posting.crisis_id}/postings`}
                className="absolute -top-2 -right-2 z-20 inline-flex items-center gap-1 rounded-md bg-accent text-accent-content px-2 py-1 shadow-sm rotate-3 transition-transform duration-200 hover:rotate-0"
              >
                {crisisTagContent}
              </Link>
            )
          : (
              <span className="absolute -top-2 -right-2 z-20 inline-flex items-center gap-1 rounded-md bg-accent text-accent-content px-2 py-1 shadow-sm rotate-3">
                {crisisTagContent}
              </span>
            )
      )}

      <div className="p-4 md:p-5 mt-1 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <OrganizationProfilePicture
            organizationName={posting.organization_name ?? 'Organization'}
            organizationId={posting.organization_id}
            logoPath={posting.organization_logo_path}
            size={48}
            linkToOrganizationPage
            linkClassName="shrink-0"
          />
          {posting.organization_name
            ? (
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold leading-tight truncate">
                    <Link to={postingDetailsPath} className="link link-primary link-hover no-underline hover:underline inline-flex items-center gap-2">
                      <span className="truncate" title={posting.title}>{posting.title}</span>
                      <ExternalLink size={14} />
                    </Link>
                  </h3>
                  <p className="text-xs mt-1">
                    <Link to={`/organization/${posting.organization_id}`} className="text-primary">
                      {posting.organization_name}
                    </Link>
                  </p>
                </div>
              )
            : (
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold leading-tight truncate">
                    <Link to={postingDetailsPath} className="link link-primary link-hover no-underline hover:underline inline-flex items-center gap-2">
                      <span className="truncate" title={posting.title}>{posting.title}</span>
                      <ExternalLink size={14} />
                    </Link>
                  </h3>
                </div>
              )}
        </div>

        <div className="flex flex-col items-end gap-1">
          {
            hasEnded
              ? (
                  <span className="badge badge-neutral inline-flex items-center gap-2">
                    <CalendarX2 size={14} />
                    Ended
                  </span>
                )
              : posting.is_closed
                ? (
                    <span className="badge badge-error inline-flex items-center gap-2">
                      <Ban size={14} />
                      Closed
                    </span>
                  )
                : posting.application_status === 'pending'
                  ? (
                      <span className="badge badge-warning inline-flex items-center gap-2">
                        <Clock size={14} />
                        Pending
                      </span>
                    )
                  : posting.application_status === 'registered'
                    ? (
                        <span className={`badge badge-${DOMAIN_COLORS.enrollment} inline-flex items-center gap-1`}>
                          <CheckCircle2 size={14} />
                          Enrolled
                        </span>
                      )
                    : isPostingFull
                      ? (
                          <span className="badge badge-error inline-flex items-center gap-2">
                            <Users size={14} />
                            Full
                          </span>
                        )
                      : posting.automatic_acceptance
                        ? (
                            <span className="badge badge-primary inline-flex items-center gap-2">
                              <LockOpen size={14} />
                              Open
                            </span>
                          )
                        : (
                            <span className="badge badge-secondary inline-flex items-center gap-2 px-3 min-w-30 h-7 whitespace-nowrap">
                              <ClipboardList size={14} />
                              Review Based
                            </span>
                          )
          }
        </div>
      </div>

      <div className="pt-1 pb-3 border-t border-base-200">
        <div className="px-4 md:px-5 flex justify-between items-start text-sm text-muted gap-6 pt-2">
          <PostingDateTime
            className="w-full"
            startDate={startDateStr}
            endDate={endDateStr}
            startTime={startTimeStr}
            endTime={endTimeStr}
          />
        </div>

        <div className="px-4 md:px-5 mt-4 border-t border-base-200 pt-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-muted">
            {/* Left column: Location */}
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-primary shrink-0" />
              <div>
                <p className="text-xs opacity-70">LOCATION</p>
                <p className="text-sm">{posting.location_name || 'TBA'}</p>
              </div>
            </div>

            {/* Right column: Commitment */}
            {isSingleDayPosting
              ? <div />
              : (
                  <div className="flex items-center gap-2 pl-4">
                    <Calendar size={16} className="text-primary shrink-0" />
                    <div>
                      <p className="text-xs opacity-70">COMMITMENT</p>
                      <p className="text-sm">{posting.allows_partial_attendance ? 'Partial' : 'Full'}</p>
                    </div>
                  </div>
                )}

            {/* Left column: Volunteers */}
            {shouldShowVolunteerCapacity
              ? (
                  <div className="flex items-center gap-2">
                    <span className="relative w-8 h-8">
                      <div
                        className={`radial-progress absolute inset-0 m-auto ${radialColor}`}
                        style={{ '--value': volunteerPercent, '--thickness': '0.4rem', 'scale': 0.4, 'transform': 'translate(-75%, 0%)' } as React.CSSProperties}
                        aria-valuenow={volunteerPercent}
                        role="progressbar"
                      />
                      <Users size={16} className="text-primary absolute inset-0 m-auto" />
                    </span>
                    <div>
                      <p className="text-xs opacity-70">VOLUNTEERS</p>
                      <p className="text-sm">{volunteerCountLabel}</p>
                    </div>
                  </div>
                )
              : shouldShowVolunteerCountOnly
                ? (
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-primary shrink-0" />
                      <div>
                        <p className="text-xs opacity-70">VOLUNTEERS</p>
                        <p className="text-sm">{volunteerCountLabel}</p>
                      </div>
                    </div>
                  )
                : <div />}

            {/* Right column: Age */}
            {posting.minimum_age
              ? (
                  <div className="flex items-center gap-2 pl-4">
                    <Cake size={16} className="text-primary shrink-0" />
                    <div>
                      <p className="text-xs opacity-70">AGE</p>
                      <p className="text-sm">
                        {posting.minimum_age}
                        {' '}
                        +
                      </p>
                    </div>
                  </div>
                )
              : <div />}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-5 py-3 border-t border-base-200 bg-base-100 mb-4">
        {posting.skills && posting.skills.length > 0 && (
          <div className="mt-auto mb-2">
            <p className="text-xs opacity-70 mb-2">SKILLS</p>
            <div className="flex flex-wrap gap-2">
              <SkillsList skills={posting.skills} limit={2} />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default PostingCard;
