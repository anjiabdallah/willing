import { ResetPasswordResponse } from '../../../auth/resetPassword.js';
import { VolunteerAccountWithoutPassword } from '../../../db/tables.js';

export type VolunteerCreateResponse = {
  volunteer: VolunteerAccountWithoutPassword;
  token: string;
};

export type VolunteerMeResponse = {
  volunteer: VolunteerAccountWithoutPassword;
};

export type VolunteerProfileResponse = {
  volunteer: VolunteerAccountWithoutPassword;
  skills: string[];
};

export type VolunteerResetPasswordResponse = ResetPasswordResponse;
