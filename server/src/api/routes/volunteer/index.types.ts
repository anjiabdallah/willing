import { ResetPasswordResponse } from '../../../auth/resetPassword.js';
import { VolunteerAccountWithoutPassword } from '../../../db/tables.js';

import type { VolunteerProfileData } from '../../../services/volunteer/profile.js';

export type VolunteerCreateResponse = {
  volunteer: VolunteerAccountWithoutPassword;
  token: string;
};

export type VolunteerMeResponse = {
  volunteer: VolunteerAccountWithoutPassword;
};

export type VolunteerProfileResponse = VolunteerProfileData;

export type VolunteerResetPasswordResponse = ResetPasswordResponse;
