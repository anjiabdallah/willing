import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { test, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

import '@testing-library/jest-dom/vitest';
import { renderPageWithAuth } from './test-utils';
import UserLoginPage from '../pages/UserLogin';

vi.mock('../utils/requestServer', () => ({
  __esModule: true,
  default: vi.fn(),
}));

let requestServerMock: ReturnType<typeof vi.fn>;

beforeAll(async () => {
  const mockedModule = await vi.importMock('../utils/requestServer');
  requestServerMock = mockedModule.default as unknown as ReturnType<typeof vi.fn>;
});

// Helpers

beforeEach(() => {
  requestServerMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  requestServerMock.mockReset();
  vi.restoreAllMocks();
});

// Link targets

test('"Forgot password?" links to /forgot-password', () => {
  renderPageWithAuth(<UserLoginPage />, { initialEntries: ['/login'] });
  const link = screen.getByRole('link', { name: /forgot password/i });
  expect(link).toHaveAttribute('href', '/forgot-password');
});

test('"Sign up" links to /volunteer/create', () => {
  renderPageWithAuth(<UserLoginPage />, { initialEntries: ['/login'] });
  const link = screen.getByRole('link', { name: /sign up/i });
  expect(link).toHaveAttribute('href', '/volunteer/create');
});

// Form submission

test('calls loginUser with email and password on valid submit', async () => {
  const user = userEvent.setup();
  const { auth } = renderPageWithAuth(<UserLoginPage />, { initialEntries: ['/login'] });

  await user.type(screen.getByLabelText(/email/i), 'test@example.com');
  await user.type(screen.getByLabelText(/password/i), 'secret123');
  await user.click(screen.getByRole('button', { name: /login/i }));

  await waitFor(() => {
    expect(auth.loginUser).toHaveBeenCalledWith('test@example.com', 'secret123');
  });
});

test('does not call loginUser when email is missing', async () => {
  const user = userEvent.setup();
  const { auth } = renderPageWithAuth(<UserLoginPage />, { initialEntries: ['/login'] });

  await user.type(screen.getByLabelText(/password/i), 'secret123');
  await user.click(screen.getByRole('button', { name: /login/i }));

  await waitFor(() => {
    expect(auth.loginUser).not.toHaveBeenCalled();
  });
});

test('does not call loginUser when password is missing', async () => {
  const user = userEvent.setup();
  const { auth } = renderPageWithAuth(<UserLoginPage />, { initialEntries: ['/login'] });

  await user.type(screen.getByLabelText(/email/i), 'test@example.com');
  await user.click(screen.getByRole('button', { name: /login/i }));

  await waitFor(() => {
    expect(auth.loginUser).not.toHaveBeenCalled();
  });
});

// Error display

test('shows root error message when loginUser throws', async () => {
  const user = userEvent.setup();
  renderPageWithAuth(<UserLoginPage />, {
    initialEntries: ['/login'],
    authOverrides: {
      loginUser: vi.fn(async () => {
        throw new Error('Invalid credentials');
      }),
    },
  });

  await user.type(screen.getByLabelText(/email/i), 'test@example.com');
  await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
  await user.click(screen.getByRole('button', { name: /login/i }));

  await screen.findByText(/invalid credentials/i);
});

test('shows invalid credentials when email is wrong', async () => {
  const user = userEvent.setup();
  renderPageWithAuth(<UserLoginPage />, {
    initialEntries: ['/login'],
    authOverrides: {
      loginUser: vi.fn(async () => {
        throw new Error('Invalid email or password');
      }),
    },
  });

  await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
  await user.type(screen.getByLabelText(/password/i), 'secret123');
  await user.click(screen.getByRole('button', { name: /login/i }));

  await screen.findByText(/invalid email or password/i);
});

test('shows invalid credentials when password is wrong', async () => {
  const user = userEvent.setup();
  renderPageWithAuth(<UserLoginPage />, {
    initialEntries: ['/login'],
    authOverrides: {
      loginUser: vi.fn(async () => {
        throw new Error('Invalid email or password');
      }),
    },
  });

  await user.type(screen.getByLabelText(/email/i), 'test@example.com');
  await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
  await user.click(screen.getByRole('button', { name: /login/i }));

  await screen.findByText(/invalid email or password/i);
});

// Loading state

test('login button is disabled while submission is in progress', async () => {
  const user = userEvent.setup();
  let resolve: () => void;
  const pendingLogin = new Promise<void>((res) => {
    resolve = res;
  });

  renderPageWithAuth(<UserLoginPage />, {
    initialEntries: ['/login'],
    authOverrides: {
      loginUser: vi.fn(() => pendingLogin),
    },
  });

  await user.type(screen.getByLabelText(/email/i), 'test@example.com');
  await user.type(screen.getByLabelText(/password/i), 'secret123');
  await user.click(screen.getByRole('button', { name: /login/i }));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /login/i })).toBeDisabled();
  });

  resolve!();
});
