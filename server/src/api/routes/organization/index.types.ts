import { ResetPasswordResponse } from '../../../auth/resetPassword.js';
import { Crisis, OrganizationAccountWithoutPassword, OrganizationAccountWithoutPasswordAndVector, OrganizationPostingWithoutVectors, PostingSkill } from '../../../db/tables.js';
import { SuccessResponse } from '../../../types.js';

export type OrganizationRequestResponse = SuccessResponse;

export type OrganizationGetLogoFileResponse = never;

export type OrganizationProfileResponse = {
  organization: OrganizationAccountWithoutPasswordAndVector;
  postings: (OrganizationPostingWithoutVectors & { skills: PostingSkill[] })[];
};

export type OrganizationGetMeResponse = {
  organization: OrganizationAccountWithoutPassword;
};

export type OrganizationUpdateProfileResponse = {
  organization: OrganizationAccountWithoutPassword;
};

export type OrganizationUploadLogoResponse = {
  organization: OrganizationAccountWithoutPassword;
};

export type OrganizationDeleteLogoResponse = {
  organization: OrganizationAccountWithoutPassword;
};

export type OrganizationPinnedCrisesResponse = {
  crises: Crisis[];
};

export type OrganizationCrisesResponse = {
  crises: Crisis[];
};

export type OrganizationCrisisResponse = {
  crisis: Crisis;
};

export type OrganizationResetPasswordResponse = ResetPasswordResponse;
