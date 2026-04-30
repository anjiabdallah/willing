export const getLocalOffsetMinutes = (): number => -new Date().getTimezoneOffset();

export type UtcTimeResult = {
  time: string;
  dateDelta: -1 | 0 | 1;
};

export const toUtcTime = (localTime: string): string => {
  const [hh, mm] = localTime.split(':').map(Number);
  const totalMinutes = (hh * 60 + mm) - getLocalOffsetMinutes();
  const utcHh = ((totalMinutes / 60 | 0) + 24) % 24;
  const utcMm = ((totalMinutes % 60) + 60) % 60;
  return `${String(utcHh).padStart(2, '0')}:${String(utcMm).padStart(2, '0')}`;
};

export const toUtcDateTime = (localTime: string): UtcTimeResult => {
  const [hh, mm] = localTime.split(':').map(Number);
  const totalMinutes = (hh * 60 + mm) - getLocalOffsetMinutes();
  const utcHh = ((totalMinutes / 60 | 0) + 24) % 24;
  const utcMm = ((totalMinutes % 60) + 60) % 60;
  const time = `${String(utcHh).padStart(2, '0')}:${String(utcMm).padStart(2, '0')}`;

  const rawHours = (hh * 60 + mm - getLocalOffsetMinutes()) / 60;
  const dateDelta = rawHours < 0 ? -1 : rawHours >= 24 ? 1 : 0;

  return { time, dateDelta: dateDelta as -1 | 0 | 1 };
};

export const shiftDate = (dateStr: string, delta: -1 | 0 | 1): string => {
  if (delta === 0) return dateStr;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + delta);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

export const toLocalTime = (utcTime: string): string => {
  const [hh, mm] = utcTime.split(':').map(Number);
  const totalMinutes = (hh * 60 + mm) + getLocalOffsetMinutes();
  const localHh = ((totalMinutes / 60 | 0) + 24) % 24;
  const localMm = ((totalMinutes % 60) + 60) % 60;
  return `${String(localHh).padStart(2, '0')}:${String(localMm).padStart(2, '0')}`;
};
