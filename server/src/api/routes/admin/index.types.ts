import { type ResetPasswordResponse } from '../../../auth/resetPassword.ts';
import {
  type AdminAccountWithoutPassword,
  type OrganizationAccountWithoutPassword,
  type OrganizationRequest,
} from '../../../db/tables/index.ts';

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

export type AdminOrganizationReportListItem = {
  id: number;
  title: string;
  message: string;
  created_at: Date;
  reported_organization: {
    id: number;
    name: string;
    email: string;
  };
  reporter_volunteer: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
};

export type AdminVolunteerReportListItem = {
  id: number;
  title: string;
  message: string;
  created_at: Date;
  reported_volunteer: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  reporter_organization: {
    id: number;
    name: string;
    email: string;
  };
};

export type AdminReportsResponse = {
  organizationReports: AdminOrganizationReportListItem[];
  volunteerReports: AdminVolunteerReportListItem[];
};

export type AdminGetOrganizationReportResponse = {
  id: number;
  title: string;
  message: string;
  created_at: Date;
  reported_organization: {
    id: number;
    name: string;
    email: string;
  };
  reporter_volunteer: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
};

export type AdminGetVolunteerReportResponse = {
  id: number;
  title: string;
  message: string;
  created_at: Date;
  reported_volunteer: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
  reporter_organization: {
    id: number;
    name: string;
    email: string;
  };
};

export type AdminDisableOrganizationAccountResponse = object;

export type AdminDisableVolunteerAccountResponse = object;

export type AdminRejectOrganizationReportResponse = object;

export type AdminRejectVolunteerReportResponse = object;

export type AdminAcceptOrganizationReportResponse = object;

export type AdminAcceptVolunteerReportResponse = object;

export type AdminResetPasswordResponse = ResetPasswordResponse;
