import { render, type RenderResult } from '@testing-library/react';
import { type ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import AuthContext from '../auth/AuthContext';

import type { VolunteerCreateResponse, VolunteerVerifyEmailResponse } from '../../../server/src/api/routes/volunteer/index.types';
import type { VolunteerAccountWithoutPassword } from '../../../server/src/db/tables/index.ts';
import type { AuthContextType } from '../auth/AuthContext';

export function buildAuthContext(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    user: undefined,
    loaded: true,
    refreshUser: vi.fn(),
    loginAdmin: vi.fn(async () => {}),
    loginUser: vi.fn(async () => {}),
    createVolunteer: vi.fn(async () => ({ requires_email_verification: true } as VolunteerCreateResponse)),
    verifyVolunteerEmail: vi.fn(async () => ({ volunteer: {} as VolunteerAccountWithoutPassword, token: '' } as VolunteerVerifyEmailResponse)),
    resendVolunteerVerification: vi.fn(async () => {}),
    changePassword: vi.fn(async () => {}),
    deleteAccount: vi.fn(async () => {}),
    logout: vi.fn(),
    restrictRoute: vi.fn(() => ({} as VolunteerAccountWithoutPassword)),
    ...overrides,
  };
}

export function renderPageWithAuth(
  ui: ReactElement,
  {
    initialEntries = ['/'],
    authOverrides = {},
  }: { initialEntries?: string[]; authOverrides?: Partial<AuthContextType> } = {},
): { auth: AuthContextType } & RenderResult {
  const auth = buildAuthContext(authOverrides);
  return {
    auth,
    ...render(
      <MemoryRouter initialEntries={initialEntries}>
        <AuthContext.Provider value={auth}>
          {ui}
        </AuthContext.Provider>
      </MemoryRouter>,
    ),
  };
}
