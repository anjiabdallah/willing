import { ResetPasswordResponse } from '../../../auth/resetPassword.js';
import { Crisis, OrganizationAccountWithoutPassword, OrganizationAccountWithoutPasswordAndVector, OrganizationPostingWithoutVectors, PostingSkill } from '../../../db/tables.js';
import { SuccessResponse } from '../../../types.js';

export type OrganizationRequestResponse = SuccessResponse;

export type OrganizationProfileResponse = {
  organization: OrganizationAccountWithoutPasswordAndVector;
  postings: (OrganizationPostingWithoutVectors & { skills: PostingSkill[] })[];
};

export type OrganizationMeResponse = {
  organization: OrganizationAccountWithoutPassword;
};

export type OrganizationPinnedCrisesResponse = {
  crises: Crisis[];
};

export type OrganizationCrisisResponse = {
  crisis: Crisis;
};

export type OrganizationResetPasswordResponse = ResetPasswordResponse;
