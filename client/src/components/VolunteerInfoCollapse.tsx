import { Cake, FileText, Mail, Mars, MessageSquare, Venus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import IconButton from './IconButton';
import SkillsList from './skills/SkillsList';
import { SERVER_BASE_URL } from '../utils/requestServer';

import type { PostingApplication, PostingEnrollment } from '../../../server/src/types';

interface VolunteerInfoCollapseProps {
  volunteer: PostingEnrollment | PostingApplication;
  actions?: ReactNode;
  profileLink?: string;
}

function formatDisplayDate(value: string) {
  const [yearRaw, monthRaw, dayRaw] = value.split('T')[0]?.split('-') ?? [];
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if ([year, month, day].some(Number.isNaN)) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function VolunteerInfoCollapse({ volunteer, actions, profileLink }: VolunteerInfoCollapseProps) {
  const [viewingCv, setViewingCv] = useState(false);
  const volunteerName = `${volunteer.first_name} ${volunteer.last_name}`;
  const initials = `${volunteer.first_name.charAt(0)}${volunteer.last_name.charAt(0)}`.toUpperCase();
  const hasCv = 'cv_path' in volunteer && Boolean(volunteer.cv_path);
  const age = useMemo(() => {
    const now = new Date();
    const birthDate = new Date(volunteer.date_of_birth);
    if (Number.isNaN(birthDate.getTime())) return 0;

    let ageNum = now.getFullYear() - birthDate.getFullYear();
    const monthDiff = now.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
      ageNum -= 1;
    }

    return Math.max(0, ageNum);
  }, [volunteer.date_of_birth]);

  const genderBadgeStyles
    = volunteer.gender === 'male'
      ? 'badge-info'
      : volunteer.gender === 'female'
        ? 'badge-secondary'
        : 'badge-accent';

  const viewCv = async () => {
    if (!hasCv) return;
    const token = localStorage.getItem('jwt');
    if (!token) return;

    setViewingCv(true);
    try {
      const response = await fetch(`${SERVER_BASE_URL}/organization/volunteer/${volunteer.volunteer_id}/cv`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to download CV');

      const blob = await response.blob();
      const previewUrl = URL.createObjectURL(blob);
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
    } finally {
      setViewingCv(false);
    }
  };

  const dates = 'dates' in volunteer ? volunteer.dates : undefined;
  const requestedDates = 'requested_dates' in volunteer ? volunteer.requested_dates : undefined;

  return (
    <div className="collapse collapse-arrow border border-base-300 bg-base-100">
      <input type="checkbox" />
      <div className="collapse-title flex items-center justify-between gap-3 z-10 pointer-events-none">
        <div className="flex items-center gap-3 flex-1">
          {profileLink
            ? (
                <Link
                  to={profileLink}
                  className="flex items-center gap-3 pointer-events-auto rounded-box -m-1 p-1"
                  onClick={event => event.stopPropagation()}
                >
                  <div className="avatar">
                    <div className="bg-primary text-primary-content rounded-full w-12 h-12 flex items-center justify-center">
                      <span className="text-lg font-semibold">{initials}</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2">
                      <h5 className="font-bold text-base leading-tight hover:underline">{volunteerName}</h5>
                      {
                        volunteer.message && <MessageSquare size={12} strokeWidth={3} opacity={0.7} />
                      }
                    </span>
                    <div className="flex gap-2 mt-1">
                      <span className={`badge badge-sm gap-1 ${genderBadgeStyles}`}>
                        {volunteer.gender === 'male' && <Mars size={10} />}
                        {volunteer.gender === 'female' && <Venus size={10} />}
                        {volunteer.gender === 'other' && <span className="font-bold">*</span>}
                        {volunteer.gender.charAt(0).toUpperCase() + volunteer.gender.slice(1)}
                      </span>
                      <span className="badge badge-sm gap-1">
                        <Cake size={12} />
                        {age}
                        <span className="max-sm:hidden">
                          {' '}
                          years old
                        </span>
                      </span>
                    </div>
                  </div>
                </Link>
              )
            : (
                <>
                  <div className="avatar">
                    <div className="bg-primary text-primary-content rounded-full w-12 h-12 flex items-center justify-center">
                      <span className="text-lg font-semibold">{initials}</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2">
                      <h5 className="font-bold text-base leading-tight">{volunteerName}</h5>
                      {
                        volunteer.message && <MessageSquare size={12} strokeWidth={3} opacity={0.7} />
                      }
                    </span>
                    <div className="flex gap-2 mt-1">
                      <span className={`badge badge-sm gap-1 ${genderBadgeStyles}`}>
                        {volunteer.gender === 'male' && <Mars size={10} />}
                        {volunteer.gender === 'female' && <Venus size={10} />}
                        {volunteer.gender === 'other' && <span className="font-bold">*</span>}
                        {volunteer.gender.charAt(0).toUpperCase() + volunteer.gender.slice(1)}
                      </span>
                      <span className="badge badge-sm gap-1">
                        <Cake size={12} />
                        {age}
                        <span className="max-sm:hidden">
                          {' '}
                          years old
                        </span>
                      </span>
                    </div>
                  </div>
                </>
              )}
        </div>
        {hasCv && (
          <div className="pointer-events-auto" onClick={event => event.stopPropagation()}>
            <IconButton
              type="button"
              color="primary"
              style="outline"
              size="sm"
              Icon={FileText}
              loading={viewingCv}
              onClick={() => { void viewCv(); }}
              aria-label="View CV"
              title="View CV"
            />
          </div>
        )}
        {actions && (
          <div className="flex gap-2 items-center pointer-events-auto max-sm:hidden" onClick={e => e.stopPropagation()}>
            {actions}
          </div>
        )}
      </div>
      <div className="collapse-content pt-0">
        <div className="mt-4 mb-8 flex flex-col items-end sm:hidden">
          {actions}
        </div>
        <div className="flex items-center gap-2 text-xs opacity-70 sm:mt-1 mt-3">
          <Mail size={12} />
          {volunteer.email}
        </div>
        {dates && dates.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold opacity-70 mb-1">Selected Dates</p>
            <p className="text-sm">{dates.map(d => d.date).sort().map(formatDisplayDate).join(', ')}</p>
          </div>
        )}
        {(!dates || dates.length === 0) && requestedDates && requestedDates.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold opacity-70 mb-1">Requested Dates</p>
            <p className="text-sm">{[...requestedDates].sort().map(formatDisplayDate).join(', ')}</p>
          </div>
        )}

        {volunteer.skills && volunteer.skills.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold opacity-70 mb-1">Skills</p>
            <div className="flex flex-wrap gap-1">
              <SkillsList skills={volunteer.skills} />
            </div>
          </div>
        )}
        {'message' in volunteer && volunteer.message && (
          <div className="mt-3">
            <p className="text-xs font-semibold opacity-70 mb-1">
              {'application_id' in volunteer ? 'Application Message' : 'Message'}
            </p>
            <p className="text-xs opacity-80 italic">
              "
              {volunteer.message}
              "
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default VolunteerInfoCollapse;
