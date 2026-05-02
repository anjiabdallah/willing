type DateLike = Date | string | null | undefined;

const formatDateToIso = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
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
