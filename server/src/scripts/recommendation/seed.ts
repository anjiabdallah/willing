import fs from 'fs';
import path from 'path';

import { sql } from 'kysely';
import zod from 'zod';

import config from '../../config.ts';
import database from '../../db/index.ts';
import { hash } from '../../services/bcrypt/index.ts';
import { CV_UPLOAD_DIR } from '../../services/uploads/paths.ts';
import {
  writeRecommendationCvPdf,
} from '../data/recommendation/cvPdf.ts';

const PASSWORD_PLAIN = 'Willing123';
const DATASET_PATH = path.resolve('src/scripts/data/recommendation/dataset.json');

const crisisSchema = zod.object({
  id: zod.number().int().positive(),
  code: zod.string().min(1),
  name: zod.string().min(1),
  description: zod.string().optional(),
});

const organizationSchema = zod.object({
  id: zod.number().int().positive(),
  name: zod.string().min(1),
  location_name: zod.string().min(1),
  description: zod.string().optional(),
  causes: zod.array(zod.string().min(1)).optional(),
});

const volunteerSchema = zod.object({
  id: zod.number().int().positive(),
  first_name: zod.string().min(1),
  last_name: zod.string().min(1),
  email: zod.email(),
  gender: zod.enum(['male', 'female', 'other']),
  date_of_birth: zod.string().min(1),
  skills: zod.array(zod.string().min(1)),
  description: zod.string().optional(),
  cv_summary_text: zod.string().optional(),
  cv_pdf_path: zod.string().min(1),
});

const postingSchema = zod.object({
  id: zod.number().int().positive(),
  organization_id: zod.number().int().positive(),
  title: zod.string().min(1),
  description: zod.string().min(1),
  location_name: zod.string().min(1),
  start_datetime: zod.string().datetime({ offset: true }),
  end_datetime: zod.string().datetime({ offset: true }),
  skills_required: zod.array(zod.string().min(1)).default([]),
  crisis_id: zod.number().int().positive().nullable().optional(),
  is_closed: zod.boolean(),
});

const datasetSchema = zod.object({
  crises: zod.array(crisisSchema),
  organizations: zod.array(organizationSchema),
  volunteers: zod.array(volunteerSchema),
  old_postings: zod.array(postingSchema),
  new_postings: zod.array(postingSchema),
  attendance_links: zod.array(zod.object({
    volunteer_id: zod.number().int().positive(),
    old_posting_id: zod.number().int().positive(),
  })),
  expected_matches: zod.array(zod.object({
    volunteer_id: zod.number().int().positive(),
    top_5_new_posting_ids: zod.array(zod.number().int().positive()).length(5),
  })),
});

type RecommendationDataset = zod.infer<typeof datasetSchema>;

type PostingSignalMeta = {
  dbId: number;
  skills: string[];
};

const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

const toWillingEmail = (emailOrHandle: string, fallbackHandle: string) => {
  const source = emailOrHandle.includes('@') ? (emailOrHandle.split('@')[0] ?? '') : emailOrHandle;
  const normalizedHandle = toSlug(source) || toSlug(fallbackHandle) || 'user';
  return `${normalizedHandle}@willing.social`;
};

const toDateAndTime = (isoDateTime: string) => {
  const date = new Date(isoDateTime);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');

  return {
    date: new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`),
    time: `${hh}:${mi}:${ss}`,
  };
};

const resolveDatasetFilePath = (filePath: string) => {
  const direct = path.resolve(filePath);
  if (fs.existsSync(direct)) return direct;

  const fromRepoRoot = path.resolve('..', filePath);
  if (fs.existsSync(fromRepoRoot)) return fromRepoRoot;

  const fromDatasetDir = path.resolve(path.dirname(DATASET_PATH), filePath);
  if (fs.existsSync(fromDatasetDir)) return fromDatasetDir;

  return direct;
};

const estimateLocationCoordinates = (locationName: string) => {
  const normalized = locationName.toLowerCase();
  if (normalized.includes('beirut')) return { latitude: 33.8938, longitude: 35.5018 };
  if (normalized.includes('zahle') || normalized.includes('bekaa')) return { latitude: 33.8467, longitude: 35.9020 };
  if (normalized.includes('jbeil') || normalized.includes('byblos')) return { latitude: 34.1230, longitude: 35.6519 };
  if (normalized.includes('halba') || normalized.includes('akkar')) return { latitude: 34.5420, longitude: 36.0800 };
  if (normalized.includes('saida') || normalized.includes('sidon')) return { latitude: 33.5575, longitude: 35.3715 };
  if (normalized.includes('tripoli')) return { latitude: 34.4367, longitude: 35.8497 };
  if (normalized.includes('tyre') || normalized.includes('sour')) return { latitude: 33.2704, longitude: 35.2038 };
  if (normalized.includes('baalbek')) return { latitude: 34.0067, longitude: 36.2181 };
  if (normalized.includes('nabatieh')) return { latitude: 33.3789, longitude: 35.4839 };

  return { latitude: 33.8938, longitude: 35.5018 };
};

const loadDataset = (): RecommendationDataset => {
  if (!fs.existsSync(DATASET_PATH)) {
    throw new Error(`Dataset file not found at ${DATASET_PATH}`);
  }

  const raw = fs.readFileSync(DATASET_PATH, 'utf8');
  return datasetSchema.parse(JSON.parse(raw));
};

async function seedRecommendationDataset() {
  if (config.NODE_ENV === 'production') {
    throw new Error('Refusing to seed in production.');
  }

  const data = loadDataset();
  const passwordHash = await hash(PASSWORD_PLAIN);

  await sql`
  TRUNCATE TABLE
    enrollment_application_date,
    enrollment_application,
    enrollment,
    posting_skill,
    volunteer_skill,
    organization_posting,
    volunteer_pending_account,
    volunteer_report,
    organization_report,
    platform_certificate_settings,
    organization_certificate_info,
    organization_request,
    volunteer_account,
    organization_account,
    admin_account,
    crisis
  RESTART IDENTITY CASCADE
`.execute(database);

  await fs.promises.mkdir(CV_UPLOAD_DIR, { recursive: true });

  await database.insertInto('admin_account').values({
    first_name: 'Admin',
    last_name: 'User',
    email: 'admin@willing.social',
    password: passwordHash,
  }).execute();

  const crisisIdMap = new Map<number, number>();
  for (const crisis of data.crises) {
    const inserted = await database
      .insertInto('crisis')
      .values({
        name: crisis.name,
        description: crisis.description,
        pinned: false,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    crisisIdMap.set(crisis.id, inserted.id);
  }

  const organizationIdMap = new Map<number, number>();
  const usedEmails = new Set<string>();

  const ensureUniqueEmail = (baseEmail: string, suffixSeed: string) => {
    if (!usedEmails.has(baseEmail)) {
      usedEmails.add(baseEmail);
      return baseEmail;
    }

    let attempt = 2;
    while (true) {
      const local = baseEmail.split('@')[0]!;
      const candidate = `${local}-${toSlug(suffixSeed)}-${attempt}@willing.social`;
      if (!usedEmails.has(candidate)) {
        usedEmails.add(candidate);
        return candidate;
      }
      attempt += 1;
    }
  };

  for (const organization of data.organizations) {
    const location = estimateLocationCoordinates(organization.location_name);
    const baseEmail = organization.id === 1
      ? 'org1@willing.social'
      : `${toSlug(organization.name)}-${organization.id}@willing.social`;
    const email = ensureUniqueEmail(baseEmail, `org-${organization.id}`);

    const inserted = await database
      .insertInto('organization_account')
      .values({
        name: organization.name,
        email,
        phone_number: `+9617000${String(organization.id).padStart(4, '0')}`,
        url: `https://${toSlug(organization.name)}.org`,
        description: organization.description,
        latitude: location.latitude,
        longitude: location.longitude,
        location_name: organization.location_name,
        password: passwordHash,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    organizationIdMap.set(organization.id, inserted.id);
  }

  const volunteerIdMap = new Map<number, number>();
  const volunteerSkillsByDbId = new Map<number, string[]>();
  for (const volunteer of data.volunteers) {
    const cvFileName = `${toSlug(`${volunteer.id}-${volunteer.first_name}-${volunteer.last_name}`)}.pdf`;
    const targetCvPath = path.join(CV_UPLOAD_DIR, cvFileName);
    const sourceCvPath = resolveDatasetFilePath(volunteer.cv_pdf_path);
    if (fs.existsSync(sourceCvPath)) {
      await fs.promises.copyFile(sourceCvPath, targetCvPath);
    } else {
      await writeRecommendationCvPdf(targetCvPath, {
        ...volunteer,
        id: volunteer.id,
        first_name: volunteer.first_name,
        last_name: volunteer.last_name,
      });
    }

    const baseVolunteerEmail = volunteer.id === 1
      ? 'vol1@willing.social'
      : toWillingEmail(volunteer.email, `${volunteer.first_name}-${volunteer.last_name}-${volunteer.id}`);
    const volunteerEmail = ensureUniqueEmail(baseVolunteerEmail, `vol-${volunteer.id}`);

    const inserted = await database
      .insertInto('volunteer_account')
      .values({
        first_name: volunteer.first_name,
        last_name: volunteer.last_name,
        email: volunteerEmail,
        password: passwordHash,
        date_of_birth: volunteer.date_of_birth,
        gender: volunteer.gender,
        description: volunteer.description,
        cv_path: cvFileName,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    volunteerIdMap.set(volunteer.id, inserted.id);
    const normalizedSkills = volunteer.skills.map(skill => skill.trim().toLowerCase()).filter(Boolean);
    volunteerSkillsByDbId.set(inserted.id, normalizedSkills);

    if (normalizedSkills.length > 0) {
      await database.insertInto('volunteer_skill').values(
        normalizedSkills.map(skill => ({
          volunteer_id: inserted.id,
          name: skill,
        })),
      ).execute();
    }
  }

  const backgroundVolunteerProfiles = [
    {
      first_name: 'Rami',
      last_name: 'Ops',
      gender: 'male' as const,
      date_of_birth: '1993-04-11',
      description: 'Background logistics volunteer for realistic enrollment distribution.',
      skills: ['warehouse operations', 'inventory counting', 'dispatch', 'packing', 'route coordination'],
    },
    {
      first_name: 'Maya',
      last_name: 'Health',
      gender: 'female' as const,
      date_of_birth: '1996-09-02',
      description: 'Background health volunteer for intake and registration tasks.',
      skills: ['patient intake', 'registration support', 'health education', 'medication prep', 'documentation'],
    },
    {
      first_name: 'Lina',
      last_name: 'Edu',
      gender: 'female' as const,
      date_of_birth: '2001-01-17',
      description: 'Background education volunteer for tutoring and child support.',
      skills: ['tutoring', 'group facilitation', 'reading support', 'child engagement', 'communication'],
    },
    {
      first_name: 'Nader',
      last_name: 'Env',
      gender: 'male' as const,
      date_of_birth: '1995-07-25',
      description: 'Background environment volunteer for outdoor activities.',
      skills: ['waste sorting', 'cleanup', 'tree planting', 'field coordination', 'public engagement'],
    },
    {
      first_name: 'Hana',
      last_name: 'Support',
      gender: 'female' as const,
      date_of_birth: '1997-03-30',
      description: 'Background community support volunteer.',
      skills: ['beneficiary intake', 'community outreach', 'active listening', 'coordination', 'documentation'],
    },
    {
      first_name: 'Fares',
      last_name: 'Driver',
      gender: 'male' as const,
      date_of_birth: '1992-10-09',
      description: 'Background route and delivery support volunteer.',
      skills: ['driving', 'route planning', 'dispatch support', 'loading', 'time management'],
    },
  ];

  for (let index = 0; index < backgroundVolunteerProfiles.length; index += 1) {
    const profile = backgroundVolunteerProfiles[index]!;
    const email = ensureUniqueEmail(
      `${toSlug(`${profile.first_name}-${profile.last_name}`)}-bg-${index + 1}@willing.social`,
      `bg-vol-${index + 1}`,
    );

    const inserted = await database
      .insertInto('volunteer_account')
      .values({
        first_name: profile.first_name,
        last_name: profile.last_name,
        email,
        password: passwordHash,
        date_of_birth: profile.date_of_birth,
        gender: profile.gender,
        description: profile.description,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    const normalizedSkills = profile.skills.map(skill => skill.trim().toLowerCase()).filter(Boolean);
    volunteerSkillsByDbId.set(inserted.id, normalizedSkills);

    await database.insertInto('volunteer_skill').values(
      normalizedSkills.map(skill => ({
        volunteer_id: inserted.id,
        name: skill,
      })),
    ).execute();
  }

  const oldPostingIdMap = new Map<number, number>();
  const newPostingIdMap = new Map<number, number>();
  const oldPostingSignalMetaByDatasetId = new Map<number, PostingSignalMeta>();
  const newPostingSignalMetaByDatasetId = new Map<number, PostingSignalMeta>();
  const createPosting = async (posting: RecommendationDataset['old_postings'][number], isFromOldSet: boolean) => {
    const organizationId = organizationIdMap.get(posting.organization_id);
    if (!organizationId) {
      throw new Error(`Unknown organization_id in posting ${posting.id}: ${posting.organization_id}`);
    }

    const crisisId = posting.crisis_id === null || posting.crisis_id === undefined
      ? undefined
      : crisisIdMap.get(posting.crisis_id);

    if (posting.crisis_id && !crisisId) {
      throw new Error(`Unknown crisis_id in posting ${posting.id}: ${posting.crisis_id}`);
    }

    const start = toDateAndTime(posting.start_datetime);
    const end = toDateAndTime(posting.end_datetime);
    const location = estimateLocationCoordinates(posting.location_name);

    const insertedPosting = await database
      .insertInto('organization_posting')
      .values({
        organization_id: organizationId,
        crisis_id: crisisId,
        title: posting.title,
        description: posting.description,
        latitude: location.latitude,
        longitude: location.longitude,
        location_name: posting.location_name,
        start_date: start.date,
        start_time: start.time,
        end_date: end.date,
        end_time: end.time,
        automatic_acceptance: posting.id % 3 !== 0,
        is_closed: posting.is_closed,
        allows_partial_attendance: false,
        minimum_age: 18,
        max_volunteers: 40,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    if (posting.skills_required.length > 0) {
      const normalizedPostingSkills = posting.skills_required.map(skill => skill.trim().toLowerCase()).filter(Boolean);
      await database
        .insertInto('posting_skill')
        .values(
          normalizedPostingSkills.map(skill => ({
            posting_id: insertedPosting.id,
            name: skill,
          })),
        )
        .execute();

      if (isFromOldSet) {
        oldPostingSignalMetaByDatasetId.set(posting.id, { dbId: insertedPosting.id, skills: normalizedPostingSkills });
      } else {
        newPostingSignalMetaByDatasetId.set(posting.id, { dbId: insertedPosting.id, skills: normalizedPostingSkills });
      }
    } else if (isFromOldSet) {
      oldPostingSignalMetaByDatasetId.set(posting.id, { dbId: insertedPosting.id, skills: [] });
    } else {
      newPostingSignalMetaByDatasetId.set(posting.id, { dbId: insertedPosting.id, skills: [] });
    }

    if (isFromOldSet) {
      oldPostingIdMap.set(posting.id, insertedPosting.id);
    } else {
      newPostingIdMap.set(posting.id, insertedPosting.id);
    }
  };

  for (const posting of data.old_postings) {
    await createPosting(posting, true);
  }

  for (const posting of data.new_postings) {
    await createPosting(posting, false);
  }

  const enrollmentPairs = new Set<string>();
  const enrollmentCountByPostingId = new Map<number, number>();
  const volunteerSignalUsageCount = new Map<number, number>();
  const attendedCountByVolunteerId = new Map<number, number>();
  const TARGET_HISTORY_COVERAGE = 0.9;
  const TARGET_ATTENDED_PER_VOLUNTEER = 2;

  const addEnrollment = async (
    volunteerId: number,
    postingId: number,
    attended: boolean,
    message: string,
  ) => {
    const pairKey = `${volunteerId}:${postingId}`;
    if (enrollmentPairs.has(pairKey)) return;

    await database
      .insertInto('enrollment')
      .values({
        volunteer_id: volunteerId,
        posting_id: postingId,
        attended,
        message,
      })
      .execute();

    enrollmentPairs.add(pairKey);
    enrollmentCountByPostingId.set(postingId, (enrollmentCountByPostingId.get(postingId) ?? 0) + 1);
    volunteerSignalUsageCount.set(volunteerId, (volunteerSignalUsageCount.get(volunteerId) ?? 0) + 1);
    if (attended) {
      attendedCountByVolunteerId.set(volunteerId, (attendedCountByVolunteerId.get(volunteerId) ?? 0) + 1);
    }
  };

  for (const attendance of data.attendance_links) {
    const volunteerId = volunteerIdMap.get(attendance.volunteer_id);
    const postingId = oldPostingIdMap.get(attendance.old_posting_id);

    if (!volunteerId || !postingId) {
      throw new Error(`Invalid attendance link: volunteer_id=${attendance.volunteer_id}, old_posting_id=${attendance.old_posting_id}`);
    }

    await addEnrollment(
      volunteerId,
      postingId,
      true,
      'Completed seeded attendance record',
    );
  }

  const getSignalVolunteersByFit = (postingSkills: string[], limit: number) => {
    const postingSkillSet = new Set(postingSkills.map(skill => skill.toLowerCase()));
    const ranked = Array.from(volunteerSkillsByDbId.entries())
      .map(([volunteerId, skills]) => {
        const overlap = skills.reduce((count, skill) => count + (postingSkillSet.has(skill) ? 1 : 0), 0);
        const usagePenalty = (volunteerSignalUsageCount.get(volunteerId) ?? 0) * 0.15;
        const score = overlap - usagePenalty;
        return { volunteerId, overlap, score };
      })
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (right.overlap !== left.overlap) return right.overlap - left.overlap;
        return left.volunteerId - right.volunteerId;
      })
      .slice(0, Math.max(1, limit));

    return ranked;
  };

  const oldPostingSignalMetas = Array.from(oldPostingSignalMetaByDatasetId.values());

  const getRankedOldPostingsByFit = (volunteerId: number, limit: number) => {
    const volunteerSkills = volunteerSkillsByDbId.get(volunteerId) ?? [];
    const volunteerSkillSet = new Set(volunteerSkills.map(skill => skill.toLowerCase()));
    return oldPostingSignalMetas
      .map((postingMeta) => {
        const overlap = postingMeta.skills.reduce(
          (count, skill) => count + (volunteerSkillSet.has(skill.toLowerCase()) ? 1 : 0),
          0,
        );
        const loadPenalty = (enrollmentCountByPostingId.get(postingMeta.dbId) ?? 0) * 0.05;
        const score = overlap - loadPenalty;
        return { postingId: postingMeta.dbId, overlap, score };
      })
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (right.overlap !== left.overlap) return right.overlap - left.overlap;
        return left.postingId - right.postingId;
      })
      .slice(0, Math.max(1, limit));
  };

  const ensureVolunteerHistoricalAttendances = async (
    volunteerId: number,
    minAttendedCount: number,
    allowZeroOverlapFallback: boolean,
  ) => {
    let currentCount = attendedCountByVolunteerId.get(volunteerId) ?? 0;
    if (currentCount >= minAttendedCount) return;

    const ranked = getRankedOldPostingsByFit(volunteerId, 30);
    for (const candidate of ranked) {
      if (candidate.overlap <= 0 && !allowZeroOverlapFallback) continue;
      await addEnrollment(
        volunteerId,
        candidate.postingId,
        true,
        'Seeded historical participation enrichment',
      );
      currentCount = attendedCountByVolunteerId.get(volunteerId) ?? 0;
      if (currentCount >= minAttendedCount) break;
    }
  };

  for (const postingMeta of oldPostingSignalMetaByDatasetId.values()) {
    if ((enrollmentCountByPostingId.get(postingMeta.dbId) ?? 0) > 0) continue;

    const ranked = getSignalVolunteersByFit(postingMeta.skills, 1);
    const volunteerId = ranked[0]?.volunteerId;
    if (!volunteerId || (ranked[0]?.overlap ?? 0) <= 0) continue;
    await addEnrollment(
      volunteerId,
      postingMeta.dbId,
      true,
      'Seeded historical participation signal',
    );
  }

  const allVolunteerIds = Array.from(volunteerSkillsByDbId.keys()).sort((left, right) => left - right);
  for (const volunteerId of allVolunteerIds) {
    await ensureVolunteerHistoricalAttendances(volunteerId, TARGET_ATTENDED_PER_VOLUNTEER, false);
  }

  const requiredWithHistory = Math.ceil(allVolunteerIds.length * TARGET_HISTORY_COVERAGE);
  let volunteerIdsWithHistory = allVolunteerIds.filter(
    volunteerId => (attendedCountByVolunteerId.get(volunteerId) ?? 0) > 0,
  );

  if (volunteerIdsWithHistory.length < requiredWithHistory) {
    const withoutHistory = allVolunteerIds.filter(
      volunteerId => (attendedCountByVolunteerId.get(volunteerId) ?? 0) === 0,
    );

    for (const volunteerId of withoutHistory) {
      await ensureVolunteerHistoricalAttendances(volunteerId, 1, true);
      volunteerIdsWithHistory = allVolunteerIds.filter(
        id => (attendedCountByVolunteerId.get(id) ?? 0) > 0,
      );
      if (volunteerIdsWithHistory.length >= requiredWithHistory) break;
    }
  }

  let processedNewPostingSignals = 0;
  for (const [datasetPostingId, postingMeta] of newPostingSignalMetaByDatasetId.entries()) {
    // Keep present-day enrollment signals realistic without saturating all opportunities.
    if (datasetPostingId % 3 === 0) continue;
    if ((enrollmentCountByPostingId.get(postingMeta.dbId) ?? 0) > 0) continue;

    const ranked = getSignalVolunteersByFit(postingMeta.skills, 8);
    const primaryCohort = ranked.filter(candidate => candidate.overlap >= 2).slice(0, 3);
    const secondaryCohort = ranked.filter(candidate => candidate.overlap >= 1).slice(0, 2);
    const selected = primaryCohort.length > 0
      ? primaryCohort
      : secondaryCohort;

    for (const candidate of selected) {
      await addEnrollment(
        candidate.volunteerId,
        postingMeta.dbId,
        false,
        'Seeded active enrollment signal',
      );
    }

    // Keep a low anomaly rate so recommendations stay realistic but not synthetic-perfect.
    const shouldAddAnomaly = processedNewPostingSignals % 12 === 0;
    if (shouldAddAnomaly) {
      const anomaly = ranked
        .filter(candidate => candidate.overlap === 0)
        .sort((left, right) => (volunteerSignalUsageCount.get(left.volunteerId) ?? 0) - (volunteerSignalUsageCount.get(right.volunteerId) ?? 0))[0];

      if (anomaly) {
        await addEnrollment(
          anomaly.volunteerId,
          postingMeta.dbId,
          false,
          'Seeded anomaly enrollment signal',
        );
      }
    }

    processedNewPostingSignals += 1;
  }

  console.log('─────────────────────────────────────────────');
  const finalVolunteerIdsWithHistory = allVolunteerIds.filter(
    volunteerId => (attendedCountByVolunteerId.get(volunteerId) ?? 0) > 0,
  );
  console.log('Recommendation dataset seeded successfully.');
  console.log(`Dataset: ${DATASET_PATH}`);
  console.log(`Crises: ${data.crises.length}`);
  console.log(`Organizations: ${data.organizations.length}`);
  console.log(`Volunteers: ${data.volunteers.length}`);
  console.log(`Old postings: ${data.old_postings.length}`);
  console.log(`New postings: ${data.new_postings.length}`);
  console.log(`Attendances (dataset links): ${data.attendance_links.length}`);
  console.log(`Total seeded enrollments: ${enrollmentPairs.size}`);
  console.log(`Volunteers with attended history: ${finalVolunteerIdsWithHistory.length}/${allVolunteerIds.length}`);
  console.log(`Password (all accounts): ${PASSWORD_PLAIN}`);

  await database.destroy();
}

seedRecommendationDataset().catch(async (error) => {
  console.error('Recommendation seed failed:', error);
  try {
    await database.destroy();
  } catch {
    // ignore cleanup errors
  }
  process.exit(1);
});
