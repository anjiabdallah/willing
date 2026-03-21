import { Enrollment, EnrollmentApplication } from '../../../db/tables.js';
import { PostingWithContext, SuccessResponse } from '../../../types.js';

export type VolunteerEnrollmentsResponse = {
  postings: PostingWithContext[];
};

export type VolunteerPostingSearchResponse = {
  postings: PostingWithContext[];
};

export type VolunteerPostingResponse = {
  posting: PostingWithContext;
};

export type VolunteerPostingEnrollResponse = {
  enrollment: Enrollment | EnrollmentApplication;
  isOpen: boolean;
};

export type VolunteerPostingWithdrawResponse = SuccessResponse;
