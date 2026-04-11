import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, beforeEach, afterEach, vi } from 'vitest';

import '@testing-library/jest-dom/vitest';

import { renderPageWithAuth } from './test-utils';
import ForgotPasswordPage from '../pages/ForgotPassword';

vi.mock('../utils/requestServer', () => ({
  __esModule: true,
  default: vi.fn(),
}));

let requestServerMock: ReturnType<typeof vi.fn>;

// Helpers

function renderForgotPasswordPage(path = '/forgot-password') {
  renderPageWithAuth(<ForgotPasswordPage />, {
    initialEntries: [path],
  });
}

beforeEach(async () => {
  const mockedModule = await vi.importMock('../utils/requestServer');
  requestServerMock = mockedModule.default as unknown as ReturnType<typeof vi.fn>;
  requestServerMock.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  requestServerMock?.mockReset();
  vi.restoreAllMocks();
});

// Request mode (no key)

test('(request) renders email field and "Send Link" button when no key in URL', () => {
  renderForgotPasswordPage();
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /send link/i })).toBeInTheDocument();
});

test('(request) does NOT render password fields when no key in URL', () => {
  renderForgotPasswordPage();
  expect(screen.queryByLabelText(/new password/i)).toBeNull();
  expect(screen.queryByLabelText(/confirm password/i)).toBeNull();
});

test('(request) "Back to login" links to /login', () => {
  renderForgotPasswordPage();
  const link = screen.getByRole('link', { name: /back to login/i });
  expect(link).toHaveAttribute('href', '/login');
});

test('(request) calls requestServer with email on valid submit', async () => {
  const user = userEvent.setup();
  renderForgotPasswordPage();

  await user.type(screen.getByLabelText(/email/i), 'user@example.com');
  await user.click(screen.getByRole('button', { name: /send link/i }));

  await waitFor(() => {
    expect(requestServerMock).toHaveBeenCalledWith('/user/forgot-password', expect.objectContaining({
      method: 'POST',
      body: { email: 'user@example.com' },
    }));
  });
});

test('(request) does not call requestServer when email is missing', async () => {
  const user = userEvent.setup();
  renderForgotPasswordPage();

  await user.click(screen.getByRole('button', { name: /send link/i }));

  await waitFor(() => {
    expect(requestServerMock).not.toHaveBeenCalled();
  });
});

test('(request) shows root error when requestServer throws', async () => {
  const user = userEvent.setup();
  requestServerMock.mockRejectedValue(new Error('Server error'));
  renderForgotPasswordPage();

  await user.type(screen.getByLabelText(/email/i), 'user@example.com');
  await user.click(screen.getByRole('button', { name: /send link/i }));

  await screen.findByText(/server error/i);
});

test('(request) "Send Link" button is disabled while submitting', async () => {
  const user = userEvent.setup();
  let resolve: () => void;
  requestServerMock.mockReturnValue(new Promise<void>((res) => {
    resolve = res;
  }));
  renderForgotPasswordPage();

  await user.type(screen.getByLabelText(/email/i), 'user@example.com');
  await user.click(screen.getByRole('button', { name: /send link/i }));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /send link/i })).toBeDisabled();
  });

  resolve!();
});

// Request success state

test('(request) shows "Check your email" confirmation after successful submit', async () => {
  const user = userEvent.setup();
  renderForgotPasswordPage();

  await user.type(screen.getByLabelText(/email/i), 'user@example.com');
  await user.click(screen.getByRole('button', { name: /send link/i }));

  await screen.findByText(/check your email/i);
});

test('(request) confirmation "Back to login" links to /login', async () => {
  const user = userEvent.setup();
  renderForgotPasswordPage();

  await user.type(screen.getByLabelText(/email/i), 'user@example.com');
  await user.click(screen.getByRole('button', { name: /send link/i }));

  const link = await screen.findByRole('link', { name: /back to login/i });
  expect(link).toHaveAttribute('href', '/login');
});

test('(request) does NOT show "Check your email" on requestServer failure', async () => {
  const user = userEvent.setup();
  requestServerMock.mockRejectedValue(new Error('Server error'));
  renderForgotPasswordPage();

  await user.type(screen.getByLabelText(/email/i), 'user@example.com');
  await user.click(screen.getByRole('button', { name: /send link/i }));

  await screen.findByText(/server error/i);
  expect(screen.queryByText(/check your email/i)).toBeNull();
});

// Reset mode (key present)

test('(reset) renders password fields and "Reset Password" button when key is in URL', () => {
  renderForgotPasswordPage('/forgot-password?key=abc123');
  expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
});

test('(reset) does NOT render email field when key is in URL', () => {
  renderForgotPasswordPage('/forgot-password?key=abc123');
  expect(screen.queryByLabelText(/^email/i)).toBeNull();
});

test('(reset) "Back to login" links to /login', () => {
  renderForgotPasswordPage('/forgot-password?key=abc123');
  const link = screen.getByRole('link', { name: /back to login/i });
  expect(link).toHaveAttribute('href', '/login');
});

test('(reset) calls requestServer with key and new password on valid submit', async () => {
  const user = userEvent.setup();
  renderForgotPasswordPage('/forgot-password?key=abc123');

  await user.type(screen.getByLabelText(/new password/i), 'NewPass123!');
  await user.type(screen.getByLabelText(/confirm password/i), 'NewPass123!');
  await user.click(screen.getByRole('button', { name: /reset password/i }));

  await waitFor(() => {
    expect(requestServerMock).toHaveBeenCalledWith('/user/forgot-password/reset', expect.objectContaining({
      method: 'POST',
      body: { key: 'abc123', password: 'NewPass123!' },
    }));
  });
});

test('(reset) does not call requestServer when passwords do not match', async () => {
  const user = userEvent.setup();
  renderForgotPasswordPage('/forgot-password?key=abc123');

  await user.type(screen.getByLabelText(/new password/i), 'NewPass123!');
  await user.type(screen.getByLabelText(/confirm password/i), 'Different999!');
  await user.click(screen.getByRole('button', { name: /reset password/i }));

  await waitFor(() => {
    expect(requestServerMock).not.toHaveBeenCalled();
  });
});

test('(reset) shows root error when requestServer throws', async () => {
  const user = userEvent.setup();
  requestServerMock.mockRejectedValue(new Error('Invalid or expired key'));
  renderForgotPasswordPage('/forgot-password?key=abc123');

  await user.type(screen.getByLabelText(/new password/i), 'NewPass123!');
  await user.type(screen.getByLabelText(/confirm password/i), 'NewPass123!');
  await user.click(screen.getByRole('button', { name: /reset password/i }));

  await screen.findByText(/invalid or expired key/i);
});

test('(reset) "Reset Password" button is disabled while submitting', async () => {
  const user = userEvent.setup();
  let resolve: () => void;
  requestServerMock.mockReturnValue(new Promise<void>((res) => {
    resolve = res;
  }));
  renderForgotPasswordPage('/forgot-password?key=abc123');

  await user.type(screen.getByLabelText(/new password/i), 'NewPass123!');
  await user.type(screen.getByLabelText(/confirm password/i), 'NewPass123!');
  await user.click(screen.getByRole('button', { name: /reset password/i }));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /reset password/i })).toBeDisabled();
  });

  resolve!();
});

// Reset success state

test('(reset) shows "Password reset successful" confirmation after successful submit', async () => {
  const user = userEvent.setup();
  renderForgotPasswordPage('/forgot-password?key=abc123');

  await user.type(screen.getByLabelText(/new password/i), 'NewPass123!');
  await user.type(screen.getByLabelText(/confirm password/i), 'NewPass123!');
  await user.click(screen.getByRole('button', { name: /reset password/i }));

  await screen.findByText(/password reset successful/i);
});

test('(reset) confirmation "Go to login" links to /login', async () => {
  const user = userEvent.setup();
  renderForgotPasswordPage('/forgot-password?key=abc123');

  await user.type(screen.getByLabelText(/new password/i), 'NewPass123!');
  await user.type(screen.getByLabelText(/confirm password/i), 'NewPass123!');
  await user.click(screen.getByRole('button', { name: /reset password/i }));

  const link = await screen.findByRole('link', { name: /go to login/i });
  expect(link).toHaveAttribute('href', '/login');
});

test('(reset) does NOT show success state on requestServer failure', async () => {
  const user = userEvent.setup();
  requestServerMock.mockRejectedValue(new Error('Invalid or expired key'));
  renderForgotPasswordPage('/forgot-password?key=abc123');

  await user.type(screen.getByLabelText(/new password/i), 'NewPass123!');
  await user.type(screen.getByLabelText(/confirm password/i), 'NewPass123!');
  await user.click(screen.getByRole('button', { name: /reset password/i }));

  await screen.findByText(/invalid or expired key/i);
  expect(screen.queryByText(/password reset successful/i)).toBeNull();
});
