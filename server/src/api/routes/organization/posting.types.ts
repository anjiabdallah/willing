import { type Crisis, type OrganizationPostingWithoutVectors, type PostingSkill } from '../../../db/tables/index.ts';
import { type PostingWithContext, type PostingWithSkills, type PostingEnrollment, type SuccessResponse, type PostingApplication } from '../../../types.ts';

export type OrganizationPostingCreateResponse = {
  posting: OrganizationPostingWithoutVectors;
  skills: PostingSkill[];
};

export type OrganizationPostingListResponse = {
  postings: (PostingWithSkills & { enrollment_count: number; is_full: boolean })[];
};

export type OrganizationPostingDiscoverResponse = {
  postings: PostingWithContext[];
};

export type OrganizationPostingResponse = {
  posting: OrganizationPostingWithoutVectors;
  skills: PostingSkill[];
  is_full: boolean;
  crisis?: Crisis;
};

export type OrganizationPostingEnrollmentsResponse = {
  enrollments: PostingEnrollment[];
};

export type OrganizationPostingUpdateResponse = {
  posting: OrganizationPostingWithoutVectors;
  skills: PostingSkill[];
  crisis?: Crisis;
};

export type OrganizationPostingDeleteResponse = SuccessResponse;

export type OrganizationPostingApplicationsReponse = {
  applications: PostingApplication[];
};

export type OrganizationPostingApplicationAcceptanceResponse = SuccessResponse;

export type OrganizationPostingApplicationRejectionResponse = SuccessResponse;
