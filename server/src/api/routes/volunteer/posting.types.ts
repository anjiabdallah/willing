import { Enrollment, EnrollmentApplication, OrganizationPostingWithoutVectors, PostingSkill } from '../../../db/tables.js';
import { PostingWithContext, SuccessResponse } from '../../../types.js';

export type VolunteerEnrollmentEntry = PostingWithContext & {
  status: 'enrolled' | 'pending';
};

export type VolunteerEnrollmentsResponse = {
  postings: VolunteerEnrollmentEntry[];
};

export type VolunteerPostingSearchResponse = {
  postings: (PostingWithContext & { enrollment_count: number })[];
};

export type VolunteerPostingResponse = {
  hasPendingApplication: boolean;
  posting: OrganizationPostingWithoutVectors;
  skills: PostingSkill[];
  isEnrolled: boolean;
};

export type VolunteerPostingEnrollResponse = {
  enrollment: Enrollment | EnrollmentApplication;
  isOpen: boolean;
};

export type VolunteerPostingWithdrawResponse = SuccessResponse;
