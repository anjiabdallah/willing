import { Router, Response } from 'express';
import zod from 'zod';

import {
  OrganizationPostingAttendanceBulkUpdateResponse,
  OrganizationPostingAttendanceResponse,
  OrganizationPostingEnrollmentAttendanceUpdateResponse,
} from './attendance.types.js';
import { getPostingEnrollments } from './postingEnrollments.js';
import database from '../../../db/index.js';
import { recomputeVolunteerExperienceVector } from '../../../services/embeddings/updates.js';

const attendanceRouter = Router();

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

const toCsv = (
  rows: Array<Record<string, string | number | boolean | null | undefined>>,
  headers: string[],
) => {
  if (headers.length === 0) return '';
  const headerLine = headers.map(toCsvCell).join(',');
  const bodyLines = rows.map(row => headers.map(header => toCsvCell(row[header])).join(','));
  return [headerLine, ...bodyLines].join('\n');
};

attendanceRouter.get('/:id/attendance', async (req, res: Response<OrganizationPostingAttendanceResponse>) => {
  const orgId = req.userJWT!.id;
  const { id: postingId } = postingIdParamsSchema.parse(req.params);

  const posting = await database
    .selectFrom('organization_posting')
    .select(['id', 'title', 'location_name'])
    .where('id', '=', postingId)
    .where('organization_id', '=', orgId)
    .executeTakeFirst();

  if (!posting) {
    res.status(404);
    throw new Error('Posting not found');
  }

  const enrollments = await getPostingEnrollments(postingId);

  res.json({
    posting,
    enrollments,
  });
});

attendanceRouter.patch('/:id/attendance', async (req, res: Response<OrganizationPostingAttendanceBulkUpdateResponse>) => {
  const orgId = req.userJWT!.id;
  const { id: postingId } = postingIdParamsSchema.parse(req.params);
  const body = attendanceBulkUpdateBodySchema.parse(req.body);

  const posting = await database
    .selectFrom('organization_posting')
    .select(['id'])
    .where('id', '=', postingId)
    .where('organization_id', '=', orgId)
    .executeTakeFirst();

  if (!posting) {
    res.status(404);
    throw new Error('Posting not found');
  }

  const changed = await database
    .updateTable('enrollment')
    .set({ attended: body.attended })
    .where('posting_id', '=', postingId)
    .where('attended', '!=', body.attended)
    .returning('volunteer_id')
    .execute();

  const volunteerIds = Array.from(new Set(changed.map(row => row.volunteer_id)));
  await Promise.all(volunteerIds.map(volunteerId => recomputeVolunteerExperienceVector(volunteerId)));

  res.json({ updated_count: changed.length });
});

attendanceRouter.get('/:id/attendance/export', async (req, res: Response<string>) => {
  const orgId = req.userJWT!.id;
  const { id: postingId } = postingIdParamsSchema.parse(req.params);

  const posting = await database
    .selectFrom('organization_posting')
    .select(['id', 'title'])
    .where('id', '=', postingId)
    .where('organization_id', '=', orgId)
    .executeTakeFirst();

  if (!posting) {
    res.status(404);
    throw new Error('Posting not found');
  }

  const enrollments = await getPostingEnrollments(postingId);
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

  const csvHeaders = [
    'enrollment_id',
    'volunteer_id',
    'first_name',
    'last_name',
    'email',
    'date_of_birth',
    'gender',
    'attended',
    'message',
    'skills',
  ];

  const csv = toCsv(rows, csvHeaders);
  const safeTitle = posting.title.replace(/[^a-z0-9-_]+/gi, '_');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeTitle || 'posting'}-attendance.csv"`);
  res.send(csv);
});

attendanceRouter.patch('/:id/enrollments/:enrollmentId/attendance', async (req, res: Response<OrganizationPostingEnrollmentAttendanceUpdateResponse>) => {
  const orgId = req.userJWT!.id;
  const { id: postingId, enrollmentId } = zod.object({
    id: zod.coerce.number().int().positive(),
    enrollmentId: zod.coerce.number().int().positive(),
  }).parse(req.params);
  const body = attendanceUpdateBodySchema.parse(req.body);

  const posting = await database
    .selectFrom('organization_posting')
    .select(['id'])
    .where('organization_posting.id', '=', postingId)
    .where('organization_posting.organization_id', '=', orgId)
    .executeTakeFirst();

  if (!posting) {
    res.status(404);
    throw new Error('Posting not found');
  }

  const enrollment = await database
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

  await database
    .updateTable('enrollment')
    .set({ attended: body.attended })
    .where('id', '=', enrollmentId)
    .execute();

  await recomputeVolunteerExperienceVector(enrollment.volunteer_id);

  res.json({});
});

export default attendanceRouter;
