import { ResetPasswordResponse } from '../../../auth/resetPassword.js';
import { OrganizationAccountWithoutPassword } from '../../../db/tables.js';
import { SuccessResponse } from '../../../types.js';

export type OrganizationRequestResponse = SuccessResponse;

export type OrganizationMeResponse = {
  organization: OrganizationAccountWithoutPassword;
};

export type OrganizationResetPasswordResponse = ResetPasswordResponse;
