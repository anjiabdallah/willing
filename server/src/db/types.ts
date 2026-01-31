import {
  Generated,
} from 'kysely';

export interface Database {
  volunteer_account: VolunteerAccountTable;
  organization_request: OrganizationRequestTable;
  organization_account: OrganizationAccountTable;
  admin_account: AdminAccountTable;
}

export interface VolunteerAccountTable {
  id: Generated<number>;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  password: string;
  date_of_birth: string;
  gender: 'male' | 'female' | 'other';
}

export interface OrganizationRequestTable {
  id: Generated<number>;
  name: string;
  email: string;
  phone_number: string;
  url: string;
  latitude: string;
  longitude: string;
}

export interface OrganizationAccountTable {
  id: Generated<number>;
  name: string;
  email: string;
  password: string;
  phone_number: string;
  url: string;
  latitude: number;
  longitude: number;
}

export interface AdminAccountTable {
  id: Generated<number>;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}
