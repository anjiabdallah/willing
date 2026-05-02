import { type PostingWithoutVectors } from '../../../db/tables/index.ts';
import { type PostingEnrollment, type SuccessResponse } from '../../../types.ts';

export type PostingEnrollmentAttendanceUpdateResponse = SuccessResponse;

export type PostingAttendanceResponse = {
  posting: Pick<PostingWithoutVectors, 'id' | 'title' | 'location_name' | 'start_date' | 'end_date' | 'allows_partial_attendance'>;
  enrollments: PostingEnrollment[];
  posting_dates: string[];
};

export type PostingAttendanceBulkUpdateResponse = {
  updated_count: number;
};
