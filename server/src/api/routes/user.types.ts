import { type OrganizationAccountWithoutPassword, type VolunteerAccountWithoutPassword } from '../../db/tables/index.ts';

export type UserLoginResponse = {
  token: string;
  role: 'volunteer' | 'organization';
  volunteer?: VolunteerAccountWithoutPassword;
  organization?: OrganizationAccountWithoutPassword;
};

export type UserForgotPasswordResponse = object;

export type UserForgotPasswordResetResponse = object;

export type UserDeleteAccountResponse = object;
