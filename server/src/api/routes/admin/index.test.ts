import { type ControlledTransaction } from 'kysely';
import supertest from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import createApp from '../../../app.ts';
import database from '../../../db/index.ts';
import { createAdminAccount, createOrganizationAccount, createVolunteerAccount } from '../../../tests/fixtures/accounts.ts';
import { authHeader } from '../../../tests/helpers/authHeader.ts';

import type { Database } from '../../../db/tables/index.ts';
import type TestAgent from 'supertest/lib/agent.js';

let transaction: ControlledTransaction<Database, []>;
let server: TestAgent;

beforeEach(async () => {
  transaction = await database.startTransaction().execute();
  server = supertest(createApp(transaction));
});

afterEach(async () => {
  await transaction.rollback().execute();
});

describe('GET /admin/reports', () => {
  test('returns 403 when unauthenticated', async () => {
    await server
      .get('/admin/reports')
      .expect(403);
  });

  test('returns 403 when requester is not an admin', async () => {
    const { token } = await createVolunteerAccount(transaction);

    await server
      .get('/admin/reports')
      .set(authHeader(token))
      .expect(403);
  });

  test('returns organization and volunteer reports in separate lists for admin', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);
    const { organization: reportedOrganization } = await createOrganizationAccount(transaction, {
      email: 'reported-org@example.com',
      name: 'Reported Organization',
      phone_number: '+10000000001',
      url: 'https://reported-org.example.com',
    });
    const { volunteer: reporterVolunteer } = await createVolunteerAccount(transaction, {
      email: 'reporter-vol@example.com',
      first_name: 'Reporter',
      last_name: 'Volunteer',
    });

    const { volunteer: reportedVolunteer } = await createVolunteerAccount(transaction, {
      email: 'reported-vol@example.com',
      first_name: 'Reported',
      last_name: 'Volunteer',
    });
    const { organization: reporterOrganization } = await createOrganizationAccount(transaction, {
      email: 'reporter-org@example.com',
      name: 'Reporter Organization',
      phone_number: '+10000000002',
      url: 'https://reporter-org.example.com',
    });

    await transaction
      .insertInto('organization_report')
      .values({
        reported_organization_id: reportedOrganization.id,
        reporter_volunteer_id: reporterVolunteer.id,
        title: 'scam',
        message: 'Suspicious behavior',
      })
      .executeTakeFirstOrThrow();

    await transaction
      .insertInto('volunteer_report')
      .values({
        reported_volunteer_id: reportedVolunteer.id,
        reporter_organization_id: reporterOrganization.id,
        title: 'harassment',
        message: 'Inappropriate communication',
      })
      .executeTakeFirstOrThrow();

    const response = await server
      .get('/admin/reports')
      .set(authHeader(adminToken))
      .expect(200);

    expect(response.body.organizationReports).toHaveLength(1);
    expect(response.body.volunteerReports).toHaveLength(1);

    expect(response.body.organizationReports[0]).toMatchObject({
      title: 'scam',
      message: 'Suspicious behavior',
      reported_organization: {
        id: reportedOrganization.id,
        name: 'Reported Organization',
        email: 'reported-org@example.com',
      },
      reporter_volunteer: {
        id: reporterVolunteer.id,
        first_name: 'Reporter',
        last_name: 'Volunteer',
        email: 'reporter-vol@example.com',
      },
    });

    expect(response.body.volunteerReports[0]).toMatchObject({
      title: 'harassment',
      message: 'Inappropriate communication',
      reported_volunteer: {
        id: reportedVolunteer.id,
        first_name: 'Reported',
        last_name: 'Volunteer',
        email: 'reported-vol@example.com',
      },
      reporter_organization: {
        id: reporterOrganization.id,
        name: 'Reporter Organization',
        email: 'reporter-org@example.com',
      },
    });
  });

  test('returns only organization reports when scope=organization', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);
    const { organization: reportedOrganization } = await createOrganizationAccount(transaction, {
      phone_number: '+10000000003',
      url: 'https://scope-org.example.com',
    });
    const { volunteer: reporterVolunteer } = await createVolunteerAccount(transaction);

    await transaction
      .insertInto('organization_report')
      .values({
        reported_organization_id: reportedOrganization.id,
        reporter_volunteer_id: reporterVolunteer.id,
        title: 'other',
        message: 'Organization-only report',
      })
      .executeTakeFirstOrThrow();

    const response = await server
      .get('/admin/reports?scope=organization')
      .set(authHeader(adminToken))
      .expect(200);

    expect(response.body.organizationReports).toHaveLength(1);
    expect(response.body.volunteerReports).toEqual([]);
  });

  test('returns only volunteer reports when scope=volunteer', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);
    const { volunteer: reportedVolunteer } = await createVolunteerAccount(transaction, {
      email: 'scope-volunteer@example.com',
    });
    const { organization: reporterOrganization } = await createOrganizationAccount(transaction, {
      email: 'scope-volunteer-org@example.com',
      phone_number: '+10000000015',
      url: 'https://scope-volunteer-org.example.com',
    });

    await transaction
      .insertInto('volunteer_report')
      .values({
        reported_volunteer_id: reportedVolunteer.id,
        reporter_organization_id: reporterOrganization.id,
        title: 'other',
        message: 'Volunteer-only report',
      })
      .executeTakeFirstOrThrow();

    const response = await server
      .get('/admin/reports?scope=volunteer')
      .set(authHeader(adminToken))
      .expect(200);

    expect(response.body.organizationReports).toEqual([]);
    expect(response.body.volunteerReports).toHaveLength(1);
  });

  test('filters reports by reportType across both lists', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);
    const { organization: reportedOrganization } = await createOrganizationAccount(transaction, {
      email: 'org1@example.com',
      phone_number: '+10000000004',
      url: 'https://org1.example.com',
    });
    const { volunteer: reporterVolunteer } = await createVolunteerAccount(transaction, { email: 'vol1@example.com' });
    const { volunteer: reportedVolunteer } = await createVolunteerAccount(transaction, { email: 'vol2@example.com' });
    const { organization: reporterOrganization } = await createOrganizationAccount(transaction, {
      email: 'org2@example.com',
      phone_number: '+10000000005',
      url: 'https://org2.example.com',
    });

    await transaction
      .insertInto('organization_report')
      .values({
        reported_organization_id: reportedOrganization.id,
        reporter_volunteer_id: reporterVolunteer.id,
        title: 'scam',
        message: 'Matching type',
      })
      .executeTakeFirstOrThrow();

    await transaction
      .insertInto('volunteer_report')
      .values({
        reported_volunteer_id: reportedVolunteer.id,
        reporter_organization_id: reporterOrganization.id,
        title: 'other',
        message: 'Non-matching type',
      })
      .executeTakeFirstOrThrow();

    const response = await server
      .get('/admin/reports?reportType=scam')
      .set(authHeader(adminToken))
      .expect(200);

    expect(response.body.organizationReports).toHaveLength(1);
    expect(response.body.volunteerReports).toHaveLength(0);
  });

  test('returns 400 when scope query is invalid', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);

    await server
      .get('/admin/reports?scope=invalid-scope')
      .set(authHeader(adminToken))
      .expect(400);
  });

  test('filters reports by search query for organization reports', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);
    const { organization: matchingOrganization } = await createOrganizationAccount(transaction, {
      email: 'search-org-match@example.com',
      name: 'Search Match Org',
      phone_number: '+10000000016',
      url: 'https://search-org-match.example.com',
    });
    const { organization: nonMatchingOrganization } = await createOrganizationAccount(transaction, {
      email: 'search-org-non-match@example.com',
      name: 'Other Org',
      phone_number: '+10000000017',
      url: 'https://search-org-non-match.example.com',
    });
    const { volunteer: reporterVolunteer } = await createVolunteerAccount(transaction, {
      email: 'search-org-reporter@example.com',
    });

    await transaction
      .insertInto('organization_report')
      .values([
        {
          reported_organization_id: matchingOrganization.id,
          reporter_volunteer_id: reporterVolunteer.id,
          title: 'scam',
          message: 'contains-neon-keyword',
        },
        {
          reported_organization_id: nonMatchingOrganization.id,
          reporter_volunteer_id: reporterVolunteer.id,
          title: 'other',
          message: 'plain message',
        },
      ])
      .execute();

    const response = await server
      .get('/admin/reports?scope=organization&search=neon-keyword')
      .set(authHeader(adminToken))
      .expect(200);

    expect(response.body.organizationReports).toHaveLength(1);
    expect(response.body.organizationReports[0].reported_organization.id).toBe(matchingOrganization.id);
    expect(response.body.volunteerReports).toEqual([]);
  });

  test('filters reports by search query for volunteer reports', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);
    const { volunteer: matchingVolunteer } = await createVolunteerAccount(transaction, {
      email: 'search-vol-match@example.com',
      first_name: 'Needle',
      last_name: 'Volunteer',
    });
    const { volunteer: nonMatchingVolunteer } = await createVolunteerAccount(transaction, {
      email: 'search-vol-non-match@example.com',
      first_name: 'Other',
      last_name: 'Volunteer',
    });
    const { organization: reporterOrganization } = await createOrganizationAccount(transaction, {
      email: 'search-vol-org@example.com',
      name: 'Reporter Org',
      phone_number: '+10000000018',
      url: 'https://search-vol-org.example.com',
    });

    await transaction
      .insertInto('volunteer_report')
      .values([
        {
          reported_volunteer_id: matchingVolunteer.id,
          reporter_organization_id: reporterOrganization.id,
          title: 'harassment',
          message: 'matched via volunteer first name',
        },
        {
          reported_volunteer_id: nonMatchingVolunteer.id,
          reporter_organization_id: reporterOrganization.id,
          title: 'other',
          message: 'different person',
        },
      ])
      .execute();

    const response = await server
      .get('/admin/reports?scope=volunteer&search=needle')
      .set(authHeader(adminToken))
      .expect(200);

    expect(response.body.organizationReports).toEqual([]);
    expect(response.body.volunteerReports).toHaveLength(1);
    expect(response.body.volunteerReports[0].reported_volunteer.id).toBe(matchingVolunteer.id);
  });

  test('filters organization reports by reporter volunteer email', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);
    const { organization: reportedOrganization } = await createOrganizationAccount(transaction, {
      email: 'search-email-org@example.com',
      phone_number: '+10000000019',
      url: 'https://search-email-org.example.com',
    });
    const { volunteer: matchingReporter } = await createVolunteerAccount(transaction, {
      email: 'needle-reporter@example.com',
      first_name: 'Email',
      last_name: 'Match',
    });
    const { volunteer: otherReporter } = await createVolunteerAccount(transaction, {
      email: 'other-reporter@example.com',
      first_name: 'Other',
      last_name: 'Reporter',
    });

    await transaction
      .insertInto('organization_report')
      .values([
        {
          reported_organization_id: reportedOrganization.id,
          reporter_volunteer_id: matchingReporter.id,
          title: 'scam',
          message: 'match by reporter email',
        },
        {
          reported_organization_id: reportedOrganization.id,
          reporter_volunteer_id: otherReporter.id,
          title: 'other',
          message: 'non matching reporter email',
        },
      ])
      .execute();

    const response = await server
      .get('/admin/reports?scope=organization&search=needle-reporter@example.com')
      .set(authHeader(adminToken))
      .expect(200);

    expect(response.body.organizationReports).toHaveLength(1);
    expect(response.body.organizationReports[0].reporter_volunteer.email).toBe('needle-reporter@example.com');
    expect(response.body.volunteerReports).toEqual([]);
  });
});

describe('GET /admin/reports/organization/:reportId', () => {
  test('returns 403 when unauthenticated', async () => {
    await server
      .get('/admin/reports/organization/1')
      .expect(403);
  });

  test('returns 403 when requester is not an admin', async () => {
    const { token } = await createVolunteerAccount(transaction);

    await server
      .get('/admin/reports/organization/1')
      .set(authHeader(token))
      .expect(403);
  });

  test('returns the organization report details for admin', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);
    const { organization: reportedOrganization } = await createOrganizationAccount(transaction, {
      email: 'reported-org-details@example.com',
      name: 'Reported Org Details',
      phone_number: '+10000000008',
      url: 'https://reported-org-details.example.com',
    });
    const { volunteer: reporterVolunteer } = await createVolunteerAccount(transaction, {
      email: 'reporter-vol-details@example.com',
      first_name: 'Reporter',
      last_name: 'Volunteer',
    });

    const report = await transaction
      .insertInto('organization_report')
      .values({
        reported_organization_id: reportedOrganization.id,
        reporter_volunteer_id: reporterVolunteer.id,
        title: 'scam',
        message: 'Organization report details',
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    const response = await server
      .get(`/admin/reports/organization/${report.id}`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(response.body).toMatchObject({
      id: report.id,
      title: 'scam',
      message: 'Organization report details',
      reported_organization: {
        id: reportedOrganization.id,
        name: 'Reported Org Details',
        email: 'reported-org-details@example.com',
      },
      reporter_volunteer: {
        id: reporterVolunteer.id,
        first_name: 'Reporter',
        last_name: 'Volunteer',
        email: 'reporter-vol-details@example.com',
      },
    });
  });

  test('returns 404 when organization report does not exist', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);

    await server
      .get('/admin/reports/organization/999999')
      .set(authHeader(adminToken))
      .expect(404);
  });
});

describe('GET /admin/reports/volunteer/:reportId', () => {
  test('returns 403 when unauthenticated', async () => {
    await server
      .get('/admin/reports/volunteer/1')
      .expect(403);
  });

  test('returns 403 when requester is not an admin', async () => {
    const { token } = await createOrganizationAccount(transaction, {
      phone_number: '+10000000009',
      url: 'https://non-admin-org-details.example.com',
    });

    await server
      .get('/admin/reports/volunteer/1')
      .set(authHeader(token))
      .expect(403);
  });

  test('returns the volunteer report details for admin', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);
    const { volunteer: reportedVolunteer } = await createVolunteerAccount(transaction, {
      email: 'reported-vol-details@example.com',
      first_name: 'Reported',
      last_name: 'Volunteer',
    });
    const { organization: reporterOrganization } = await createOrganizationAccount(transaction, {
      email: 'reporter-org-details@example.com',
      name: 'Reporter Org Details',
      phone_number: '+10000000010',
      url: 'https://reporter-org-details.example.com',
    });

    const report = await transaction
      .insertInto('volunteer_report')
      .values({
        reported_volunteer_id: reportedVolunteer.id,
        reporter_organization_id: reporterOrganization.id,
        title: 'harassment',
        message: 'Volunteer report details',
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    const response = await server
      .get(`/admin/reports/volunteer/${report.id}`)
      .set(authHeader(adminToken))
      .expect(200);

    expect(response.body).toMatchObject({
      id: report.id,
      title: 'harassment',
      message: 'Volunteer report details',
      reported_volunteer: {
        id: reportedVolunteer.id,
        first_name: 'Reported',
        last_name: 'Volunteer',
        email: 'reported-vol-details@example.com',
      },
      reporter_organization: {
        id: reporterOrganization.id,
        name: 'Reporter Org Details',
        email: 'reporter-org-details@example.com',
      },
    });
  });

  test('returns 404 when volunteer report does not exist', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);

    await server
      .get('/admin/reports/volunteer/999999')
      .set(authHeader(adminToken))
      .expect(404);
  });
});

describe('POST /admin/reports/organization/:reportId/reject', () => {
  test('returns 403 when unauthenticated', async () => {
    await server
      .post('/admin/reports/organization/1/reject')
      .expect(403);
  });

  test('returns 404 when organization report does not exist', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);

    await server
      .post('/admin/reports/organization/999999/reject')
      .set(authHeader(adminToken))
      .expect(404);
  });

  test('removes organization report when admin rejects it', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);
    const { organization: reportedOrganization } = await createOrganizationAccount(transaction, {
      phone_number: '+10000000011',
      url: 'https://reject-org.example.com',
    });
    const { volunteer: reporterVolunteer } = await createVolunteerAccount(transaction);

    const report = await transaction
      .insertInto('organization_report')
      .values({
        reported_organization_id: reportedOrganization.id,
        reporter_volunteer_id: reporterVolunteer.id,
        title: 'other',
        message: 'To be rejected',
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    await server
      .post(`/admin/reports/organization/${report.id}/reject`)
      .set(authHeader(adminToken))
      .expect(200);

    const deletedReport = await transaction
      .selectFrom('organization_report')
      .select(['id'])
      .where('id', '=', report.id)
      .executeTakeFirst();

    expect(deletedReport).toBeUndefined();
  });
});

describe('POST /admin/reports/volunteer/:reportId/reject', () => {
  test('returns 403 when requester is not an admin', async () => {
    const { token } = await createVolunteerAccount(transaction);

    await server
      .post('/admin/reports/volunteer/1/reject')
      .set(authHeader(token))
      .expect(403);
  });

  test('returns 404 when volunteer report does not exist', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);

    await server
      .post('/admin/reports/volunteer/999999/reject')
      .set(authHeader(adminToken))
      .expect(404);
  });

  test('removes volunteer report when admin rejects it', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);
    const { volunteer: reportedVolunteer } = await createVolunteerAccount(transaction);
    const { organization: reporterOrganization } = await createOrganizationAccount(transaction, {
      phone_number: '+10000000012',
      url: 'https://reject-vol.example.com',
    });

    const report = await transaction
      .insertInto('volunteer_report')
      .values({
        reported_volunteer_id: reportedVolunteer.id,
        reporter_organization_id: reporterOrganization.id,
        title: 'harassment',
        message: 'Volunteer report to reject',
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    await server
      .post(`/admin/reports/volunteer/${report.id}/reject`)
      .set(authHeader(adminToken))
      .expect(200);

    const deletedReport = await transaction
      .selectFrom('volunteer_report')
      .select(['id'])
      .where('id', '=', report.id)
      .executeTakeFirst();

    expect(deletedReport).toBeUndefined();
  });
});

describe('POST /admin/reports/organization/:organizationId/disable', () => {
  test('returns 403 when unauthenticated', async () => {
    await server
      .post('/admin/reports/organization/1/disable')
      .expect(403);
  });

  test('returns 404 when organization account does not exist', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);

    await server
      .post('/admin/reports/organization/999999/disable')
      .set(authHeader(adminToken))
      .expect(404);
  });

  test('sets organization account as disabled, increments token version, and removes related reports', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);
    const { organization } = await createOrganizationAccount(transaction, {
      phone_number: '+10000000006',
      url: 'https://disable-org.example.com',
    });
    const { volunteer: reporterVolunteer } = await createVolunteerAccount(transaction, {
      email: 'disable-org-volunteer@example.com',
    });
    const { volunteer: reportedVolunteer } = await createVolunteerAccount(transaction, {
      email: 'disable-org-reported-volunteer@example.com',
    });

    await transaction
      .insertInto('organization_report')
      .values({
        reported_organization_id: organization.id,
        reporter_volunteer_id: reporterVolunteer.id,
        title: 'scam',
        message: 'report against organization',
      })
      .executeTakeFirstOrThrow();

    await transaction
      .insertInto('volunteer_report')
      .values({
        reported_volunteer_id: reportedVolunteer.id,
        reporter_organization_id: organization.id,
        title: 'other',
        message: 'report by organization',
      })
      .executeTakeFirstOrThrow();

    const before = await transaction
      .selectFrom('organization_account')
      .select(['is_disabled', 'token_version'])
      .where('id', '=', organization.id)
      .executeTakeFirstOrThrow();

    expect(before.is_disabled).toBe(false);

    await server
      .post(`/admin/reports/organization/${organization.id}/disable`)
      .set(authHeader(adminToken))
      .expect(200);

    const after = await transaction
      .selectFrom('organization_account')
      .select(['is_disabled', 'token_version'])
      .where('id', '=', organization.id)
      .executeTakeFirstOrThrow();

    const remainingOrganizationReports = await transaction
      .selectFrom('organization_report')
      .select(['id'])
      .where('reported_organization_id', '=', organization.id)
      .execute();

    const remainingVolunteerReports = await transaction
      .selectFrom('volunteer_report')
      .select(['id'])
      .where('reporter_organization_id', '=', organization.id)
      .execute();

    expect(after.is_disabled).toBe(true);
    expect(after.token_version).toBe(before.token_version + 1);
    expect(remainingOrganizationReports).toHaveLength(0);
    expect(remainingVolunteerReports).toHaveLength(0);
  });
});

describe('POST /admin/reports/volunteer/:volunteerId/disable', () => {
  test('returns 403 when requester is not an admin', async () => {
    const { token } = await createOrganizationAccount(transaction, {
      phone_number: '+10000000007',
      url: 'https://non-admin-org.example.com',
    });

    await server
      .post('/admin/reports/volunteer/1/disable')
      .set(authHeader(token))
      .expect(403);
  });

  test('returns 404 when volunteer account does not exist', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);

    await server
      .post('/admin/reports/volunteer/999999/disable')
      .set(authHeader(adminToken))
      .expect(404);
  });

  test('sets volunteer account as disabled, increments token version, and removes related reports', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);
    const { volunteer } = await createVolunteerAccount(transaction);
    const { organization: reporterOrganization } = await createOrganizationAccount(transaction, {
      email: 'disable-vol-org@example.com',
      phone_number: '+10000000020',
      url: 'https://disable-vol-org.example.com',
    });
    const { organization: reportedOrganization } = await createOrganizationAccount(transaction, {
      email: 'disable-vol-reported-org@example.com',
      phone_number: '+10000000021',
      url: 'https://disable-vol-reported-org.example.com',
    });

    await transaction
      .insertInto('volunteer_report')
      .values({
        reported_volunteer_id: volunteer.id,
        reporter_organization_id: reporterOrganization.id,
        title: 'harassment',
        message: 'report against volunteer',
      })
      .executeTakeFirstOrThrow();

    await transaction
      .insertInto('organization_report')
      .values({
        reported_organization_id: reportedOrganization.id,
        reporter_volunteer_id: volunteer.id,
        title: 'other',
        message: 'report by volunteer',
      })
      .executeTakeFirstOrThrow();

    const before = await transaction
      .selectFrom('volunteer_account')
      .select(['is_disabled', 'token_version'])
      .where('id', '=', volunteer.id)
      .executeTakeFirstOrThrow();

    expect(before.is_disabled).toBe(false);

    await server
      .post(`/admin/reports/volunteer/${volunteer.id}/disable`)
      .set(authHeader(adminToken))
      .expect(200);

    const after = await transaction
      .selectFrom('volunteer_account')
      .select(['is_disabled', 'token_version'])
      .where('id', '=', volunteer.id)
      .executeTakeFirstOrThrow();

    const remainingVolunteerReports = await transaction
      .selectFrom('volunteer_report')
      .select(['id'])
      .where('reported_volunteer_id', '=', volunteer.id)
      .execute();

    const remainingOrganizationReports = await transaction
      .selectFrom('organization_report')
      .select(['id'])
      .where('reporter_volunteer_id', '=', volunteer.id)
      .execute();

    expect(after.is_disabled).toBe(true);
    expect(after.token_version).toBe(before.token_version + 1);
    expect(remainingVolunteerReports).toHaveLength(0);
    expect(remainingOrganizationReports).toHaveLength(0);
  });
});

describe('POST /admin/reports/organization/:reportId/accept', () => {
  test('returns 403 when unauthenticated', async () => {
    await server
      .post('/admin/reports/organization/1/accept')
      .expect(403);
  });

  test('returns 404 when organization report does not exist', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);

    await server
      .post('/admin/reports/organization/999999/accept')
      .set(authHeader(adminToken))
      .expect(404);
  });

  test('disables organization and removes all related reports atomically', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);
    const { organization: reportedOrganization } = await createOrganizationAccount(transaction, {
      phone_number: '+10000000013',
      url: 'https://accept-org.example.com',
    });
    const { volunteer: reporterVolunteer } = await createVolunteerAccount(transaction, {
      email: 'accept-org-reporter@example.com',
    });

    const before = await transaction
      .selectFrom('organization_account')
      .select(['is_disabled', 'token_version'])
      .where('id', '=', reportedOrganization.id)
      .executeTakeFirstOrThrow();

    const report = await transaction
      .insertInto('organization_report')
      .values({
        reported_organization_id: reportedOrganization.id,
        reporter_volunteer_id: reporterVolunteer.id,
        title: 'scam',
        message: 'Accept and disable organization',
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    const { volunteer: anotherReportedVolunteer } = await createVolunteerAccount(transaction, {
      email: 'accept-org-another-volunteer@example.com',
    });

    await transaction
      .insertInto('volunteer_report')
      .values({
        reported_volunteer_id: anotherReportedVolunteer.id,
        reporter_organization_id: reportedOrganization.id,
        title: 'other',
        message: 'Another report created by organization',
      })
      .executeTakeFirstOrThrow();

    await server
      .post(`/admin/reports/organization/${report.id}/accept`)
      .set(authHeader(adminToken))
      .expect(200);

    const after = await transaction
      .selectFrom('organization_account')
      .select(['is_disabled', 'token_version'])
      .where('id', '=', reportedOrganization.id)
      .executeTakeFirstOrThrow();

    const remainingOrganizationReports = await transaction
      .selectFrom('organization_report')
      .select(['id'])
      .where('reported_organization_id', '=', reportedOrganization.id)
      .execute();

    const remainingVolunteerReports = await transaction
      .selectFrom('volunteer_report')
      .select(['id'])
      .where('reporter_organization_id', '=', reportedOrganization.id)
      .execute();

    expect(after.is_disabled).toBe(true);
    expect(after.token_version).toBe(before.token_version + 1);
    expect(remainingOrganizationReports).toHaveLength(0);
    expect(remainingVolunteerReports).toHaveLength(0);
  });
});

describe('POST /admin/reports/volunteer/:reportId/accept', () => {
  test('returns 403 when unauthenticated', async () => {
    await server
      .post('/admin/reports/volunteer/1/accept')
      .expect(403);
  });

  test('returns 404 when volunteer report does not exist', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);

    await server
      .post('/admin/reports/volunteer/999999/accept')
      .set(authHeader(adminToken))
      .expect(404);
  });

  test('disables volunteer and removes all related reports atomically', async () => {
    const { token: adminToken } = await createAdminAccount(transaction);
    const { volunteer: reportedVolunteer } = await createVolunteerAccount(transaction, {
      email: 'accept-vol-reported@example.com',
    });
    const { organization: reporterOrganization } = await createOrganizationAccount(transaction, {
      email: 'accept-vol-org@example.com',
      phone_number: '+10000000014',
      url: 'https://accept-vol-org.example.com',
    });

    const before = await transaction
      .selectFrom('volunteer_account')
      .select(['is_disabled', 'token_version'])
      .where('id', '=', reportedVolunteer.id)
      .executeTakeFirstOrThrow();

    const report = await transaction
      .insertInto('volunteer_report')
      .values({
        reported_volunteer_id: reportedVolunteer.id,
        reporter_organization_id: reporterOrganization.id,
        title: 'harassment',
        message: 'Accept and disable volunteer',
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    const { organization: anotherReportedOrganization } = await createOrganizationAccount(transaction, {
      email: 'accept-vol-another-org@example.com',
      phone_number: '+10000000022',
      url: 'https://accept-vol-another-org.example.com',
    });

    await transaction
      .insertInto('organization_report')
      .values({
        reported_organization_id: anotherReportedOrganization.id,
        reporter_volunteer_id: reportedVolunteer.id,
        title: 'other',
        message: 'Another report created by volunteer',
      })
      .executeTakeFirstOrThrow();

    await server
      .post(`/admin/reports/volunteer/${report.id}/accept`)
      .set(authHeader(adminToken))
      .expect(200);

    const after = await transaction
      .selectFrom('volunteer_account')
      .select(['is_disabled', 'token_version'])
      .where('id', '=', reportedVolunteer.id)
      .executeTakeFirstOrThrow();

    const remainingVolunteerReports = await transaction
      .selectFrom('volunteer_report')
      .select(['id'])
      .where('reported_volunteer_id', '=', reportedVolunteer.id)
      .execute();

    const remainingOrganizationReports = await transaction
      .selectFrom('organization_report')
      .select(['id'])
      .where('reporter_volunteer_id', '=', reportedVolunteer.id)
      .execute();

    expect(after.is_disabled).toBe(true);
    expect(after.token_version).toBe(before.token_version + 1);
    expect(remainingVolunteerReports).toHaveLength(0);
    expect(remainingOrganizationReports).toHaveLength(0);
  });
});
