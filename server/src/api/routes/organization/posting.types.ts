import { Crisis, OrganizationPostingWithoutVectors, PostingSkill } from '../../../db/tables.js';
import { PostingWithSkills, PostingEnrollment, SuccessResponse, PostingApplication } from '../../../types.js';

export type OrganizationPostingCreateResponse = {
  posting: OrganizationPostingWithoutVectors;
  skills: PostingSkill[];
};

export type OrganizationPostingListResponse = {
  postings: (PostingWithSkills & { enrollment_count: number })[];
};

export type OrganizationPostingResponse = {
  posting: OrganizationPostingWithoutVectors;
  skills: PostingSkill[];
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

export type OrganizationPostingEnrollmentAttendanceUpdateResponse = SuccessResponse;

export type AttendanceStatus = 'not_started' | 'open' | 'closed';

export type OrganizationPostingAttendanceResponse = {
  posting: Pick<OrganizationPostingWithoutVectors, 'id' | 'title' | 'start_timestamp' | 'end_timestamp' | 'location_name'>;
  enrollments: PostingEnrollment[];
  attendance_status: AttendanceStatus;
  can_edit_attendance: boolean;
  attendance_edit_starts_at: Date;
  attendance_edit_ends_at: Date;
};

export type OrganizationPostingAttendanceBulkUpdateResponse = {
  updated_count: number;
};
