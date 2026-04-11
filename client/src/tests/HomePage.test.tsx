import { cleanup, screen, waitFor } from '@testing-library/react';
import { test, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

import '@testing-library/jest-dom/vitest';
import { renderPageWithAuth } from './test-utils';
import HomePage from '../pages/HomePage';

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

const mockStats = {
  totalVolunteers: 120,
  totalOpportunities: 45,
  totalOrganizations: 18,
  newVolunteersThisWeek: 7,
  newOpportunitiesThisWeek: 3,
  newOrganizationsThisWeek: 1,
};

function renderHomePage(role?: 'volunteer' | 'organization' | 'admin', initialPath = '/') {
  return renderPageWithAuth(<HomePage />, {
    initialEntries: [initialPath],
    authOverrides: role ? { user: { role } } : {},
  });
}

beforeEach(() => {
  requestServerMock.mockResolvedValue(mockStats);
});

afterEach(() => {
  cleanup();
  requestServerMock.mockReset();
  vi.restoreAllMocks();
});

// Guest State

test('(guest) shows two Log In links, both pointing to /login', () => {
  const { getAllByRole } = renderHomePage();
  const loginLinks = getAllByRole('link', { name: /log in/i });
  expect(loginLinks.length).toBeGreaterThanOrEqual(2);
  loginLinks.forEach(link => expect(link).toHaveAttribute('href', '/login'));
});

test('(guest) volunteer-side Log In button has correct testid and href', () => {
  const { getByTestId } = renderHomePage();
  const loginBtn = getByTestId('volunteer-login-button');
  expect(loginBtn).toBeInTheDocument();
  expect(loginBtn).toHaveAttribute('href', '/login');
});

test('(guest) "Create Volunteer Account" links to /volunteer/create', () => {
  const { getByText } = renderHomePage();
  const btn = getByText('Create Volunteer Account').closest('a');
  expect(btn).toHaveAttribute('href', '/volunteer/create');
});

test('(guest) "Request Organization Account" links to /organization/request', () => {
  const { getByText } = renderHomePage();
  const btn = getByText('Request Organization Account').closest('a');
  expect(btn).toHaveAttribute('href', '/organization/request');
});

test('(guest) does NOT show any "Go to Dashboard" button', () => {
  const { queryByText } = renderHomePage();
  expect(queryByText('Go to Dashboard')).toBeNull();
});

test('(guest) does NOT show admin controls', () => {
  const { queryByText } = renderHomePage();
  expect(queryByText(/Go to Admin Dashboard/i)).toBeNull();
  expect(queryByText('Manage Volunteers')).toBeNull();
  expect(queryByText('Manage Organizations')).toBeNull();
});

// Volunteer Role

test('(volunteer) "Go to Dashboard" links to /volunteer', () => {
  const { getByText } = renderHomePage('volunteer');
  const btn = getByText('Go to Dashboard').closest('a');
  expect(btn).toHaveAttribute('href', '/volunteer');
});

test('(volunteer) shows disabled "Volunteer Account Active" in org card', () => {
  const { getByText } = renderHomePage('volunteer');
  const disabledBtn = getByText('Volunteer Account Active');
  expect(disabledBtn).toBeInTheDocument();
  expect(disabledBtn.closest('button')).toBeDisabled();
});

test('(volunteer) does NOT show Log In buttons or account creation links', () => {
  const { queryByTestId, queryByRole, queryByText } = renderHomePage('volunteer');
  expect(queryByTestId('volunteer-login-button')).toBeNull();
  expect(queryByRole('link', { name: /log in/i })).toBeNull();
  expect(queryByText('Create Volunteer Account')).toBeNull();
  expect(queryByText('Request Organization Account')).toBeNull();
});

test('(volunteer) does NOT show admin controls', () => {
  const { queryByText } = renderHomePage('volunteer');
  expect(queryByText(/Go to Admin Dashboard/i)).toBeNull();
  expect(queryByText('Manage Volunteers')).toBeNull();
  expect(queryByText('Manage Organizations')).toBeNull();
});

// Organization Role

test('(organization) "Go to Dashboard" links to /organization', () => {
  const { getByText } = renderHomePage('organization');
  const btn = getByText('Go to Dashboard').closest('a');
  expect(btn).toHaveAttribute('href', '/organization');
});

test('(organization) shows disabled "Organization Account Active" in volunteer card', () => {
  const { getByText } = renderHomePage('organization');
  const disabledBtn = getByText('Organization Account Active');
  expect(disabledBtn).toBeInTheDocument();
  expect(disabledBtn.closest('button')).toBeDisabled();
});

test('(organization) does NOT show Log In buttons or account creation links', () => {
  const { queryByTestId, queryByRole, queryByText } = renderHomePage('organization');
  expect(queryByTestId('volunteer-login-button')).toBeNull();
  expect(queryByRole('link', { name: /log in/i })).toBeNull();
  expect(queryByText('Create Volunteer Account')).toBeNull();
  expect(queryByText('Request Organization Account')).toBeNull();
});

test('(organization) does NOT show admin controls', () => {
  const { queryByText } = renderHomePage('organization');
  expect(queryByText(/Go to Admin Dashboard/i)).toBeNull();
  expect(queryByText('Manage Volunteers')).toBeNull();
  expect(queryByText('Manage Organizations')).toBeNull();
});

// Admin Role

test('(admin) "Go to Admin Dashboard" links to /admin', () => {
  const { getByText } = renderHomePage('admin');
  const btn = getByText(/Go to Admin Dashboard/i).closest('a');
  expect(btn).toHaveAttribute('href', '/admin');
});

test('(admin) does NOT show Log In buttons or account creation links', () => {
  const { queryByTestId, queryByRole, queryByText } = renderHomePage('admin');
  expect(queryByTestId('volunteer-login-button')).toBeNull();
  expect(queryByRole('link', { name: /log in/i })).toBeNull();
  expect(queryByText('Create Volunteer Account')).toBeNull();
  expect(queryByText('Request Organization Account')).toBeNull();
});

// Stats Loading States

test('shows "..." placeholders while stats are loading', () => {
  requestServerMock.mockImplementation(() => new Promise(() => {}));
  const { getAllByText } = renderHomePage();
  expect(getAllByText('...').length).toBeGreaterThan(0);
});

test('shows error state and hides carousel when stats request fails', async () => {
  requestServerMock.mockRejectedValue(new Error('Network error'));
  const { container } = renderHomePage();
  await screen.findByText(/Failed to load stats/i);
  expect(container.querySelector('[data-testid="stats-explore-link"]')).toBeNull();
});

test('shows carousel and no error when stats load successfully', async () => {
  renderHomePage();
  await screen.findByTestId('stats-explore-link');
  await waitFor(() => {
    expect(screen.queryByText('Failed to load stats')).toBeNull();
  });
});

// Stats Carousel explore path by role

test('(guest) StatsCarousel explore path points to /login', async () => {
  renderHomePage();
  const exploreLink = await screen.findByTestId('stats-explore-link');
  expect(exploreLink).toHaveAttribute('href', '/login');
});

test('(volunteer) StatsCarousel explore path points to /volunteer', async () => {
  renderHomePage('volunteer');
  const exploreLink = await screen.findByTestId('stats-explore-link');
  expect(exploreLink).toHaveAttribute('href', '/volunteer');
});

test('(organization) StatsCarousel explore path points to /organization', async () => {
  renderHomePage('organization');
  const exploreLink = await screen.findByTestId('stats-explore-link');
  expect(exploreLink).toHaveAttribute('href', '/organization');
});

test('(admin) StatsCarousel explore path points to /admin', async () => {
  renderHomePage('admin');
  const exploreLink = await screen.findByTestId('stats-explore-link');
  expect(exploreLink).toHaveAttribute('href', '/admin');
});
