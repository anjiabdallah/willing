import { CheckCheck, Download, RotateCcw, Save, Undo2, Users } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router';

import Alert from '../../components/Alert';
import Button from '../../components/Button';
import PageHeader from '../../components/layout/PageHeader';
import Loading from '../../components/Loading';
import VolunteerInfoCollapse from '../../components/VolunteerInfoCollapse';
import useNotifications from '../../notifications/useNotifications';
import requestServer, { SERVER_BASE_URL } from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type { OrganizationPostingAttendanceResponse } from '../../../../server/src/api/types';
import type { PostingEnrollment } from '../../../../server/src/types';

function OrganizationPostingAttendance() {
  const { id } = useParams<{ id: string }>();

  const [saving, setSaving] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [draftAttendance, setDraftAttendance] = useState<Record<number, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'attended_first' | 'absent_first'>('name_asc');
  const notifications = useNotifications();

  const {
    data,
    loading,
    error,
    trigger: loadAttendance,
  } = useAsync<OrganizationPostingAttendanceResponse, []>(async () => {
    if (!id) {
      throw new Error('Posting ID is missing.');
    }

    const response = await requestServer<OrganizationPostingAttendanceResponse>(`/organization/posting/${id}/attendance`, { includeJwt: true });
    setDraftAttendance(
      Object.fromEntries(response.enrollments.map(enrollment => [enrollment.enrollment_id, enrollment.attended])),
    );
    return response;
  }, {
    immediate: true,
    notifyOnError: true,
  });

  const { trigger: submitAttendanceChanges } = useAsync(
    async (postingId: string, attendanceUpdates: Array<{ enrollmentId: number; attended: boolean }>) => Promise.all(
      attendanceUpdates.map(update => requestServer(
        `/organization/posting/${postingId}/enrollments/${update.enrollmentId}/attendance`,
        {
          method: 'PATCH',
          includeJwt: true,
          body: { attended: update.attended },
        },
      )),
    ),
    { notifyOnError: true },
  );

  const { trigger: requestAttendanceCsv } = useAsync(
    async (postingId: string) => {
      const token = localStorage.getItem('jwt');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${SERVER_BASE_URL}/organization/posting/${postingId}/attendance/export`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        let messageText = `Failed to export CSV (status ${response.status})`;
        try {
          const errorBody = await response.json();
          messageText = errorBody.message ?? messageText;
        } catch {
          // Ignore non-JSON response body
        }
        throw new Error(messageText);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameFromHeader = contentDisposition?.match(/filename="([^"]+)"/)?.[1];

      return {
        blob,
        filename: filenameFromHeader ?? `posting-${postingId}-attendance.csv`,
      };
    },
    { notifyOnError: true },
  );

  const toggleAttendance = useCallback(async (enrollment: PostingEnrollment) => {
    if (saving) return;
    setDraftAttendance(current => ({
      ...current,
      [enrollment.enrollment_id]: !(current[enrollment.enrollment_id] ?? enrollment.attended),
    }));
  }, [saving]);

  const setAllAttendanceDraft = useCallback((attended: boolean) => {
    if (!data) return;
    if (saving) return;
    setDraftAttendance(
      Object.fromEntries(data!.enrollments.map(enrollment => [enrollment.enrollment_id, attended])),
    );
  }, [data, saving]);

  const submitAttendance = useCallback(async () => {
    if (!id || !data || saving) return;

    const changedEnrollments = data.enrollments.filter((enrollment) => {
      const nextAttendedValue = draftAttendance[enrollment.enrollment_id] ?? enrollment.attended;
      return nextAttendedValue !== enrollment.attended;
    });

    if (changedEnrollments.length === 0) {
      notifications.push({
        type: 'info',
        message: 'No attendance changes to submit.',
      });
      return;
    }

    try {
      setSaving(true);

      await submitAttendanceChanges(
        id,
        changedEnrollments.map(enrollment => ({
          enrollmentId: enrollment.enrollment_id,
          attended: draftAttendance[enrollment.enrollment_id] ?? enrollment.attended,
        })),
      );

      await loadAttendance();
      notifications.push({
        type: 'success',
        message: `Attendance saved for ${changedEnrollments.length} volunteer${changedEnrollments.length > 1 ? 's' : ''}.`,
      });
    } catch {
      await loadAttendance();
    } finally {
      setSaving(false);
    }
  }, [data, draftAttendance, id, loadAttendance, notifications, saving, submitAttendanceChanges]);

  const undoAttendanceChanges = useCallback(() => {
    if (!data || saving) return;
    setDraftAttendance(
      Object.fromEntries(data.enrollments.map(enrollment => [enrollment.enrollment_id, enrollment.attended])),
    );
  }, [data, saving]);

  const exportAttendanceCsv = useCallback(async () => {
    if (!id || exportingCsv) return;

    try {
      setExportingCsv(true);
      const { blob, filename } = await requestAttendanceCsv(id);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      notifications.push({
        type: 'success',
        message: 'Attendance CSV exported successfully.',
      });
    } finally {
      setExportingCsv(false);
    }
  }, [exportingCsv, id, notifications, requestAttendanceCsv]);

  const hasUnsavedChanges = useMemo(() => {
    if (!data) return false;
    return data.enrollments.some((enrollment) => {
      const nextAttendedValue = draftAttendance[enrollment.enrollment_id] ?? enrollment.attended;
      return nextAttendedValue !== enrollment.attended;
    });
  }, [data, draftAttendance]);

  const displayedEnrollments = useMemo(() => {
    if (!data) return [];
    return data.enrollments.map(enrollment => ({
      ...enrollment,
      attended: draftAttendance[enrollment.enrollment_id] ?? enrollment.attended,
    }));
  }, [data, draftAttendance]);

  const filteredAndSortedEnrollments = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    let result = displayedEnrollments.filter((enrollment) => {
      if (!normalizedSearch) return true;
      const fullName = `${enrollment.first_name} ${enrollment.last_name}`.toLowerCase();
      return (
        fullName.includes(normalizedSearch)
        || enrollment.email.toLowerCase().includes(normalizedSearch)
      );
    });

    result = [...result].sort((left, right) => {
      if (sortBy === 'name_asc') {
        return `${left.last_name} ${left.first_name}`.localeCompare(`${right.last_name} ${right.first_name}`);
      }
      if (sortBy === 'name_desc') {
        return `${right.last_name} ${right.first_name}`.localeCompare(`${left.last_name} ${left.first_name}`);
      }
      if (sortBy === 'attended_first') {
        if (left.attended === right.attended) {
          return `${left.last_name} ${left.first_name}`.localeCompare(`${right.last_name} ${right.first_name}`);
        }
        return left.attended ? -1 : 1;
      }
      if (left.attended === right.attended) {
        return `${left.last_name} ${left.first_name}`.localeCompare(`${right.last_name} ${right.first_name}`);
      }
      return left.attended ? 1 : -1;
    });

    return result;
  }, [displayedEnrollments, searchTerm, sortBy]);

  if (loading && !data) {
    return (
      <div className="grow bg-base-200">
        <div className="p-6 md:container mx-auto">
          <div className="flex justify-center mt-8">
            <Loading size="xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="grow bg-base-200">
        <div className="p-6 md:container mx-auto">
          <div className="mb-4 text-sm text-base-content/70">
            Unable to load attendance details.
          </div>
          <Button style="outline" onClick={() => void loadAttendance()} Icon={RotateCcw}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <PageHeader
          title="Attendance"
          subtitle={`Manage attendance for "${data.posting.title}"`}
          icon={Users}
          showBack
          defaultBackTo={`/posting/${data.posting.id}`}
          actions={(
            <>
              <Button
                style="outline"
                onClick={() => void exportAttendanceCsv()}
                disabled={data.enrollments.length === 0}
                loading={exportingCsv}
                Icon={Download}
              >
                Export CSV
              </Button>
              <Button
                style="soft"
                color="success"
                onClick={() => setAllAttendanceDraft(true)}
                disabled={data.enrollments.length === 0}
                loading={saving}
                Icon={CheckCheck}
              >
                Mark All Present
              </Button>
              <Button
                color="warning"
                style="soft"
                onClick={() => setAllAttendanceDraft(false)}
                disabled={data.enrollments.length === 0}
                loading={saving}
                Icon={RotateCcw}
              >
                Clear All
              </Button>
              <Button
                color="ghost"
                onClick={undoAttendanceChanges}
                disabled={!hasUnsavedChanges}
                loading={saving}
                Icon={Undo2}
              >
                Undo Changes
              </Button>
              <Button
                color="primary"
                onClick={() => void submitAttendance()}
                disabled={!hasUnsavedChanges}
                loading={saving}
                Icon={Save}
              >
                Save Attendance
              </Button>
            </>
          )}
        />

        <div className="card bg-base-100 shadow-md mt-4">
          <div className="card-body">
            <h4 className="text-xl font-bold mb-3">
              Registered Volunteers
              {' '}
              <span className="badge badge-primary">{data.enrollments.length}</span>
            </h4>
            <div className="mb-4 grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="Search by name or email"
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
              />
              <select
                className="select select-bordered"
                value={sortBy}
                onChange={event => setSortBy(event.target.value as typeof sortBy)}
              >
                <option value="name_asc">Name A-Z</option>
                <option value="name_desc">Name Z-A</option>
                <option value="attended_first">Present First</option>
                <option value="absent_first">Absent First</option>
              </select>
            </div>

            {data.enrollments.length === 0 && (
              <Alert>
                No enrolled volunteers to track yet.
              </Alert>
            )}

            {data.enrollments.length > 0 && filteredAndSortedEnrollments.length === 0 && (
              <Alert>
                No volunteers match this search.
              </Alert>
            )}

            {data.enrollments.length > 0 && filteredAndSortedEnrollments.length > 0 && (
              <div className="space-y-2">
                {filteredAndSortedEnrollments.map(volunteer => (
                  <VolunteerInfoCollapse
                    key={volunteer.enrollment_id}
                    volunteer={volunteer}
                    actions={(
                      <label className="flex items-center gap-2">
                        <span className={`badge ${volunteer.attended ? 'badge-success' : 'badge-ghost'}`}>
                          {volunteer.attended ? 'Present' : 'Absent'}
                        </span>
                        <input
                          type="checkbox"
                          className="toggle toggle-success"
                          checked={volunteer.attended}
                          disabled={saving}
                          onChange={() => void toggleAttendance(volunteer)}
                        />
                      </label>
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OrganizationPostingAttendance;
