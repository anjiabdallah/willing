import { EnrollmentApplication, OrganizationPosting, PostingSkill } from '../../../db/tables.js';
import { PostingWithSkillsAndOrgName, SuccessResponse } from '../../../types.js';

export type VolunteerPostingSearchResponse = {
  postings: PostingWithSkillsAndOrgName[];
};

export type VolunteerPostingResponse = {
  hasPendingApplication: boolean;
  posting: OrganizationPosting;
  skills: PostingSkill[];
  isEnrolled: boolean;
};

export type VolunteerPostingEnrollResponse = {
  application: EnrollmentApplication;
  isOpen: boolean;
};

export type VolunteerPostingWithdrawResponse = SuccessResponse;
