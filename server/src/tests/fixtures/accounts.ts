import database from '../../db/index.ts';
import { hash } from '../../services/bcrypt/index.ts';
import { generateJWT } from '../../services/jwt/index.ts';

import type { AdminAccount, Database, OrganizationAccount, VolunteerAccount } from '../../db/tables/index.ts';
import type { Kysely } from 'kysely';

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

type AdminFixtureOptions = {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
};

const DEFAULT_ORG_PASSWORD = 'OrgPassword123!';
const HASHED_DEFAULT_ORG_PASSWORD = hash(DEFAULT_ORG_PASSWORD);

const DEFAULT_VOL_PASSWORD = 'VolPassword123!';
const HASHED_DEFAULT_VOL_PASSWORD = hash(DEFAULT_VOL_PASSWORD);

const DEFAULT_ADMIN_PASSWORD = 'AdminPassword123!';
const HASHED_DEFAULT_ADMIN_PASSWORD = hash(DEFAULT_ADMIN_PASSWORD);
let organizationPhoneCounter = 0;

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

export async function createOrganizationAccount(options?: OrganizationFixtureOptions): Promise<{ organization: OrganizationAccount; plainPassword: string; token: string }>;
export async function createOrganizationAccount(db: DbExecutor, options?: OrganizationFixtureOptions): Promise<{ organization: OrganizationAccount; plainPassword: string; token: string }>;
export async function createOrganizationAccount(arg1?: DbExecutor | OrganizationFixtureOptions, arg2?: OrganizationFixtureOptions) {
  const [db, options] = resolveFixtureArgs<OrganizationFixtureOptions>(arg1, arg2);
  const generatedOrganizationIndex = organizationPhoneCounter++;
  const generatedPhoneNumber = `+1${String(generatedOrganizationIndex).padStart(10, '0')}`;
  const generatedUrl = `https://example-org-${generatedOrganizationIndex}.test`;

  const {
    email = 'org@example.com',
    password,
    name = 'Helping Hands',
    phone_number = generatedPhoneNumber,
    url = generatedUrl,
    created_at = new Date(),
  } = options;

  const hashedPassword = await (password === undefined ? HASHED_DEFAULT_ORG_PASSWORD : hash(password));
  const now = new Date();

  const organization = await db
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

export async function createVolunteerAccount(options?: VolunteerFixtureOptions): Promise<{ volunteer: VolunteerAccount; plainPassword: string; token: string }>;
export async function createVolunteerAccount(db: DbExecutor, options?: VolunteerFixtureOptions): Promise<{ volunteer: VolunteerAccount; plainPassword: string; token: string }>;
export async function createVolunteerAccount(arg1?: DbExecutor | VolunteerFixtureOptions, arg2?: VolunteerFixtureOptions) {
  const [db, options] = resolveFixtureArgs<VolunteerFixtureOptions>(arg1, arg2);

  const {
    email = 'vol@example.com',
    password,
    first_name = 'Jane',
    last_name = 'Doe',
    created_at = new Date(),
  } = options;

  const hashedPassword = await (password === undefined ? HASHED_DEFAULT_VOL_PASSWORD : hash(password));
  const now = new Date();

  const volunteer = await db
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

export async function createAdminAccount(options?: AdminFixtureOptions): Promise<{ admin: AdminAccount; plainPassword: string; token: string }>;
export async function createAdminAccount(db: DbExecutor, options?: AdminFixtureOptions): Promise<{ admin: AdminAccount; plainPassword: string; token: string }>;
export async function createAdminAccount(arg1?: DbExecutor | AdminFixtureOptions, arg2?: AdminFixtureOptions) {
  const [db, options] = resolveFixtureArgs<AdminFixtureOptions>(arg1, arg2);

  const {
    email = 'admin@example.com',
    password,
    first_name = 'Admin',
    last_name = 'User',
  } = options;

  const hashedPassword = await (password === undefined ? HASHED_DEFAULT_ADMIN_PASSWORD : hash(password));
  const now = new Date();

  const admin = await db
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
