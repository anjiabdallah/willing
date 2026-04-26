import { sql } from 'kysely';

import database from '../../db/index.ts';

import type { VolunteerAccountWithoutPassword } from '../../db/tables/index.ts';

export type VolunteerCompletedExperience = {
  enrollment_id: number;
  posting_id: number;
  posting_title: string;
  organization_id: number;
  organization_name: string;
  organization_logo_path: string | null | undefined;
  location_name: string;
  start_date: Date;
  start_time: string;
  end_date: Date | undefined;
  end_time: string | undefined;
  crisis_name: string | null;
  is_closed: boolean;
  automatic_acceptance: boolean;
  enrollment_count: number;
};

export type VolunteerExperienceStats = {
  total_completed_experiences: number;
  organizations_supported: number;
  crisis_related_experiences: number;
  total_hours_completed: number;
  total_skills_used: number;
  most_volunteered_crisis: string | null;
};

export type VolunteerProfileData = {
  volunteer: VolunteerAccountWithoutPassword;
  skills: string[];
  experience_stats: VolunteerExperienceStats;
  completed_experiences: VolunteerCompletedExperience[];
};

export const getVolunteerProfile = async (volunteerId: number): Promise<VolunteerProfileData> => {
  const [volunteer, volunteerSkills, completedExperiences, usedPostingSkills] = await Promise.all([
    database
      .selectFrom('volunteer_account')
      .select([
        'id',
        'first_name',
        'last_name',
        'email',
        'date_of_birth',
        'gender',
        'cv_path',
        'description',
      ] as const)
      .where('id', '=', volunteerId)
      .where('is_deleted', '=', false)
      .where('is_disabled', '=', false)
      .executeTakeFirstOrThrow(),
    database
      .selectFrom('volunteer_skill')
      .select('name')
      .where('volunteer_id', '=', volunteerId)
      .orderBy('id', 'asc')
      .execute(),
    database
      .selectFrom('enrollment')
      .innerJoin('organization_posting', 'organization_posting.id', 'enrollment.posting_id')
      .innerJoin('organization_account', 'organization_account.id', 'organization_posting.organization_id')
      .leftJoin('crisis', 'crisis.id', 'organization_posting.crisis_id')
      .select('enrollment.id as enrollment_id')
      .select('organization_posting.id as posting_id')
      .select('organization_posting.title as posting_title')
      .select('organization_posting.organization_id as organization_id')
      .select('organization_account.name as organization_name')
      .select('organization_account.logo_path as organization_logo_path')
      .select('organization_posting.location_name as location_name')
      .select('organization_posting.start_date as start_date')
      .select('organization_posting.start_time as start_time')
      .select('organization_posting.end_date as end_date')
      .select('organization_posting.end_time as end_time')
      .select('organization_posting.is_closed as is_closed')
      .select('organization_posting.automatic_acceptance as automatic_acceptance')
      .select(sql<number>`COALESCE((SELECT COUNT(*) FROM enrollment e2 WHERE e2.posting_id = organization_posting.id), 0)`.as('enrollment_count'))
      .select('crisis.name as crisis_name')
      .where('enrollment.volunteer_id', '=', volunteerId)
      .where('enrollment.attended', '=', true)
      .orderBy('organization_posting.start_date', 'desc')
      .orderBy('organization_posting.start_time', 'desc')
      .execute(),
    database
      .selectFrom('enrollment')
      .innerJoin('posting_skill', 'posting_skill.posting_id', 'enrollment.posting_id')
      .select('posting_skill.name as skill_name')
      .where('enrollment.volunteer_id', '=', volunteerId)
      .where('enrollment.attended', '=', true)
      .execute(),
  ]);

  const totalHoursRow = await database
    .selectFrom('enrollment_date')
    .innerJoin('enrollment', 'enrollment.id', 'enrollment_date.enrollment_id')
    .innerJoin('organization_posting', 'organization_posting.id', 'enrollment.posting_id')
    .select(sql<number>`COALESCE(SUM(GREATEST(
  0,
  EXTRACT(EPOCH FROM (
    (enrollment_date.date + organization_posting.end_time)
    - (enrollment_date.date + organization_posting.start_time)
  )) / 3600.0
)), 0)`.as('total_hours'))
    .where('enrollment.volunteer_id', '=', volunteerId)
    .where('enrollment_date.attended', '=', true)
    .executeTakeFirstOrThrow();

  const totalHoursCompleted = Math.round((Number(totalHoursRow.total_hours ?? 0)) * 10) / 10;

  const crisisCountByName = new Map<string, number>();
  completedExperiences.forEach((experience) => {
    if (experience.crisis_name) {
      const previousCount = crisisCountByName.get(experience.crisis_name) ?? 0;
      crisisCountByName.set(experience.crisis_name, previousCount + 1);
    }
  });

  const sortedCrisisCounts = Array.from(crisisCountByName.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    });

  const mostVolunteeredCrisisEntry = sortedCrisisCounts[0];

  const skillUsageByName = new Map<string, number>();
  usedPostingSkills.forEach((skill) => {
    const previousCount = skillUsageByName.get(skill.skill_name) ?? 0;
    skillUsageByName.set(skill.skill_name, previousCount + 1);
  });

  const experienceStats: VolunteerExperienceStats = {
    total_completed_experiences: completedExperiences.length,
    organizations_supported: new Set(completedExperiences.map(experience => experience.organization_id)).size,
    crisis_related_experiences: completedExperiences.filter(experience => experience.crisis_name !== null).length,
    total_hours_completed: totalHoursCompleted,
    total_skills_used: skillUsageByName.size,
    most_volunteered_crisis: mostVolunteeredCrisisEntry?.[0] ?? null,
  };

  return {
    volunteer: {
      id: volunteer.id,
      first_name: volunteer.first_name,
      last_name: volunteer.last_name,
      email: volunteer.email,
      date_of_birth: volunteer.date_of_birth,
      gender: volunteer.gender,
      cv_path: volunteer.cv_path,
      description: volunteer.description ?? '',
    },
    skills: volunteerSkills.map(skill => skill.name),
    experience_stats: experienceStats,
    completed_experiences: completedExperiences.map(experience => ({
      enrollment_id: experience.enrollment_id,
      posting_id: experience.posting_id,
      posting_title: experience.posting_title,
      organization_id: experience.organization_id,
      organization_name: experience.organization_name,
      location_name: experience.location_name,
      start_date: experience.start_date,
      start_time: experience.start_time,
      end_date: experience.end_date ?? undefined,
      end_time: experience.end_time ?? undefined,
      crisis_name: experience.crisis_name,
      is_closed: experience.is_closed,
      automatic_acceptance: experience.automatic_acceptance,
      enrollment_count: experience.enrollment_count,
      organization_logo_path: experience.organization_logo_path,
    })),
  };
};
