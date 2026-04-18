import { sql, type Kysely } from 'kysely';

import { type Database } from '../../../db/tables/index.ts';
import { type PostingEnrollment } from '../../../types.ts';

export const getPostingEnrollments = async (
  db: Kysely<Database>,
  postingId: number,
): Promise<PostingEnrollment[]> => {
  const enrollments = await db
    .selectFrom('enrollment')
    .innerJoin('volunteer_account', 'volunteer_account.id', 'enrollment.volunteer_id')
    .select([
      'enrollment.id as enrollment_id',
      'enrollment.volunteer_id',
      'enrollment.message',
      'enrollment.attended',
      'volunteer_account.first_name',
      'volunteer_account.last_name',
      'volunteer_account.email',
      'volunteer_account.date_of_birth',
      'volunteer_account.gender',
      'volunteer_account.cv_path',
    ])
    .where('enrollment.posting_id', '=', postingId)
    .where('volunteer_account.is_deleted', '=', false)
    .where('volunteer_account.is_disabled', '=', false)
    .orderBy('volunteer_account.last_name', 'asc')
    .orderBy('volunteer_account.first_name', 'asc')
    .execute();

  const volunteerIds = enrollments.map(enrollment => enrollment.volunteer_id);
  const skills = volunteerIds.length > 0
    ? await db
        .selectFrom('volunteer_skill')
        .selectAll()
        .where('volunteer_id', 'in', volunteerIds)
        .execute()
    : [];

  const enrollmentIds = enrollments.map(enrollment => enrollment.enrollment_id);
  const enrollmentDates = enrollmentIds.length > 0
    ? await db
        .selectFrom('enrollment_date')
        .select([
          'id',
          'enrollment_id',
          sql<string>`to_char(enrollment_date.date, 'YYYY-MM-DD')`.as('date'),
          'attended',
        ])
        .where('enrollment_id', 'in', enrollmentIds)
        .execute()
    : [];

  const datesByEnrollmentId = new Map<number, Array<{ id: number; date: string; attended: boolean }>>();
  enrollmentDates.forEach((row) => {
    const dateStr = typeof row.date === 'string' ? row.date : undefined;
    if (!dateStr) return;
    if (!datesByEnrollmentId.has(row.enrollment_id)) {
      datesByEnrollmentId.set(row.enrollment_id, []);
    }
    datesByEnrollmentId.get(row.enrollment_id)!.push({ id: row.id, date: dateStr, attended: Boolean(row.attended) });
  });

  const skillsByVolunteerId = new Map<number, typeof skills>();
  skills.forEach((skill) => {
    if (!skillsByVolunteerId.has(skill.volunteer_id)) {
      skillsByVolunteerId.set(skill.volunteer_id, []);
    }
    skillsByVolunteerId.get(skill.volunteer_id)!.push(skill);
  });

  return enrollments.map((enrollment) => {
    const payload: PostingEnrollment = {
      enrollment_id: enrollment.enrollment_id,
      volunteer_id: enrollment.volunteer_id,
      message: enrollment.message,
      attended: enrollment.attended,
      first_name: enrollment.first_name,
      last_name: enrollment.last_name,
      email: enrollment.email,
      date_of_birth: enrollment.date_of_birth,
      gender: enrollment.gender,
      skills: skillsByVolunteerId.get(enrollment.volunteer_id) || [],
      dates: datesByEnrollmentId.get(enrollment.enrollment_id) || [],
    };

    if (enrollment.cv_path != null) {
      payload.cv_path = enrollment.cv_path;
    }

    return payload;
  });
};
