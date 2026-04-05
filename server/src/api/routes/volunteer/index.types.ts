import { type ResetPasswordResponse } from '../../../auth/resetPassword.ts';
import { type Crisis, type VolunteerAccountWithoutPassword } from '../../../db/tables/index.ts';

import type { VolunteerProfileData } from '../../../services/volunteer/index.ts';

export type VolunteerCreateResponse = {
  requires_email_verification: true;
};

export type VolunteerResendVerificationResponse = object;

export type VolunteerVerifyEmailResponse = {
  volunteer: VolunteerAccountWithoutPassword;
  token: string;
};

export type VolunteerMeResponse = {
  volunteer: VolunteerAccountWithoutPassword;
};

export type VolunteerProfileResponse = VolunteerProfileData;

export type VolunteerPinnedCrisesResponse = {
  crises: Crisis[];
};

export type VolunteerCrisesResponse = {
  crises: Crisis[];
};

export type VolunteerCrisisResponse = {
  crisis: Crisis;
};

export type VolunteerCertificateOrganization = {
  id: number;
  name: string;
  hours: number;
  hours_threshold: number | null;
  certificate_feature_enabled: boolean;
  eligible: boolean;
  logo_path: string | null;
  signatory_name: string | null;
  signatory_position: string | null;
  signature_path: string | null;
};

export type VolunteerOrganizationSearchResult = {
  id: number;
  name: string;
  description: string | null;
  location_name: string | null;
  logo_path: string | null;
  posting_count: number;
};

export type VolunteerOrganizationSearchResponse = {
  organizations: VolunteerOrganizationSearchResult[];
};

export type VolunteerCertificateResponse = {
  volunteer: Pick<VolunteerAccountWithoutPassword, 'id' | 'first_name' | 'last_name'>;
  total_hours: number;
  organizations: VolunteerCertificateOrganization[];
  platform_certificate: {
    signatory_name: string | null;
    signatory_position: string | null;
    signature_path: string | null;
  } | null;
};

export type VolunteerCertificateIssueResponse = {
  verification_token: string;
  issued_at: string;
};

export type VolunteerResetPasswordResponse = ResetPasswordResponse;

export type VolunteerReportOrganizationResponse = object;
