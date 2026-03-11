import { ResetPasswordResponse } from '../../../auth/resetPassword.js';
import {
  AdminAccountWithoutPassword,
  Crisis,
  OrganizationAccountWithoutPassword,
  OrganizationRequest,
} from '../../../db/tables.js';

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

export type AdminCrisesResponse = {
  crises: Crisis[];
};

export type AdminCrisisCreateResponse = {
  crisis: Crisis;
};

export type AdminCrisisUpdateResponse = {
  crisis: Crisis;
};

export type AdminCrisisPinResponse = {
  crisis: Crisis;
};

export type AdminCrisisDeleteResponse = object;

export type AdminResetPasswordResponse = ResetPasswordResponse;
