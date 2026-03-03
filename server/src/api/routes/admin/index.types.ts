import { ResetPasswordResponse } from '../../../auth/resetPassword.js';
import { AdminAccountWithoutPassword, OrganizationAccountWithoutPassword, OrganizationRequest } from '../../../db/tables.js';

export type AdminLoginResponse = {
  token: string;
  admin: AdminAccountWithoutPassword;
};

export type AdminMeResponse = {
  admin: AdminAccountWithoutPassword;
};

export type AdminOrganizationRequestsResponse = {
  organizationRequests: OrganizationRequest[];
};

export type AdminOrganizationRequestReviewResponse = object | {
  organization: OrganizationAccountWithoutPassword;
};

export type AdminResetPasswordResponse = ResetPasswordResponse;
