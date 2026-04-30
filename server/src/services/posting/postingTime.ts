import { sql } from 'kysely';

type DateLike = Date | string | null | undefined;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

export const formatDateToIso = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

const POSTING_LOCAL_TIMEZONE = 'Asia/Beirut';

const parseIsoDateParts = (value: string): DateParts | undefined => {
  const segments = value.split('-').map(Number);
  if (segments.length !== 3) return undefined;
  const [year, month, day] = segments as [number, number, number];
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
  return { year, month, day };
};

const parseTimeParts = (time: string) => {
  const parts = time.split(':').map(Number);
  return {
    hours: Number.isFinite(parts[0]) ? parts[0] : 0,
    minutes: Number.isFinite(parts[1]) ? parts[1] : 0,
    seconds: Number.isFinite(parts[2]) ? parts[2] : 0,
  };
};

export const normalizeStoredDate = (value: DateLike) => {
  if (value instanceof Date) return formatDateToIso(value);
  if (typeof value === 'string') {
    const datePart = value.split('T')[0]?.trim();
    return datePart || undefined;
  }
  return undefined;
};

export const normalizeStoredTime = (value: string | null | undefined) => {
  if (!value) return undefined;
  const timePart = value.trim().split('.')[0];
  if (!timePart) return undefined;

  const segments = timePart.split(':');

  if (segments.length === 2) {
    return `${segments[0]}:${segments[1]}:00`;
  }

  if (segments.length >= 3) {
    return `${segments[0]}:${segments[1]}:${segments[2]}`;
  }

  return undefined;
};

export const getPostingDateTimeFromDateAndTime = (
  date: DateLike,
  time: string,
) => {
  const normalizedDate = normalizeStoredDate(date);
  const dateParts = normalizedDate ? parseIsoDateParts(normalizedDate) : undefined;
  if (!dateParts) return undefined;

  const { hours, minutes, seconds } = parseTimeParts(time);
  return new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, hours, minutes, seconds));
};

export const getPostingDates = (startDate: DateLike, endDate: DateLike) => {
  const normalizedStartDate = normalizeStoredDate(startDate);
  const normalizedEndDate = normalizeStoredDate(endDate);
  const startParts = normalizedStartDate ? parseIsoDateParts(normalizedStartDate) : undefined;
  const endParts = normalizedEndDate ? parseIsoDateParts(normalizedEndDate) : undefined;

  if (!startParts || !endParts) {
    return [];
  }

  const result: string[] = [];
  const current = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
  const end = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day));

  while (current.getTime() <= end.getTime()) {
    result.push(formatDateToIso(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
};

export const getPostingEndDateTime = (
  endDate: DateLike,
  endTime: string | null | undefined,
) => {
  const endDateStr = normalizeStoredDate(endDate);

  if (!endDateStr) {
    return undefined;
  }

  const endTimeStr = normalizeStoredTime(endTime);
  const endDateTime = new Date(
    endTimeStr
      ? `${endDateStr}T${endTimeStr}Z`
      : `${endDateStr}T23:59:59Z`,
  );

  return Number.isNaN(endDateTime.getTime()) ? undefined : endDateTime;
};

export const isPostingStartBeforeEnd = (
  startDate: DateLike,
  startTime: string,
  endDate: DateLike,
  endTime: string,
) => {
  const startDateTime = getPostingDateTimeFromDateAndTime(startDate, startTime);
  const endDateTime = getPostingDateTimeFromDateAndTime(endDate, endTime);
  return Boolean(startDateTime && endDateTime && endDateTime > startDateTime);
};

export const getPostingDailyHours = (startTime: string, endTime: string) => {
  const startDateTime = getPostingDateTimeFromDateAndTime('1970-01-01', startTime);
  const endDateTime = getPostingDateTimeFromDateAndTime('1970-01-01', endTime);

  if (!startDateTime || !endDateTime) {
    return 0;
  }

  if (endDateTime <= startDateTime) {
    endDateTime.setUTCDate(endDateTime.getUTCDate() + 1);
  }

  return (endDateTime.getTime() - startDateTime.getTime()) / 3600000;
};

export const getPostingDailyHoursExpression = () => sql<number>`GREATEST(
  0,
  EXTRACT(EPOCH FROM (
    (
      enrollment_date.date + posting.end_time
      + CASE
          WHEN posting.end_time <= posting.start_time THEN INTERVAL '1 day'
          ELSE INTERVAL '0'
        END
    )
    - (enrollment_date.date + posting.start_time)
  )) / 3600.0
)`;

export const getPostingHoursPerAttendedDateExpression = () => sql<number>`GREATEST(
  0,
  CASE
    WHEN (
      posting.end_time > posting.start_time
      AND
      (
        ((DATE '1970-01-01' + posting.end_time) AT TIME ZONE 'UTC')
        AT TIME ZONE ${POSTING_LOCAL_TIMEZONE}
      )::time
      >
      (
        ((DATE '1970-01-01' + posting.start_time) AT TIME ZONE 'UTC')
        AT TIME ZONE ${POSTING_LOCAL_TIMEZONE}
      )::time
    ) THEN EXTRACT(EPOCH FROM (
      (enrollment_date.date + posting.end_time) - (enrollment_date.date + posting.start_time)
    )) / 3600.0
    ELSE CASE
      WHEN enrollment_date.id = (
        SELECT MIN(ed_anchor.id)
        FROM enrollment_date AS ed_anchor
        WHERE ed_anchor.enrollment_id = enrollment_date.enrollment_id
          AND ed_anchor.posting_id = enrollment_date.posting_id
          AND ed_anchor.attended = true
      ) THEN (
        EXTRACT(EPOCH FROM (
          (
            (
              DATE '1970-01-01'
              + posting.end_time
              + CASE
                  WHEN posting.end_time <= posting.start_time THEN INTERVAL '1 day'
                  ELSE INTERVAL '0'
                END
            )
            - (DATE '1970-01-01' + posting.start_time)
          )
        )) / 3600.0
      ) * (
        SELECT COUNT(*)
        FROM (
          SELECT DISTINCT ed_pair.date
          FROM enrollment_date AS ed_pair
          WHERE ed_pair.enrollment_id = enrollment_date.enrollment_id
            AND ed_pair.posting_id = enrollment_date.posting_id
            AND ed_pair.attended = true
        ) AS attended_dates
        WHERE EXISTS (
          SELECT 1
          FROM enrollment_date AS ed_next
          WHERE ed_next.enrollment_id = enrollment_date.enrollment_id
            AND ed_next.posting_id = enrollment_date.posting_id
            AND ed_next.attended = true
            AND ed_next.date = attended_dates.date + INTERVAL '1 day'
        )
      )
      ELSE 0
    END
  END
)`;

export const hasPostingEnded = (
  posting: {
    end_date: DateLike;
    end_time?: string | null;
  },
  now: Date = new Date(),
) => {
  const endDateTime = getPostingEndDateTime(posting.end_date, posting.end_time);
  return endDateTime ? now > endDateTime : false;
};
