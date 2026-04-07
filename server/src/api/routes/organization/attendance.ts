import { Router, type Response } from 'express';
import { type Kysely } from 'kysely';
import zod from 'zod';

import { getPostingEnrollments } from './postingEnrollments.ts';
import { type Database } from '../../../db/tables/index.ts';
import { recomputePostingVectorsForVolunteerEnrollments, recomputeVolunteerExperienceVector } from '../../../services/embeddings/updates.ts';

const postingIdParamsSchema = zod.object({
  id: zod.coerce.number().int().positive('ID must be a positive number'),
});

const attendanceUpdateBodySchema = zod.object({
  attended: zod.boolean(),
});

const attendanceBulkUpdateBodySchema = zod.object({
  attended: zod.boolean(),
});

const toCsvCell = (value: string | number | boolean | null | undefined) => {
  const stringValue = String(value ?? '');
  return `"${stringValue.replace(/"/g, '""')}"`;
};

function formatDateToIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeStoredDate(value: Date | string | null | undefined): string | undefined {
  if (value instanceof Date) {
    return formatDateToIso(value);
  }

  if (typeof value === 'string') {
    const datePart = value.split('T')[0]?.trim();
    return datePart || undefined;
  }

  return undefined;
}

function parseIsoDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function getPostingDates(startDate: Date | string, endDate: Date | string): string[] {
  const normalizedStartDate = normalizeStoredDate(startDate);
  const normalizedEndDate = normalizeStoredDate(endDate);
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
}

const toCsv = (
  rows: Array<Record<string, string | number | boolean | null | undefined>>,
  headers: string[],
) => {
  if (headers.length === 0) return '';
  const headerLine = headers.map(toCsvCell).join(',');
  const bodyLines = rows.map(row => headers.map(header => toCsvCell(row[header])).join(','));
  return [headerLine, ...bodyLines].join('\n');
};

function createAttendanceRouter(db: Kysely<Database>) {
  const attendanceRouter = Router();

  attendanceRouter.get('/:id/attendance', async (req, res: Response) => {
    const orgId = req.userJWT!.id;
    const { id: postingId } = postingIdParamsSchema.parse(req.params);

    const posting = await db
      .selectFrom('organization_posting')
      .select(['id', 'title', 'location_name', 'start_date', 'end_date', 'allows_partial_attendance'])
      .where('id', '=', postingId)
      .where('organization_id', '=', orgId)
      .executeTakeFirst();

    if (!posting) {
      res.status(404);
      throw new Error('Posting not found');
    }

    const enrollments = await getPostingEnrollments(db, postingId);
    const posting_dates = posting.start_date && posting.end_date
      ? getPostingDates(posting.start_date, posting.end_date)
      : [];

    res.json({ posting, enrollments, posting_dates });
  });

  attendanceRouter.patch('/:id/attendance', async (req, res: Response) => {
    const orgId = req.userJWT!.id;
    const { id: postingId } = postingIdParamsSchema.parse(req.params);
    const body = attendanceBulkUpdateBodySchema.parse(req.body);

    const posting = await db
      .selectFrom('organization_posting')
      .select(['id'])
      .where('id', '=', postingId)
      .where('organization_id', '=', orgId)
      .executeTakeFirst();

    if (!posting) {
      res.status(404);
      throw new Error('Posting not found');
    }

    const changed = await db
      .updateTable('enrollment')
      .set({ attended: body.attended })
      .where('posting_id', '=', postingId)
      .where('attended', '!=', body.attended)
      .returning('volunteer_id')
      .execute();

    const volunteerIds = Array.from(new Set(changed.map(row => row.volunteer_id)));
    await Promise.all(volunteerIds.map(async (volunteerId) => {
      await recomputeVolunteerExperienceVector(volunteerId, db);
      await recomputePostingVectorsForVolunteerEnrollments(volunteerId, db);
    }));

    res.json({ updated_count: changed.length });
  });

  attendanceRouter.patch('/:id/enrollment-dates/:enrollmentDateId/attendance', async (req, res: Response) => {
    const orgId = req.userJWT!.id;
    const { id: postingId, enrollmentDateId } = zod.object({
      id: zod.coerce.number().int().positive(),
      enrollmentDateId: zod.coerce.number().int().positive(),
    }).parse(req.params);
    const body = attendanceUpdateBodySchema.parse(req.body);

    const posting = await db
      .selectFrom('organization_posting')
      .select(['id'])
      .where('id', '=', postingId)
      .where('organization_id', '=', orgId)
      .executeTakeFirst();

    if (!posting) {
      res.status(404);
      throw new Error('Posting not found');
    }

    const dateRecord = await db
      .selectFrom('enrollment_date')
      .select(['id', 'enrollment_id'])
      .where('id', '=', enrollmentDateId)
      .where('posting_id', '=', postingId)
      .executeTakeFirst();

    if (!dateRecord) {
      res.status(404);
      throw new Error('Enrollment date record not found');
    }

    await db
      .updateTable('enrollment_date')
      .set({ attended: body.attended })
      .where('id', '=', enrollmentDateId)
      .execute();

    if (body.attended) {
      const enrollment = await db
        .selectFrom('enrollment')
        .select(['id', 'volunteer_id'])
        .where('id', '=', dateRecord.enrollment_id)
        .executeTakeFirst();

      if (enrollment) {
        await recomputeVolunteerExperienceVector(enrollment.volunteer_id, db);
      }
    }

    res.json({});
  });

  attendanceRouter.get('/:id/attendance/export', async (req, res) => {
    const orgId = req.userJWT!.id;
    const { id: postingId } = postingIdParamsSchema.parse(req.params);

    const posting = await db
      .selectFrom('organization_posting')
      .select(['id', 'title'])
      .where('id', '=', postingId)
      .where('organization_id', '=', orgId)
      .executeTakeFirst();

    if (!posting) {
      res.status(404);
      throw new Error('Posting not found');
    }

    const enrollments = await getPostingEnrollments(db, postingId);

    const rows = enrollments.map(enrollment => ({
      enrollment_id: enrollment.enrollment_id,
      volunteer_id: enrollment.volunteer_id,
      first_name: enrollment.first_name,
      last_name: enrollment.last_name,
      email: enrollment.email,
      date_of_birth: enrollment.date_of_birth,
      gender: enrollment.gender,
      attended: enrollment.attended,
      message: enrollment.message ?? '',
      skills: enrollment.skills.map(skill => skill.name).join('|'),
    }));

    const csvHeaders = ['enrollment_id', 'volunteer_id', 'first_name', 'last_name', 'email', 'date_of_birth', 'gender', 'attended', 'message', 'skills'];
    const csv = toCsv(rows, csvHeaders);
    const safeTitle = posting.title.replace(/[^a-z0-9-_]+/gi, '_') || 'posting';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}-attendance.csv"`);
    res.send(csv);
  });

  attendanceRouter.patch('/:id/enrollments/:enrollmentId/attendance', async (req, res) => {
    const orgId = req.userJWT!.id;
    const { id: postingId, enrollmentId } = zod.object({
      id: zod.coerce.number().int().positive(),
      enrollmentId: zod.coerce.number().int().positive(),
    }).parse(req.params);
    const body = attendanceUpdateBodySchema.parse(req.body);

    const posting = await db
      .selectFrom('organization_posting')
      .select(['id'])
      .where('organization_posting.id', '=', postingId)
      .where('organization_posting.organization_id', '=', orgId)
      .executeTakeFirst();

    if (!posting) {
      res.status(404);
      throw new Error('Posting not found');
    }

    const enrollment = await db
      .selectFrom('enrollment')
      .select(['id', 'volunteer_id', 'posting_id', 'attended'])
      .where('id', '=', enrollmentId)
      .executeTakeFirst();

    if (!enrollment || enrollment.posting_id !== postingId) {
      res.status(404);
      throw new Error('Enrollment not found');
    }

    if (enrollment.attended === body.attended) {
      res.json({});
      return;
    }

    await db
      .updateTable('enrollment')
      .set({ attended: body.attended })
      .where('id', '=', enrollmentId)
      .execute();

    await recomputeVolunteerExperienceVector(enrollment.volunteer_id, db);
    await recomputePostingVectorsForVolunteerEnrollments(enrollment.volunteer_id, db);

    res.json({});
  });

  return attendanceRouter;
}

export default createAttendanceRouter;
