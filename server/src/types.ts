import zod from 'zod';

export type Role = 'admin' | 'volunteer' | 'organization';

export interface UserJWT {
  id: number;
  role: Role;
}

export const loginInfoSchema = zod.object({
  email: zod.email(),
  password: zod.string(),
});

export type LoginInfo = zod.infer<typeof loginInfoSchema>;

export interface GeocodingResponseEntry {
  name: string;
  description: string;
  latitude: number;
  longitude: number;
}

export type GeocodingResponse = GeocodingResponseEntry[];
