import database from '../../db/index.js';

import type { VolunteerAccountWithoutPassword } from '../../db/tables.js';

export type VolunteerCompletedExperience = {
  enrollment_id: number;
  posting_id: number;
  posting_title: string;
  organization_id: number;
  organization_name: string;
  location_name: string;
  start_timestamp: Date;
  end_timestamp: Date | undefined;
  crisis_name: string | null;
};

export type VolunteerExperienceStats = {
  total_completed_experiences: number;
  organizations_supported: number;
  crisis_related_experiences: number;
  total_hours_completed: number;
  total_skills_used: number;
  most_used_skill: string | null;
  most_used_skill_frequency: number;
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
        'privacy',
      ])
      .where('id', '=', volunteerId)
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
      .select([
        'enrollment.id as enrollment_id',
        'organization_posting.id as posting_id',
        'organization_posting.title as posting_title',
        'organization_posting.organization_id as organization_id',
        'organization_account.name as organization_name',
        'organization_posting.location_name as location_name',
        'organization_posting.start_timestamp as start_timestamp',
        'organization_posting.end_timestamp as end_timestamp',
        'crisis.name as crisis_name',
      ])
      .where('enrollment.volunteer_id', '=', volunteerId)
      .where('enrollment.attended', '=', true)
      .orderBy('organization_posting.start_timestamp', 'desc')
      .execute(),
    database
      .selectFrom('enrollment')
      .innerJoin('posting_skill', 'posting_skill.posting_id', 'enrollment.posting_id')
      .select('posting_skill.name as skill_name')
      .where('enrollment.volunteer_id', '=', volunteerId)
      .where('enrollment.attended', '=', true)
      .execute(),
  ]);

  const totalHoursCompletedRaw = completedExperiences.reduce((totalHours, experience) => {
    if (!experience.end_timestamp) return totalHours;

    const startMillis = new Date(experience.start_timestamp).getTime();
    const endMillis = new Date(experience.end_timestamp).getTime();

    if (Number.isNaN(startMillis) || Number.isNaN(endMillis) || endMillis <= startMillis) {
      return totalHours;
    }

    return totalHours + ((endMillis - startMillis) / (1000 * 60 * 60));
  }, 0);

  const totalHoursCompleted = Math.round(totalHoursCompletedRaw * 10) / 10;

  const skillUsageByName = new Map<string, number>();
  usedPostingSkills.forEach((skill) => {
    const previousCount = skillUsageByName.get(skill.skill_name) ?? 0;
    skillUsageByName.set(skill.skill_name, previousCount + 1);
  });

  const sortedSkillUsage = Array.from(skillUsageByName.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    });

  const mostUsedSkillEntry = sortedSkillUsage[0];

  const experienceStats: VolunteerExperienceStats = {
    total_completed_experiences: completedExperiences.length,
    organizations_supported: new Set(completedExperiences.map(experience => experience.organization_id)).size,
    crisis_related_experiences: completedExperiences.filter(experience => experience.crisis_name !== null).length,
    total_hours_completed: totalHoursCompleted,
    total_skills_used: skillUsageByName.size,
    most_used_skill: mostUsedSkillEntry?.[0] ?? null,
    most_used_skill_frequency: mostUsedSkillEntry?.[1] ?? 0,
  };

  return {
    volunteer: {
      id: volunteer.id,
      first_name: volunteer.first_name,
      last_name: volunteer.last_name,
      email: volunteer.email,
      date_of_birth: volunteer.date_of_birth,
      gender: volunteer.gender,
      privacy: volunteer.privacy,
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
      start_timestamp: experience.start_timestamp,
      end_timestamp: experience.end_timestamp,
      crisis_name: experience.crisis_name,
    })),
  };
};
