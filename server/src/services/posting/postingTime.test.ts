import { describe, expect, test } from 'vitest';

import {
  getPostingDateTimeFromDateAndTime,
  getPostingDailyHours,
  getPostingDates,
  getPostingEndDateTime,
  normalizeStoredDate,
  normalizeStoredTime,
  isPostingStartBeforeEnd,
} from './postingTime.ts';

describe('postingTime utilities', () => {
  test('normalizeStoredDate returns an ISO date string for Date objects', () => {
    expect(normalizeStoredDate(new Date(Date.UTC(2026, 3, 28)))).toBe('2026-04-28');
  });

  test('normalizeStoredDate extracts the date portion from ISO date strings', () => {
    expect(normalizeStoredDate('2026-04-28T12:34:56.789Z')).toBe('2026-04-28');
  });

  test('normalizeStoredDate returns undefined for invalid values', () => {
    expect(normalizeStoredDate('')).toBeUndefined();
    expect(normalizeStoredDate(null)).toBeUndefined();
  });

  test('normalizeStoredTime normalizes partial time strings', () => {
    expect(normalizeStoredTime('09:00')).toBe('09:00:00');
    expect(normalizeStoredTime('09:00:00')).toBe('09:00:00');
    expect(normalizeStoredTime('09:00:00.123')).toBe('09:00:00');
  });

  test('normalizeStoredTime returns undefined for invalid values', () => {
    expect(normalizeStoredTime('')).toBeUndefined();
    expect(normalizeStoredTime(null)).toBeUndefined();
  });

  test('getPostingDateTimeFromDateAndTime builds a UTC Date from date and time', () => {
    const result = getPostingDateTimeFromDateAndTime('2026-04-28', '09:00:00');
    expect(result?.toISOString()).toBe('2026-04-28T09:00:00.000Z');
  });

  test('getPostingEndDateTime returns a Date for a valid end date and time', () => {
    const result = getPostingEndDateTime('2026-04-28', '17:00:00');
    expect(result?.toISOString()).toBe('2026-04-28T17:00:00.000Z');
  });

  test('isPostingStartBeforeEnd returns false for same-day end-before-start', () => {
    expect(isPostingStartBeforeEnd('2026-04-28', '17:00:00', '2026-04-28', '09:00:00')).toBe(false);
  });

  test('isPostingStartBeforeEnd returns true for valid cross-date postings', () => {
    expect(isPostingStartBeforeEnd('2026-04-28', '23:00:00', '2026-04-29', '02:00:00')).toBe(true);
  });

  test('getPostingDailyHours calculates same-day durations correctly', () => {
    expect(getPostingDailyHours('09:00:00', '13:00:00')).toBe(4);
  });

  test('getPostingDailyHours calculates overnight durations correctly', () => {
    expect(getPostingDailyHours('23:00:00', '02:00:00')).toBe(3);
  });

  test('getPostingDates returns all dates between start and end inclusive', () => {
    expect(getPostingDates('2026-04-28', '2026-05-01')).toEqual([
      '2026-04-28',
      '2026-04-29',
      '2026-04-30',
      '2026-05-01',
    ]);
  });
});
