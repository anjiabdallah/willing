import { Enrollment, EnrollmentApplication, OrganizationPostingWithoutVectors, PostingSkill } from '../../../db/tables.js';
import { PostingWithContext, SuccessResponse } from '../../../types.js';

export type VolunteerEnrollmentEntry = PostingWithContext & {
  status: 'enrolled' | 'pending';
  is_full: boolean;
};

export type VolunteerEnrollmentsResponse = {
  postings: VolunteerEnrollmentEntry[];
};

export type VolunteerPostingSearchResponse = {
  postings: (PostingWithContext & { is_full: boolean })[];
};

export type VolunteerPostingResponse = {
  hasPendingApplication: boolean;
  posting: OrganizationPostingWithoutVectors;
  skills: PostingSkill[];
  isEnrolled: boolean;
  is_full: boolean;
};

export type VolunteerPostingEnrollResponse = {
  enrollment: Enrollment | EnrollmentApplication;
  isOpen: boolean;
};

export type VolunteerPostingWithdrawResponse = SuccessResponse;
