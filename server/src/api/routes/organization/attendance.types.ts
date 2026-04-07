import { type OrganizationPostingWithoutVectors } from '../../../db/tables/index.ts';
import { type PostingEnrollment, type SuccessResponse } from '../../../types.ts';

export type OrganizationPostingEnrollmentAttendanceUpdateResponse = SuccessResponse;

export type OrganizationPostingAttendanceResponse = {
  posting: Pick<OrganizationPostingWithoutVectors, 'id' | 'title' | 'location_name' | 'start_date' | 'end_date' | 'allows_partial_attendance'>;
  enrollments: PostingEnrollment[];
  posting_dates: string[];
};

export type OrganizationPostingAttendanceBulkUpdateResponse = {
  updated_count: number;
};
