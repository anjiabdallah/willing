import { ResetPasswordResponse } from '../../../auth/resetPassword.js';
import { OrganizationAccount, OrganizationAccountWithoutPassword, OrganizationPosting, PostingSkill } from '../../../db/tables.js';
import { SuccessResponse } from '../../../types.js';

export type OrganizationRequestResponse = SuccessResponse;

export type OrganizationProfileResponse = {
  organization: Omit<OrganizationAccount, 'password'>;
  postings: (OrganizationPosting & { skills: PostingSkill[] })[];
};

export type OrganizationMeResponse = {
  organization: OrganizationAccountWithoutPassword;
};

export type OrganizationResetPasswordResponse = ResetPasswordResponse;
