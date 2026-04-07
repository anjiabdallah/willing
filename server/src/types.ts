import zod from 'zod';

import {
  type OrganizationPostingWithoutVectors,
  type PostingSkill,
  type VolunteerSkill,
  type VolunteerAccountWithoutPassword,
} from './db/tables/index.ts';

export type Role = 'admin' | 'volunteer' | 'organization';

export const genderSchema = zod.enum(['male', 'female', 'other'], 'Gender should be \'female\', \'male\', or \'other\' ');
export type Gender = zod.infer<typeof genderSchema>;

export type SuccessResponse = Record<string, never>;

export interface UserJWT {
  id: number;
  role: Role;
  token_version: number;
}

export const loginInfoSchema = zod.object({
  email: zod.email(),
  password: zod.string(),
});

export type LoginInfo = zod.infer<typeof loginInfoSchema>;

export type PostingWithSkills = OrganizationPostingWithoutVectors & {
  skills: PostingSkill[];
};

export type PostingApplicationStatus = 'none' | 'pending' | 'registered';

export type PostingWithContext = PostingWithSkills & {
  organization_name: string;
  organization_logo_path: string | undefined;
  crisis_name: string | null;
  enrollment_count: number;
  application_status: PostingApplicationStatus;
  date_capacity?: Record<string, number>;
  confirmed_date_capacity?: Record<string, number>;
};

export type PostingEnrollment = {
  enrollment_id: number;
  volunteer_id: number;
  message: string | undefined;
  attended: boolean;
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth: string;
  gender: Gender;
  cv_path?: string | null;
  skills: VolunteerSkill[];
  dates?: Array<{ id: number; date: string; attended: boolean }>;
};

export type PostingApplication = Omit<
  VolunteerAccountWithoutPassword,
    'id' | 'description'
> & {
  skills: VolunteerSkill[];
  volunteer_id: number;
  message: string | undefined;
  created_at: Date;
  application_id: number;
  requested_dates?: string[];
};
