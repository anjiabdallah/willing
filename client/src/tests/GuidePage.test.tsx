import { cleanup, screen } from '@testing-library/react';
import { test, expect, beforeEach, afterEach, vi } from 'vitest';

import '@testing-library/jest-dom/vitest';
import { renderPageWithAuth } from './test-utils';
import GuidePage from '../pages/GuidePage';

// Helpers

function renderGuidePage(role?: 'volunteer' | 'organization' | 'admin') {
  return renderPageWithAuth(<GuidePage />, {
    initialEntries: ['/guide'],
    authOverrides: role ? { user: { role } } : {},
  });
}

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Section IDs (required for sidebar scroll navigation)

test('all navigable section ids are present in the DOM', () => {
  renderGuidePage();
  for (const id of ['overview', 'volunteers', 'organizations', 'postings', 'crises', 'certificates', 'faq']) {
    expect(document.getElementById(id)).toBeInTheDocument();
  }
});

test('clicking a nav button calls scrollIntoView on the section', () => {
  renderGuidePage();
  screen.getAllByRole('button', { name: 'For Volunteers' })[0].click();
  expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
});

// CTA Section — Guest

test('(guest) "Get Started" links to /volunteer/create', () => {
  renderGuidePage();
  expect(screen.getByText('Get Started').closest('a')).toHaveAttribute('href', '/volunteer/create');
});

test('(guest) "Register" links to /organization/request', () => {
  renderGuidePage();
  expect(screen.getByText('Register').closest('a')).toHaveAttribute('href', '/organization/request');
});

test('(guest) does NOT show "Go to Dashboard" or any disabled account buttons', () => {
  renderGuidePage();
  expect(screen.queryByText('Go to Dashboard')).toBeNull();
  expect(screen.queryByText('Admin Account Active')).toBeNull();
  expect(screen.queryByText('Volunteer Account Active')).toBeNull();
  expect(screen.queryByText('Organization Account Active')).toBeNull();
});

// CTA Section — Volunteer

test('(volunteer) "Go to Dashboard" links to /volunteer', () => {
  renderGuidePage('volunteer');
  expect(screen.getByText('Go to Dashboard').closest('a')).toHaveAttribute('href', '/volunteer');
});

test('(volunteer) shows disabled "Volunteer Account Active" in org card', () => {
  renderGuidePage('volunteer');
  expect(screen.getByText('Volunteer Account Active').closest('button')).toBeDisabled();
});

test('(volunteer) does NOT show guest links or admin button', () => {
  renderGuidePage('volunteer');
  expect(screen.queryByText('Get Started')).toBeNull();
  expect(screen.queryByText('Register')).toBeNull();
  expect(screen.queryByText('Admin Account Active')).toBeNull();
});

// CTA Section — Organization

test('(organization) "Go to Dashboard" links to /organization', () => {
  renderGuidePage('organization');
  expect(screen.getByText('Go to Dashboard').closest('a')).toHaveAttribute('href', '/organization');
});

test('(organization) shows disabled "Organization Account Active" in volunteer card', () => {
  renderGuidePage('organization');
  expect(screen.getByText('Organization Account Active').closest('button')).toBeDisabled();
});

test('(organization) does NOT show guest links or admin button', () => {
  renderGuidePage('organization');
  expect(screen.queryByText('Get Started')).toBeNull();
  expect(screen.queryByText('Register')).toBeNull();
  expect(screen.queryByText('Admin Account Active')).toBeNull();
});

// CTA Section — Admin

test('(admin) shows two disabled "Admin Account Active" buttons', () => {
  renderGuidePage('admin');
  const btns = screen.getAllByText('Admin Account Active');
  expect(btns.length).toBe(2);
  for (const btn of btns) {
    expect(btn.closest('button')).toBeDisabled();
  }
});

test('(admin) does NOT show guest links or role-specific dashboard/account buttons', () => {
  renderGuidePage('admin');
  expect(screen.queryByText('Get Started')).toBeNull();
  expect(screen.queryByText('Register')).toBeNull();
  expect(screen.queryByText('Go to Dashboard')).toBeNull();
  expect(screen.queryByText('Volunteer Account Active')).toBeNull();
  expect(screen.queryByText('Organization Account Active')).toBeNull();
});
