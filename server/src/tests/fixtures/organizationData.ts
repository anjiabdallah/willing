import database from '../../db/index.ts';

import type { Database, Posting, OrganizationRequest } from '../../db/tables/index.ts';
import type { Kysely } from 'kysely';

type OrganizationRequestOptions = {
  email?: string;
  name?: string;
};

type PostingOptions = {
  organizationId: number;
  title?: string;
  created_at?: Date;
  overrides?: Partial<Omit<Posting, 'id'>>;
  skills?: string[];
};

type DbExecutor = Kysely<Database>;

const isDbExecutor = (value: unknown): value is DbExecutor =>
  typeof value === 'object'
  && value !== null
  && 'insertInto' in value
  && 'selectFrom' in value;

const resolveFixtureArgs = <T>(arg1?: DbExecutor | T, arg2?: T): [DbExecutor, T] => {
  if (isDbExecutor(arg1)) {
    return [arg1, (arg2 ?? {}) as T];
  }

  return [database, (arg1 ?? {}) as T];
};

export async function createOrganizationRequest(options?: OrganizationRequestOptions): Promise<OrganizationRequest>;
export async function createOrganizationRequest(db: DbExecutor, options?: OrganizationRequestOptions): Promise<OrganizationRequest>;
export async function createOrganizationRequest(arg1?: DbExecutor | OrganizationRequestOptions, arg2?: OrganizationRequestOptions): Promise<OrganizationRequest> {
  const [db, options] = resolveFixtureArgs<OrganizationRequestOptions>(arg1, arg2);

  const {
    email = 'pending-org@example.com',
    name = 'Pending Org',
  } = options;

  const now = new Date();

  const request = await db
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

export async function createPosting(options: PostingOptions): Promise<Posting>;
export async function createPosting(db: DbExecutor, options: PostingOptions): Promise<Posting>;
export async function createPosting(arg1: DbExecutor | PostingOptions, arg2?: PostingOptions): Promise<Posting> {
  const [db, options] = resolveFixtureArgs<PostingOptions>(arg1, arg2);

  const {
    organizationId,
    title = 'Community Cleanup',
    created_at,
    overrides,
    skills,
  } = options;

  const now = created_at ?? overrides?.created_at ?? new Date();
  const startDate = overrides?.start_date ?? new Date('2026-01-01');
  const endDate = overrides?.end_date ?? new Date('2026-01-02');

  const posting = await db
    .insertInto('posting')
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
    await db
      .insertInto('posting_skill')
      .values(skills.map(name => ({
        posting_id: posting.id,
        name,
      })))
      .execute();
  }

  return posting;
}
