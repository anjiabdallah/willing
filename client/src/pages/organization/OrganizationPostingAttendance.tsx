import { CheckCheck, Download, RotateCcw, Save, Undo2, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';

import Alert from '../../components/Alert';
import Button from '../../components/Button';
import CalendarInfo from '../../components/CalendarInfo';
import Card from '../../components/Card';
import PageContainer from '../../components/layout/PageContainer';
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
  const attendanceFiltersStorageKey = useMemo(
    () => `organization-posting-attendance-filters:${id ?? 'unknown'}`,
    [id],
  );

  const [saving, setSaving] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [currentDateIndex, setCurrentDateIndex] = useState(0);
  const [draftDateAttendance, setDraftDateAttendance] = useState<Record<number, Record<string, boolean>>>({});
  const [searchTerm, setSearchTerm] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const raw = window.sessionStorage.getItem(attendanceFiltersStorageKey);
      const parsed = raw ? JSON.parse(raw) as { searchTerm?: string } : null;
      return parsed?.searchTerm ?? '';
    } catch {
      return '';
    }
  });
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'attended_first' | 'absent_first'>(() => {
    if (typeof window === 'undefined') return 'name_asc';
    try {
      const raw = window.sessionStorage.getItem(attendanceFiltersStorageKey);
      const parsed = raw ? JSON.parse(raw) as { sortBy?: 'name_asc' | 'name_desc' | 'attended_first' | 'absent_first' } : null;
      return parsed?.sortBy ?? 'name_asc';
    } catch {
      return 'name_asc';
    }
  });
  const notifications = useNotifications();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(attendanceFiltersStorageKey, JSON.stringify({
      searchTerm,
      sortBy,
    }));
  }, [attendanceFiltersStorageKey, searchTerm, sortBy]);

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
    const postingDates = response.posting_dates ?? [];

    const dateAttendanceMap: Record<number, Record<string, boolean>> = {};
    response.enrollments.forEach((enrollment) => {
      dateAttendanceMap[enrollment.enrollment_id] = {};
      enrollment.dates?.forEach((dateItem) => {
        dateAttendanceMap[enrollment.enrollment_id][dateItem.date] = dateItem.attended;
      });
    });

    setAvailableDates(postingDates);
    setCurrentDateIndex(0);
    setDraftDateAttendance(dateAttendanceMap);

    return response;
  }, {
    immediate: true,
    notifyOnError: true,
  });

  const { trigger: submitAttendanceChanges } = useAsync(
    async (postingId: string, attendanceUpdates: Array<{ enrollmentDateId: number; attended: boolean }>) => Promise.all(
      attendanceUpdates.map(update => requestServer(
        `/organization/posting/${postingId}/enrollment-dates/${update.enrollmentDateId}/attendance`,
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

  const currentDate = availableDates[currentDateIndex] ?? null;
  const isBatchAttendance = Boolean(data && (!data.posting.allows_partial_attendance || availableDates.length <= 1));

  const getEnrollmentAttendance = useCallback((enrollment: PostingEnrollment) => {
    const dates = enrollment.dates ?? [];
    if (dates.length === 0) return false;

    return dates.every((dateItem) => {
      const draftValue = draftDateAttendance[enrollment.enrollment_id]?.[dateItem.date];
      return typeof draftValue === 'boolean' ? draftValue : dateItem.attended;
    });
  }, [draftDateAttendance]);

  const toggleAttendance = useCallback(async (enrollment: PostingEnrollment) => {
    if (saving) return;
    const dates = enrollment.dates ?? [];
    if (dates.length === 0) return;

    if (isBatchAttendance) {
      const currentlyAllPresent = getEnrollmentAttendance(enrollment);

      setDraftDateAttendance(current => ({
        ...current,
        [enrollment.enrollment_id]: Object.fromEntries(
          dates.map(dateItem => [dateItem.date, !currentlyAllPresent]),
        ),
      }));
      return;
    }

    if (!currentDate) return;

    setDraftDateAttendance((current) => {
      const nextForEnrollment = {
        ...(current[enrollment.enrollment_id] ?? {}),
      };

      const currentValue = nextForEnrollment[currentDate] ?? enrollment.dates?.find(d => d.date === currentDate)?.attended ?? false;
      nextForEnrollment[currentDate] = !currentValue;

      return {
        ...current,
        [enrollment.enrollment_id]: nextForEnrollment,
      };
    });
  }, [currentDate, getEnrollmentAttendance, isBatchAttendance, saving]);

  const markVolunteerAllDates = useCallback((enrollment: PostingEnrollment) => {
    const dates = enrollment.dates ?? [];
    if (dates.length === 0) return;

    setDraftDateAttendance(current => ({
      ...current,
      [enrollment.enrollment_id]: Object.fromEntries(
        dates.map(dateItem => [dateItem.date, true]),
      ),
    }));
  }, []);

  const setAllAttendanceDraft = useCallback((attended: boolean) => {
    if (!data) return;
    if (saving) return;
    if (!isBatchAttendance && !currentDate) return;

    setDraftDateAttendance(
      Object.fromEntries(data.enrollments.map((enrollment) => {
        const dates = enrollment.dates ?? [];
        const targetDates = isBatchAttendance
          ? dates
          : dates.filter(dateItem => dateItem.date === currentDate);

        if (targetDates.length === 0) return [enrollment.enrollment_id, {}] as const;

        return [
          enrollment.enrollment_id,
          Object.fromEntries(targetDates.map(dateItem => [dateItem.date, attended])),
        ] as const;
      })),
    );
  }, [currentDate, data, isBatchAttendance, saving]);

  const submitAttendance = useCallback(async () => {
    if (!id || !data || saving || (!currentDate && !isBatchAttendance)) return;

    const changes: Array<{ enrollmentDateId: number; attended: boolean }> = [];

    data.enrollments.forEach((enrollment) => {
      enrollment.dates?.forEach((dateItem) => {
        const originalValue = dateItem.attended;
        const draftValue = draftDateAttendance[enrollment.enrollment_id]?.[dateItem.date];
        if (typeof draftValue === 'boolean' && draftValue !== originalValue) {
          changes.push({ enrollmentDateId: dateItem.id, attended: draftValue });
        }
      });
    });

    if (changes.length === 0) {
      notifications.push({
        type: 'info',
        message: 'No attendance changes to submit.',
      });
      return;
    }

    try {
      setSaving(true);

      await submitAttendanceChanges(id, changes);

      await loadAttendance();
      const changedVolunteerCount = new Set(changes.map((c) => {
        const enrollment = data.enrollments.find(e => e.dates?.some(d => d.id === c.enrollmentDateId));
        return enrollment?.enrollment_id;
      }).filter((id): id is number => id !== undefined)).size;

      notifications.push({
        type: 'success',
        message: `Attendance saved for ${changes.length} ${changes.length === 1 ? 'day' : 'days'}, for ${changedVolunteerCount} volunteer${changedVolunteerCount === 1 ? '' : 's'}.`,
      });
    } catch {
      await loadAttendance();
    } finally {
      setSaving(false);
    }
  }, [currentDate, data, draftDateAttendance, id, loadAttendance, notifications, saving, submitAttendanceChanges]);

  const undoAttendanceChanges = useCallback(() => {
    if (!data || saving) return;
    setDraftDateAttendance(
      Object.fromEntries(
        data.enrollments.map(enrollment => [
          enrollment.enrollment_id,
          Object.fromEntries(
            enrollment.dates?.map(dateItem => [dateItem.date, dateItem.attended]) ?? [],
          ),
        ]),
      ),
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
      return enrollment.dates?.some((dateItem) => {
        const originalValue = dateItem.attended;
        const nextAttendedValue = draftDateAttendance[enrollment.enrollment_id]?.[dateItem.date];
        return typeof nextAttendedValue === 'boolean' && nextAttendedValue !== originalValue;
      }) ?? false;
    });
  }, [data, draftDateAttendance]);

  const displayedEnrollments = useMemo(() => {
    if (!data) return [];

    return data.enrollments.map((enrollment) => {
      let attended = false;

      if (isBatchAttendance) {
        attended = getEnrollmentAttendance(enrollment);
      } else if (currentDate) {
        const original = enrollment.dates?.find(d => d.date === currentDate)?.attended;
        const draft = draftDateAttendance[enrollment.enrollment_id]?.[currentDate];
        if (typeof draft === 'boolean') {
          attended = draft;
        } else if (typeof original === 'boolean') {
          attended = original;
        }
      }

      return {
        ...enrollment,
        attended,
      };
    }).filter((enrollment) => {
      if (isBatchAttendance) return true;
      if (!currentDate) return true;
      return enrollment.dates?.some(dateItem => dateItem.date === currentDate) ?? false;
    });
  }, [currentDate, data, draftDateAttendance, getEnrollmentAttendance, isBatchAttendance]);

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
    <PageContainer>
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

      <Card
        title="Registered Volunteers"
        right={
          <span className="badge badge-primary">{data.enrollments.length}</span>
        }
      >
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

        {!isBatchAttendance && availableDates.length > 0 && (
          <div className="mb-4 -mt-2">
            <div className="flex items-center gap-2 flex-nowrap">
              <span className="text-sm font-semibold relative top-1">Select date:</span>
              <CalendarInfo
                selectionMode="single"
                singleValue={currentDate ?? ''}
                onSingleChange={(value) => {
                  const index = availableDates.indexOf(value);
                  if (index >= 0) setCurrentDateIndex(index);
                }}
                className="w-56"
                allowedDates={availableDates}
                showTopLabels={false}
                startLabel=""
                endLabel=""
              />
              <Button
                className="relative top-2 h-11 px-5 text-base"
                style="outline"
                onClick={() => setCurrentDateIndex(prev => Math.max(prev - 1, 0))}
                disabled={currentDateIndex <= 0}
              >
                Previous
              </Button>
              <Button
                className="relative top-2 h-11 px-5 text-base"
                style="outline"
                onClick={() => setCurrentDateIndex(prev => Math.min(prev + 1, availableDates.length - 1))}
                disabled={currentDateIndex >= availableDates.length - 1}
              >
                Next
              </Button>
            </div>
            <span className="text-xs opacity-70">Showing attendance for one day at a time</span>
          </div>
        )}
        {isBatchAttendance && (
          <div className="mb-4 -mt-2">
            <span className="text-xs opacity-70">Attendance is recorded for the whole posting at once.</span>
          </div>
        )}

        {data.enrollments.length === 0 && (
          <Alert>
            No enrolled volunteers to track yet.
          </Alert>
        )}

        {data.enrollments.length > 0 && filteredAndSortedEnrollments.length === 0 && (
          <Alert>
            No volunteers signed up for this day yet
          </Alert>
        )}

        {data.enrollments.length > 0 && filteredAndSortedEnrollments.length > 0 && (
          <div className="space-y-2">
            {filteredAndSortedEnrollments.map(volunteer => (
              <VolunteerInfoCollapse
                key={volunteer.enrollment_id}
                volunteer={volunteer}
                profileLink={`/organization/volunteer/${volunteer.volunteer_id}`}
                actions={(
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2">
                      <span className={`badge ${volunteer.attended ? 'badge-success' : 'badge-ghost'}`}>
                        {volunteer.attended ? 'Present' : 'Absent'}
                      </span>
                      <input
                        type="checkbox"
                        className="toggle toggle-success"
                        checked={volunteer.attended}
                        disabled={saving || (!isBatchAttendance && (!currentDate || !volunteer.dates?.some(d => d.date === currentDate)))}
                        onChange={() => void toggleAttendance(volunteer)}
                      />
                    </label>
                    {!isBatchAttendance && (
                      <Button
                        size="sm"
                        color="secondary"
                        style="outline"
                        onClick={() => markVolunteerAllDates(volunteer)}
                        disabled={saving || !volunteer.dates || volunteer.dates.length === 0}
                      >
                        All Days Present
                      </Button>
                    )}
                  </div>
                )}
              />
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}

export default OrganizationPostingAttendance;
