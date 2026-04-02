import { hash } from '../../services/bcrypt/index.ts';
import { generateJWT } from '../../services/jwt/index.ts';

import type { Database } from '../../db/tables/index.ts';
import type { ControlledTransaction } from 'kysely';

type OrganizationFixtureOptions = {
  email?: string;
  password?: string;
  name?: string;
  phone_number?: string;
  url?: string;
  created_at?: Date;
};

type VolunteerFixtureOptions = {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  created_at?: Date;
};

const DEFAULT_ORG_PASSWORD = 'OrgPassword123!';
const HASHED_DEFAULT_ORG_PASSWORD = hash(DEFAULT_ORG_PASSWORD);

const DEFAULT_VOL_PASSWORD = 'VolPassword123!';
const HASHED_DEFAULT_VOL_PASSWORD = hash(DEFAULT_VOL_PASSWORD);

const DEFAULT_ADMIN_PASSWORD = 'AdminPassword123!';
const HASHED_DEFAULT_ADMIN_PASSWORD = hash(DEFAULT_ADMIN_PASSWORD);

export async function createOrganizationAccount(
  database: ControlledTransaction<Database>,
  {
    email = 'org@example.com',
    password,
    name = 'Helping Hands',
    phone_number = '+10000000000',
    url = 'https://example.org',
    created_at = new Date(),
  }: OrganizationFixtureOptions = {},
) {
  const hashedPassword = await (password === undefined ? HASHED_DEFAULT_ORG_PASSWORD : hash(password));
  const now = new Date();

  const organization = await database
    .insertInto('organization_account')
    .values({
      name,
      email,
      phone_number,
      url,
      location_name: 'Beirut',
      password: hashedPassword,
      created_at,
      updated_at: now,
      is_disabled: false,
      is_deleted: false,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    organization,
    plainPassword: password === undefined ? DEFAULT_ORG_PASSWORD : password,
    token: await generateJWT({ id: organization.id, role: 'organization', token_version: organization.token_version }),
  };
}

export async function createVolunteerAccount(
  database: ControlledTransaction<Database>,
  {
    email = 'vol@example.com',
    password,
    first_name = 'Jane',
    last_name = 'Doe',
    created_at = new Date(),
  }: VolunteerFixtureOptions = {},
) {
  const hashedPassword = await (password === undefined ? HASHED_DEFAULT_VOL_PASSWORD : hash(password));
  const now = new Date();

  const volunteer = await database
    .insertInto('volunteer_account')
    .values({
      first_name,
      last_name,
      email,
      password: hashedPassword,
      date_of_birth: '2000-01-01',
      gender: 'female',
      created_at,
      updated_at: now,
      is_disabled: false,
      is_deleted: false,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    volunteer,
    plainPassword: password === undefined ? DEFAULT_VOL_PASSWORD : password,
    token: await generateJWT({ id: volunteer.id, role: 'volunteer', token_version: volunteer.token_version }),
  };
}

type AdminFixtureOptions = {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
};

export async function createAdminAccount(
  database: ControlledTransaction<Database>,
  {
    email = 'admin@example.com',
    password,
    first_name = 'Admin',
    last_name = 'User',
  }: AdminFixtureOptions = {},
) {
  const hashedPassword = await (password === undefined ? HASHED_DEFAULT_ADMIN_PASSWORD : hash(password));
  const now = new Date();

  const admin = await database
    .insertInto('admin_account')
    .values({
      first_name,
      last_name,
      email,
      password: hashedPassword,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return {
    admin,
    plainPassword: password === undefined ? DEFAULT_ADMIN_PASSWORD : password,
    token: await generateJWT({ id: admin.id, role: 'admin', token_version: admin.token_version }),
  };
}
