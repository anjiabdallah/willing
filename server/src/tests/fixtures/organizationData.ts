import type { Database, OrganizationPosting, OrganizationRequest } from '../../db/tables/index.ts';
import type { ControlledTransaction } from 'kysely';

type OrganizationRequestOptions = {
  email?: string;
  name?: string;
};

export async function createOrganizationRequest(
  database: ControlledTransaction<Database>,
  {
    email = 'pending-org@example.com',
    name = 'Pending Org',
  }: OrganizationRequestOptions = {},
): Promise<OrganizationRequest> {
  const now = new Date();

  const request = await database
    .insertInto('organization_request')
    .values({
      name,
      email,
      phone_number: '+19999999999',
      url: 'https://pending.org',
      latitude: 33.9,
      longitude: 35.5,
      location_name: 'Beirut',
      created_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return request;
}

type OrganizationPostingOptions = {
  organizationId: number;
  title?: string;
  created_at?: Date;
  overrides?: Partial<Omit<OrganizationPosting, 'id'>>;
  skills?: string[];
};

export async function createOrganizationPosting(
  database: ControlledTransaction<Database>,
  {
    organizationId,
    title = 'Community Cleanup',
    created_at,
    overrides,
    skills,
  }: OrganizationPostingOptions,
): Promise<OrganizationPosting> {
  const now = created_at ?? overrides?.created_at ?? new Date();
  const startDate = overrides?.start_date ?? new Date('2026-01-01');
  const endDate = overrides?.end_date ?? new Date('2026-01-02');

  const posting = await database
    .insertInto('organization_posting')
    .values({
      organization_id: organizationId,
      title,
      description: overrides?.description ?? 'Help clean the community park',
      latitude: overrides?.latitude ?? 33.9,
      longitude: overrides?.longitude ?? 35.5,
      max_volunteers: overrides?.max_volunteers ?? 10,
      start_date: startDate,
      start_time: overrides?.start_time ?? '09:00',
      end_date: endDate,
      end_time: overrides?.end_time ?? '17:00',
      minimum_age: overrides?.minimum_age ?? 18,
      automatic_acceptance: overrides?.automatic_acceptance ?? true,
      is_closed: overrides?.is_closed ?? false,
      allows_partial_attendance: overrides?.allows_partial_attendance ?? false,
      location_name: overrides?.location_name ?? 'Beirut',
      crisis_id: overrides?.crisis_id ?? undefined,
      created_at: now,
      updated_at: overrides?.updated_at ?? now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  if (skills && skills.length > 0) {
    await database
      .insertInto('posting_skill')
      .values(skills.map(name => ({
        posting_id: posting.id,
        name,
      })))
      .execute();
  }

  return posting;
}
