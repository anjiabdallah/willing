import { sql, type Kysely } from 'kysely';

import { type CertificateVerificationPayload } from './token.ts';
import database from '../../db/index.ts';
import { type Database } from '../../db/tables/index.ts';

const HOURS_EPSILON = 0.01;
const HOURS_DECIMAL_PLACES = 2;

type CertificateVerificationResult = {
  valid: boolean;
};

type VolunteerHoursSnapshot = {
  totalHours: number;
  hoursByOrgId: Map<number, number>;
};

const roundHours = (value: number) => Number(value.toFixed(HOURS_DECIMAL_PLACES));
const isSameHours = (left: number, right: number) => Math.abs(left - right) <= HOURS_EPSILON;

const getVolunteerHoursSnapshot = async (db: Kysely<Database>, volunteerId: number, issuedAt: Date): Promise<VolunteerHoursSnapshot> => {
  const hoursPerAttendedDateExpression = sql<number>`GREATEST(
    0,
    EXTRACT(EPOCH FROM (
      (enrollment_date.date + posting.end_time)
      - (enrollment_date.date + posting.start_time)
    )) / 3600.0
  )`;

  const rows = await db
    .selectFrom('enrollment_date')
    .innerJoin('enrollment', 'enrollment.id', 'enrollment_date.enrollment_id')
    .innerJoin('posting', 'posting.id', 'enrollment.posting_id')
    .select([
      'posting.organization_id as organization_id',
      sql<number>`COALESCE(SUM(${hoursPerAttendedDateExpression}), 0)`.as('hours'),
    ])
    .where('enrollment.volunteer_id', '=', volunteerId)
    .where('enrollment_date.attended', '=', true)
    // Historical attendance timestamps are not fully modeled in schema.
    // We use enrollment.created_at as the strongest available "known by issued_at" bound.
    .where('enrollment.created_at', '<=', issuedAt)
    .groupBy('posting.organization_id')
    .execute();

  const hoursByOrgId = new Map<number, number>();
  rows.forEach((row) => {
    hoursByOrgId.set(row.organization_id, roundHours(Number(row.hours ?? 0)));
  });

  const totalHours = roundHours(rows.reduce((total, row) => total + Number(row.hours ?? 0), 0));
  return {
    totalHours,
    hoursByOrgId,
  };
};

export const verifyCertificatePayloadAgainstDatabase = async (
  payload: CertificateVerificationPayload,
  db: Kysely<Database> = database,
): Promise<CertificateVerificationResult> => {
  const volunteerId = Number(payload.uid);
  if (!Number.isInteger(volunteerId) || volunteerId <= 0) {
    return { valid: false };
  }

  const issuedAt = new Date(payload.issued_at);
  if (Number.isNaN(issuedAt.getTime())) {
    return { valid: false };
  }

  if (issuedAt.getTime() > Date.now()) {
    return { valid: false };
  }

  const volunteer = await db
    .selectFrom('volunteer_account')
    .select(['id'])
    .where('id', '=', volunteerId)
    .executeTakeFirst();

  if (!volunteer) {
    return { valid: false };
  }

  const orgIds = payload.org_ids.map(Number);
  if (orgIds.some(orgId => !Number.isInteger(orgId) || orgId <= 0)) {
    return { valid: false };
  }

  const hoursSnapshot = await getVolunteerHoursSnapshot(db, volunteerId, issuedAt);

  const claimedHoursByOrg = payload.org_ids.reduce((map, orgId) => {
    map.set(Number(orgId), roundHours(payload.hours_per_org[orgId] ?? 0));
    return map;
  }, new Map<number, number>());

  const actualSelectedHoursSum = orgIds.reduce((sum, orgId) => sum + (hoursSnapshot.hoursByOrgId.get(orgId) ?? 0), 0);
  const claimedSelectedHoursSum = payload.org_ids.reduce((sum, orgId) => sum + (payload.hours_per_org[orgId] ?? 0), 0);

  if (!isSameHours(roundHours(claimedSelectedHoursSum), roundHours(actualSelectedHoursSum))) {
    return { valid: false };
  }

  if (!isSameHours(roundHours(payload.total_hours), roundHours(hoursSnapshot.totalHours))) {
    return { valid: false };
  }

  for (const [orgId, claimedHours] of claimedHoursByOrg.entries()) {
    const actualHours = hoursSnapshot.hoursByOrgId.get(orgId);
    if (actualHours === undefined) {
      return { valid: false };
    }

    if (!isSameHours(claimedHours, actualHours)) {
      return { valid: false };
    }
  }

  return { valid: true };
};
