import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { renderPageWithAuth } from './test-utils';
import NotificationsContext from '../notifications/NotificationsContext';
import VolunteerVerifyEmail from '../pages/VolunteerVerifyEmail';
import requestServer from '../utils/requestServer';

describe('requestServer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('throws a message for zod validation errors returned as an array', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify([
        {
          origin: 'string',
          code: 'invalid_format',
          format: 'email',
          pattern: '/^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_+\'-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$/',
          path: ['email'],
          message: 'Invalid email address',
        },
      ]), { status: 400, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch);

    await expect(requestServer('/volunteer/resend-verification', {
      method: 'POST',
      body: { email: 'bad' },
    })).rejects.toThrow('Invalid email address');
  });
});

describe('VolunteerVerifyEmail page', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('shows an invalid email warning when resend is attempted with an invalid address', async () => {
    const verifyVolunteerEmail = vi.fn(async () => {
      throw new Error('Invalid or expired verification token');
    });
    const resendVolunteerVerification = vi.fn(async () => {});

    const push = vi.fn();

    renderPageWithAuth(
      <NotificationsContext.Provider value={{ push }}>
        <VolunteerVerifyEmail />
      </NotificationsContext.Provider>,
      {
        initialEntries: ['/volunteer/verify-email?key=wrong'],
        authOverrides: { verifyVolunteerEmail, resendVolunteerVerification },
      },
    );

    const user = userEvent.setup();

    await screen.findByText(/Email verification failed/i);

    const emailInput = screen.getByLabelText(/Need a new link\? Enter your email/i);
    await user.clear(emailInput);
    await user.type(emailInput, 'invalid-email');
    await user.click(screen.getByRole('button', { name: /Resend link/i }));

    expect(push).toHaveBeenCalledWith({
      type: 'warning',
      message: 'Invalid email',
    });
    expect(resendVolunteerVerification).not.toHaveBeenCalled();
  });
});
