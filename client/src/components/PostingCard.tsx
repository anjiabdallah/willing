import { Cake, Calendar, Clock, ExternalLink, LockOpen, MapPin, Users, AlertCircle, Ban } from 'lucide-react';
import { Link } from 'react-router';

import Card from './Card';
import OrganizationProfilePicture from './OrganizationProfilePicture';
import PostingDateTime from './PostingDateTime.tsx';
import SkillsList from './skills/SkillsList';

import type { PostingWithContext } from '../../../server/src/types';

interface PostingCardProps {
  posting: PostingWithContext;
  showCrisis?: boolean;
  crisisTagClickable?: boolean;
  crisisBasePath?: string;
  fillHeight?: boolean;
}

const getPostingDates = (startDate: string | Date, endDate: string | Date | null | undefined) => {
  const normalizeDateOnly = (value: string | Date | null | undefined) => {
    if (value == null) return undefined;
    if (value instanceof Date) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }

    const datePart = value.split('T')[0]?.trim();
    return datePart || undefined;
  };

  const parseIsoDateParts = (value: string) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return undefined;

    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    };
  };

  const formatDateToIso = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

  const normalizedStartDate = normalizeDateOnly(startDate);
  const normalizedEndDate = normalizeDateOnly(endDate ?? startDate);
  const startParts = normalizedStartDate ? parseIsoDateParts(normalizedStartDate) : undefined;
  const endParts = normalizedEndDate ? parseIsoDateParts(normalizedEndDate) : undefined;

  if (!startParts || !endParts) {
    return [];
  }

  const result: string[] = [];
  const current = new Date(startParts.year, startParts.month - 1, startParts.day);
  const end = new Date(endParts.year, endParts.month - 1, endParts.day);

  while (current.getTime() <= end.getTime()) {
    result.push(formatDateToIso(current));
    current.setDate(current.getDate() + 1);
  }

  return result;
};

const isPostingFullyBooked = (posting: PostingWithContext) => {
  if (posting.max_volunteers == null) {
    return false;
  }

  if (!posting.allows_partial_attendance) {
    return (posting.enrollment_count ?? 0) >= posting.max_volunteers;
  }

  const postingDates = getPostingDates(posting.start_date, posting.end_date);
  if (postingDates.length === 0) {
    return false;
  }

  return postingDates.every(date => (posting.date_capacity?.[date] ?? 0) >= posting.max_volunteers!);
};

function PostingCard({
  posting,
  showCrisis = true,
  crisisTagClickable = true,
  crisisBasePath = '/volunteer/crises',
  fillHeight = false,
}: PostingCardProps) {
  const postingDetailsPath = `/posting/${posting.id}`;
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

  const startDateValue = posting.start_date;
  const endDateValue = posting.end_date;

  const startTimeValue = posting.start_time || '';
  const endTimeValue = posting.end_time || '';

  const startDt = normalizeTimestamp(startDateValue);
  const endDt = normalizeTimestamp(endDateValue);
  const hasEndDate = Boolean(endDt);

  const startDateStr = formatCardDate(startDt);
  const endDateStr = formatCardDate(endDt);
  const startTimeStr = formatTime12Hour(startTimeValue) || (startDt ? startDt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '');
  const endTimeStr = formatTime12Hour(endTimeValue) || (endDt ? endDt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '');
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
      <AlertCircle size={14} />
      <span className="truncate max-w-40 text-sm font-semibold">
        {posting.crisis_name}
      </span>
    </>
  );

  return (
    <Card padding={false} fillHeight={fillHeight} className={fillHeight ? 'h-full min-h-[24rem]' : ''}>
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
          <Link to={`/organization/${posting.organization_id}`} className="shrink-0">
            <OrganizationProfilePicture
              organizationName={posting.organization_name ?? 'Organization'}
              organizationId={posting.organization_id}
              logoPath={posting.organization_logo_path}
              size={48}
            />
          </Link>
          {posting.organization_name
            ? (
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold leading-tight truncate">
                    <Link to={postingDetailsPath} className="link link-primary link-hover no-underline hover:underline inline-flex items-center gap-2">
                      <span className="truncate">{posting.title}</span>
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
                      <span className="truncate">{posting.title}</span>
                      <ExternalLink size={14} />
                    </Link>
                  </h3>
                </div>
              )}
        </div>

        <div className="flex flex-col items-end gap-1">
          {
            posting.is_closed
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
                      <span className="badge badge-success inline-flex items-center gap-2">
                        <Users size={14} />
                        Registered
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
                          <span className="badge badge-secondary inline-flex items-center gap-2 px-3 min-w-[120px] h-7 items-center" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: '120px', maxWidth: '100%', display: 'inline-flex', alignItems: 'center' }}>
                            <Clock size={16} style={{ marginBottom: '-2px' }} />
                            Review based
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
