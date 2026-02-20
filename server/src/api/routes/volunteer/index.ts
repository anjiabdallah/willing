import bcrypt from 'bcrypt';
import { Router } from 'express';
import * as jose from 'jose';
import zod from 'zod';

import volunteerPostingRouter from './posting.js';
import resetPassword from '../../../auth/resetPassword.js';
import config from '../../../config.js';
import database from '../../../db/index.js';
import { type VolunteerAccountWithoutPassword, newVolunteerAccountSchema, volunteerAccountSchema } from '../../../db/tables.js';
import { authorizeOnly } from '../../authorization.js';

const volunteerRouter = Router();

type VolunteerProfileResponse = {
  volunteer: VolunteerAccountWithoutPassword;
  skills: string[];
};

const volunteerProfileUserUpdateSchema = volunteerAccountSchema.omit({
  id: true,
  password: true,
}).partial();

const volunteerProfileUpdateSchema = volunteerProfileUserUpdateSchema.extend({
  skills: zod.array(zod.string().trim().min(1, 'Skill cannot be empty')).optional(),
});

const getVolunteerProfile = async (volunteerId: number): Promise<VolunteerProfileResponse> => {
  const volunteer = await database
    .selectFrom('volunteer_account')
    .select([
      'id',
      'first_name',
      'last_name',
      'email',
      'date_of_birth',
      'gender',
      'description',
      'privacy',
    ])
    .where('id', '=', volunteerId)
    .executeTakeFirstOrThrow();

  const volunteerSkills = await database
    .selectFrom('volunteer_skill')
    .select('name')
    .where('volunteer_id', '=', volunteerId)
    .orderBy('id', 'asc')
    .execute();

  return {
    volunteer: {
      id: volunteer.id,
      first_name: volunteer.first_name,
      last_name: volunteer.last_name,
      email: volunteer.email,
      date_of_birth: volunteer.date_of_birth,
      gender: volunteer.gender,
      privacy: volunteer.privacy,
      ...(volunteer.description !== undefined ? { description: volunteer.description } : {}),
    },
    skills: volunteerSkills.map(skill => skill.name),
  };
};

volunteerRouter.post('/create', async (req, res) => {
  const body = newVolunteerAccountSchema.parse(req.body);

  const existingVolunteer = await database
    .selectFrom('volunteer_account')
    .select('id')
    .where('email', '=', body.email)
    .executeTakeFirst();

  if (existingVolunteer) {
    res.status(409);
    throw new Error('Account already exists, log in or use another email');
  }

  const hashedPassword = await bcrypt.hash(body.password, 10);

  const newVolunteer = await database
    .insertInto('volunteer_account')
    .values({
      first_name: body.first_name,
      last_name: body.last_name,
      email: body.email,
      password: hashedPassword,
      date_of_birth: body.date_of_birth,
      gender: body.gender,
      privacy: 'public',
    })
    .returningAll()
    .executeTakeFirst();

  if (!newVolunteer) {
    res.status(500);
    throw new Error('Failed to create volunteer');
  }

  const token = await new jose.SignJWT({ id: newVolunteer.id, role: 'volunteer' })
    .setIssuedAt()
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(config.JWT_SECRET));

  // @ts-expect-error: do not return the password
  delete newVolunteer.password;
  res.status(201).json({ volunteer: newVolunteer, token });
});

volunteerRouter.use(authorizeOnly('volunteer'));

volunteerRouter.get('/me', async (req, res) => {
  const volunteer = await database
    .selectFrom('volunteer_account')
    .selectAll()
    .where('id', '=', req.userJWT!.id)
    .executeTakeFirstOrThrow();

  // @ts-expect-error: do not return the password
  delete volunteer.password;

  res.json({ volunteer });
});

volunteerRouter.get('/profile', async (req, res) => {
  const profile = await getVolunteerProfile(req.userJWT!.id);
  res.json(profile);
});

volunteerRouter.put('/profile', async (req, res) => {
  const body = volunteerProfileUpdateSchema.parse(req.body);
  const volunteerId = req.userJWT!.id;

  if (body.email !== undefined) {
    const existingVolunteer = await database
      .selectFrom('volunteer_account')
      .select('id')
      .where('email', '=', body.email)
      .where('id', '!=', volunteerId)
      .executeTakeFirst();

    if (existingVolunteer) {
      res.status(409);
      throw new Error('Another account already uses this email');
    }
  }

  await database.transaction().execute(async (trx) => {
    const volunteerUpdate: Partial<Omit<VolunteerAccountWithoutPassword, 'id'>> = {};

    if (body.first_name !== undefined) volunteerUpdate.first_name = body.first_name;
    if (body.last_name !== undefined) volunteerUpdate.last_name = body.last_name;
    if (body.email !== undefined) volunteerUpdate.email = body.email;
    if (body.date_of_birth !== undefined) volunteerUpdate.date_of_birth = body.date_of_birth;
    if (body.gender !== undefined) volunteerUpdate.gender = body.gender;
    if (body.description !== undefined) volunteerUpdate.description = body.description;
    if (body.privacy !== undefined) volunteerUpdate.privacy = body.privacy;

    if (Object.keys(volunteerUpdate).length > 0) {
      await trx
        .updateTable('volunteer_account')
        .set(volunteerUpdate)
        .where('id', '=', volunteerId)
        .execute();
    }

    if (body.skills !== undefined) {
      const normalizedSkills = Array.from(
        new Set(body.skills.map(skill => skill.trim()).filter(Boolean)),
      );

      await trx
        .deleteFrom('volunteer_skill')
        .where('volunteer_id', '=', volunteerId)
        .execute();

      if (normalizedSkills.length > 0) {
        await trx
          .insertInto('volunteer_skill')
          .values(normalizedSkills.map((name) => ({
            volunteer_id: volunteerId,
            name,
          })))
          .execute();
      }
    }
  });

  const profile = await getVolunteerProfile(volunteerId);
  res.json(profile);
});

volunteerRouter.post('/reset-password', resetPassword);

volunteerRouter.use('/posting', volunteerPostingRouter);

export default volunteerRouter;
