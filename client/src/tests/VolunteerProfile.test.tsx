import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import '@testing-library/jest-dom/vitest';
import VolunteerProfile from '../pages/volunteer/VolunteerProfile';
import { renderPageWithAuth } from './test-utils';

import type { VolunteerProfileResponse } from '../../../server/src/api/types';

vi.mock('../utils/requestServer', () => ({
  __esModule: true,
  default: vi.fn(),
  SERVER_BASE_URL: '',
}));

let requestServerMock: ReturnType<typeof vi.fn>;

const buildProfileResponse = (): VolunteerProfileResponse => ({
  volunteer: {
    id: 1,
    first_name: 'Nour',
    last_name: 'Haddad',
    email: 'nour@example.com',
    date_of_birth: '2000-01-01',
    gender: 'female',
    cv_path: null,
    description: 'Volunteer profile',
  },
  skills: ['logistics'],
  experience_stats: {
    total_completed_experiences: 1,
    organizations_supported: 1,
    crisis_related_experiences: 0,
    total_hours_completed: 2,
    total_skills_used: 1,
    most_volunteered_crisis: null,
  },
  completed_experiences: [
    {
      enrollment_id: 11,
      posting_id: 7,
      posting_title: 'Overnight Shift',
      organization_id: 4,
      organization_name: 'Helpers Org',
      organization_logo_path: null,
      location_name: 'Beirut',
      start_date: new Date('2026-05-28T00:00:00.000Z'),
      start_time: '23:00:00',
      end_date: new Date('2026-05-29T00:00:00.000Z'),
      end_time: '01:00:00',
      crisis_name: null,
      is_closed: false,
      automatic_acceptance: true,
      enrollment_count: 1,
    },
  ],
});

beforeEach(async () => {
  const mockedModule = await vi.importMock('../utils/requestServer');
  requestServerMock = mockedModule.default as unknown as ReturnType<typeof vi.fn>;
  requestServerMock.mockResolvedValue(buildProfileResponse());
});

afterEach(() => {
  cleanup();
  requestServerMock?.mockReset();
  vi.restoreAllMocks();
});

test('uses backend total_hours_completed for the hours stat', async () => {
  renderPageWithAuth(<VolunteerProfile />, {
    initialEntries: ['/volunteer/profile'],
    authOverrides: { user: { role: 'volunteer' } },
  });

  await waitFor(() => {
    expect(requestServerMock).toHaveBeenCalledWith('/volunteer/profile', { includeJwt: true });
  });

  expect(screen.getByText('Hours Completed')).toBeInTheDocument();
  expect(screen.getByText('2.0')).toBeInTheDocument();
  expect(screen.queryByText('10.0')).toBeNull();
});
