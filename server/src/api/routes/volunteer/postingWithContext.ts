import { sql, type Kysely } from 'kysely';

import { type Database } from '../../../db/tables/index.ts';
import { hasPostingEnded } from '../../../services/posting/postingTime.ts';
import { rejectEndedPendingApplicationsForPostings } from '../../../services/posting/rejectEndedPendingApplications.ts';
import { type PostingWithContext, type PostingApplicationStatus } from '../../../types.ts';

export const postingWithContextSelectColumns = [
  'posting.id',
  'posting.organization_id',
  'posting.crisis_id',
  'posting.title',
  'posting.description',
  'posting.latitude',
  'posting.longitude',
  'posting.max_volunteers',
  'posting.start_date',
  'posting.start_time',
  'posting.end_date',
  'posting.end_time',
  'posting.minimum_age',
  'posting.automatic_acceptance',
  'posting.is_closed',
  'posting.allows_partial_attendance',
  'posting.location_name',
  'posting.created_at',
  'posting.updated_at',
  'crisis.name as crisis_name',
  'organization_account.name as organization_name',
  'organization_account.logo_path as organization_logo_path',
] as const;

type PostingWithContextBase = Omit<PostingWithContext, 'skills' | 'enrollment_count' | 'application_status'>;

type BuildPostingsWithContextOptions = {
  volunteerId: number;
  postings: PostingWithContextBase[];
  applicationStatusByPostingId?: ReadonlyMap<number, Extract<PostingApplicationStatus, 'registered' | 'pending'>>;
};

const formatDateToIso = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
const normalizeStoredDate = (value: Date | string | null | undefined) => {
  if (value instanceof Date) return formatDateToIso(value);
  if (typeof value === 'string') {
    const datePart = value.split('T')[0]?.trim();
    return datePart || undefined;
  }
  return undefined;
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

export const getPostingDates = (startDate: Date | string, endDate: Date | string | null | undefined): string[] => {
  const normalizedStartDate = normalizeStoredDate(startDate);
  const normalizedEndDate = normalizeStoredDate(endDate ?? startDate);
  const startParts = normalizedStartDate ? parseIsoDateParts(normalizedStartDate) : undefined;
  const endParts = normalizedEndDate ? parseIsoDateParts(normalizedEndDate) : undefined;

  if (!startParts || !endParts) {
    return [];
  }

  const result: string[] = [];
  const current = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
  const end = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day));

  while (current.getTime() <= end.getTime()) {
    result.push(formatDateToIso(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
};

export const isVolunteerPostingFull = (
  posting: Pick<PostingWithContext, 'allows_partial_attendance' | 'max_volunteers' | 'enrollment_count' | 'start_date' | 'end_date' | 'date_capacity'>,
) => {
  const maxVolunteers = posting.max_volunteers;

  if (maxVolunteers == null) {
    return false;
  }

  if (!posting.allows_partial_attendance) {
    return posting.enrollment_count >= maxVolunteers;
  }

  const postingDates = getPostingDates(posting.start_date, posting.end_date);
  if (postingDates.length === 0) {
    return false;
  }

  return postingDates.every(date => (posting.date_capacity?.[date] ?? 0) >= maxVolunteers);
};

export async function buildPostingsWithContext(
  db: Kysely<Database>,
  {
    volunteerId,
    postings,
    applicationStatusByPostingId,
  }: BuildPostingsWithContextOptions,
): Promise<PostingWithContext[]> {
  if (postings.length === 0) {
    return [];
  }

  const autoRejectedPostingIds = await rejectEndedPendingApplicationsForPostings(
    db,
    postings.map(posting => posting.id),
  );

  const postingIds = postings.map(posting => posting.id);

  const [skills, enrollmentCounts, dateCapacities, volunteerEnrollments, volunteerPendingApplications] = await Promise.all([
    db
      .selectFrom('posting_skill')
      .selectAll()
      .where('posting_id', 'in', postingIds)
      .execute(),
    db
      .selectFrom('enrollment')
      .select([
        'posting_id',
        sql<number>`count(enrollment.id)`.as('count'),
      ])
      .where('posting_id', 'in', postingIds)
      .groupBy('posting_id')
      .execute(),
    db
      .selectFrom('enrollment_date')
      .select([
        'posting_id',
        sql<string>`to_char(enrollment_date.date, 'YYYY-MM-DD')`.as('date'),
        sql<number>`count(enrollment_date.id)`.as('count'),
      ])
      .where('posting_id', 'in', postingIds)
      .groupBy(['posting_id', 'enrollment_date.date'])
      .execute(),
    applicationStatusByPostingId
      ? Promise.resolve([])
      : db
          .selectFrom('enrollment')
          .select('posting_id')
          .where('volunteer_id', '=', volunteerId)
          .where('posting_id', 'in', postingIds)
          .execute(),
    applicationStatusByPostingId
      ? Promise.resolve([])
      : db
          .selectFrom('enrollment_application')
          .select('posting_id')
          .where('volunteer_id', '=', volunteerId)
          .where('posting_id', 'in', postingIds)
          .execute(),
  ]);

  const skillsByPostingId = new Map<number, typeof skills>();
  skills.forEach((skill) => {
    if (!skillsByPostingId.has(skill.posting_id)) {
      skillsByPostingId.set(skill.posting_id, []);
    }
    skillsByPostingId.get(skill.posting_id)!.push(skill);
  });

  const countsByPostingId = new Map<number, number>();
  enrollmentCounts.forEach((countRow) => {
    countsByPostingId.set(countRow.posting_id, Number(countRow.count ?? 0));
  });

  const dateCapacityByPostingId = new Map<number, Record<string, number>>();
  dateCapacities.forEach((row) => {
    if (!dateCapacityByPostingId.has(row.posting_id)) {
      dateCapacityByPostingId.set(row.posting_id, {});
    }

    dateCapacityByPostingId.get(row.posting_id)![row.date] = Number(row.count ?? 0);
  });

  const resolvedApplicationStatusByPostingId = new Map<number, PostingApplicationStatus>();

  if (applicationStatusByPostingId) {
    applicationStatusByPostingId.forEach((status, postingId) => {
      if (status === 'pending' && autoRejectedPostingIds.has(postingId)) {
        return;
      }
      resolvedApplicationStatusByPostingId.set(postingId, status);
    });
  } else {
    volunteerPendingApplications.forEach((row) => {
      resolvedApplicationStatusByPostingId.set(row.posting_id, 'pending');
    });
    volunteerEnrollments.forEach((row) => {
      resolvedApplicationStatusByPostingId.set(row.posting_id, 'registered');
    });
  }

  return postings.map(posting => ({
    ...posting,
    crisis_name: posting.crisis_name ?? null,
    skills: skillsByPostingId.get(posting.id) ?? [],
    enrollment_count: countsByPostingId.get(posting.id) ?? 0,
    has_ended: hasPostingEnded(posting),
    date_capacity: dateCapacityByPostingId.get(posting.id) ?? {},
    application_status: resolvedApplicationStatusByPostingId.get(posting.id) ?? 'none',
  }));
}
