import { CheckCheck, Clock3, Download, RotateCcw, Save, Undo2, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';

import PageHeader from '../../components/layout/PageHeader';
import Loading from '../../components/Loading';
import VolunteerInfoCollapse from '../../components/VolunteerInfoCollapse';
import requestServer, { SERVER_BASE_URL } from '../../utils/requestServer';

import type { OrganizationPostingAttendanceResponse } from '../../../../server/src/api/types';
import type { PostingEnrollment } from '../../../../server/src/types';

const formatDateTime = (value: Date | string) => new Date(value).toLocaleString();

function OrganizationPostingAttendance() {
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<OrganizationPostingAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draftAttendance, setDraftAttendance] = useState<Record<number, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'attended_first' | 'absent_first'>('name_asc');

  const loadAttendance = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const response = await requestServer<OrganizationPostingAttendanceResponse>(`/organization/posting/${id}/attendance`, { includeJwt: true });
      setData(response);
      setDraftAttendance(
        Object.fromEntries(response.enrollments.map(enrollment => [enrollment.enrollment_id, enrollment.attended])),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const toggleAttendance = useCallback(async (enrollment: PostingEnrollment) => {
    if (!data?.can_edit_attendance || saving) return;
    setError(null);
    setMessage(null);
    setDraftAttendance(current => ({
      ...current,
      [enrollment.enrollment_id]: !(current[enrollment.enrollment_id] ?? enrollment.attended),
    }));
  }, [data, saving]);

  const setAllAttendanceDraft = useCallback((attended: boolean) => {
    if (!data?.can_edit_attendance || saving) return;
    setError(null);
    setMessage(null);
    setDraftAttendance(
      Object.fromEntries(data.enrollments.map(enrollment => [enrollment.enrollment_id, attended])),
    );
  }, [data, saving]);

  const submitAttendance = useCallback(async () => {
    if (!id || !data?.can_edit_attendance || saving) return;

    const changedEnrollments = data.enrollments.filter((enrollment) => {
      const nextAttendedValue = draftAttendance[enrollment.enrollment_id] ?? enrollment.attended;
      return nextAttendedValue !== enrollment.attended;
    });

    if (changedEnrollments.length === 0) {
      setMessage('No attendance changes to submit.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      await Promise.all(changedEnrollments.map(enrollment => requestServer(
        `/organization/posting/${id}/enrollments/${enrollment.enrollment_id}/attendance`,
        {
          method: 'PATCH',
          includeJwt: true,
          body: { attended: draftAttendance[enrollment.enrollment_id] ?? enrollment.attended },
        },
      )));

      setData(current => (
        current
          ? {
              ...current,
              enrollments: current.enrollments.map(enrollment => ({
                ...enrollment,
                attended: draftAttendance[enrollment.enrollment_id] ?? enrollment.attended,
              })),
            }
          : current
      ));
      setMessage(`Attendance submitted for ${changedEnrollments.length} volunteer${changedEnrollments.length > 1 ? 's' : ''}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to submit attendance');
    } finally {
      setSaving(false);
    }
  }, [data, draftAttendance, id, saving]);

  const undoAttendanceChanges = useCallback(() => {
    if (!data || saving) return;
    setDraftAttendance(
      Object.fromEntries(data.enrollments.map(enrollment => [enrollment.enrollment_id, enrollment.attended])),
    );
    setError(null);
    setMessage(null);
  }, [data, saving]);

  const exportAttendanceCsv = useCallback(async () => {
    if (!id || exportingCsv) return;

    try {
      setExportingCsv(true);
      setError(null);
      const token = localStorage.getItem('jwt');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${SERVER_BASE_URL}/organization/posting/${id}/attendance/export`, {
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
      const link = document.createElement('a');
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameFromHeader = contentDisposition?.match(/filename="([^"]+)"/)?.[1];
      link.href = URL.createObjectURL(blob);
      link.download = filenameFromHeader ?? `posting-${id}-attendance.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (csvError) {
      setError(csvError instanceof Error ? csvError.message : 'Failed to export CSV');
    } finally {
      setExportingCsv(false);
    }
  }, [exportingCsv, id]);

  const isAttendanceClosed = data?.attendance_status === 'closed';

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

  useEffect(() => {
    void loadAttendance();
  }, [loadAttendance]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 2800);
    return () => clearTimeout(timer);
  }, [message]);

  if (loading) {
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
          <div role="alert" className="alert alert-error mb-4">
            <span>{error}</span>
          </div>
          <button className="btn btn-outline" onClick={() => void loadAttendance()}>
            Retry
          </button>
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
              <button
                className="btn btn-outline"
                onClick={() => void exportAttendanceCsv()}
                disabled={exportingCsv || data.enrollments.length === 0}
              >
                <Download size={16} />
                {exportingCsv ? 'Exporting...' : 'Export CSV'}
              </button>
              <button
                className="btn btn-success btn-soft"
                onClick={() => setAllAttendanceDraft(true)}
                disabled={!data.can_edit_attendance || saving || data.enrollments.length === 0}
              >
                <CheckCheck size={16} />
                Mark All Present
              </button>
              <button
                className="btn btn-warning btn-soft"
                onClick={() => setAllAttendanceDraft(false)}
                disabled={!data.can_edit_attendance || saving || data.enrollments.length === 0}
              >
                <RotateCcw size={16} />
                Clear All
              </button>
              <button
                className="btn btn-ghost"
                onClick={undoAttendanceChanges}
                disabled={saving || !hasUnsavedChanges}
              >
                <Undo2 size={16} />
                Undo Changes
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void submitAttendance()}
                disabled={!data.can_edit_attendance || saving || !hasUnsavedChanges}
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save Attendance'}
              </button>
            </>
          )}
        />

        {isAttendanceClosed && (
          <div className="alert alert-warning mb-2">
            <span>Attendance editing is closed.</span>
          </div>
        )}
        <div className="mb-4 flex items-center gap-2 text-sm opacity-80">
          <Clock3 size={14} className="opacity-70" />
          <span>
            Editable until
            {' '}
            <span className="font-semibold">{formatDateTime(data.attendance_edit_ends_at)}</span>
          </span>
          {data.can_edit_attendance && hasUnsavedChanges && (
            <span className="badge badge-ghost">Unsaved changes</span>
          )}
        </div>

        {error && (
          <div role="alert" className="alert alert-error mt-4">
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div role="alert" className="alert alert-success mt-4">
            <span>{message}</span>
          </div>
        )}

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
              <div className="alert">
                <span className="text-sm">No enrolled volunteers to track yet.</span>
              </div>
            )}

            {data.enrollments.length > 0 && filteredAndSortedEnrollments.length === 0 && (
              <div className="alert">
                <span className="text-sm">No volunteers match this search.</span>
              </div>
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
                          disabled={!data.can_edit_attendance || saving}
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
