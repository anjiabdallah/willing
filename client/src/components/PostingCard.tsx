import { Calendar, Cake, Clock, ExternalLink, LockOpen, MapPin, Users, AlertCircle, Building2, Ban } from 'lucide-react';
import { Link } from 'react-router';

import SkillsList from './skills/SkillsList';

import type { PostingWithContext } from '../../../server/src/types';

interface PostingCardProps {
  posting: PostingWithContext;
  showCrisis?: boolean;
}

function PostingCard({ posting, showCrisis = true }: PostingCardProps) {
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

  const startDateValue = posting.start_date;
  const endDateValue = posting.end_date;

  const startTimeValue = posting.start_time || '';
  const endTimeValue = posting.end_time || '';

  const startDt = normalizeTimestamp(startDateValue);
  const endDt = normalizeTimestamp(endDateValue);
  const hasEndDate = Boolean(endDt);

  const startDateStr = startDt ? startDt.toLocaleDateString() : '';
  const endDateStr = endDt ? endDt.toLocaleDateString() : '';
  const startTimeStr = formatTime12Hour(startTimeValue) || (startDt ? startDt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '');
  const endTimeStr = formatTime12Hour(endTimeValue) || (endDt ? endDt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : '');
  const organizationInitials = posting.organization_name
    ? posting.organization_name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word: string) => word[0]?.toUpperCase() ?? '')
        .join('')
    : '';

  const volunteerFilled = posting.enrollment_count ?? 0;
  const volunteerPercent = posting.max_volunteers ? Math.round((volunteerFilled / posting.max_volunteers) * 100) : 0;
  const isPostingFull = Boolean(posting.max_volunteers && volunteerFilled >= posting.max_volunteers);
  let radialColor = 'text-primary';
  if (volunteerPercent >= 100) radialColor = 'text-error';
  else if (volunteerPercent > 70) radialColor = 'text-warning';

  return (
    <article className="relative rounded-xl border border-base-200 bg-base-100 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col overflow-visible">
      {showCrisis && posting.crisis_name && posting.crisis_id && (
        <Link
          to={`/volunteer/crises/${posting.crisis_id}/postings`}
          className="absolute -top-2 -right-2 z-20 inline-flex items-center gap-1 rounded-md bg-accent text-accent-content px-2 py-1 shadow-sm rotate-3 transition-transform duration-200 hover:rotate-0"
        >
          <AlertCircle size={14} />
          <span className="truncate max-w-40 text-sm font-semibold">
            {posting.crisis_name}
          </span>
        </Link>
      )}

      <div className="p-4 md:p-5 mt-1 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link to={`/organization/${posting.organization_id}`} className="shrink-0">
            <div className="avatar avatar-placeholder">
              <div className="bg-primary text-primary-content w-12 rounded-full">
                {organizationInitials
                  ? <span className="text-md font-semibold">{organizationInitials}</span>
                  : <Building2 size={18} />}
              </div>
            </div>
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
                          <span className="badge badge-secondary inline-flex items-center gap-2">
                            <Clock size={14} />
                            Review based
                          </span>
                        )
          }
        </div>
      </div>

      <div className="pt-1 pb-3 border-t border-base-200">
        <div className="px-4 md:px-5 flex justify-between items-start text-sm text-muted gap-6 pt-2">
          <div className="flex items-center gap-3 grow h-22">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center shrink-0 mt-1">
                <Calendar size={16} className="text-primary" />
                {(hasEndDate && startDateStr !== endDateStr) && <div className="w-0.5 h-6 bg-primary my-1" />}
                {(hasEndDate && startDateStr !== endDateStr) && <Calendar size={16} className="text-primary" />}
              </div>
              <div>
                <div className="text-sm">
                  <p className="text-xs opacity-70">{(!hasEndDate || startDateStr === endDateStr) ? 'DATE' : 'START'}</p>
                  <p className="font-medium">{startDateStr || 'TBA'}</p>
                </div>
                {(hasEndDate && startDateStr !== endDateStr) && (
                  <div className="mt-3 text-sm">
                    <p className="text-xs opacity-70">END</p>
                    <p className="font-medium">{endDateStr}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grow" />

            <div className="flex items-start gap-3">
              <div className="text-right">
                <div className="text-sm">
                  <p className="text-xs opacity-70">{hasEndDate ? 'START' : 'TIME'}</p>
                  <p className="font-medium">{startTimeStr || '—'}</p>
                </div>
                {hasEndDate && (
                  <div className="mt-3 text-sm">
                    <p className="text-xs opacity-70">END</p>
                    <p className="font-medium">{endTimeStr || '—'}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center shrink-0 mt-1">
                <Clock size={16} className="text-primary" />
                {hasEndDate && <div className="w-0.5 h-6 bg-primary my-1" />}
                {hasEndDate && <Clock size={16} className="text-primary" />}
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-5 mt-4 border-t border-base-200 pt-3">
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
            <div className="flex items-center gap-2 flex-1">
              <MapPin size={16} className="text-primary" />
              <div>
                <p className="text-xs opacity-70">LOCATION</p>
                <p className="text-sm">{posting.location_name || 'TBA'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-1">
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
                <p className="text-sm">{`${volunteerFilled}${posting.max_volunteers ? '/' + posting.max_volunteers : ''}`}</p>
              </div>
            </div>

            {posting.minimum_age && (
              <div className="flex items-center gap-2 flex-1">
                <Cake size={16} className="text-primary" />
                <div>
                  <p className="text-xs opacity-70">AGE</p>
                  <p className="text-sm">
                    {posting.minimum_age}
                    +
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-5 py-3 border-t border-base-200 bg-base-100 mb-4">
        {posting.skills && posting.skills.length > 0 && (
          <div className="mt-2">
            <p className="text-xs opacity-70 mb-2">SKILLS</p>
            <div className="flex flex-wrap gap-2">
              <SkillsList skills={posting.skills} limit={3} />
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export default PostingCard;
