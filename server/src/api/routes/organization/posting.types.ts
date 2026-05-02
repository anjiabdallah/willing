import { type Crisis, type PostingWithoutVectors, type PostingSkill } from '../../../db/tables/index.ts';
import { type PostingWithContext, type PostingWithSkills, type PostingEnrollment, type SuccessResponse, type PostingApplication } from '../../../types.ts';

type PostingWithEndedStatus = PostingWithoutVectors & {
  has_ended: boolean;
};

type PostingListItem = PostingWithSkills & {
  enrollment_count: number;
  is_full: boolean;
  has_ended: boolean;
};

export type PostingCreateResponse = {
  posting: PostingWithEndedStatus;
  skills: PostingSkill[];
};

export type PostingListResponse = {
  postings: PostingListItem[];
};

export type PostingDiscoverResponse = {
  postings: PostingWithContext[];
};

export type PostingResponse = {
  posting: PostingWithEndedStatus;
  skills: PostingSkill[];
  is_full: boolean;
  crisis?: Crisis;
};

export type PostingEnrollmentsResponse = {
  enrollments: PostingEnrollment[];
};

export type PostingUpdateResponse = {
  posting: PostingWithEndedStatus;
  skills: PostingSkill[];
  crisis?: Crisis;
};

export type PostingDeleteResponse = SuccessResponse;

export type PostingApplicationsReponse = {
  applications: PostingApplication[];
};

export type PostingApplicationAcceptanceResponse = SuccessResponse;

export type PostingApplicationRejectionResponse = SuccessResponse;
