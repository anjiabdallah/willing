import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { sql } from 'kysely';

import config from '../config.ts';
import database from '../db/index.ts';
import { hash } from '../services/bcrypt/index.ts';

const PASSWORD_PLAIN = process.argv[2] || 'Willing123';

async function seed() {
  const passwordHash = await hash(PASSWORD_PLAIN);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const SEED_LOGOS_DIR = path.resolve(__dirname, 'seed-assets/org-logos');
  const DEST_LOGOS_DIR = path.resolve(config.UPLOAD_DIR, 'org-logos');
  fs.mkdirSync(DEST_LOGOS_DIR, { recursive: true });
  for (const file of fs.readdirSync(SEED_LOGOS_DIR)) {
    fs.copyFileSync(
      path.join(SEED_LOGOS_DIR, file),
      path.join(DEST_LOGOS_DIR, file),
    );
  }

  const SEED_ORG_SIGNATURES_DIR = path.resolve(__dirname, 'seed-assets/org-signatures');
  const DEST_ORG_SIGNATURES_DIR = path.resolve(config.UPLOAD_DIR, 'org-signatures');
  fs.mkdirSync(DEST_ORG_SIGNATURES_DIR, { recursive: true });
  for (const file of fs.readdirSync(SEED_ORG_SIGNATURES_DIR)) {
    fs.copyFileSync(
      path.join(SEED_ORG_SIGNATURES_DIR, file),
      path.join(DEST_ORG_SIGNATURES_DIR, file),
    );
  }

  const SEED_PLATFORM_SIGNATURES_DIR = path.resolve(__dirname, 'seed-assets/platform-signatures');
  const DEST_PLATFORM_SIGNATURES_DIR = path.resolve(config.UPLOAD_DIR, 'platform-signatures');
  fs.mkdirSync(DEST_PLATFORM_SIGNATURES_DIR, { recursive: true });
  for (const file of fs.readdirSync(SEED_PLATFORM_SIGNATURES_DIR)) {
    fs.copyFileSync(
      path.join(SEED_PLATFORM_SIGNATURES_DIR, file),
      path.join(DEST_PLATFORM_SIGNATURES_DIR, file),
    );
  }

  const SEED_CVS_DIR = path.resolve(__dirname, 'seed-assets/vol-cvs');
  const DEST_CVS_DIR = path.resolve(config.UPLOAD_DIR, 'cvs');
  fs.mkdirSync(DEST_CVS_DIR, { recursive: true });
  for (const file of fs.readdirSync(SEED_CVS_DIR)) {
    fs.copyFileSync(path.join(SEED_CVS_DIR, file), path.join(DEST_CVS_DIR, file));
  }

  await sql`
  TRUNCATE TABLE
    enrollment_application_date,
    enrollment_date,
    enrollment_application,
    enrollment,
    posting_skill,
    volunteer_skill,
    posting,
    platform_certificate_settings,
    organization_certificate_info,
    volunteer_pending_account,
    organization_request,
    volunteer_account,
    organization_account,
    admin_account,
    crisis
  RESTART IDENTITY CASCADE
`.execute(database);

  await database.insertInto('admin_account').values({
    first_name: 'Admin',
    last_name: 'User',
    email: 'admin@willing.social',
    password: passwordHash,
  }).execute();

  await database.insertInto('platform_certificate_settings').values({
    signatory_name: 'Willing Platform',
    signatory_position: 'Volunteer Program Director',
    signature_path: 'willing-platform-signature.png',
    signature_uploaded_by_admin_id: 1,
  }).execute();

  const now = new Date();

  /** Return a UTC Date that is `offsetDays` from today, at the given HH:MM. */
  const relDate = (offsetDays: number, hh = 0, mm = 0, ss = 0): Date => {
    const d = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + offsetDays,
      hh, mm, ss,
    ));
    return d;
  };

  const toIsoDate = (value: Date) => {
    const year = value.getUTCFullYear();
    const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${value.getUTCDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDate = (value: Date) => {
    const year = value.getUTCFullYear();
    const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${value.getUTCDate()}`.padStart(2, '0');
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  };

  const formatTime = (value: Date) => {
    const hours = `${value.getUTCHours()}`.padStart(2, '0');
    const minutes = `${value.getUTCMinutes()}`.padStart(2, '0');
    const seconds = `${value.getUTCSeconds()}`.padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  /**
   * Build the four temporal columns from two Date objects.
   * If `end` is omitted, the posting is single-day (same date for start & end).
   */
  const bt = (start: Date, end?: Date) => {
    const e = end ?? start;
    return {
      start_date: formatDate(start),
      start_time: formatTime(start),
      end_date: formatDate(e),
      end_time: formatTime(e),
    };
  };

  const getDateRange = (startDate: Date, endDate: Date) => {
    const dates: string[] = [];
    const cursor = new Date(Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
    ));
    const end = new Date(Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate(),
    ));
    while (cursor.getTime() <= end.getTime()) {
      dates.push(toIsoDate(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  };

  // Organization certificate infos

  const certInfoValues = [
    {
      certificate_feature_enabled: true,
      hours_threshold: 8,
      signatory_name: 'Mira Khoury',
      signatory_position: 'Programs Director',
      signature_path: 'nour-relief-signature.png',
    },
    {
      certificate_feature_enabled: false,
      hours_threshold: 20,
      signatory_name: 'Rani Hayek',
      signatory_position: 'North Lebanon Coordinator',
      signature_path: 'ajialouna-signature.png',
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: 5,
      signatory_name: 'Fadi Daher',
      signatory_position: 'Community Partnerships Lead',
      signature_path: 'arz-community-signature.png',
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: 6,
      signatory_name: 'Nadine Saliba',
      signatory_position: 'Executive Director',
      signature_path: 'cedar-response-signature.png',
    },
    {
      certificate_feature_enabled: false,
      hours_threshold: null,
      signatory_name: null,
      signatory_position: null,
      signature_path: null,
    },
    {
      certificate_feature_enabled: false,
      hours_threshold: null,
      signatory_name: null,
      signatory_position: null,
      signature_path: null,
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: 5,
      signatory_name: 'Rima Jouni',
      signatory_position: 'Director',
      signature_path: 'inssan-signature.png',
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: null,
      signatory_name: null,
      signatory_position: null,
      signature_path: null,
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: 6,
      signatory_name: 'Lena Chehade',
      signatory_position: 'Operations Manager',
      signature_path: 'lfb-signature.png',
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: 8,
      signatory_name: 'Joseph Matta',
      signatory_position: 'CEO',
      signature_path: 'arc-en-ciel-signature.png',
    },
    {
      certificate_feature_enabled: false,
      hours_threshold: null,
      signatory_name: null,
      signatory_position: null,
      signature_path: null,
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: 4,
      signatory_name: 'Sana Itani',
      signatory_position: 'Programs Lead',
      signature_path: 'green-hand-signature.png',
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: 6,
      signatory_name: 'Ahmad Safa',
      signatory_position: 'Executive Director',
      signature_path: 'basmeh-signature.png',
    },
    {
      certificate_feature_enabled: false,
      hours_threshold: null,
      signatory_name: null,
      signatory_position: null,
      signature_path: null,
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: 5,
      signatory_name: 'Hana Khachab',
      signatory_position: 'Country Director',
      signature_path: 'sawa-signature.png',
    },
    {
      certificate_feature_enabled: false,
      hours_threshold: null,
      signatory_name: null,
      signatory_position: null,
      signature_path: null,
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: 6,
      signatory_name: 'Ziad Nassar',
      signatory_position: 'Director',
      signature_path: 'beyond-signature.png',
    },
    {
      certificate_feature_enabled: false,
      hours_threshold: null,
      signatory_name: null,
      signatory_position: null,
      signature_path: null,
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: 8,
      signatory_name: 'Kamel Mohanna',
      signatory_position: 'President',
      signature_path: 'amel-signature.png',
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: null,
      signatory_name: null,
      signatory_position: null,
      signature_path: null,
    },
    {
      certificate_feature_enabled: false,
      hours_threshold: null,
      signatory_name: null,
      signatory_position: null,
      signature_path: null,
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: 10,
      signatory_name: 'George Kettaneh',
      signatory_position: 'Secretary General',
      signature_path: 'lrc-signature.png',
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: 6,
      signatory_name: 'Maya Semaan',
      signatory_position: 'Country Representative',
      signature_path: 'tdh-signature.png',
    },
    {
      certificate_feature_enabled: false,
      hours_threshold: null,
      signatory_name: null,
      signatory_position: null,
      signature_path: null,
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: 5,
      signatory_name: 'Sara Minkara',
      signatory_position: 'Co-Founder',
      signature_path: 'nawaya-signature.png',
    },
    {
      certificate_feature_enabled: false,
      hours_threshold: null,
      signatory_name: null,
      signatory_position: null,
      signature_path: null,
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: 4,
      signatory_name: 'Omar Salam',
      signatory_position: 'Chairman',
      signature_path: 'sidon-welfare-signature.png',
    },
    {
      certificate_feature_enabled: false,
      hours_threshold: null,
      signatory_name: null,
      signatory_position: null,
      signature_path: null,
    },
    {
      certificate_feature_enabled: true,
      hours_threshold: 6,
      signatory_name: 'Hind Beydoun',
      signatory_position: 'Director',
      signature_path: 'slen-signature.png',
    },
    {
      certificate_feature_enabled: false,
      hours_threshold: null,
      signatory_name: null,
      signatory_position: null,
      signature_path: null,
    },
  ];

  const certInfoRows = await database.insertInto('organization_certificate_info')
    .values(certInfoValues)
    .returning(['id'])
    .execute();

  const certId = (idx: number) => certInfoRows[idx]!.id;

  // Organizations

  const orgs = await database.insertInto('organization_account')
    .values([
      {
        name: 'Nour Relief',
        email: 'org1@willing.social',
        phone_number: '+96101234567',
        url: 'https://nourrelief.org',
        latitude: 33.8938,
        longitude: 35.5018,
        location_name: 'Beirut',
        description: 'Emergency relief NGO coordinating shelter, food, and health support across Beirut.',
        logo_path: 'nour-relief.png',
        certificate_info_id: certId(0),
        password: passwordHash,
      },
      {
        name: 'Ajialouna',
        email: 'org2@willing.social',
        phone_number: '+96107654321',
        url: 'https://ajialouna.org.lb',
        latitude: 33.3547,
        longitude: 35.4955,
        location_name: 'Saida',
        description: 'Youth-focused nonprofit delivering educational and inclusive community programming in South Lebanon.',
        logo_path: 'ajialouna.png',
        certificate_info_id: certId(1),
        password: passwordHash,
      },
      {
        name: 'Arz Community',
        email: 'org3@willing.social',
        phone_number: '+96106112233',
        url: 'https://arzcommunity.org',
        latitude: 34.4367,
        longitude: 35.8333,
        location_name: 'Tripoli',
        description: 'North Lebanon volunteer network supporting environmental recovery and neighborhood resilience.',
        logo_path: 'arz-community.png',
        certificate_info_id: certId(2),
        password: passwordHash,
      },
      {
        name: 'Cedar Response',
        email: 'org4@willing.social',
        phone_number: '+96181777000',
        url: 'https://cedarresponse.org',
        latitude: 33.8889,
        longitude: 35.4942,
        location_name: 'Beirut',
        description: 'Rapid-response nonprofit focused on volunteer coordination, hotline support, and urban recovery.',
        logo_path: 'cedar-response.png',
        certificate_info_id: certId(3),
        password: passwordHash,
      },
      {
        name: 'Bekaa Uplift',
        email: 'org5@willing.social',
        phone_number: '+96188881111',
        url: 'https://bekaauplift.org',
        latitude: 33.8462,
        longitude: 35.9020,
        location_name: 'Zahle',
        description: 'Bekaa-based community organization supporting farms, schools, and flood recovery efforts.',
        logo_path: 'bekaa-uplift.png',
        certificate_info_id: certId(4),
        password: passwordHash,
      },
      {
        name: 'Life Organization',
        email: 'org6@willing.social',
        phone_number: '+96199990000',
        url: 'https://life-organization.example.social',
        latitude: 33.5000,
        longitude: 35.5000,
        location_name: 'Test Beirut',
        description: 'Fraudulent organization seeded for manual reporting and disable-account testing.',
        logo_path: 'life-organization.png',
        certificate_info_id: certId(5),
        password: passwordHash,
      },
      {
        name: 'Inssan',
        email: 'org7@willing.social',
        phone_number: '+96170123456',
        url: 'https://inssan.org',
        latitude: 33.8900,
        longitude: 35.5050,
        location_name: 'Beirut',
        description: 'Inssan works with marginalized communities across Lebanon, focusing on human rights, asylum seekers, and stateless persons.',
        logo_path: 'inssan.png',
        certificate_info_id: certId(6),
        password: passwordHash,
      },
      {
        name: 'Offre Joie',
        email: 'org8@willing.social',
        phone_number: '+96104567890',
        url: 'https://offrejoie.org',
        latitude: 33.8750,
        longitude: 35.5200,
        location_name: 'Beirut',
        description: 'Nationwide volunteer movement rebuilding homes, restoring public spaces, and planting hope across Lebanon.',
        logo_path: null,
        certificate_info_id: certId(7),
        password: passwordHash,
      },
      {
        name: 'Lebanese Food Bank',
        email: 'org9@willing.social',
        phone_number: '+96101987654',
        url: 'https://foodbanklb.org',
        latitude: 33.8720,
        longitude: 35.4980,
        location_name: 'Beirut',
        description: 'Collecting and distributing surplus food to vulnerable families and institutions across Lebanon.',
        logo_path: 'lfb.png',
        certificate_info_id: certId(8),
        password: passwordHash,
      },
      {
        name: 'Arc en Ciel',
        email: 'org10@willing.social',
        phone_number: '+96101765432',
        url: 'https://arcenciel.org',
        latitude: 33.8800,
        longitude: 35.4900,
        location_name: 'Beirut',
        description: 'Development and humanitarian organization supporting people with disabilities and vulnerable populations across Lebanon.',
        logo_path: 'arc-en-ciel.png',
        certificate_info_id: certId(9),
        password: passwordHash,
      },
      {
        name: 'Embracing Differences',
        email: 'org11@willing.social',
        phone_number: '+96103456789',
        url: 'https://embracingdifferences.org',
        latitude: 33.8860,
        longitude: 35.5080,
        location_name: 'Beirut',
        description: 'Promoting inclusive education and disability rights through awareness campaigns and school programming.',
        logo_path: 'embracing-differences.png',
        certificate_info_id: certId(10),
        password: passwordHash,
      },
      {
        name: 'Green Hand',
        email: 'org12@willing.social',
        phone_number: '+96170889900',
        url: 'https://greenhandlb.org',
        latitude: 33.8500,
        longitude: 35.5300,
        location_name: 'Beirut',
        description: 'Environmental NGO leading urban greening, coastal cleanups, and climate awareness across Lebanon.',
        logo_path: 'green-hand.png',
        certificate_info_id: certId(11),
        password: passwordHash,
      },
      {
        name: 'Basmeh & Zeitooneh',
        email: 'org13@willing.social',
        phone_number: '+96101223344',
        url: 'https://basmeh.org',
        latitude: 33.8670,
        longitude: 35.5100,
        location_name: 'Beirut',
        description: 'Serving refugee and host communities in Lebanon with education, livelihoods, and emergency relief.',
        logo_path: 'basmeh.png',
        certificate_info_id: certId(12),
        password: passwordHash,
      },
      {
        name: 'Kayany Foundation',
        email: 'org14@willing.social',
        phone_number: '+96103334455',
        url: 'https://kayany.org',
        latitude: 33.8830,
        longitude: 35.5120,
        location_name: 'Beirut',
        description: 'Providing Syrian refugee children with quality education and psychosocial support in Lebanon.',
        logo_path: null,
        certificate_info_id: certId(13),
        password: passwordHash,
      },
      {
        name: 'Sawa for Development',
        email: 'org15@willing.social',
        phone_number: '+96170556677',
        url: 'https://sawa.org.lb',
        latitude: 33.5300,
        longitude: 35.3700,
        location_name: 'Saida',
        description: 'Sawa supports vulnerable women and families in South Lebanon through economic empowerment and legal aid.',
        logo_path: 'sawa.png',
        certificate_info_id: certId(14),
        password: passwordHash,
      },
      {
        name: 'Restart Center',
        email: 'org16@willing.social',
        phone_number: '+96103667788',
        url: 'https://restartcenter.org',
        latitude: 33.8910,
        longitude: 35.5010,
        location_name: 'Beirut',
        description: 'Rehabilitation and reintegration services for survivors of torture and organized violence.',
        logo_path: 'restart.png',
        certificate_info_id: certId(15),
        password: passwordHash,
      },
      {
        name: 'Beyond',
        email: 'org17@willing.social',
        phone_number: '+96101778899',
        url: 'https://beyondassociation.org',
        latitude: 33.8780,
        longitude: 35.4960,
        location_name: 'Beirut',
        description: 'Empowering Lebanese youth through leadership programs, civic education, and community service.',
        logo_path: 'beyond.png',
        certificate_info_id: certId(16),
        password: passwordHash,
      },
      {
        name: 'Skoun',
        email: 'org18@willing.social',
        phone_number: '+96101889900',
        url: 'https://skoun.org',
        latitude: 33.8820,
        longitude: 35.5000,
        location_name: 'Beirut',
        description: 'Lebanon\'s leading organization addressing drug use through treatment, outreach, and harm reduction.',
        logo_path: null,
        certificate_info_id: certId(17),
        password: passwordHash,
      },
      {
        name: 'Amel Association',
        email: 'org19@willing.social',
        phone_number: '+96101990011',
        url: 'https://amel.org',
        latitude: 33.5600,
        longitude: 35.3800,
        location_name: 'Saida',
        description: 'One of Lebanon\'s largest development organizations, providing health, education, and social services since 1979.',
        logo_path: 'amel.png',
        certificate_info_id: certId(18),
        password: passwordHash,
      },
      {
        name: 'Arcenciel Tripoli',
        email: 'org20@willing.social',
        phone_number: '+96106223344',
        url: 'https://arcenciel-tripoli.org',
        latitude: 34.4400,
        longitude: 35.8360,
        location_name: 'Tripoli',
        description: 'Branch of Arc en Ciel providing disability support, recycling programs, and economic inclusion in North Lebanon.',
        logo_path: null,
        certificate_info_id: certId(19),
        password: passwordHash,
      },
      {
        name: 'Himaya',
        email: 'org21@willing.social',
        phone_number: '+96101334455',
        url: 'https://himaya.org',
        latitude: 33.8840,
        longitude: 35.5060,
        location_name: 'Beirut',
        description: 'Child protection organization working to prevent abuse, support survivors, and reform protective systems in Lebanon.',
        logo_path: 'himaya.png',
        certificate_info_id: certId(20),
        password: passwordHash,
      },
      {
        name: 'Lebanese Red Cross Beirut',
        email: 'org22@willing.social',
        phone_number: '+96101372372',
        url: 'https://redcross.org.lb',
        latitude: 33.8870,
        longitude: 35.5040,
        location_name: 'Beirut',
        description: 'Emergency response, blood services, and first aid training for communities across Greater Beirut.',
        logo_path: 'lrc.png',
        certificate_info_id: certId(21),
        password: passwordHash,
      },
      {
        name: 'Terre des hommes Lebanon',
        email: 'org23@willing.social',
        phone_number: '+96101741741',
        url: 'https://tdh.ch/en/countries/middle-east/lebanon',
        latitude: 33.8760,
        longitude: 35.5080,
        location_name: 'Beirut',
        description: 'International child protection NGO delivering education, psychosocial support, and child rights programs in Lebanon.',
        logo_path: 'tdh.png',
        certificate_info_id: certId(22),
        password: passwordHash,
      },
      {
        name: 'Impact Lebanon',
        email: 'org24@willing.social',
        phone_number: '+96103778899',
        url: 'https://impactlebanon.org',
        latitude: 33.8930,
        longitude: 35.5070,
        location_name: 'Beirut',
        description: 'Diaspora-driven platform channeling global Lebanese support into verified local relief and development projects.',
        logo_path: 'impact-lebanon.png',
        certificate_info_id: certId(23),
        password: passwordHash,
      },
      {
        name: 'Nawaya Network',
        email: 'org25@willing.social',
        phone_number: '+96101556644',
        url: 'https://nawaya.org',
        latitude: 33.8810,
        longitude: 35.5010,
        location_name: 'Beirut',
        description: 'Supporting vulnerable youth through entrepreneurship training, mentorship, and employment pathways.',
        logo_path: 'nawaya.png',
        certificate_info_id: certId(24),
        password: passwordHash,
      },
      {
        name: 'Akkar Network for Development',
        email: 'org26@willing.social',
        phone_number: '+96106445566',
        url: 'https://and-lb.org',
        latitude: 34.5600,
        longitude: 36.0700,
        location_name: 'Akkar',
        description: 'Grassroots network empowering Akkar communities through agricultural support, youth programs, and civic participation.',
        logo_path: 'and.png',
        certificate_info_id: certId(25),
        password: passwordHash,
      },
      {
        name: 'Sidon Welfare Association',
        email: 'org27@willing.social',
        phone_number: '+96107223311',
        url: 'https://sidonwelfare.org.lb',
        latitude: 33.5570,
        longitude: 35.3730,
        location_name: 'Saida',
        description: 'Longstanding charity providing healthcare, education, and poverty relief to families in Saida and surroundings.',
        logo_path: 'sidon-welfare.png',
        certificate_info_id: certId(26),
        password: passwordHash,
      },
      {
        name: 'Tyre Community Foundation',
        email: 'org28@willing.social',
        phone_number: '+96107334422',
        url: 'https://tyrecf.org',
        latitude: 33.2705,
        longitude: 35.2038,
        location_name: 'Tyre',
        description: 'Local foundation preserving the cultural heritage and improving the livelihoods of residents in the Tyre region.',
        logo_path: 'tyre-cf.png',
        certificate_info_id: certId(27),
        password: passwordHash,
      },
      {
        name: 'South Lebanon Education Network',
        email: 'org29@willing.social',
        phone_number: '+96107556677',
        url: 'https://slen.org.lb',
        latitude: 33.4000,
        longitude: 35.4900,
        location_name: 'South Lebanon',
        description: 'Network of educators and volunteers bridging educational gaps for public school students across South Lebanon.',
        logo_path: 'slen.png',
        certificate_info_id: certId(28),
        password: passwordHash,
      },
      {
        name: 'Zahle Youth Council',
        email: 'org30@willing.social',
        phone_number: '+96108667788',
        url: 'https://zahleyouth.org',
        latitude: 33.8500,
        longitude: 35.9050,
        location_name: 'Zahle',
        description: 'Youth-led council in the Bekaa driving civic engagement, local cleanup campaigns, and sports initiatives.',
        logo_path: 'zahle-youth.png',
        certificate_info_id: certId(29),
        password: passwordHash,
      },
    ])
    .returning(['id', 'name'])
    .execute();

  const orgByName = new Map(orgs.map(o => [o.name, o.id]));

  // Pending onboarding requests

  await database.insertInto('organization_request').values([
    {
      name: 'Watan Foundation',
      email: 'watan-bekaa@willing.social',
      phone_number: '+96108910910',
      url: 'https://watanfoundation.org',
      latitude: 33.8497,
      longitude: 35.9016,
      location_name: 'Zahle, Bekaa',
    },
    {
      name: 'Shabab Liban',
      email: 'shababLiban@willing.social',
      phone_number: '+96104542542',
      url: 'https://shababLiban.org',
      latitude: 33.8333,
      longitude: 35.6167,
      location_name: 'Baabda, Mount Lebanon',
    },
    {
      name: 'Amal Child Care',
      email: 'amalchildcare@willing.social',
      phone_number: '+96101480480',
      url: 'https://amalchildcare.org',
      latitude: 33.9000,
      longitude: 35.4800,
      location_name: 'Beirut',
    },
  ]).execute();

  // Volunteers

  const volunteerValues = [
    { first_name: 'Karim', last_name: 'Mansour', email: 'vol1@willing.social', gender: 'male', date_of_birth: '1998-03-15', description: 'Experienced in field logistics and heavy lifting. Reliable in high-pressure environments.', cv_path: 'karim-mansour-cv.pdf' },
    { first_name: 'Aya', last_name: 'Sadek', email: 'vol2@willing.social', gender: 'female', date_of_birth: '2000-07-22', description: 'Former student tutor with strong communication skills and a passion for education.', cv_path: 'aya-sadek-cv.pdf' },
    { first_name: 'Jad', last_name: 'Nassar', email: 'vol3@willing.social', gender: 'male', date_of_birth: '1996-11-04', description: 'Paramedic student with first aid certification and crisis response training.', cv_path: 'jad-nassar-cv.pdf' },
    { first_name: 'Hala', last_name: 'Farah', email: 'vol4@willing.social', gender: 'female', date_of_birth: '1994-01-30', description: 'Social worker background. Comfortable with elderly care and emotional support.', cv_path: null },
    { first_name: 'Tarek', last_name: 'Slim', email: 'vol5@willing.social', gender: 'male', date_of_birth: '2001-09-18', description: 'Environmentally conscious and physically fit. Loves outdoor community work.', cv_path: null },
    { first_name: 'Nina', last_name: 'Choufany', email: 'vol6@willing.social', gender: 'female', date_of_birth: '2002-05-11', description: 'Art teacher background. Great with children and creative activities.', cv_path: null },
    { first_name: 'Marc', last_name: 'Hamamji', email: 'vol7@willing.social', gender: 'male', date_of_birth: '1999-12-01', description: 'Software developer who volunteers for tech literacy programs and remote support.', cv_path: null },
    { first_name: 'Rana', last_name: 'Saad', email: 'vol8@willing.social', gender: 'female', date_of_birth: '1997-08-25', description: 'Catering background. Expert in food prep and community kitchen coordination.', cv_path: null },
    { first_name: 'Ziad', last_name: 'Bou Habib', email: 'vol9@willing.social', gender: 'male', date_of_birth: '2003-02-14', description: 'Detail-oriented and great at organizing and sorting donated supplies.', cv_path: null },
    { first_name: 'Maya', last_name: 'Tannous', email: 'vol10@willing.social', gender: 'female', date_of_birth: '2001-06-06', description: 'Flexible volunteer. Prefers to keep profile private.', cv_path: null },
    { first_name: 'Sami', last_name: 'Khater', email: 'vol11@willing.social', gender: 'male', date_of_birth: '1995-04-09', description: 'Operations-minded volunteer with warehouse and dispatch experience.', cv_path: null },
    { first_name: 'Lea', last_name: 'Rizk', email: 'vol12@willing.social', gender: 'female', date_of_birth: '1999-10-02', description: 'Community educator who enjoys tutoring, facilitation, and youth engagement.', cv_path: null },
    { first_name: 'Omar', last_name: 'Haddad', email: 'vol13@willing.social', gender: 'male', date_of_birth: '1997-12-19', description: 'Tech-savvy coordinator comfortable with helplines, spreadsheets, and operations support.', cv_path: 'omar-haddad-cv.pdf' },
    { first_name: 'Dana', last_name: 'Mokbel', email: 'vol14@willing.social', gender: 'female', date_of_birth: '2000-03-27', description: 'Patient and dependable volunteer with experience in admin support and event coordination.', cv_path: null },
    { first_name: 'Carly', last_name: 'Estephan', email: 'vol15@willing.social', gender: 'female', date_of_birth: '1998-12-12', description: 'Passionate volunteer with a background in community outreach and event planning.', cv_path: null },
    { first_name: 'Rami', last_name: 'Khoury', email: 'vol16@willing.social', gender: 'male', date_of_birth: '1996-05-20', description: 'Civil engineering student comfortable with construction and debris clearance.', cv_path: null },
    { first_name: 'Sara', last_name: 'Najjar', email: 'vol17@willing.social', gender: 'female', date_of_birth: '2002-08-14', description: 'Psychology student with an interest in psychosocial support and trauma care.', cv_path: null },
    { first_name: 'Elie', last_name: 'Gemayel', email: 'vol18@willing.social', gender: 'male', date_of_birth: '1993-03-07', description: 'Experienced first responder with firefighting and emergency management background.', cv_path: 'elie-gemayel-cv.pdf' },
    { first_name: 'Lara', last_name: 'Hayek', email: 'vol19@willing.social', gender: 'female', date_of_birth: '1999-11-30', description: 'Nurse with ICU experience. Comfortable in medical triage and patient care settings.', cv_path: null },
    { first_name: 'Charbel', last_name: 'Abi Nader', email: 'vol20@willing.social', gender: 'male', date_of_birth: '2000-04-22', description: 'Fitness coach passionate about inclusive sports and physical rehabilitation.', cv_path: null },
    { first_name: 'Nour', last_name: 'Khalil', email: 'vol21@willing.social', gender: 'female', date_of_birth: '2001-07-03', description: 'Graphic designer volunteering for awareness campaigns and community art projects.', cv_path: 'nour-khalil-cv.pdf' },
    { first_name: 'Fares', last_name: 'Aziz', email: 'vol22@willing.social', gender: 'male', date_of_birth: '1997-01-18', description: 'Experienced driver and fleet coordinator. Available for supply transport missions.', cv_path: null },
    { first_name: 'Zeina', last_name: 'Saade', email: 'vol23@willing.social', gender: 'female', date_of_birth: '2003-09-25', description: 'University student active in campus environmental clubs and beach cleanup campaigns.', cv_path: null },
    { first_name: 'Ali', last_name: 'Berro', email: 'vol24@willing.social', gender: 'male', date_of_birth: '1995-12-11', description: 'Carpenter and handyman with experience in shelter repair and carpentry.', cv_path: null },
    { first_name: 'Nadine', last_name: 'Harb', email: 'vol25@willing.social', gender: 'female', date_of_birth: '1998-06-29', description: 'Social media manager helping NGOs tell stories and reach wider audiences.', cv_path: null },
    { first_name: 'Bassem', last_name: 'Chaaban', email: 'vol26@willing.social', gender: 'male', date_of_birth: '1992-02-04', description: 'Former army officer with crisis management and team leadership experience.', cv_path: null },
    { first_name: 'Tala', last_name: 'Srour', email: 'vol27@willing.social', gender: 'female', date_of_birth: '2004-03-17', description: 'High school student eager to contribute to local relief and community events.', cv_path: null },
    { first_name: 'Georges', last_name: 'Daou', email: 'vol28@willing.social', gender: 'male', date_of_birth: '1990-10-08', description: 'Retired schoolteacher willing to tutor children and run literacy workshops.', cv_path: 'georges-daou-cv.pdf' },
    { first_name: 'Hiba', last_name: 'Itani', email: 'vol29@willing.social', gender: 'female', date_of_birth: '2002-12-22', description: 'Trained sign language interpreter with experience in inclusive events.', cv_path: null },
    { first_name: 'Bilal', last_name: 'Moussawi', email: 'vol30@willing.social', gender: 'male', date_of_birth: '1999-05-15', description: 'Mechanic and driver with experience supporting mobile relief convoys.', cv_path: null },
    { first_name: 'Carla', last_name: 'Aoun', email: 'vol31@willing.social', gender: 'female', date_of_birth: '2001-08-30', description: 'Dietitian student interested in community nutrition and food security programs.', cv_path: null },
    { first_name: 'Hassan', last_name: 'Jaber', email: 'vol32@willing.social', gender: 'male', date_of_birth: '1994-04-14', description: 'Agricultural specialist supporting farm recovery and soil restoration efforts.', cv_path: null },
    { first_name: 'Mia', last_name: 'Stephan', email: 'vol33@willing.social', gender: 'female', date_of_birth: '2003-01-09', description: 'Theater student running storytelling and drama workshops for displaced youth.', cv_path: null },
    { first_name: 'Kamal', last_name: 'Saleh', email: 'vol34@willing.social', gender: 'male', date_of_birth: '1988-07-21', description: 'Experienced plumber and water systems technician supporting flood and WASH recovery.', cv_path: null },
    { first_name: 'Joelle', last_name: 'Abou Jaoude', email: 'vol35@willing.social', gender: 'female', date_of_birth: '2000-09-05', description: 'Public health graduate working on community health education and hygiene promotion.', cv_path: null },
    { first_name: 'Wissam', last_name: 'Khalife', email: 'vol36@willing.social', gender: 'male', date_of_birth: '1996-03-28', description: 'IT support volunteer helping NGOs with tech setup, connectivity, and device repair. .', cv_path: null },
    { first_name: 'Rola', last_name: 'Hamdan', email: 'vol37@willing.social', gender: 'female', date_of_birth: '1991-11-13', description: 'Lawyer providing pro-bono legal information and referral services to displaced persons.', cv_path: null },
    { first_name: 'Khaled', last_name: 'Mikati', email: 'vol38@willing.social', gender: 'male', date_of_birth: '2002-06-07', description: 'Football coach organizing youth leagues and inclusive sport days in North Lebanon.', cv_path: null },
    { first_name: 'Cynthia', last_name: 'Frem', email: 'vol39@willing.social', gender: 'female', date_of_birth: '1997-02-16', description: 'Event planner supporting community fundraisers, awareness drives, and distribution events.', cv_path: null },
    { first_name: 'Mazen', last_name: 'Abou Rizk', email: 'vol40@willing.social', gender: 'male', date_of_birth: '1993-08-03', description: 'Structural engineer assessing damaged buildings and guiding repair volunteers safely.', cv_path: null },
    { first_name: 'Ghada', last_name: 'Rahhal', email: 'vol41@willing.social', gender: 'female', date_of_birth: '2001-04-19', description: 'Arabic calligrapher and art educator bringing creative healing workshops to communities.', cv_path: null },
    { first_name: 'Tony', last_name: 'Khoury', email: 'vol42@willing.social', gender: 'male', date_of_birth: '1998-10-27', description: 'Supply chain analyst helping NGOs optimize donations and distribution logistics.', cv_path: 'tony-khoury-cv.pdf' },
    { first_name: 'Dina', last_name: 'Mansour', email: 'vol43@willing.social', gender: 'female', date_of_birth: '2000-01-14', description: 'Medical laboratory student assisting in blood drives and health screening days.', cv_path: null },
    { first_name: 'Fouad', last_name: 'Geagea', email: 'vol44@willing.social', gender: 'male', date_of_birth: '1989-05-31', description: 'Experienced chef and culinary trainer managing large-scale community kitchens.', cv_path: null },
    { first_name: 'Leen', last_name: 'Khoury', email: 'vol45@willing.social', gender: 'female', date_of_birth: '2004-07-11', description: 'Teen volunteer passionate about environmental activism and ocean conservation.', cv_path: null },
    { first_name: 'Adnan', last_name: 'Wehbe', email: 'vol46@willing.social', gender: 'male', date_of_birth: '1986-12-24', description: 'Former UNHCR field officer with refugee registration and case management experience.', cv_path: null },
    { first_name: 'Reem', last_name: 'Diab', email: 'vol47@willing.social', gender: 'female', date_of_birth: '2002-03-03', description: 'Student journalist documenting community relief efforts for awareness and advocacy.', cv_path: null },
    { first_name: 'Nidal', last_name: 'Haidar', email: 'vol48@willing.social', gender: 'male', date_of_birth: '1995-09-17', description: 'Solar energy technician supporting off-grid power solutions for relief organizations.', cv_path: null },
    { first_name: 'Aline', last_name: 'Eid', email: 'vol49@willing.social', gender: 'female', date_of_birth: '1999-06-20', description: 'Early childhood educator running learning circles and play-based activities for young children.', cv_path: null },
    { first_name: 'Riad', last_name: 'Zein', email: 'vol50@willing.social', gender: 'male', date_of_birth: '1997-08-08', description: 'Warehouse supervisor with extensive experience managing large donation stockrooms.', cv_path: null },
    { first_name: 'Myriam', last_name: 'Aboud', email: 'vol51@willing.social', gender: 'female', date_of_birth: '2003-11-04', description: 'Music student offering music therapy and choir workshops in shelters and community centers.', cv_path: null },
    { first_name: 'Saad', last_name: 'Farran', email: 'vol52@willing.social', gender: 'male', date_of_birth: '1990-03-22', description: 'Veterinarian assisting animal rescue and care efforts in disaster-affected regions.', cv_path: null },
    { first_name: 'Natalia', last_name: 'Frem', email: 'vol53@willing.social', gender: 'female', date_of_birth: '2001-05-29', description: 'Fashion design student upcycling donated clothing for distribution in refugee camps.', cv_path: null },
    { first_name: 'Bassel', last_name: 'Khodr', email: 'vol54@willing.social', gender: 'male', date_of_birth: '1994-07-16', description: 'Geography teacher assisting with mapping disaster zones and logistics planning for NGOs.', cv_path: null },
    { first_name: 'Hind', last_name: 'Assaf', email: 'vol55@willing.social', gender: 'female', date_of_birth: '1998-02-11', description: 'Community organizer experienced in mobilizing volunteers for neighborhood recovery projects.', cv_path: null },
    { first_name: 'Youssef', last_name: 'Nasser', email: 'vol56@willing.social', gender: 'male', date_of_birth: '2002-10-18', description: 'Engineering student building makeshift infrastructure for displaced communities.', cv_path: null },
    { first_name: 'Abir', last_name: 'Mourad', email: 'vol57@willing.social', gender: 'female', date_of_birth: '1993-04-05', description: 'Accountant volunteering for NGO financial transparency and grant reporting support.', cv_path: null },
    { first_name: 'Ramzi', last_name: 'Charaf', email: 'vol58@willing.social', gender: 'male', date_of_birth: '1988-01-29', description: 'Veteran field coordinator managing large multi-organization volunteer deployments.', cv_path: 'ramzi-charaf-cv.pdf' },
    { first_name: 'Pamela', last_name: 'Harb', email: 'vol59@willing.social', gender: 'female', date_of_birth: '2004-08-22', description: 'Teen environmental volunteer running awareness campaigns in her school district.', cv_path: null },
    { first_name: 'Fadi', last_name: 'Daher', email: 'vol60@willing.social', gender: 'male', date_of_birth: '1996-06-13', description: 'Pharmacist supporting medicine distribution, cold chain management, and health fairs.', cv_path: null },
    { first_name: 'Yasmine', last_name: 'Saleh', email: 'vol61@willing.social', gender: 'female', date_of_birth: '2000-12-01', description: 'Child psychologist providing age-appropriate mental health activities in displacement shelters.', cv_path: null },
    { first_name: 'Marwan', last_name: 'Khoury', email: 'vol62@willing.social', gender: 'male', date_of_birth: '1991-09-09', description: 'Professional chef running food safety training and community cooking events.', cv_path: null },
    { first_name: 'Rania', last_name: 'Tabbara', email: 'vol63@willing.social', gender: 'female', date_of_birth: '1997-03-14', description: 'Environmental scientist supporting coastal pollution assessment and cleanup coordination.', cv_path: null },
    { first_name: 'Majd', last_name: 'Makhoul', email: 'vol64@willing.social', gender: 'male', date_of_birth: '2003-07-27', description: 'Youth activist and community garden project leader in Tripoli.', cv_path: null },
    { first_name: 'Sana', last_name: 'Itani', email: 'vol65@willing.social', gender: 'female', date_of_birth: '1999-01-23', description: 'Human resources professional streamlining volunteer onboarding and coordination systems.', cv_path: null },
    { first_name: 'Khalil', last_name: 'Nassif', email: 'vol66@willing.social', gender: 'male', date_of_birth: '1992-11-06', description: 'Electrician providing safe wiring and generator support to shelters and relief centers.', cv_path: null },
    { first_name: 'Lina', last_name: 'Feghali', email: 'vol67@willing.social', gender: 'female', date_of_birth: '2001-02-28', description: 'Social media coordinator amplifying NGO volunteer calls and community stories online.', cv_path: null },
    { first_name: 'Malek', last_name: 'Haddad', email: 'vol68@willing.social', gender: 'male', date_of_birth: '2004-04-14', description: 'Student athlete coaching youth sports and running inclusive fitness sessions.', cv_path: null },
    { first_name: 'Riwa', last_name: 'Ghanem', email: 'vol69@willing.social', gender: 'female', date_of_birth: '2002-06-30', description: 'Biology student assisting environmental NGOs with species monitoring and habitat restoration.', cv_path: null },
    { first_name: 'Majd', last_name: 'Farhat', email: 'vol70@willing.social', gender: 'male', date_of_birth: '1985-08-15', description: 'Logistics manager with 15 years of supply chain experience supporting humanitarian relief operations.', cv_path: null },
    { first_name: 'Dalia', last_name: 'Sleiman', email: 'vol71@willing.social', gender: 'female', date_of_birth: '1998-10-10', description: 'Occupational therapist supporting recovery and daily living activities for injured residents.', cv_path: null },
    { first_name: 'Nasser', last_name: 'Khalife', email: 'vol72@willing.social', gender: 'male', date_of_birth: '2000-03-03', description: 'Community radio presenter using media skills to broadcast relief announcements and volunteer calls.', cv_path: 'nasser-khalife-cv.pdf' },
    { first_name: 'Rouba', last_name: 'Karam', email: 'vol73@willing.social', gender: 'female', date_of_birth: '1995-07-19', description: 'Medical doctor volunteering in crisis clinics and mobile health units across Lebanon.', cv_path: null },
    { first_name: 'Samer', last_name: 'Abdo', email: 'vol74@willing.social', gender: 'male', date_of_birth: '1993-05-26', description: 'Marine biologist monitoring ecosystem recovery along Lebanon\'s coastline after pollution events.', cv_path: null },
    { first_name: 'Lara', last_name: 'Gemayel', email: 'vol75@willing.social', gender: 'female', date_of_birth: '2002-09-12', description: 'Architecture student helping design accessible and dignified shelter spaces for displaced families.', cv_path: null },
    { first_name: 'Imad', last_name: 'Chahrour', email: 'vol76@willing.social', gender: 'male', date_of_birth: '1990-01-17', description: 'Safety officer ensuring volunteer protection standards on field sites and distribution points.', cv_path: null },
    { first_name: 'Celine', last_name: 'Nasr', email: 'vol77@willing.social', gender: 'female', date_of_birth: '2001-11-20', description: 'Fundraising and grant writing volunteer helping small NGOs access emergency funding.', cv_path: null },
    { first_name: 'Joe', last_name: 'Abi Khalil', email: 'vol78@willing.social', gender: 'male', date_of_birth: '1997-04-06', description: 'Drone operator mapping flood damage and wildfire zones to support relief planning.', cv_path: null },
    { first_name: 'Mirna', last_name: 'Khoury', email: 'vol79@willing.social', gender: 'female', date_of_birth: '2003-02-08', description: 'Youth mentor running after-school and weekend programs for at-risk teenagers.', cv_path: null },
    { first_name: 'Firas', last_name: 'Barakat', email: 'vol80@willing.social', gender: 'male', date_of_birth: '1991-06-24', description: 'Trauma surgeon with extensive field hospital experience, supporting emergency medical teams.', cv_path: null },
  ].map(v => ({ ...v, password: passwordHash, gender: v.gender as 'male' | 'female' | 'other' }));

  const volunteers = await database.insertInto('volunteer_account')
    .values(volunteerValues)
    .returning(['id', 'email'])
    .execute();

  const volByEmail = new Map(volunteers.map(v => [v.email, v.id]));

  // Reports

  await database.insertInto('organization_report').values([
    {
      reported_organization_id: orgByName.get('Life Organization')!,
      reporter_volunteer_id: volByEmail.get('vol1@willing.social')!,
      title: 'scam',
      message: 'Claimed to be a legitimate nonprofit organization but asked for a payment.',
    },
    {
      reported_organization_id: orgByName.get('Life Organization')!,
      reporter_volunteer_id: volByEmail.get('vol2@willing.social')!,
      title: 'impersonation',
      message: 'Operated under a convincing but fraudulent brand name and solicited volunteers dishonestly.',
    },
    {
      reported_organization_id: orgByName.get('Nour Relief')!,
      reporter_volunteer_id: volByEmail.get('vol3@willing.social')!,
      title: 'harassment',
      message: 'Overseers used intimidating language and blamed volunteers for issues outside their control.',
    },
    {
      reported_organization_id: orgByName.get('Cedar Response')!,
      reporter_volunteer_id: volByEmail.get('vol4@willing.social')!,
      title: 'other',
      message: 'Committed to providing a proper volunteer orientation but repeatedly postponed and canceled sessions.',
    },
    {
      reported_organization_id: orgByName.get('Ajialouna')!,
      reporter_volunteer_id: volByEmail.get('vol5@willing.social')!,
      title: 'inappropriate_behavior',
      message: 'Asked volunteers to perform unsafe tasks without proper protective equipment.',
    },
    {
      reported_organization_id: orgByName.get('Arz Community')!,
      reporter_volunteer_id: volByEmail.get('vol6@willing.social')!,
      title: 'other',
      message: 'Provided inaccurate location details and caused confusion during volunteer transport planning.',
    },
    {
      reported_organization_id: orgByName.get('Bekaa Uplift')!,
      reporter_volunteer_id: volByEmail.get('vol7@willing.social')!,
      title: 'scam',
      message: 'Did not mark me as attended despite my presence.',
    },
    {
      reported_organization_id: orgByName.get('Cedar Response')!,
      reporter_volunteer_id: volByEmail.get('vol8@willing.social')!,
      title: 'impersonation',
      message: 'Claimed staff were certified when they had no verified credentials.',
    },
  ]).execute();

  await database.insertInto('volunteer_report').values([
    {
      reported_volunteer_id: volByEmail.get('vol15@willing.social')!,
      reporter_organization_id: orgByName.get('Nour Relief')!,
      title: 'scam',
      message: 'Volunteer attempted to collect funds from our community contacts using false statements.',
    },
    {
      reported_volunteer_id: volByEmail.get('vol15@willing.social')!,
      reporter_organization_id: orgByName.get('Cedar Response')!,
      title: 'inappropriate_behavior',
      message: 'Exhibited rude and unprofessional behavior during onboarding calls and site visits.',
    },
    {
      reported_volunteer_id: volByEmail.get('vol5@willing.social')!,
      reporter_organization_id: orgByName.get('Ajialouna')!,
      title: 'impersonation',
      message: 'Misrepresented availability and qualifications during onboarding calls.',
    },
    {
      reported_volunteer_id: volByEmail.get('vol6@willing.social')!,
      reporter_organization_id: orgByName.get('Arz Community')!,
      title: 'harassment',
      message: 'Used aggressive language with staff and other volunteers during a shift.',
    },
  ]).execute();

  // Crises

  const crises = await database.insertInto('crisis')
    .values([
      {
        name: 'Lebanon 2026 War',
        description:
          'Lebanon is facing a severe humanitarian crisis in 2026, with families displaced and basic needs like '
          + 'food, water, and medical care becoming scarce. Urgent support is needed to help civilians and provide '
          + 'essential aid.',
        pinned: true,
      },
      {
        name: 'Beirut Port Explosion Aftermath',
        description:
          'Five years on, many families in the neighborhoods closest to the port are still '
          + 'living in damaged homes — the cameras moved on, but the need did not.',
        pinned: true,
      },
      {
        name: 'Akkar Wildfires',
        description:
          'The fires swept through Akkar in a matter of hours, burning homes, orchards, and '
          + 'decades of work. Families who had nothing to spare lost everything.',
        pinned: false,
      },
      {
        name: 'Economic Food Insecurity',
        description:
          'With the lira in freefall and salaries worth a fraction of what they were, '
          + 'more Lebanese families than ever are skipping meals.',
        pinned: false,
      },
      {
        name: 'Tyre Coastal Pollution Emergency',
        description:
          'A fuel spill and years of unchecked waste dumping have left the Tyre coastline '
          + 'visibly damaged — tar on the sand, dead fish, and a smell that carries for kilometers.',
        pinned: false,
      },
      {
        name: 'Bekaa Valley Flooding',
        description:
          'Flash floods tore through several Bekaa villages last month, sweeping away crops, '
          + 'flooding homes to the ceiling, and cutting off roads.',
        pinned: false,
      },
    ])
    .returning(['id', 'name'])
    .execute();

  const crisisByName = new Map(crises.map(c => [c.name, c.id]));
  const war = crisisByName.get('Lebanon 2026 War')!;
  const port = crisisByName.get('Beirut Port Explosion Aftermath')!;
  const akkar = crisisByName.get('Akkar Wildfires')!;
  const food = crisisByName.get('Economic Food Insecurity')!;
  const tyre = crisisByName.get('Tyre Coastal Pollution Emergency')!;
  const bekaaFlood = crisisByName.get('Bekaa Valley Flooding')!;

  // Postings

  const postings = await database.insertInto('posting')
    .values([

      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: war,
        title: 'Blood Drive Coordination',
        description: 'Support the blood donation drive set up in response to the surge in casualties. Tasks include donor registration, managing the waiting area, and post-donation care.',
        latitude: 33.8938,
        longitude: 35.5018,
        location_name: 'Nour Relief Centre, Beirut',
        max_volunteers: 10,
        ...bt(relDate(-30, 8), relDate(-30, 16)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: true,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: food,
        title: 'Emergency Food Packing',
        description: 'Pack monthly food parcels for families enrolled in the emergency food assistance programme. Fast-paced warehouse environment; comfortable shoes required.',
        latitude: 33.8820,
        longitude: 35.5100,
        location_name: 'Nour Relief Warehouse, Barbir',
        max_volunteers: 30,
        ...bt(relDate(-14, 9), relDate(-14, 14)),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: war,
        title: 'Mobile Aid Kit Distribution',
        description: 'Distribute hygiene and first-aid kits to displaced families in affected Beirut neighborhoods. Requires solid communication skills and situational safety awareness.',
        latitude: 33.8800,
        longitude: 35.5100,
        location_name: 'Beirut Northern Districts',
        max_volunteers: 20,
        ...bt(relDate(-7, 10), relDate(-7, 15)),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: war,
        title: 'First Aid Support',
        description: 'Assist certified medics in providing first aid to war-affected civilians at a Beirut field hospital. Tasks include triage support, supply management, and patient transport.',
        latitude: 33.8700,
        longitude: 35.5050,
        location_name: 'Beirut Field Hospital, Cola',
        max_volunteers: 15,
        ...bt(relDate(3, 7), relDate(3, 19)),
        minimum_age: 18,
        automatic_acceptance: false,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: war,
        title: 'Displaced Families Registration',
        description: 'Help register and document displaced families arriving at Beirut shelters. Duties include data entry, family intake interviews, and guiding families to services.',
        latitude: 33.8850,
        longitude: 35.4950,
        location_name: 'Beirut Municipal Stadium Shelter',
        max_volunteers: 20,
        ...bt(relDate(5, 8), relDate(7, 18)),
        minimum_age: 18,
        automatic_acceptance: false,
        allows_partial_attendance: true, is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: war,
        title: 'Emergency Shelter Setup',
        description: 'Help assemble and maintain temporary shelters for displaced families. Tasks include tent assembly, site sanitation, and organising sleeping areas.',
        latitude: 33.8900,
        longitude: 35.5000,
        location_name: 'Mar Elias Shelter Site, Beirut',
        max_volunteers: 30,
        ...bt(relDate(4, 9), relDate(4, 17)),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: war,
        title: 'War Survivor Psychosocial Support',
        description: 'Support trained counsellors running group psychosocial sessions for adults displaced by the conflict. Volunteers help facilitate safe spaces and manage attendance.',
        latitude: 33.8870,
        longitude: 35.5030,
        location_name: 'Hamra Community Hall, Beirut',
        max_volunteers: 10,
        ...bt(relDate(9, 9), relDate(9, 13)),
        minimum_age: 21,
        automatic_acceptance: false,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: war,
        title: 'Meals for the Displaced',
        description: 'Help cook and distribute hot meals to displaced families sheltering in schools across Beirut. No cooking experience required — just willingness to work hard.',
        latitude: 33.8760,
        longitude: 35.4980,
        location_name: 'Ras Beirut School Shelter',
        max_volunteers: 25,
        ...bt(relDate(6, 7), relDate(6, 11)),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: war,
        title: 'Children\'s Activities in Shelters',
        description: 'Run structured play and learning activities for children in displacement shelters. Bring patience, energy, and a willingness to be silly.',
        latitude: 33.8820,
        longitude: 35.5050,
        location_name: 'Tallet el-Khayat School Shelter',
        max_volunteers: 12,
        ...bt(relDate(10, 10), relDate(10, 14)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: port,
        title: 'Psychological First Aid Sessions',
        description: 'Support trained psychologists delivering group psychological first aid sessions to explosion survivors. Volunteers facilitate sessions and provide comfort.',
        latitude: 33.9010,
        longitude: 35.5200,
        location_name: 'Mar Mikhael Community Hall',
        max_volunteers: 8,
        ...bt(relDate(14, 10), relDate(14, 15)),
        minimum_age: 21,
        automatic_acceptance: false,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: war,
        title: 'Winter Blanket Distribution',
        description: 'Help sort and distribute donated winter blankets and clothing to displaced families at collection points across Beirut.',
        latitude: 33.8870,
        longitude: 35.5010,
        location_name: 'Nour Relief Centre, Beirut',
        max_volunteers: 20,
        ...bt(relDate(12, 9), relDate(12, 14)),
        minimum_age: null,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: null,
        title: 'Community Health Screening Day',
        description: 'Assist medical volunteers running free blood pressure, sugar, and basic health checks for Beirut residents at a neighborhood clinic.',
        latitude: 33.8800,
        longitude: 35.4950,
        location_name: 'Burj Hammoud Community Clinic',
        max_volunteers: 15,
        ...bt(relDate(18, 8), relDate(18, 14)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: war,
        title: 'Supply Convoy Loading',
        description: 'Help load and unload trucks carrying relief supplies to warehouses and distribution points serving displaced families across Beirut.',
        latitude: 33.8820,
        longitude: 35.5100,
        location_name: 'Nour Relief Warehouse, Barbir',
        max_volunteers: 18,
        ...bt(relDate(2, 7), relDate(2, 13)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Ajialouna')!,
        crisis_id: null,
        title: 'Inclusive Sports Day',
        description: 'Help organise and run an inclusive sports day for children and young adults with physical disabilities.',
        latitude: 33.3600,
        longitude: 35.5000,
        location_name: 'Saida Municipal Sports Ground',
        max_volunteers: 8,
        ...bt(relDate(11, 9), relDate(11, 15)),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Ajialouna')!,
        crisis_id: food,
        title: 'Community Kitchen',
        description: 'Assist the community kitchen in preparing and serving daily hot meals to vulnerable families. Roles include food prep, serving, and kitchen cleanup.',
        latitude: 33.3520,
        longitude: 35.4880,
        location_name: 'Jeel Kitchen, Saida Old City',
        max_volunteers: 14,
        ...bt(relDate(8, 10), relDate(8, 12)),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Ajialouna')!,
        crisis_id: null,
        title: 'Remote Homework Support',
        description: 'Provide online academic support to public school students in South Lebanon via phone or video call. Subjects: Arabic, English, Maths, Sciences.',
        latitude: 33.3547,
        longitude: 35.4955,
        location_name: 'Remote (South Lebanon)',
        max_volunteers: 20,
        ...bt(relDate(1, 15), relDate(60, 18)),
        minimum_age: 12,
        automatic_acceptance: false,
        allows_partial_attendance: true, is_closed: false,
      },
      {
        organization_id: orgByName.get('Ajialouna')!,
        crisis_id: null,
        title: 'Winter Clothing Distribution',
        description: 'Sort and distribute donated winter clothing to families in Saida and surrounding villages.',
        latitude: 33.3480,
        longitude: 35.4900,
        location_name: 'Saida Community Centre',
        max_volunteers: 10,
        ...bt(relDate(-21, 9), relDate(-21, 14)),
        minimum_age: null,
        automatic_acceptance: true,
        is_closed: true,
      },
      {
        organization_id: orgByName.get('Ajialouna')!,
        crisis_id: null,
        title: 'Community Storytelling Circle',
        description: 'Lead a welcoming storytelling and conversation circle for women and youth in Saida.',
        latitude: 33.3560,
        longitude: 35.4950,
        location_name: 'Saida Women\'s Centre',
        max_volunteers: 12,
        ...bt(relDate(15, 16), relDate(15, 19)),
        minimum_age: null,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Ajialouna')!,
        crisis_id: null,
        title: 'Youth Reading Circle',
        description: 'Host a youth reading circle for students and pre-teens at the Saida library.',
        latitude: 33.3545,
        longitude: 35.4960,
        location_name: 'Saida Public Library',
        max_volunteers: 14,
        ...bt(relDate(22, 10), relDate(22, 13)),
        minimum_age: null,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Ajialouna')!,
        crisis_id: null,
        title: 'Junior Sports Field Prep',
        description: 'Prepare a local youth sports field with line marking, equipment setup, and light groundskeeping before community games.',
        latitude: 33.3560,
        longitude: 35.4950,
        location_name: 'Saida Youth Sports Ground',
        max_volunteers: 12,
        ...bt(relDate(23, 8), relDate(23, 12)),
        minimum_age: 14,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Ajialouna')!,
        crisis_id: war,
        title: 'Refugee Family Intake Support',
        description: 'Assist social workers registering war-displaced families at a reception centre in South Lebanon. Arabic speakers strongly preferred.',
        latitude: 33.3540,
        longitude: 35.4870,
        location_name: 'Saida Reception Centre',
        max_volunteers: 10,
        ...bt(relDate(7, 9), relDate(9, 16)),
        minimum_age: 18,
        automatic_acceptance: false,
        allows_partial_attendance: true, is_closed: false,
      },

      {
        organization_id: orgByName.get('Arz Community')!,
        crisis_id: akkar,
        title: 'Wildfire Relief Distribution',
        description: 'Help distribute emergency relief kits to families displaced by the Akkar wildfires, at a Tripoli staging area.',
        latitude: 34.4367,
        longitude: 35.8333,
        location_name: 'Arz Community Warehouse, Tripoli',
        max_volunteers: 25,
        ...bt(relDate(5, 8), relDate(5, 17)),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Arz Community')!,
        crisis_id: null,
        title: 'Medical Supplies Inventory & Sorting',
        description: 'Organise and verify incoming donations of medical supplies at the Tripoli depot. Attention to detail critical.',
        latitude: 34.4300,
        longitude: 35.8150,
        location_name: 'Tripoli Medical Depot',
        max_volunteers: 7,
        ...bt(relDate(16, 9), relDate(16, 13)),
        minimum_age: 18,
        automatic_acceptance: false,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Arz Community')!,
        crisis_id: null,
        title: 'Community Garden Open Help Day',
        description: 'Join a drop-in garden day. Help is welcome for planting, watering, and cleanup alongside local community gardeners.',
        latitude: 34.4370,
        longitude: 35.8340,
        location_name: 'Tripoli Community Garden',
        max_volunteers: null,
        ...bt(relDate(27, 9), relDate(27, 13)),
        minimum_age: 12,
        automatic_acceptance: true,
        allows_partial_attendance: true, is_closed: false,
      },
      {
        organization_id: orgByName.get('Arz Community')!,
        crisis_id: tyre,
        title: 'Coastal Cleanup',
        description: 'Join a large-scale beach and coastal cleanup at the Tyre coast following the fuel spill.',
        latitude: 33.2705,
        longitude: 35.2038,
        location_name: 'Tyre Al-Bass Coast',
        max_volunteers: 50,
        ...bt(relDate(13, 7, 30), relDate(13, 13)),
        minimum_age: 14,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Arz Community')!,
        crisis_id: null,
        title: 'Children\'s Art & Story Workshop',
        description: 'Run creative storytelling and art sessions for underprivileged children at the Tripoli community centre.',
        latitude: 34.4370,
        longitude: 35.8340,
        location_name: 'Tripoli Community Centre',
        max_volunteers: 10,
        ...bt(relDate(20, 9), relDate(20, 12)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Arz Community')!,
        crisis_id: null,
        title: 'Youth Garden Helpers',
        description: 'Support a community garden project by planting, weeding, and watering garden beds with local youth volunteers.',
        latitude: 34.4370,
        longitude: 35.8340,
        location_name: 'Tripoli Community Garden',
        max_volunteers: 12,
        ...bt(relDate(24, 9), relDate(24, 13)),
        minimum_age: 12,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Arz Community')!,
        crisis_id: null,
        title: 'Family Water Station Support',
        description: 'Support a community water station in Tripoli by handing out water and refreshments to families.',
        latitude: 34.4360,
        longitude: 35.8335,
        location_name: 'Tripoli Al-Akhdar Community Hub',
        max_volunteers: 18,
        ...bt(relDate(26, 9), relDate(26, 13)),
        minimum_age: null,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Arz Community')!,
        crisis_id: akkar,
        title: 'Debris Clearance',
        description: 'Physical volunteer work helping wildfire-affected families in Akkar clear debris and begin rebuilding. Heavy lifting involved.',
        latitude: 34.5500,
        longitude: 36.0500,
        location_name: 'Akkar, North Lebanon',
        max_volunteers: 30,
        ...bt(relDate(-28, 7), relDate(-28, 16)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: true,
      },
      {
        organization_id: orgByName.get('Arz Community')!,
        crisis_id: akkar,
        title: 'Reforestation Day – Akkar',
        description: 'Plant native tree seedlings in areas cleared by the Akkar wildfires, supported by the forestry directorate.',
        latitude: 34.5400,
        longitude: 36.0400,
        location_name: 'Akkar Forest Zone',
        max_volunteers: 40,
        ...bt(relDate(30, 8), relDate(30, 14)),
        minimum_age: 14,
        automatic_acceptance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Cedar Response')!,
        crisis_id: port,
        title: 'Volunteer Helpline Shifts',
        description: 'Take scheduled helpline shifts to guide affected residents toward support services, legal referrals, and psychosocial resources.',
        latitude: 33.8955,
        longitude: 35.5140,
        location_name: 'Cedar Response Office, Gemmayze',
        max_volunteers: 12,
        ...bt(relDate(10, 9), relDate(14, 17)),
        minimum_age: 18,
        automatic_acceptance: false,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Cedar Response')!,
        crisis_id: port,
        title: 'Neighborhood Repair Week',
        description: 'Support teams repainting, cleaning, and repairing damaged community spaces over a five-day neighborhood recovery push.',
        latitude: 33.8981,
        longitude: 35.5182,
        location_name: 'Mar Mikhael Recovery Hub',
        max_volunteers: 24,
        ...bt(relDate(18, 8), relDate(22, 16)),
        minimum_age: 17,
        automatic_acceptance: true,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Cedar Response')!,
        crisis_id: port,
        title: 'One-Day Hotline Sprint',
        description: 'Support the hotline team for a single high-volume day by answering calls, escalating urgent cases, and updating referral notes.',
        latitude: 33.8940,
        longitude: 35.5132,
        location_name: 'Cedar Response Office, Gemmayze',
        max_volunteers: 6,
        ...bt(relDate(25, 9), relDate(25, 17)),
        minimum_age: 18,
        automatic_acceptance: true,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Cedar Response')!,
        crisis_id: port,
        title: 'Crisis Hotline Coverage Week',
        description: 'Cover every hotline shift for a three-day support push. Volunteers handle caller triage, documentation, and referral follow-ups.',
        latitude: 33.8950,
        longitude: 35.5144,
        location_name: 'Cedar Response Coordination Room',
        max_volunteers: 2,
        ...bt(relDate(35, 9), relDate(37, 17)),
        minimum_age: 18,
        automatic_acceptance: true,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Cedar Response')!,
        crisis_id: war,
        title: 'Urban Search & Rescue Logistics',
        description: 'Support the logistics team coordinating supplies and communications for urban search and rescue operations across Beirut.',
        latitude: 33.8889,
        longitude: 35.4942,
        location_name: 'Cedar Response HQ, Beirut',
        max_volunteers: 8,
        ...bt(relDate(2, 6), relDate(4, 18)),
        minimum_age: 21,
        automatic_acceptance: false,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Cedar Response')!,
        crisis_id: null,
        title: 'First Aid Training Day',
        description: 'Join a free first aid and CPR training day open to all community members. Certified trainers, no experience required.',
        latitude: 33.8870,
        longitude: 35.5010,
        location_name: 'Cedar Response Training Hall',
        max_volunteers: 30,
        ...bt(relDate(40, 9), relDate(40, 16)),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Cedar Response')!,
        crisis_id: war,
        title: 'Displacement Shelter Coordination',
        description: 'Help manage volunteer rosters, supply logs, and communications for three active displacement shelters in East Beirut.',
        latitude: 33.8910,
        longitude: 35.5280,
        location_name: 'East Beirut Shelter Hub',
        max_volunteers: 10,
        ...bt(relDate(3, 8), relDate(6, 18)),
        minimum_age: 18,
        automatic_acceptance: false,
        allows_partial_attendance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Bekaa Uplift')!,
        crisis_id: bekaaFlood,
        title: 'Flood Cleanup Crew',
        description: 'Join teams helping families clear mud, salvage belongings, and reset homes after flooding in the Bekaa Valley.',
        latitude: 33.8462,
        longitude: 35.9020,
        location_name: 'Zahle Flood Recovery Point',
        max_volunteers: 18,
        ...bt(relDate(12, 8), relDate(13, 15)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Bekaa Uplift')!,
        crisis_id: bekaaFlood,
        title: 'School Supply Restocking',
        description: 'Help restock school materials and classroom kits for schools affected by flooding. Includes sorting, packing, and local delivery coordination.',
        latitude: 33.8500,
        longitude: 35.9100,
        location_name: 'Bekaa Uplift Learning Hub',
        max_volunteers: 16,
        ...bt(relDate(24, 9), relDate(26, 14)),
        minimum_age: 16,
        automatic_acceptance: false,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Bekaa Uplift')!,
        crisis_id: bekaaFlood,
        title: 'Farm Recovery Rotation',
        description: 'Help farm families recover across a three-day rotation of cleanup, seed sorting, and irrigation setup support.',
        latitude: 33.8525,
        longitude: 35.9150,
        location_name: 'Bekaa Farm Support Hub',
        max_volunteers: 2,
        ...bt(relDate(28, 8), relDate(30, 15)),
        minimum_age: 18,
        automatic_acceptance: true,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Bekaa Uplift')!,
        crisis_id: food,
        title: 'Bekaa Food Parcel Drive',
        description: 'Pack and distribute food parcels to food-insecure families across Zahle and surrounding Bekaa towns.',
        latitude: 33.8480,
        longitude: 35.9010,
        location_name: 'Zahle Distribution Centre',
        max_volunteers: 20,
        ...bt(relDate(8, 9), relDate(8, 15)),
        minimum_age: 14,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Bekaa Uplift')!,
        crisis_id: null,
        title: 'Bekaa Youth Football League Setup',
        description: 'Set up fields, organize team registrations, and assist coordinators for the Bekaa inter-school youth football league.',
        latitude: 33.8500,
        longitude: 35.9020,
        location_name: 'Zahle Sports Fields',
        max_volunteers: 14,
        ...bt(relDate(17, 8), relDate(17, 15)),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Inssan')!,
        crisis_id: war,
        title: 'Stateless Persons Documentation Support',
        description: 'Assist legal staff in collecting documentation and intake information from stateless persons displaced by the conflict.',
        latitude: 33.8900,
        longitude: 35.5050,
        location_name: 'Inssan Office, Beirut',
        max_volunteers: 6,
        ...bt(relDate(4, 9), relDate(4, 15)),
        minimum_age: 21,
        automatic_acceptance: false,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Inssan')!,
        crisis_id: null,
        title: 'Know Your Rights Workshop',
        description: 'Facilitate rights awareness workshops for migrant and refugee communities in Beirut. Materials provided. Arabic and English needed.',
        latitude: 33.8905,
        longitude: 35.5055,
        location_name: 'Inssan Training Room, Beirut',
        max_volunteers: 8,
        ...bt(relDate(19, 10), relDate(19, 13)),
        minimum_age: 18,
        automatic_acceptance: false,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Inssan')!,
        crisis_id: war,
        title: 'Asylum Seeker Intake Assistance',
        description: 'Help intake coordinators process new asylum cases, verify documents, and schedule follow-up appointments.',
        latitude: 33.8900,
        longitude: 35.5050,
        location_name: 'Inssan Office, Beirut',
        max_volunteers: 5,
        ...bt(relDate(6, 9), relDate(8, 15)),
        minimum_age: 21,
        automatic_acceptance: false,
        allows_partial_attendance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Offre Joie')!,
        crisis_id: port,
        title: 'Home Repair Volunteer Day',
        description: 'Join Offre Joie teams repairing homes in Karantina and Bourj Hammoud still bearing damage from the port explosion.',
        latitude: 33.8870,
        longitude: 35.5360,
        location_name: 'Karantina, Beirut',
        max_volunteers: 30,
        ...bt(relDate(9, 8), relDate(9, 16)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Offre Joie')!,
        crisis_id: akkar,
        title: 'Akkar Rebuilding Week',
        description: 'Spend five days helping wildfire-affected families in Akkar rebuild walls, clear rubble, and restore community spaces.',
        latitude: 34.5600,
        longitude: 36.0700,
        location_name: 'Akkar Village Sites',
        max_volunteers: 40,
        ...bt(relDate(32, 8), relDate(36, 17)),
        minimum_age: 18,
        automatic_acceptance: true,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Offre Joie')!,
        crisis_id: null,
        title: 'Urban Mural & Beautification Day',
        description: 'Paint a community mural and clean up a neglected public wall in a Beirut neighborhood.',
        latitude: 33.8820,
        longitude: 35.5100,
        location_name: 'Bourj Hammoud, Beirut',
        max_volunteers: 20,
        ...bt(relDate(20, 9), relDate(20, 14)),
        minimum_age: 14,
        automatic_acceptance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Lebanese Food Bank')!,
        crisis_id: food,
        title: 'Weekend Food Sort & Pack',
        description: 'Sort and repack donated food items at the Lebanese Food Bank warehouse for distribution to partner organizations.',
        latitude: 33.8720,
        longitude: 35.4980,
        location_name: 'LFB Warehouse, Beirut',
        max_volunteers: 25,
        ...bt(relDate(7, 9), relDate(7, 13)),
        minimum_age: 14,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Lebanese Food Bank')!,
        crisis_id: food,
        title: 'Mobile Food Pantry – Tripoli',
        description: 'Support the mobile food pantry visiting underserved neighborhoods in Tripoli, distributing dry goods and fresh produce.',
        latitude: 34.4380,
        longitude: 35.8300,
        location_name: 'Bab Al-Tabbaneh, Tripoli',
        max_volunteers: 15,
        ...bt(relDate(14, 10), relDate(14, 15)),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Lebanese Food Bank')!,
        crisis_id: war,
        title: 'Crisis Food Parcel Assembly Line',
        description: 'Join a rapid-response parcel assembly line for families newly displaced by the conflict. Shifts of 4 hours, twice daily.',
        latitude: 33.8720,
        longitude: 35.4980,
        location_name: 'LFB Warehouse, Beirut',
        max_volunteers: 30,
        ...bt(relDate(1, 7), relDate(3, 19)),
        minimum_age: 16,
        automatic_acceptance: true,
        allows_partial_attendance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Arc en Ciel')!,
        crisis_id: null,
        title: 'Accessibility Audit – Beirut Streets',
        description: 'Walk routes with Arc en Ciel field officers, documenting accessibility barriers for wheelchair users and people with mobility impairments.',
        latitude: 33.8800,
        longitude: 35.4900,
        location_name: 'Hamra – Ras Beirut',
        max_volunteers: 10,
        ...bt(relDate(11, 9), relDate(11, 13)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Arc en Ciel')!,
        crisis_id: war,
        title: 'Persons with Disabilities Evacuation Support',
        description: 'Assist field teams supporting persons with disabilities evacuating from conflict zones to accessible shelters.',
        latitude: 33.8800,
        longitude: 35.4900,
        location_name: 'Arc en Ciel HQ, Beirut',
        max_volunteers: 12,
        ...bt(relDate(2, 8), relDate(4, 18)),
        minimum_age: 21,
        automatic_acceptance: false,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Arc en Ciel')!,
        crisis_id: null,
        title: 'Adaptive Sports Morning',
        description: 'Run an adaptive sports morning for youth with physical and sensory disabilities. Activities include bocce, sitting volleyball, and swimming.',
        latitude: 33.8790,
        longitude: 35.4920,
        location_name: 'Arc en Ciel Sports Centre',
        max_volunteers: 15,
        ...bt(relDate(25, 9), relDate(25, 13)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Green Hand')!,
        crisis_id: tyre,
        title: 'Tyre Shoreline Tar Removal',
        description: 'Help trained crews carefully remove tar and debris from the Tyre shoreline following the fuel spill.',
        latitude: 33.2700,
        longitude: 35.2050,
        location_name: 'Tyre Coast',
        max_volunteers: 35,
        ...bt(relDate(6, 7), relDate(6, 13)),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Green Hand')!,
        crisis_id: null,
        title: 'Urban Tree Planting – Beirut',
        description: 'Plant native trees and shrubs along a key Beirut boulevard as part of the urban greening initiative.',
        latitude: 33.8820,
        longitude: 35.5080,
        location_name: 'Corniche al-Mazraa, Beirut',
        max_volunteers: 20,
        ...bt(relDate(21, 8), relDate(21, 12)),
        minimum_age: 14,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Green Hand')!,
        crisis_id: null,
        title: 'Recycling Awareness Day – Schools',
        description: 'Visit three Beirut schools with interactive recycling and waste reduction workshops for students aged 10–16.',
        latitude: 33.8750,
        longitude: 35.5150,
        location_name: 'Beirut Public Schools',
        max_volunteers: 12,
        ...bt(relDate(29, 9), relDate(29, 13)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Basmeh & Zeitooneh')!,
        crisis_id: null,
        title: 'Refugee Community Learning Support',
        description: 'Support refugee children at a non-formal education centre in Beirut with literacy, numeracy, and creative activities.',
        latitude: 33.8670,
        longitude: 35.5100,
        location_name: 'Basmeh Centre, Shatila',
        max_volunteers: 15,
        ...bt(relDate(10, 14), relDate(10, 17)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Basmeh & Zeitooneh')!,
        crisis_id: war,
        title: 'Emergency NFI Distribution',
        description: 'Assist teams distributing non-food items (blankets, hygiene kits, clothing) to newly displaced families at a Beirut hub.',
        latitude: 33.8670,
        longitude: 35.5100,
        location_name: 'Basmeh Centre, Shatila',
        max_volunteers: 20,
        ...bt(relDate(3, 8), relDate(5, 16)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Basmeh & Zeitooneh')!,
        crisis_id: food,
        title: 'Community Kitchen – Shatila',
        description: 'Help prepare and serve daily hot meals to refugee and host community families at the Basmeh kitchen in Shatila.',
        latitude: 33.8670,
        longitude: 35.5100,
        location_name: 'Basmeh Kitchen, Shatila',
        max_volunteers: 12,
        ...bt(relDate(17, 10), relDate(17, 12)),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Kayany Foundation')!,
        crisis_id: null,
        title: 'Non-Formal Education Volunteer',
        description: 'Support Syrian refugee children in non-formal education classrooms. Help teachers deliver lessons in Arabic, maths, and life skills.',
        latitude: 33.8830,
        longitude: 35.5120,
        location_name: 'Kayany Learning Centre, Beirut',
        max_volunteers: 10,
        ...bt(relDate(12, 13), relDate(12, 16)),
        minimum_age: 18,
        automatic_acceptance: false,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Kayany Foundation')!,
        crisis_id: null,
        title: 'Psychosocial Activities for Children',
        description: 'Run structured psychosocial activities (art, play, drama) for Syrian refugee children aged 5–14 at a Beirut learning centre.',
        latitude: 33.8835,
        longitude: 35.5125,
        location_name: 'Kayany Learning Centre, Beirut',
        max_volunteers: 8,
        ...bt(relDate(19, 10), relDate(19, 14)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Sawa for Development')!,
        crisis_id: null,
        title: 'Women\'s Livelihood Skills Workshop',
        description: 'Assist facilitators running sewing, crafts, and small business training for women in South Lebanon.',
        latitude: 33.5300,
        longitude: 35.3700,
        location_name: 'Sawa Centre, Saida',
        max_volunteers: 6,
        ...bt(relDate(-15, 10), relDate(-15, 14)),
        minimum_age: 18,
        automatic_acceptance: false,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Sawa for Development')!,
        crisis_id: war,
        title: 'Displaced Women Support Circle',
        description: 'Facilitate peer support circles for women displaced by the conflict in South Lebanon. Trauma-informed approach; training provided.',
        latitude: 33.5300,
        longitude: 35.3700,
        location_name: 'Sawa Centre, Saida',
        max_volunteers: 5,
        ...bt(relDate(8, 9), relDate(10, 13)),
        minimum_age: 21,
        automatic_acceptance: false,
        allows_partial_attendance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Amel Association')!,
        crisis_id: null,
        title: 'Mobile Health Clinic Support',
        description: 'Support Amel\'s mobile health clinic visiting rural villages in South Lebanon with registration, patient flow, and pharmacy assistance.',
        latitude: 33.4500,
        longitude: 35.4300,
        location_name: 'South Lebanon Villages',
        max_volunteers: 8,
        ...bt(relDate(11, 8), relDate(11, 15)),
        minimum_age: 18,
        automatic_acceptance: false,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Amel Association')!,
        crisis_id: war,
        title: 'Emergency Health Triage Support',
        description: 'Assist Amel\'s medical teams running triage and first aid at a war-affected community health point in South Lebanon.',
        latitude: 33.4600,
        longitude: 35.4200,
        location_name: 'South Lebanon Emergency Health Point',
        max_volunteers: 10,
        ...bt(relDate(-4, 8), relDate(-2, 16)),
        minimum_age: 21,
        automatic_acceptance: false,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Amel Association')!,
        crisis_id: food,
        title: 'Food Basket Delivery – South Lebanon',
        description: 'Join field teams delivering monthly food baskets to elderly and disabled residents in South Lebanon villages.',
        latitude: 33.4000,
        longitude: 35.4900,
        location_name: 'South Lebanon Rural Route',
        max_volunteers: 12,
        ...bt(relDate(16, 9), relDate(16, 15)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Lebanese Red Cross Beirut')!,
        crisis_id: war,
        title: 'Blood Donation Campaign',
        description: 'Support the Red Cross blood drive responding to the surge in surgical need. Roles include donor registration, refreshments, and post-donation care.',
        latitude: 33.8870,
        longitude: 35.5040,
        location_name: 'LRC Blood Center, Spears Beirut',
        max_volunteers: 15,
        ...bt(relDate(5, 8), relDate(5, 16)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Lebanese Red Cross Beirut')!,
        crisis_id: null,
        title: 'CPR & First Aid Public Training',
        description: 'Help Red Cross trainers run a free, open CPR and basic first aid training session for the public.',
        latitude: 33.8870,
        longitude: 35.5040,
        location_name: 'LRC Headquarters, Beirut',
        max_volunteers: 10,
        ...bt(relDate(28, 9), relDate(28, 15)),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Lebanese Red Cross Beirut')!,
        crisis_id: war,
        title: 'Emergency Ambulance Dispatch Support',
        description: 'Assist the dispatch coordination team managing ambulance logistics and call routing during high-volume emergency periods.',
        latitude: 33.8870,
        longitude: 35.5040,
        location_name: 'LRC Operations Room, Beirut',
        max_volunteers: 6,
        ...bt(relDate(1, 7), relDate(3, 19)),
        minimum_age: 21,
        automatic_acceptance: false,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Nawaya Network')!,
        crisis_id: null,
        title: 'Youth Entrepreneurship Mentorship',
        description: 'Mentor young Lebanese entrepreneurs for four weekly sessions on business planning, pitching, and market research.',
        latitude: 33.8810,
        longitude: 35.5010,
        location_name: 'Nawaya Hub, Beirut',
        max_volunteers: 10,
        ...bt(relDate(21, 15), relDate(42, 18)),
        minimum_age: 23,
        automatic_acceptance: false,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nawaya Network')!,
        crisis_id: food,
        title: 'Food Micro-Enterprise Support',
        description: 'Help displaced women and unemployed youth launch and sustain small food production enterprises with skills training and supply logistics.',
        latitude: 33.8810,
        longitude: 35.5010,
        location_name: 'Nawaya Hub, Beirut',
        max_volunteers: 8,
        ...bt(relDate(14, 10), relDate(14, 14)),
        minimum_age: 21,
        automatic_acceptance: false,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Akkar Network for Development')!,
        crisis_id: akkar,
        title: 'Akkar Household Assessment Teams',
        description: 'Join household assessment teams documenting wildfire damage and recovery needs in remote Akkar villages.',
        latitude: 34.5500,
        longitude: 36.0600,
        location_name: 'Akkar Villages',
        max_volunteers: 12,
        ...bt(relDate(7, 8), relDate(9, 16)),
        minimum_age: 18,
        automatic_acceptance: false,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Akkar Network for Development')!,
        crisis_id: null,
        title: 'Agricultural Revival Day – Akkar',
        description: 'Help farmers replant crops on cleared land in Akkar with seeds and tools provided by the development network.',
        latitude: 34.5600,
        longitude: 36.0700,
        location_name: 'Akkar Farmlands',
        max_volunteers: 25,
        ...bt(relDate(31, 7), relDate(31, 15)),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Sidon Welfare Association')!,
        crisis_id: food,
        title: 'Monthly Food Parcel Distribution',
        description: 'Help volunteers distribute monthly food parcels to registered families in Saida and surrounding villages.',
        latitude: 33.5570,
        longitude: 35.3730,
        location_name: 'Sidon Welfare Centre, Saida',
        max_volunteers: 15,
        ...bt(relDate(-10, 9), relDate(-10, 14)),
        minimum_age: 14,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Sidon Welfare Association')!,
        crisis_id: null,
        title: 'Elderly Home Visiting Program',
        description: 'Visit isolated elderly residents in Saida, provide companionship, help with errands, and flag welfare concerns to the social team.',
        latitude: 33.5550,
        longitude: 35.3720,
        location_name: 'Saida City',
        max_volunteers: 10,
        ...bt(relDate(22, 10), relDate(22, 14)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Tyre Community Foundation')!,
        crisis_id: tyre,
        title: 'Tyre Beach Rehabilitation',
        description: 'Support the multi-week effort to rehabilitate Tyre\'s sandy beaches following the coastal pollution crisis.',
        latitude: 33.2705,
        longitude: 35.2038,
        location_name: 'Tyre Al-Bass Beach',
        max_volunteers: 30,
        ...bt(relDate(9, 8), relDate(11, 15)),
        minimum_age: 16,
        automatic_acceptance: true,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Tyre Community Foundation')!,
        crisis_id: null,
        title: 'Heritage Site Cleanup Day',
        description: 'Clean and maintain the UNESCO-listed archaeological sites in Tyre ahead of the tourist season.',
        latitude: 33.2700,
        longitude: 35.2030,
        location_name: 'Tyre Hippodrome & Al-Bass Site',
        max_volunteers: 20,
        ...bt(relDate(26, 8), relDate(26, 14)),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('South Lebanon Education Network')!,
        crisis_id: null,
        title: 'Volunteer Tutor – South Lebanon',
        description: 'Commit to four weeks of in-person or remote tutoring sessions for public school students in South Lebanon.',
        latitude: 33.4000,
        longitude: 35.4900,
        location_name: 'South Lebanon (various schools)',
        max_volunteers: 25,
        ...bt(relDate(-42, 14), relDate(-14, 17)),
        minimum_age: 18,
        automatic_acceptance: false,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('South Lebanon Education Network')!,
        crisis_id: war,
        title: 'Catch-Up Classes for Displaced Children',
        description: 'Run accelerated catch-up classes for war-displaced children who have missed school, hosted at a Saida community centre.',
        latitude: 33.3560,
        longitude: 35.4950,
        location_name: 'Saida Community Centre',
        max_volunteers: 12,
        ...bt(relDate(5, 14), relDate(7, 17)),
        minimum_age: 18,
        automatic_acceptance: false,
        allows_partial_attendance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Zahle Youth Council')!,
        crisis_id: bekaaFlood,
        title: 'Zahle Flood Relief Pack & Deliver',
        description: 'Help youth council teams pack and deliver hygiene kits and food to flood-affected households in Zahle.',
        latitude: 33.8500,
        longitude: 35.9050,
        location_name: 'Zahle Town Hall',
        max_volunteers: 20,
        ...bt(relDate(4, 9), relDate(4, 16)),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Zahle Youth Council')!,
        crisis_id: null,
        title: 'Youth Clean City Campaign',
        description: 'Join the Zahle Youth Council for a city-wide street cleaning, mural-painting, and beautification campaign.',
        latitude: 33.8500,
        longitude: 35.9050,
        location_name: 'Zahle City Centre',
        max_volunteers: 30,
        ...bt(relDate(23, 8), relDate(23, 15)),
        minimum_age: 12,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Zahle Youth Council')!,
        crisis_id: null,
        title: 'Bekaa After-School Sports Program',
        description: 'Coach and supervise after-school sports sessions for students at Zahle public schools, focusing on teamwork and inclusion.',
        latitude: 33.8510,
        longitude: 35.9060,
        location_name: 'Zahle Public Schools',
        max_volunteers: 10,
        ...bt(relDate(30, 15), relDate(57, 17)),
        minimum_age: 18,
        automatic_acceptance: true,
        allows_partial_attendance: true,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Beyond')!,
        crisis_id: null,
        title: 'Youth Leadership Summit Volunteer',
        description: 'Support the organizing team at Beyond\'s annual youth leadership summit for 200 participants from across Lebanon.',
        latitude: 33.8780,
        longitude: 35.4960,
        location_name: 'Beirut Forum Conference Centre',
        max_volunteers: 20,
        ...bt(relDate(33, 8), relDate(34, 18)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Beyond')!,
        crisis_id: null,
        title: 'Civic Engagement Workshop Facilitator',
        description: 'Facilitate a hands-on civic engagement workshop for university students on advocacy, community organizing, and policy literacy.',
        latitude: 33.8780,
        longitude: 35.4960,
        location_name: 'Beyond Office, Beirut',
        max_volunteers: 6,
        ...bt(relDate(41, 10), relDate(41, 14)),
        minimum_age: 21,
        automatic_acceptance: false,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Arcenciel Tripoli')!,
        crisis_id: null,
        title: 'Recycling Drive – Tripoli',
        description: 'Help collect and sort recyclable materials in Tripoli neighborhoods as part of the monthly community recycling program.',
        latitude: 34.4400,
        longitude: 35.8360,
        location_name: 'Tripoli (various neighborhoods)',
        max_volunteers: 18,
        ...bt(relDate(13, 8), relDate(13, 13)),
        minimum_age: 14,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Arcenciel Tripoli')!,
        crisis_id: akkar,
        title: 'Disability-Sensitive Relief Distribution',
        description: 'Ensure wildfire relief items are distributed in an accessible and dignified way for persons with disabilities in Akkar.',
        latitude: 34.5500,
        longitude: 36.0600,
        location_name: 'Akkar Relief Point',
        max_volunteers: 10,
        ...bt(relDate(16, 9), relDate(17, 15)),
        minimum_age: 18,
        automatic_acceptance: false,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Himaya')!,
        crisis_id: null,
        title: 'Child Safety Awareness Event',
        description: 'Support Himaya\'s child protection awareness event at a Beirut school, including games, presentations, and parent workshops.',
        latitude: 33.8840,
        longitude: 35.5060,
        location_name: 'Beirut Public School',
        max_volunteers: 10,
        ...bt(relDate(18, 9), relDate(18, 14)),
        minimum_age: 21,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Himaya')!,
        crisis_id: war,
        title: 'Child Protection Hotline Backup',
        description: 'Provide backup support to Himaya\'s child protection hotline during peak call periods driven by the conflict crisis.',
        latitude: 33.8840,
        longitude: 35.5060,
        location_name: 'Himaya Office, Beirut',
        max_volunteers: 4,
        ...bt(relDate(3, 9), relDate(5, 17)),
        minimum_age: 21,
        automatic_acceptance: false,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Terre des hommes Lebanon')!,
        crisis_id: war,
        title: 'Child-Friendly Space Activities',
        description: 'Run structured child-friendly space activities (play, art, movement) for war-displaced children in a Beirut safe space.',
        latitude: 33.8760,
        longitude: 35.5080,
        location_name: 'TDH Child-Friendly Space, Beirut',
        max_volunteers: 10,
        ...bt(relDate(6, 10), relDate(8, 14)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Terre des hommes Lebanon')!,
        crisis_id: null,
        title: 'Child Rights Education Session',
        description: 'Deliver a child-rights awareness session to students at a Beirut public school, guided by TDH materials.',
        latitude: 33.8760,
        longitude: 35.5080,
        location_name: 'Beirut Public School',
        max_volunteers: 6,
        ...bt(relDate(27, 10), relDate(27, 13)),
        minimum_age: 21,
        automatic_acceptance: false,
        is_closed: false,
      },

      {
        organization_id: orgByName.get('Impact Lebanon')!,
        crisis_id: war,
        title: 'Relief Fund Transparency Reporting',
        description: 'Help Impact Lebanon document and verify relief fund usage for diaspora donors, visiting partner sites and compiling written reports.',
        latitude: 33.8930,
        longitude: 35.5070,
        location_name: 'Beirut (various sites)',
        max_volunteers: 5,
        ...bt(relDate(12, 9), relDate(15, 16)),
        minimum_age: 21,
        automatic_acceptance: false,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Impact Lebanon')!,
        crisis_id: null,
        title: 'Diaspora Connect Volunteer Event',
        description: 'Help organize and run a networking event connecting Lebanese diaspora volunteers visiting Beirut with local NGOs.',
        latitude: 33.8930,
        longitude: 35.5070,
        location_name: 'Beirut Event Venue',
        max_volunteers: 15,
        ...bt(relDate(38, 9), relDate(38, 18)),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },

    ])
    .returning(['id', 'title', 'start_date', 'end_date', 'allows_partial_attendance'])
    .execute();

  const postingByTitle = new Map(postings.map(p => [p.title, p.id]));

  // Posting Skills

  await database.insertInto('posting_skill').values([
    // Blood Drive Coordination
    { posting_id: postingByTitle.get('Blood Drive Coordination')!, name: 'Organisation' },
    { posting_id: postingByTitle.get('Blood Drive Coordination')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Blood Drive Coordination')!, name: 'Data Entry' },
    { posting_id: postingByTitle.get('Blood Drive Coordination')!, name: 'Customer Service' },

    // Emergency Food Packing
    { posting_id: postingByTitle.get('Emergency Food Packing')!, name: 'Packing' },
    { posting_id: postingByTitle.get('Emergency Food Packing')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Emergency Food Packing')!, name: 'Inventory Handling' },
    { posting_id: postingByTitle.get('Emergency Food Packing')!, name: 'Organisation' },

    // Mobile Aid Kit Distribution
    { posting_id: postingByTitle.get('Mobile Aid Kit Distribution')!, name: 'Distribution' },
    { posting_id: postingByTitle.get('Mobile Aid Kit Distribution')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Mobile Aid Kit Distribution')!, name: 'Safety Awareness' },
    { posting_id: postingByTitle.get('Mobile Aid Kit Distribution')!, name: 'Organisation' },

    // First Aid Support
    { posting_id: postingByTitle.get('First Aid Support')!, name: 'First Aid' },
    { posting_id: postingByTitle.get('First Aid Support')!, name: 'Medical Assistance' },
    { posting_id: postingByTitle.get('First Aid Support')!, name: 'Crisis Response' },
    { posting_id: postingByTitle.get('First Aid Support')!, name: 'Triage Support' },
    { posting_id: postingByTitle.get('First Aid Support')!, name: 'Teamwork' },

    // Displaced Families Registration
    { posting_id: postingByTitle.get('Displaced Families Registration')!, name: 'Data Entry' },
    { posting_id: postingByTitle.get('Displaced Families Registration')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Displaced Families Registration')!, name: 'Arabic' },
    { posting_id: postingByTitle.get('Displaced Families Registration')!, name: 'Organisation' },
    { posting_id: postingByTitle.get('Displaced Families Registration')!, name: 'Empathy' },

    // Emergency Shelter Setup
    { posting_id: postingByTitle.get('Emergency Shelter Setup')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Emergency Shelter Setup')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Emergency Shelter Setup')!, name: 'Safety Awareness' },
    { posting_id: postingByTitle.get('Emergency Shelter Setup')!, name: 'Construction' },

    // War Survivor Psychosocial Support
    { posting_id: postingByTitle.get('War Survivor Psychosocial Support')!, name: 'Emotional Support' },
    { posting_id: postingByTitle.get('War Survivor Psychosocial Support')!, name: 'Active Listening' },
    { posting_id: postingByTitle.get('War Survivor Psychosocial Support')!, name: 'Empathy' },
    { posting_id: postingByTitle.get('War Survivor Psychosocial Support')!, name: 'Communication' },

    // Meals for the Displaced
    { posting_id: postingByTitle.get('Meals for the Displaced')!, name: 'Cooking' },
    { posting_id: postingByTitle.get('Meals for the Displaced')!, name: 'Food Preparation' },
    { posting_id: postingByTitle.get('Meals for the Displaced')!, name: 'Serving' },
    { posting_id: postingByTitle.get('Meals for the Displaced')!, name: 'Teamwork' },

    // Children's Activities in Shelters
    { posting_id: postingByTitle.get('Children\'s Activities in Shelters')!, name: 'Child Engagement' },
    { posting_id: postingByTitle.get('Children\'s Activities in Shelters')!, name: 'Creativity' },
    { posting_id: postingByTitle.get('Children\'s Activities in Shelters')!, name: 'Patience' },
    { posting_id: postingByTitle.get('Children\'s Activities in Shelters')!, name: 'Communication' },

    // Psychological First Aid Sessions
    { posting_id: postingByTitle.get('Psychological First Aid Sessions')!, name: 'Emotional Support' },
    { posting_id: postingByTitle.get('Psychological First Aid Sessions')!, name: 'Active Listening' },
    { posting_id: postingByTitle.get('Psychological First Aid Sessions')!, name: 'Empathy' },
    { posting_id: postingByTitle.get('Psychological First Aid Sessions')!, name: 'Communication' },

    // Winter Blanket Distribution
    { posting_id: postingByTitle.get('Winter Blanket Distribution')!, name: 'Sorting' },
    { posting_id: postingByTitle.get('Winter Blanket Distribution')!, name: 'Packing' },
    { posting_id: postingByTitle.get('Winter Blanket Distribution')!, name: 'Organisation' },
    { posting_id: postingByTitle.get('Winter Blanket Distribution')!, name: 'Teamwork' },

    // Community Health Screening Day
    { posting_id: postingByTitle.get('Community Health Screening Day')!, name: 'Medical Assistance' },
    { posting_id: postingByTitle.get('Community Health Screening Day')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Community Health Screening Day')!, name: 'Data Entry' },
    { posting_id: postingByTitle.get('Community Health Screening Day')!, name: 'Organisation' },

    // Supply Convoy Loading
    { posting_id: postingByTitle.get('Supply Convoy Loading')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Supply Convoy Loading')!, name: 'Logistics' },
    { posting_id: postingByTitle.get('Supply Convoy Loading')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Supply Convoy Loading')!, name: 'Packing' },

    // Inclusive Sports Day
    { posting_id: postingByTitle.get('Inclusive Sports Day')!, name: 'Inclusion Support' },
    { posting_id: postingByTitle.get('Inclusive Sports Day')!, name: 'Physical Assistance' },
    { posting_id: postingByTitle.get('Inclusive Sports Day')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Inclusive Sports Day')!, name: 'Communication' },

    // Community Kitchen
    { posting_id: postingByTitle.get('Community Kitchen')!, name: 'Cooking' },
    { posting_id: postingByTitle.get('Community Kitchen')!, name: 'Food Preparation' },
    { posting_id: postingByTitle.get('Community Kitchen')!, name: 'Serving' },
    { posting_id: postingByTitle.get('Community Kitchen')!, name: 'Hygiene' },
    { posting_id: postingByTitle.get('Community Kitchen')!, name: 'Teamwork' },

    // Remote Homework Support
    { posting_id: postingByTitle.get('Remote Homework Support')!, name: 'Teaching' },
    { posting_id: postingByTitle.get('Remote Homework Support')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Remote Homework Support')!, name: 'Remote Support' },
    { posting_id: postingByTitle.get('Remote Homework Support')!, name: 'Explaining Concepts' },
    { posting_id: postingByTitle.get('Remote Homework Support')!, name: 'Problem Solving' },

    // Winter Clothing Distribution
    { posting_id: postingByTitle.get('Winter Clothing Distribution')!, name: 'Sorting' },
    { posting_id: postingByTitle.get('Winter Clothing Distribution')!, name: 'Packing' },
    { posting_id: postingByTitle.get('Winter Clothing Distribution')!, name: 'Organisation' },
    { posting_id: postingByTitle.get('Winter Clothing Distribution')!, name: 'Inventory Handling' },

    // Community Storytelling Circle
    { posting_id: postingByTitle.get('Community Storytelling Circle')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Community Storytelling Circle')!, name: 'Storytelling' },
    { posting_id: postingByTitle.get('Community Storytelling Circle')!, name: 'Community Engagement' },
    { posting_id: postingByTitle.get('Community Storytelling Circle')!, name: 'Empathy' },

    // Youth Reading Circle
    { posting_id: postingByTitle.get('Youth Reading Circle')!, name: 'Storytelling' },
    { posting_id: postingByTitle.get('Youth Reading Circle')!, name: 'Child Engagement' },
    { posting_id: postingByTitle.get('Youth Reading Circle')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Youth Reading Circle')!, name: 'Patience' },

    // Junior Sports Field Prep
    { posting_id: postingByTitle.get('Junior Sports Field Prep')!, name: 'Line Marking' },
    { posting_id: postingByTitle.get('Junior Sports Field Prep')!, name: 'Equipment Setup' },
    { posting_id: postingByTitle.get('Junior Sports Field Prep')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Junior Sports Field Prep')!, name: 'Light Groundskeeping' },

    // Refugee Family Intake Support
    { posting_id: postingByTitle.get('Refugee Family Intake Support')!, name: 'Arabic' },
    { posting_id: postingByTitle.get('Refugee Family Intake Support')!, name: 'Data Entry' },
    { posting_id: postingByTitle.get('Refugee Family Intake Support')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Refugee Family Intake Support')!, name: 'Empathy' },

    // Wildfire Relief Distribution
    { posting_id: postingByTitle.get('Wildfire Relief Distribution')!, name: 'Logistics' },
    { posting_id: postingByTitle.get('Wildfire Relief Distribution')!, name: 'Packing' },
    { posting_id: postingByTitle.get('Wildfire Relief Distribution')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Wildfire Relief Distribution')!, name: 'Teamwork' },

    // Medical Supplies Inventory & Sorting
    { posting_id: postingByTitle.get('Medical Supplies Inventory & Sorting')!, name: 'Inventory Handling' },
    { posting_id: postingByTitle.get('Medical Supplies Inventory & Sorting')!, name: 'Attention to Detail' },
    { posting_id: postingByTitle.get('Medical Supplies Inventory & Sorting')!, name: 'Organisation' },
    { posting_id: postingByTitle.get('Medical Supplies Inventory & Sorting')!, name: 'Label Checking' },
    { posting_id: postingByTitle.get('Medical Supplies Inventory & Sorting')!, name: 'Accuracy' },

    // Community Garden Open Help Day
    { posting_id: postingByTitle.get('Community Garden Open Help Day')!, name: 'Gardening' },
    { posting_id: postingByTitle.get('Community Garden Open Help Day')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Community Garden Open Help Day')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Community Garden Open Help Day')!, name: 'Outdoor Work' },

    // Coastal Cleanup
    { posting_id: postingByTitle.get('Coastal Cleanup')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Coastal Cleanup')!, name: 'Environmental Awareness' },
    { posting_id: postingByTitle.get('Coastal Cleanup')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Coastal Cleanup')!, name: 'Waste Sorting' },

    // Children's Art & Story Workshop
    { posting_id: postingByTitle.get('Children\'s Art & Story Workshop')!, name: 'Creativity' },
    { posting_id: postingByTitle.get('Children\'s Art & Story Workshop')!, name: 'Storytelling' },
    { posting_id: postingByTitle.get('Children\'s Art & Story Workshop')!, name: 'Child Engagement' },
    { posting_id: postingByTitle.get('Children\'s Art & Story Workshop')!, name: 'Art' },

    // Youth Garden Helpers
    { posting_id: postingByTitle.get('Youth Garden Helpers')!, name: 'Gardening' },
    { posting_id: postingByTitle.get('Youth Garden Helpers')!, name: 'Light Groundskeeping' },
    { posting_id: postingByTitle.get('Youth Garden Helpers')!, name: 'Teamwork' },

    // Family Water Station Support
    { posting_id: postingByTitle.get('Family Water Station Support')!, name: 'Customer Service' },
    { posting_id: postingByTitle.get('Family Water Station Support')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Family Water Station Support')!, name: 'Community Support' },

    // Debris Clearance
    { posting_id: postingByTitle.get('Debris Clearance')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Debris Clearance')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Debris Clearance')!, name: 'Construction' },
    { posting_id: postingByTitle.get('Debris Clearance')!, name: 'Safety Awareness' },

    // Reforestation Day – Akkar
    { posting_id: postingByTitle.get('Reforestation Day – Akkar')!, name: 'Gardening' },
    { posting_id: postingByTitle.get('Reforestation Day – Akkar')!, name: 'Outdoor Work' },
    { posting_id: postingByTitle.get('Reforestation Day – Akkar')!, name: 'Environmental Awareness' },
    { posting_id: postingByTitle.get('Reforestation Day – Akkar')!, name: 'Teamwork' },

    // Volunteer Helpline Shifts
    { posting_id: postingByTitle.get('Volunteer Helpline Shifts')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Volunteer Helpline Shifts')!, name: 'Active Listening' },
    { posting_id: postingByTitle.get('Volunteer Helpline Shifts')!, name: 'Remote Support' },
    { posting_id: postingByTitle.get('Volunteer Helpline Shifts')!, name: 'Data Entry' },

    // Neighborhood Repair Week
    { posting_id: postingByTitle.get('Neighborhood Repair Week')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Neighborhood Repair Week')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Neighborhood Repair Week')!, name: 'Painting' },
    { posting_id: postingByTitle.get('Neighborhood Repair Week')!, name: 'Construction' },

    // One-Day Hotline Sprint
    { posting_id: postingByTitle.get('One-Day Hotline Sprint')!, name: 'Communication' },
    { posting_id: postingByTitle.get('One-Day Hotline Sprint')!, name: 'Active Listening' },
    { posting_id: postingByTitle.get('One-Day Hotline Sprint')!, name: 'Data Entry' },
    { posting_id: postingByTitle.get('One-Day Hotline Sprint')!, name: 'Calm Under Pressure' },

    // Crisis Hotline Coverage Week
    { posting_id: postingByTitle.get('Crisis Hotline Coverage Week')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Crisis Hotline Coverage Week')!, name: 'Active Listening' },
    { posting_id: postingByTitle.get('Crisis Hotline Coverage Week')!, name: 'Remote Support' },
    { posting_id: postingByTitle.get('Crisis Hotline Coverage Week')!, name: 'Data Entry' },

    // Urban Search & Rescue Logistics
    { posting_id: postingByTitle.get('Urban Search & Rescue Logistics')!, name: 'Logistics' },
    { posting_id: postingByTitle.get('Urban Search & Rescue Logistics')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Urban Search & Rescue Logistics')!, name: 'Crisis Response' },
    { posting_id: postingByTitle.get('Urban Search & Rescue Logistics')!, name: 'Organisation' },

    // First Aid Training Day
    { posting_id: postingByTitle.get('First Aid Training Day')!, name: 'First Aid' },
    { posting_id: postingByTitle.get('First Aid Training Day')!, name: 'Communication' },
    { posting_id: postingByTitle.get('First Aid Training Day')!, name: 'Teaching' },

    // Displacement Shelter Coordination
    { posting_id: postingByTitle.get('Displacement Shelter Coordination')!, name: 'Organisation' },
    { posting_id: postingByTitle.get('Displacement Shelter Coordination')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Displacement Shelter Coordination')!, name: 'Logistics' },
    { posting_id: postingByTitle.get('Displacement Shelter Coordination')!, name: 'Data Entry' },

    // Flood Cleanup Crew
    { posting_id: postingByTitle.get('Flood Cleanup Crew')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Flood Cleanup Crew')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Flood Cleanup Crew')!, name: 'Safety Awareness' },
    { posting_id: postingByTitle.get('Flood Cleanup Crew')!, name: 'Logistics' },

    // School Supply Restocking
    { posting_id: postingByTitle.get('School Supply Restocking')!, name: 'Organisation' },
    { posting_id: postingByTitle.get('School Supply Restocking')!, name: 'Packing' },
    { posting_id: postingByTitle.get('School Supply Restocking')!, name: 'Inventory Handling' },
    { posting_id: postingByTitle.get('School Supply Restocking')!, name: 'Communication' },

    // Farm Recovery Rotation
    { posting_id: postingByTitle.get('Farm Recovery Rotation')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Farm Recovery Rotation')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Farm Recovery Rotation')!, name: 'Organisation' },
    { posting_id: postingByTitle.get('Farm Recovery Rotation')!, name: 'Outdoor Work' },

    // Bekaa Food Parcel Drive
    { posting_id: postingByTitle.get('Bekaa Food Parcel Drive')!, name: 'Packing' },
    { posting_id: postingByTitle.get('Bekaa Food Parcel Drive')!, name: 'Distribution' },
    { posting_id: postingByTitle.get('Bekaa Food Parcel Drive')!, name: 'Teamwork' },

    // Bekaa Youth Football League Setup
    { posting_id: postingByTitle.get('Bekaa Youth Football League Setup')!, name: 'Equipment Setup' },
    { posting_id: postingByTitle.get('Bekaa Youth Football League Setup')!, name: 'Organisation' },
    { posting_id: postingByTitle.get('Bekaa Youth Football League Setup')!, name: 'Teamwork' },

    // Stateless Persons Documentation Support
    { posting_id: postingByTitle.get('Stateless Persons Documentation Support')!, name: 'Data Entry' },
    { posting_id: postingByTitle.get('Stateless Persons Documentation Support')!, name: 'Arabic' },
    { posting_id: postingByTitle.get('Stateless Persons Documentation Support')!, name: 'Empathy' },

    // Know Your Rights Workshop
    { posting_id: postingByTitle.get('Know Your Rights Workshop')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Know Your Rights Workshop')!, name: 'Teaching' },
    { posting_id: postingByTitle.get('Know Your Rights Workshop')!, name: 'Arabic' },

    // Asylum Seeker Intake Assistance
    { posting_id: postingByTitle.get('Asylum Seeker Intake Assistance')!, name: 'Data Entry' },
    { posting_id: postingByTitle.get('Asylum Seeker Intake Assistance')!, name: 'Empathy' },
    { posting_id: postingByTitle.get('Asylum Seeker Intake Assistance')!, name: 'Communication' },

    // Home Repair Volunteer Day
    { posting_id: postingByTitle.get('Home Repair Volunteer Day')!, name: 'Construction' },
    { posting_id: postingByTitle.get('Home Repair Volunteer Day')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Home Repair Volunteer Day')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Home Repair Volunteer Day')!, name: 'Safety Awareness' },

    // Akkar Rebuilding Week
    { posting_id: postingByTitle.get('Akkar Rebuilding Week')!, name: 'Construction' },
    { posting_id: postingByTitle.get('Akkar Rebuilding Week')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Akkar Rebuilding Week')!, name: 'Teamwork' },

    // Urban Mural & Beautification Day
    { posting_id: postingByTitle.get('Urban Mural & Beautification Day')!, name: 'Art' },
    { posting_id: postingByTitle.get('Urban Mural & Beautification Day')!, name: 'Painting' },
    { posting_id: postingByTitle.get('Urban Mural & Beautification Day')!, name: 'Community Engagement' },

    // Weekend Food Sort & Pack
    { posting_id: postingByTitle.get('Weekend Food Sort & Pack')!, name: 'Sorting' },
    { posting_id: postingByTitle.get('Weekend Food Sort & Pack')!, name: 'Inventory Handling' },
    { posting_id: postingByTitle.get('Weekend Food Sort & Pack')!, name: 'Teamwork' },

    // Mobile Food Pantry – Tripoli
    { posting_id: postingByTitle.get('Mobile Food Pantry – Tripoli')!, name: 'Distribution' },
    { posting_id: postingByTitle.get('Mobile Food Pantry – Tripoli')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Mobile Food Pantry – Tripoli')!, name: 'Teamwork' },

    // Crisis Food Parcel Assembly Line
    { posting_id: postingByTitle.get('Crisis Food Parcel Assembly Line')!, name: 'Packing' },
    { posting_id: postingByTitle.get('Crisis Food Parcel Assembly Line')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Crisis Food Parcel Assembly Line')!, name: 'Organisation' },

    // Accessibility Audit – Beirut Streets
    { posting_id: postingByTitle.get('Accessibility Audit – Beirut Streets')!, name: 'Attention to Detail' },
    { posting_id: postingByTitle.get('Accessibility Audit – Beirut Streets')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Accessibility Audit – Beirut Streets')!, name: 'Inclusion Support' },

    // Persons with Disabilities Evacuation Support
    { posting_id: postingByTitle.get('Persons with Disabilities Evacuation Support')!, name: 'Physical Assistance' },
    { posting_id: postingByTitle.get('Persons with Disabilities Evacuation Support')!, name: 'Empathy' },
    { posting_id: postingByTitle.get('Persons with Disabilities Evacuation Support')!, name: 'Logistics' },

    // Adaptive Sports Morning
    { posting_id: postingByTitle.get('Adaptive Sports Morning')!, name: 'Inclusion Support' },
    { posting_id: postingByTitle.get('Adaptive Sports Morning')!, name: 'Physical Assistance' },
    { posting_id: postingByTitle.get('Adaptive Sports Morning')!, name: 'Communication' },

    // Tyre Shoreline Tar Removal
    { posting_id: postingByTitle.get('Tyre Shoreline Tar Removal')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Tyre Shoreline Tar Removal')!, name: 'Environmental Awareness' },
    { posting_id: postingByTitle.get('Tyre Shoreline Tar Removal')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Tyre Shoreline Tar Removal')!, name: 'Waste Sorting' },

    // Urban Tree Planting – Beirut
    { posting_id: postingByTitle.get('Urban Tree Planting – Beirut')!, name: 'Gardening' },
    { posting_id: postingByTitle.get('Urban Tree Planting – Beirut')!, name: 'Outdoor Work' },
    { posting_id: postingByTitle.get('Urban Tree Planting – Beirut')!, name: 'Teamwork' },

    // Recycling Awareness Day – Schools
    { posting_id: postingByTitle.get('Recycling Awareness Day – Schools')!, name: 'Teaching' },
    { posting_id: postingByTitle.get('Recycling Awareness Day – Schools')!, name: 'Environmental Awareness' },
    { posting_id: postingByTitle.get('Recycling Awareness Day – Schools')!, name: 'Communication' },

    // Refugee Community Learning Support
    { posting_id: postingByTitle.get('Refugee Community Learning Support')!, name: 'Teaching' },
    { posting_id: postingByTitle.get('Refugee Community Learning Support')!, name: 'Child Engagement' },
    { posting_id: postingByTitle.get('Refugee Community Learning Support')!, name: 'Patience' },

    // Emergency NFI Distribution
    { posting_id: postingByTitle.get('Emergency NFI Distribution')!, name: 'Distribution' },
    { posting_id: postingByTitle.get('Emergency NFI Distribution')!, name: 'Packing' },
    { posting_id: postingByTitle.get('Emergency NFI Distribution')!, name: 'Teamwork' },

    // Community Kitchen – Shatila
    { posting_id: postingByTitle.get('Community Kitchen – Shatila')!, name: 'Cooking' },
    { posting_id: postingByTitle.get('Community Kitchen – Shatila')!, name: 'Food Preparation' },
    { posting_id: postingByTitle.get('Community Kitchen – Shatila')!, name: 'Teamwork' },

    // Non-Formal Education Volunteer
    { posting_id: postingByTitle.get('Non-Formal Education Volunteer')!, name: 'Teaching' },
    { posting_id: postingByTitle.get('Non-Formal Education Volunteer')!, name: 'Arabic' },
    { posting_id: postingByTitle.get('Non-Formal Education Volunteer')!, name: 'Patience' },
    { posting_id: postingByTitle.get('Non-Formal Education Volunteer')!, name: 'Child Engagement' },

    // Psychosocial Activities for Children
    { posting_id: postingByTitle.get('Psychosocial Activities for Children')!, name: 'Child Engagement' },
    { posting_id: postingByTitle.get('Psychosocial Activities for Children')!, name: 'Creativity' },
    { posting_id: postingByTitle.get('Psychosocial Activities for Children')!, name: 'Emotional Support' },

    // Women's Livelihood Skills Workshop
    { posting_id: postingByTitle.get('Women\'s Livelihood Skills Workshop')!, name: 'Teaching' },
    { posting_id: postingByTitle.get('Women\'s Livelihood Skills Workshop')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Women\'s Livelihood Skills Workshop')!, name: 'Empathy' },

    // Displaced Women Support Circle
    { posting_id: postingByTitle.get('Displaced Women Support Circle')!, name: 'Emotional Support' },
    { posting_id: postingByTitle.get('Displaced Women Support Circle')!, name: 'Active Listening' },
    { posting_id: postingByTitle.get('Displaced Women Support Circle')!, name: 'Empathy' },

    // Mobile Health Clinic Support
    { posting_id: postingByTitle.get('Mobile Health Clinic Support')!, name: 'Medical Assistance' },
    { posting_id: postingByTitle.get('Mobile Health Clinic Support')!, name: 'Organisation' },
    { posting_id: postingByTitle.get('Mobile Health Clinic Support')!, name: 'Communication' },

    // Emergency Health Triage Support
    { posting_id: postingByTitle.get('Emergency Health Triage Support')!, name: 'First Aid' },
    { posting_id: postingByTitle.get('Emergency Health Triage Support')!, name: 'Medical Assistance' },
    { posting_id: postingByTitle.get('Emergency Health Triage Support')!, name: 'Triage Support' },
    { posting_id: postingByTitle.get('Emergency Health Triage Support')!, name: 'Crisis Response' },

    // Food Basket Delivery – South Lebanon
    { posting_id: postingByTitle.get('Food Basket Delivery – South Lebanon')!, name: 'Distribution' },
    { posting_id: postingByTitle.get('Food Basket Delivery – South Lebanon')!, name: 'Logistics' },
    { posting_id: postingByTitle.get('Food Basket Delivery – South Lebanon')!, name: 'Teamwork' },

    // Blood Donation Campaign
    { posting_id: postingByTitle.get('Blood Donation Campaign')!, name: 'Organisation' },
    { posting_id: postingByTitle.get('Blood Donation Campaign')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Blood Donation Campaign')!, name: 'Customer Service' },

    // CPR & First Aid Public Training
    { posting_id: postingByTitle.get('CPR & First Aid Public Training')!, name: 'First Aid' },
    { posting_id: postingByTitle.get('CPR & First Aid Public Training')!, name: 'Teaching' },
    { posting_id: postingByTitle.get('CPR & First Aid Public Training')!, name: 'Communication' },

    // Emergency Ambulance Dispatch Support
    { posting_id: postingByTitle.get('Emergency Ambulance Dispatch Support')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Emergency Ambulance Dispatch Support')!, name: 'Data Entry' },
    { posting_id: postingByTitle.get('Emergency Ambulance Dispatch Support')!, name: 'Calm Under Pressure' },

    // Youth Entrepreneurship Mentorship
    { posting_id: postingByTitle.get('Youth Entrepreneurship Mentorship')!, name: 'Teaching' },
    { posting_id: postingByTitle.get('Youth Entrepreneurship Mentorship')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Youth Entrepreneurship Mentorship')!, name: 'Problem Solving' },

    // Food Micro-Enterprise Support
    { posting_id: postingByTitle.get('Food Micro-Enterprise Support')!, name: 'Teaching' },
    { posting_id: postingByTitle.get('Food Micro-Enterprise Support')!, name: 'Cooking' },
    { posting_id: postingByTitle.get('Food Micro-Enterprise Support')!, name: 'Organisation' },

    // Akkar Household Assessment Teams
    { posting_id: postingByTitle.get('Akkar Household Assessment Teams')!, name: 'Data Entry' },
    { posting_id: postingByTitle.get('Akkar Household Assessment Teams')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Akkar Household Assessment Teams')!, name: 'Attention to Detail' },

    // Agricultural Revival Day – Akkar
    { posting_id: postingByTitle.get('Agricultural Revival Day – Akkar')!, name: 'Outdoor Work' },
    { posting_id: postingByTitle.get('Agricultural Revival Day – Akkar')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Agricultural Revival Day – Akkar')!, name: 'Teamwork' },

    // Monthly Food Parcel Distribution
    { posting_id: postingByTitle.get('Monthly Food Parcel Distribution')!, name: 'Distribution' },
    { posting_id: postingByTitle.get('Monthly Food Parcel Distribution')!, name: 'Organisation' },
    { posting_id: postingByTitle.get('Monthly Food Parcel Distribution')!, name: 'Teamwork' },

    // Elderly Home Visiting Program
    { posting_id: postingByTitle.get('Elderly Home Visiting Program')!, name: 'Empathy' },
    { posting_id: postingByTitle.get('Elderly Home Visiting Program')!, name: 'Active Listening' },
    { posting_id: postingByTitle.get('Elderly Home Visiting Program')!, name: 'Communication' },

    // Tyre Beach Rehabilitation
    { posting_id: postingByTitle.get('Tyre Beach Rehabilitation')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Tyre Beach Rehabilitation')!, name: 'Environmental Awareness' },
    { posting_id: postingByTitle.get('Tyre Beach Rehabilitation')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Tyre Beach Rehabilitation')!, name: 'Waste Sorting' },

    // Heritage Site Cleanup Day
    { posting_id: postingByTitle.get('Heritage Site Cleanup Day')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Heritage Site Cleanup Day')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Heritage Site Cleanup Day')!, name: 'Attention to Detail' },

    // Volunteer Tutor – South Lebanon
    { posting_id: postingByTitle.get('Volunteer Tutor – South Lebanon')!, name: 'Teaching' },
    { posting_id: postingByTitle.get('Volunteer Tutor – South Lebanon')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Volunteer Tutor – South Lebanon')!, name: 'Patience' },
    { posting_id: postingByTitle.get('Volunteer Tutor – South Lebanon')!, name: 'Arabic' },

    // Catch-Up Classes for Displaced Children
    { posting_id: postingByTitle.get('Catch-Up Classes for Displaced Children')!, name: 'Teaching' },
    { posting_id: postingByTitle.get('Catch-Up Classes for Displaced Children')!, name: 'Child Engagement' },
    { posting_id: postingByTitle.get('Catch-Up Classes for Displaced Children')!, name: 'Arabic' },
    { posting_id: postingByTitle.get('Catch-Up Classes for Displaced Children')!, name: 'Patience' },

    // Zahle Flood Relief Pack & Deliver
    { posting_id: postingByTitle.get('Zahle Flood Relief Pack & Deliver')!, name: 'Packing' },
    { posting_id: postingByTitle.get('Zahle Flood Relief Pack & Deliver')!, name: 'Distribution' },
    { posting_id: postingByTitle.get('Zahle Flood Relief Pack & Deliver')!, name: 'Teamwork' },

    // Youth Clean City Campaign
    { posting_id: postingByTitle.get('Youth Clean City Campaign')!, name: 'Community Engagement' },
    { posting_id: postingByTitle.get('Youth Clean City Campaign')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Youth Clean City Campaign')!, name: 'Physical Stamina' },

    // Bekaa After-School Sports Program
    { posting_id: postingByTitle.get('Bekaa After-School Sports Program')!, name: 'Teaching' },
    { posting_id: postingByTitle.get('Bekaa After-School Sports Program')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Bekaa After-School Sports Program')!, name: 'Inclusion Support' },

    // Youth Leadership Summit Volunteer
    { posting_id: postingByTitle.get('Youth Leadership Summit Volunteer')!, name: 'Organisation' },
    { posting_id: postingByTitle.get('Youth Leadership Summit Volunteer')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Youth Leadership Summit Volunteer')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Youth Leadership Summit Volunteer')!, name: 'Customer Service' },

    // Civic Engagement Workshop Facilitator
    { posting_id: postingByTitle.get('Civic Engagement Workshop Facilitator')!, name: 'Teaching' },
    { posting_id: postingByTitle.get('Civic Engagement Workshop Facilitator')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Civic Engagement Workshop Facilitator')!, name: 'Community Engagement' },

    // Recycling Drive – Tripoli
    { posting_id: postingByTitle.get('Recycling Drive – Tripoli')!, name: 'Waste Sorting' },
    { posting_id: postingByTitle.get('Recycling Drive – Tripoli')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Recycling Drive – Tripoli')!, name: 'Environmental Awareness' },

    // Disability-Sensitive Relief Distribution
    { posting_id: postingByTitle.get('Disability-Sensitive Relief Distribution')!, name: 'Inclusion Support' },
    { posting_id: postingByTitle.get('Disability-Sensitive Relief Distribution')!, name: 'Empathy' },
    { posting_id: postingByTitle.get('Disability-Sensitive Relief Distribution')!, name: 'Communication' },

    // Child Safety Awareness Event
    { posting_id: postingByTitle.get('Child Safety Awareness Event')!, name: 'Child Engagement' },
    { posting_id: postingByTitle.get('Child Safety Awareness Event')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Child Safety Awareness Event')!, name: 'Community Engagement' },

    // Child Protection Hotline Backup
    { posting_id: postingByTitle.get('Child Protection Hotline Backup')!, name: 'Active Listening' },
    { posting_id: postingByTitle.get('Child Protection Hotline Backup')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Child Protection Hotline Backup')!, name: 'Calm Under Pressure' },

    // Child-Friendly Space Activities
    { posting_id: postingByTitle.get('Child-Friendly Space Activities')!, name: 'Child Engagement' },
    { posting_id: postingByTitle.get('Child-Friendly Space Activities')!, name: 'Creativity' },
    { posting_id: postingByTitle.get('Child-Friendly Space Activities')!, name: 'Patience' },

    // Child Rights Education Session
    { posting_id: postingByTitle.get('Child Rights Education Session')!, name: 'Teaching' },
    { posting_id: postingByTitle.get('Child Rights Education Session')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Child Rights Education Session')!, name: 'Child Engagement' },

    // Relief Fund Transparency Reporting
    { posting_id: postingByTitle.get('Relief Fund Transparency Reporting')!, name: 'Attention to Detail' },
    { posting_id: postingByTitle.get('Relief Fund Transparency Reporting')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Relief Fund Transparency Reporting')!, name: 'Data Entry' },

    // Diaspora Connect Volunteer Event
    { posting_id: postingByTitle.get('Diaspora Connect Volunteer Event')!, name: 'Community Engagement' },
    { posting_id: postingByTitle.get('Diaspora Connect Volunteer Event')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Diaspora Connect Volunteer Event')!, name: 'Organisation' },
  ]).execute();

  // Volunteer Skills

  await database.insertInto('volunteer_skill').values([
    // vol1 – logistics / physical
    { volunteer_id: volByEmail.get('vol1@willing.social')!, name: 'Logistics' },
    { volunteer_id: volByEmail.get('vol1@willing.social')!, name: 'Physical Stamina' },
    { volunteer_id: volByEmail.get('vol1@willing.social')!, name: 'Packing' },
    { volunteer_id: volByEmail.get('vol1@willing.social')!, name: 'Teamwork' },
    { volunteer_id: volByEmail.get('vol1@willing.social')!, name: 'Organisation' },
    { volunteer_id: volByEmail.get('vol1@willing.social')!, name: 'Safety Awareness' },

    // vol2 – teaching / communication
    { volunteer_id: volByEmail.get('vol2@willing.social')!, name: 'Teaching' },
    { volunteer_id: volByEmail.get('vol2@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol2@willing.social')!, name: 'Patience' },
    { volunteer_id: volByEmail.get('vol2@willing.social')!, name: 'Explaining Concepts' },
    { volunteer_id: volByEmail.get('vol2@willing.social')!, name: 'Arabic' },
    { volunteer_id: volByEmail.get('vol2@willing.social')!, name: 'Active Listening' },

    // vol3 – medical / first aid
    { volunteer_id: volByEmail.get('vol3@willing.social')!, name: 'First Aid' },
    { volunteer_id: volByEmail.get('vol3@willing.social')!, name: 'Medical Assistance' },
    { volunteer_id: volByEmail.get('vol3@willing.social')!, name: 'Triage Support' },
    { volunteer_id: volByEmail.get('vol3@willing.social')!, name: 'Crisis Response' },
    { volunteer_id: volByEmail.get('vol3@willing.social')!, name: 'Teamwork' },

    // vol4 – social work / emotional support
    { volunteer_id: volByEmail.get('vol4@willing.social')!, name: 'Empathy' },
    { volunteer_id: volByEmail.get('vol4@willing.social')!, name: 'Emotional Support' },
    { volunteer_id: volByEmail.get('vol4@willing.social')!, name: 'Active Listening' },
    { volunteer_id: volByEmail.get('vol4@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol4@willing.social')!, name: 'Patience' },
    { volunteer_id: volByEmail.get('vol4@willing.social')!, name: 'Arabic' },

    // vol5 – environment / outdoors
    { volunteer_id: volByEmail.get('vol5@willing.social')!, name: 'Physical Stamina' },
    { volunteer_id: volByEmail.get('vol5@willing.social')!, name: 'Environmental Awareness' },
    { volunteer_id: volByEmail.get('vol5@willing.social')!, name: 'Teamwork' },
    { volunteer_id: volByEmail.get('vol5@willing.social')!, name: 'Waste Sorting' },
    { volunteer_id: volByEmail.get('vol5@willing.social')!, name: 'Safety Awareness' },

    // vol6 – children / creativity
    { volunteer_id: volByEmail.get('vol6@willing.social')!, name: 'Creativity' },
    { volunteer_id: volByEmail.get('vol6@willing.social')!, name: 'Storytelling' },
    { volunteer_id: volByEmail.get('vol6@willing.social')!, name: 'Child Engagement' },
    { volunteer_id: volByEmail.get('vol6@willing.social')!, name: 'Art' },
    { volunteer_id: volByEmail.get('vol6@willing.social')!, name: 'Patience' },
    { volunteer_id: volByEmail.get('vol6@willing.social')!, name: 'Teaching' },

    // vol7 – tech / remote support
    { volunteer_id: volByEmail.get('vol7@willing.social')!, name: 'Remote Support' },
    { volunteer_id: volByEmail.get('vol7@willing.social')!, name: 'Teaching' },
    { volunteer_id: volByEmail.get('vol7@willing.social')!, name: 'Problem Solving' },
    { volunteer_id: volByEmail.get('vol7@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol7@willing.social')!, name: 'Explaining Concepts' },

    // vol8 – food / kitchen
    { volunteer_id: volByEmail.get('vol8@willing.social')!, name: 'Cooking' },
    { volunteer_id: volByEmail.get('vol8@willing.social')!, name: 'Food Preparation' },
    { volunteer_id: volByEmail.get('vol8@willing.social')!, name: 'Serving' },
    { volunteer_id: volByEmail.get('vol8@willing.social')!, name: 'Hygiene' },
    { volunteer_id: volByEmail.get('vol8@willing.social')!, name: 'Teamwork' },

    // vol9 – sorting / warehousing
    { volunteer_id: volByEmail.get('vol9@willing.social')!, name: 'Sorting' },
    { volunteer_id: volByEmail.get('vol9@willing.social')!, name: 'Inventory Handling' },
    { volunteer_id: volByEmail.get('vol9@willing.social')!, name: 'Attention to Detail' },
    { volunteer_id: volByEmail.get('vol9@willing.social')!, name: 'Label Checking' },
    { volunteer_id: volByEmail.get('vol9@willing.social')!, name: 'Accuracy' },
    { volunteer_id: volByEmail.get('vol9@willing.social')!, name: 'Organisation' },

    // vol10 – general
    { volunteer_id: volByEmail.get('vol10@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol10@willing.social')!, name: 'Teamwork' },
    { volunteer_id: volByEmail.get('vol10@willing.social')!, name: 'Organisation' },

    // vol11 – operations / logistics
    { volunteer_id: volByEmail.get('vol11@willing.social')!, name: 'Logistics' },
    { volunteer_id: volByEmail.get('vol11@willing.social')!, name: 'Inventory Handling' },
    { volunteer_id: volByEmail.get('vol11@willing.social')!, name: 'Organisation' },
    { volunteer_id: volByEmail.get('vol11@willing.social')!, name: 'Physical Stamina' },

    // vol12 – tutoring / facilitation
    { volunteer_id: volByEmail.get('vol12@willing.social')!, name: 'Teaching' },
    { volunteer_id: volByEmail.get('vol12@willing.social')!, name: 'Child Engagement' },
    { volunteer_id: volByEmail.get('vol12@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol12@willing.social')!, name: 'Patience' },

    // vol13 – tech / coordination
    { volunteer_id: volByEmail.get('vol13@willing.social')!, name: 'Remote Support' },
    { volunteer_id: volByEmail.get('vol13@willing.social')!, name: 'Data Entry' },
    { volunteer_id: volByEmail.get('vol13@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol13@willing.social')!, name: 'Problem Solving' },

    // vol14 – admin / events
    { volunteer_id: volByEmail.get('vol14@willing.social')!, name: 'Organisation' },
    { volunteer_id: volByEmail.get('vol14@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol14@willing.social')!, name: 'Data Entry' },
    { volunteer_id: volByEmail.get('vol14@willing.social')!, name: 'Teamwork' },

    // vol16 – construction
    { volunteer_id: volByEmail.get('vol16@willing.social')!, name: 'Construction' },
    { volunteer_id: volByEmail.get('vol16@willing.social')!, name: 'Physical Stamina' },
    { volunteer_id: volByEmail.get('vol16@willing.social')!, name: 'Safety Awareness' },
    { volunteer_id: volByEmail.get('vol16@willing.social')!, name: 'Teamwork' },

    // vol17 – psychology / support
    { volunteer_id: volByEmail.get('vol17@willing.social')!, name: 'Emotional Support' },
    { volunteer_id: volByEmail.get('vol17@willing.social')!, name: 'Active Listening' },
    { volunteer_id: volByEmail.get('vol17@willing.social')!, name: 'Empathy' },
    { volunteer_id: volByEmail.get('vol17@willing.social')!, name: 'Communication' },

    // vol18 – emergency response
    { volunteer_id: volByEmail.get('vol18@willing.social')!, name: 'First Aid' },
    { volunteer_id: volByEmail.get('vol18@willing.social')!, name: 'Crisis Response' },
    { volunteer_id: volByEmail.get('vol18@willing.social')!, name: 'Physical Stamina' },
    { volunteer_id: volByEmail.get('vol18@willing.social')!, name: 'Safety Awareness' },

    // vol19 – medical nursing
    { volunteer_id: volByEmail.get('vol19@willing.social')!, name: 'Medical Assistance' },
    { volunteer_id: volByEmail.get('vol19@willing.social')!, name: 'First Aid' },
    { volunteer_id: volByEmail.get('vol19@willing.social')!, name: 'Triage Support' },
    { volunteer_id: volByEmail.get('vol19@willing.social')!, name: 'Communication' },

    // vol20 – sports / inclusion
    { volunteer_id: volByEmail.get('vol20@willing.social')!, name: 'Physical Assistance' },
    { volunteer_id: volByEmail.get('vol20@willing.social')!, name: 'Inclusion Support' },
    { volunteer_id: volByEmail.get('vol20@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol20@willing.social')!, name: 'Teamwork' },

    // vol21 – design / art
    { volunteer_id: volByEmail.get('vol21@willing.social')!, name: 'Art' },
    { volunteer_id: volByEmail.get('vol21@willing.social')!, name: 'Creativity' },
    { volunteer_id: volByEmail.get('vol21@willing.social')!, name: 'Community Engagement' },

    // vol22 – driving / logistics
    { volunteer_id: volByEmail.get('vol22@willing.social')!, name: 'Logistics' },
    { volunteer_id: volByEmail.get('vol22@willing.social')!, name: 'Distribution' },
    { volunteer_id: volByEmail.get('vol22@willing.social')!, name: 'Organisation' },

    // vol23 – environment / youth
    { volunteer_id: volByEmail.get('vol23@willing.social')!, name: 'Environmental Awareness' },
    { volunteer_id: volByEmail.get('vol23@willing.social')!, name: 'Waste Sorting' },
    { volunteer_id: volByEmail.get('vol23@willing.social')!, name: 'Teamwork' },
    { volunteer_id: volByEmail.get('vol23@willing.social')!, name: 'Community Engagement' },

    // vol24 – carpenter / repair
    { volunteer_id: volByEmail.get('vol24@willing.social')!, name: 'Construction' },
    { volunteer_id: volByEmail.get('vol24@willing.social')!, name: 'Physical Stamina' },
    { volunteer_id: volByEmail.get('vol24@willing.social')!, name: 'Safety Awareness' },

    // vol25 – social media / communication
    { volunteer_id: volByEmail.get('vol25@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol25@willing.social')!, name: 'Community Engagement' },
    { volunteer_id: volByEmail.get('vol25@willing.social')!, name: 'Storytelling' },

    // vol26 – crisis management
    { volunteer_id: volByEmail.get('vol26@willing.social')!, name: 'Crisis Response' },
    { volunteer_id: volByEmail.get('vol26@willing.social')!, name: 'Logistics' },
    { volunteer_id: volByEmail.get('vol26@willing.social')!, name: 'Safety Awareness' },
    { volunteer_id: volByEmail.get('vol26@willing.social')!, name: 'Teamwork' },

    // vol27 – youth events
    { volunteer_id: volByEmail.get('vol27@willing.social')!, name: 'Teamwork' },
    { volunteer_id: volByEmail.get('vol27@willing.social')!, name: 'Community Engagement' },
    { volunteer_id: volByEmail.get('vol27@willing.social')!, name: 'Organisation' },

    // vol28 – retired teacher
    { volunteer_id: volByEmail.get('vol28@willing.social')!, name: 'Teaching' },
    { volunteer_id: volByEmail.get('vol28@willing.social')!, name: 'Arabic' },
    { volunteer_id: volByEmail.get('vol28@willing.social')!, name: 'Patience' },
    { volunteer_id: volByEmail.get('vol28@willing.social')!, name: 'Child Engagement' },

    // vol29 – sign language / inclusion
    { volunteer_id: volByEmail.get('vol29@willing.social')!, name: 'Inclusion Support' },
    { volunteer_id: volByEmail.get('vol29@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol29@willing.social')!, name: 'Empathy' },

    // vol30 – mechanic / driver
    { volunteer_id: volByEmail.get('vol30@willing.social')!, name: 'Logistics' },
    { volunteer_id: volByEmail.get('vol30@willing.social')!, name: 'Distribution' },
    { volunteer_id: volByEmail.get('vol30@willing.social')!, name: 'Physical Stamina' },

    // vol31 – nutrition / food
    { volunteer_id: volByEmail.get('vol31@willing.social')!, name: 'Food Preparation' },
    { volunteer_id: volByEmail.get('vol31@willing.social')!, name: 'Hygiene' },
    { volunteer_id: volByEmail.get('vol31@willing.social')!, name: 'Communication' },

    // vol32 – agriculture
    { volunteer_id: volByEmail.get('vol32@willing.social')!, name: 'Outdoor Work' },
    { volunteer_id: volByEmail.get('vol32@willing.social')!, name: 'Physical Stamina' },
    { volunteer_id: volByEmail.get('vol32@willing.social')!, name: 'Teamwork' },

    // vol33 – theater / storytelling
    { volunteer_id: volByEmail.get('vol33@willing.social')!, name: 'Storytelling' },
    { volunteer_id: volByEmail.get('vol33@willing.social')!, name: 'Child Engagement' },
    { volunteer_id: volByEmail.get('vol33@willing.social')!, name: 'Creativity' },

    // vol34 – plumber / WASH
    { volunteer_id: volByEmail.get('vol34@willing.social')!, name: 'Construction' },
    { volunteer_id: volByEmail.get('vol34@willing.social')!, name: 'Physical Stamina' },
    { volunteer_id: volByEmail.get('vol34@willing.social')!, name: 'Safety Awareness' },

    // vol35 – public health
    { volunteer_id: volByEmail.get('vol35@willing.social')!, name: 'Hygiene' },
    { volunteer_id: volByEmail.get('vol35@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol35@willing.social')!, name: 'Teaching' },

    // vol36 – IT support
    { volunteer_id: volByEmail.get('vol36@willing.social')!, name: 'Remote Support' },
    { volunteer_id: volByEmail.get('vol36@willing.social')!, name: 'Problem Solving' },
    { volunteer_id: volByEmail.get('vol36@willing.social')!, name: 'Data Entry' },

    // vol37 – legal
    { volunteer_id: volByEmail.get('vol37@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol37@willing.social')!, name: 'Empathy' },
    { volunteer_id: volByEmail.get('vol37@willing.social')!, name: 'Active Listening' },

    // vol38 – sports coach
    { volunteer_id: volByEmail.get('vol38@willing.social')!, name: 'Inclusion Support' },
    { volunteer_id: volByEmail.get('vol38@willing.social')!, name: 'Physical Assistance' },
    { volunteer_id: volByEmail.get('vol38@willing.social')!, name: 'Communication' },

    // vol39 – event planning
    { volunteer_id: volByEmail.get('vol39@willing.social')!, name: 'Organisation' },
    { volunteer_id: volByEmail.get('vol39@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol39@willing.social')!, name: 'Customer Service' },

    // vol40 – structural engineer
    { volunteer_id: volByEmail.get('vol40@willing.social')!, name: 'Construction' },
    { volunteer_id: volByEmail.get('vol40@willing.social')!, name: 'Safety Awareness' },
    { volunteer_id: volByEmail.get('vol40@willing.social')!, name: 'Attention to Detail' },

    // vol41 – calligraphy / art
    { volunteer_id: volByEmail.get('vol41@willing.social')!, name: 'Art' },
    { volunteer_id: volByEmail.get('vol41@willing.social')!, name: 'Creativity' },
    { volunteer_id: volByEmail.get('vol41@willing.social')!, name: 'Teaching' },
    { volunteer_id: volByEmail.get('vol41@willing.social')!, name: 'Patience' },

    // vol42 – supply chain
    { volunteer_id: volByEmail.get('vol42@willing.social')!, name: 'Logistics' },
    { volunteer_id: volByEmail.get('vol42@willing.social')!, name: 'Inventory Handling' },
    { volunteer_id: volByEmail.get('vol42@willing.social')!, name: 'Organisation' },

    // vol43 – lab / blood drive
    { volunteer_id: volByEmail.get('vol43@willing.social')!, name: 'Medical Assistance' },
    { volunteer_id: volByEmail.get('vol43@willing.social')!, name: 'Data Entry' },
    { volunteer_id: volByEmail.get('vol43@willing.social')!, name: 'Accuracy' },

    // vol44 – chef
    { volunteer_id: volByEmail.get('vol44@willing.social')!, name: 'Cooking' },
    { volunteer_id: volByEmail.get('vol44@willing.social')!, name: 'Food Preparation' },
    { volunteer_id: volByEmail.get('vol44@willing.social')!, name: 'Hygiene' },
    { volunteer_id: volByEmail.get('vol44@willing.social')!, name: 'Teaching' },

    // vol45 – teen environmentalist
    { volunteer_id: volByEmail.get('vol45@willing.social')!, name: 'Environmental Awareness' },
    { volunteer_id: volByEmail.get('vol45@willing.social')!, name: 'Waste Sorting' },
    { volunteer_id: volByEmail.get('vol45@willing.social')!, name: 'Community Engagement' },

    // vol46 – refugee specialist
    { volunteer_id: volByEmail.get('vol46@willing.social')!, name: 'Data Entry' },
    { volunteer_id: volByEmail.get('vol46@willing.social')!, name: 'Arabic' },
    { volunteer_id: volByEmail.get('vol46@willing.social')!, name: 'Empathy' },
    { volunteer_id: volByEmail.get('vol46@willing.social')!, name: 'Communication' },

    // vol47 – journalism
    { volunteer_id: volByEmail.get('vol47@willing.social')!, name: 'Storytelling' },
    { volunteer_id: volByEmail.get('vol47@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol47@willing.social')!, name: 'Community Engagement' },

    // vol48 – solar / energy
    { volunteer_id: volByEmail.get('vol48@willing.social')!, name: 'Construction' },
    { volunteer_id: volByEmail.get('vol48@willing.social')!, name: 'Safety Awareness' },
    { volunteer_id: volByEmail.get('vol48@willing.social')!, name: 'Problem Solving' },

    // vol49 – early childhood
    { volunteer_id: volByEmail.get('vol49@willing.social')!, name: 'Child Engagement' },
    { volunteer_id: volByEmail.get('vol49@willing.social')!, name: 'Patience' },
    { volunteer_id: volByEmail.get('vol49@willing.social')!, name: 'Creativity' },

    // vol50 – warehouse
    { volunteer_id: volByEmail.get('vol50@willing.social')!, name: 'Inventory Handling' },
    { volunteer_id: volByEmail.get('vol50@willing.social')!, name: 'Organisation' },
    { volunteer_id: volByEmail.get('vol50@willing.social')!, name: 'Logistics' },

    // vol51 – music
    { volunteer_id: volByEmail.get('vol51@willing.social')!, name: 'Creativity' },
    { volunteer_id: volByEmail.get('vol51@willing.social')!, name: 'Emotional Support' },
    { volunteer_id: volByEmail.get('vol51@willing.social')!, name: 'Child Engagement' },

    // vol52 – veterinarian
    { volunteer_id: volByEmail.get('vol52@willing.social')!, name: 'Medical Assistance' },
    { volunteer_id: volByEmail.get('vol52@willing.social')!, name: 'Outdoor Work' },
    { volunteer_id: volByEmail.get('vol52@willing.social')!, name: 'Communication' },

    // vol53 – fashion / clothing
    { volunteer_id: volByEmail.get('vol53@willing.social')!, name: 'Sorting' },
    { volunteer_id: volByEmail.get('vol53@willing.social')!, name: 'Creativity' },
    { volunteer_id: volByEmail.get('vol53@willing.social')!, name: 'Organisation' },

    // vol54 – geography / mapping
    { volunteer_id: volByEmail.get('vol54@willing.social')!, name: 'Attention to Detail' },
    { volunteer_id: volByEmail.get('vol54@willing.social')!, name: 'Teaching' },
    { volunteer_id: volByEmail.get('vol54@willing.social')!, name: 'Organisation' },

    // vol55 – community organizer
    { volunteer_id: volByEmail.get('vol55@willing.social')!, name: 'Community Engagement' },
    { volunteer_id: volByEmail.get('vol55@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol55@willing.social')!, name: 'Organisation' },

    // vol56 – engineering student
    { volunteer_id: volByEmail.get('vol56@willing.social')!, name: 'Construction' },
    { volunteer_id: volByEmail.get('vol56@willing.social')!, name: 'Physical Stamina' },
    { volunteer_id: volByEmail.get('vol56@willing.social')!, name: 'Problem Solving' },

    // vol57 – accountant / NGO finance
    { volunteer_id: volByEmail.get('vol57@willing.social')!, name: 'Accuracy' },
    { volunteer_id: volByEmail.get('vol57@willing.social')!, name: 'Attention to Detail' },
    { volunteer_id: volByEmail.get('vol57@willing.social')!, name: 'Data Entry' },

    // vol58 – field coordinator
    { volunteer_id: volByEmail.get('vol58@willing.social')!, name: 'Logistics' },
    { volunteer_id: volByEmail.get('vol58@willing.social')!, name: 'Crisis Response' },
    { volunteer_id: volByEmail.get('vol58@willing.social')!, name: 'Organisation' },
    { volunteer_id: volByEmail.get('vol58@willing.social')!, name: 'Teamwork' },

    // vol59 – teen environmentalist
    { volunteer_id: volByEmail.get('vol59@willing.social')!, name: 'Environmental Awareness' },
    { volunteer_id: volByEmail.get('vol59@willing.social')!, name: 'Community Engagement' },
    { volunteer_id: volByEmail.get('vol59@willing.social')!, name: 'Teamwork' },

    // vol60 – pharmacist
    { volunteer_id: volByEmail.get('vol60@willing.social')!, name: 'Medical Assistance' },
    { volunteer_id: volByEmail.get('vol60@willing.social')!, name: 'Accuracy' },
    { volunteer_id: volByEmail.get('vol60@willing.social')!, name: 'Organisation' },

    // vol61 – child psychologist
    { volunteer_id: volByEmail.get('vol61@willing.social')!, name: 'Child Engagement' },
    { volunteer_id: volByEmail.get('vol61@willing.social')!, name: 'Emotional Support' },
    { volunteer_id: volByEmail.get('vol61@willing.social')!, name: 'Active Listening' },
    { volunteer_id: volByEmail.get('vol61@willing.social')!, name: 'Empathy' },

    // vol62 – chef
    { volunteer_id: volByEmail.get('vol62@willing.social')!, name: 'Cooking' },
    { volunteer_id: volByEmail.get('vol62@willing.social')!, name: 'Food Preparation' },
    { volunteer_id: volByEmail.get('vol62@willing.social')!, name: 'Teaching' },
    { volunteer_id: volByEmail.get('vol62@willing.social')!, name: 'Hygiene' },

    // vol63 – environmental scientist
    { volunteer_id: volByEmail.get('vol63@willing.social')!, name: 'Environmental Awareness' },
    { volunteer_id: volByEmail.get('vol63@willing.social')!, name: 'Waste Sorting' },
    { volunteer_id: volByEmail.get('vol63@willing.social')!, name: 'Attention to Detail' },

    // vol64 – youth gardener / activist
    { volunteer_id: volByEmail.get('vol64@willing.social')!, name: 'Gardening' },
    { volunteer_id: volByEmail.get('vol64@willing.social')!, name: 'Outdoor Work' },
    { volunteer_id: volByEmail.get('vol64@willing.social')!, name: 'Community Engagement' },
    { volunteer_id: volByEmail.get('vol64@willing.social')!, name: 'Physical Stamina' },

    // vol65 – HR / volunteer management
    { volunteer_id: volByEmail.get('vol65@willing.social')!, name: 'Organisation' },
    { volunteer_id: volByEmail.get('vol65@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol65@willing.social')!, name: 'Data Entry' },

    // vol66 – electrician
    { volunteer_id: volByEmail.get('vol66@willing.social')!, name: 'Construction' },
    { volunteer_id: volByEmail.get('vol66@willing.social')!, name: 'Safety Awareness' },
    { volunteer_id: volByEmail.get('vol66@willing.social')!, name: 'Physical Stamina' },

    // vol67 – social media
    { volunteer_id: volByEmail.get('vol67@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol67@willing.social')!, name: 'Storytelling' },
    { volunteer_id: volByEmail.get('vol67@willing.social')!, name: 'Community Engagement' },

    // vol68 – student athlete / coach
    { volunteer_id: volByEmail.get('vol68@willing.social')!, name: 'Physical Assistance' },
    { volunteer_id: volByEmail.get('vol68@willing.social')!, name: 'Inclusion Support' },
    { volunteer_id: volByEmail.get('vol68@willing.social')!, name: 'Teamwork' },

    // vol69 – biology / environment
    { volunteer_id: volByEmail.get('vol69@willing.social')!, name: 'Environmental Awareness' },
    { volunteer_id: volByEmail.get('vol69@willing.social')!, name: 'Outdoor Work' },
    { volunteer_id: volByEmail.get('vol69@willing.social')!, name: 'Attention to Detail' },

    // vol70 – logistics manager
    { volunteer_id: volByEmail.get('vol70@willing.social')!, name: 'Logistics' },
    { volunteer_id: volByEmail.get('vol70@willing.social')!, name: 'Organisation' },
    { volunteer_id: volByEmail.get('vol70@willing.social')!, name: 'Inventory Handling' },
    { volunteer_id: volByEmail.get('vol70@willing.social')!, name: 'Teamwork' },

    // vol71 – occupational therapist
    { volunteer_id: volByEmail.get('vol71@willing.social')!, name: 'Medical Assistance' },
    { volunteer_id: volByEmail.get('vol71@willing.social')!, name: 'Physical Assistance' },
    { volunteer_id: volByEmail.get('vol71@willing.social')!, name: 'Empathy' },

    // vol72 – radio / media
    { volunteer_id: volByEmail.get('vol72@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol72@willing.social')!, name: 'Storytelling' },
    { volunteer_id: volByEmail.get('vol72@willing.social')!, name: 'Community Engagement' },

    // vol73 – doctor
    { volunteer_id: volByEmail.get('vol73@willing.social')!, name: 'Medical Assistance' },
    { volunteer_id: volByEmail.get('vol73@willing.social')!, name: 'First Aid' },
    { volunteer_id: volByEmail.get('vol73@willing.social')!, name: 'Triage Support' },
    { volunteer_id: volByEmail.get('vol73@willing.social')!, name: 'Crisis Response' },

    // vol74 – marine biologist
    { volunteer_id: volByEmail.get('vol74@willing.social')!, name: 'Environmental Awareness' },
    { volunteer_id: volByEmail.get('vol74@willing.social')!, name: 'Outdoor Work' },
    { volunteer_id: volByEmail.get('vol74@willing.social')!, name: 'Attention to Detail' },

    // vol75 – architecture
    { volunteer_id: volByEmail.get('vol75@willing.social')!, name: 'Construction' },
    { volunteer_id: volByEmail.get('vol75@willing.social')!, name: 'Attention to Detail' },
    { volunteer_id: volByEmail.get('vol75@willing.social')!, name: 'Safety Awareness' },

    // vol76 – safety officer
    { volunteer_id: volByEmail.get('vol76@willing.social')!, name: 'Safety Awareness' },
    { volunteer_id: volByEmail.get('vol76@willing.social')!, name: 'Crisis Response' },
    { volunteer_id: volByEmail.get('vol76@willing.social')!, name: 'Communication' },

    // vol77 – fundraising
    { volunteer_id: volByEmail.get('vol77@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol77@willing.social')!, name: 'Community Engagement' },
    { volunteer_id: volByEmail.get('vol77@willing.social')!, name: 'Data Entry' },

    // vol78 – drone operator
    { volunteer_id: volByEmail.get('vol78@willing.social')!, name: 'Outdoor Work' },
    { volunteer_id: volByEmail.get('vol78@willing.social')!, name: 'Attention to Detail' },
    { volunteer_id: volByEmail.get('vol78@willing.social')!, name: 'Safety Awareness' },

    // vol79 – youth mentor
    { volunteer_id: volByEmail.get('vol79@willing.social')!, name: 'Child Engagement' },
    { volunteer_id: volByEmail.get('vol79@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol79@willing.social')!, name: 'Patience' },
    { volunteer_id: volByEmail.get('vol79@willing.social')!, name: 'Teaching' },

    // vol80 – trauma surgeon
    { volunteer_id: volByEmail.get('vol80@willing.social')!, name: 'Medical Assistance' },
    { volunteer_id: volByEmail.get('vol80@willing.social')!, name: 'First Aid' },
    { volunteer_id: volByEmail.get('vol80@willing.social')!, name: 'Triage Support' },
    { volunteer_id: volByEmail.get('vol80@willing.social')!, name: 'Crisis Response' },
    { volunteer_id: volByEmail.get('vol80@willing.social')!, name: 'Calm Under Pressure' },
  ]).execute();

  // Enrollment Applications (review-based postings)

  const applications = await database.insertInto('enrollment_application').values([
    {
      volunteer_id: volByEmail.get('vol3@willing.social')!,
      posting_id: postingByTitle.get('First Aid Support')!,
      message: 'Currently completing my paramedic diploma. I have first aid and triage training and am comfortable in high-pressure environments.',
    },
    {
      volunteer_id: volByEmail.get('vol19@willing.social')!,
      posting_id: postingByTitle.get('First Aid Support')!,
      message: 'ICU nurse with triage experience. Ready to support the medical team wherever needed.',
    },
    {
      volunteer_id: volByEmail.get('vol80@willing.social')!,
      posting_id: postingByTitle.get('First Aid Support')!,
      message: 'Trauma surgeon with field hospital experience. Can assist with complex triage cases.',
    },
    {
      volunteer_id: volByEmail.get('vol4@willing.social')!,
      posting_id: postingByTitle.get('Displaced Families Registration')!,
      message: 'I work as a social worker and speak Arabic fluently. Comfortable conducting intake interviews with empathy.',
    },
    {
      volunteer_id: volByEmail.get('vol2@willing.social')!,
      posting_id: postingByTitle.get('Displaced Families Registration')!,
      message: 'Strong communication and data entry skills. Happy to assist with registration and guiding families.',
    },
    {
      volunteer_id: volByEmail.get('vol46@willing.social')!,
      posting_id: postingByTitle.get('Displaced Families Registration')!,
      message: 'Former UNHCR field officer with refugee registration experience. Fluent in Arabic.',
    },
    {
      volunteer_id: volByEmail.get('vol4@willing.social')!,
      posting_id: postingByTitle.get('War Survivor Psychosocial Support')!,
      message: 'Background in social work and mental health. Familiar with trauma-informed approaches.',
    },
    {
      volunteer_id: volByEmail.get('vol17@willing.social')!,
      posting_id: postingByTitle.get('War Survivor Psychosocial Support')!,
      message: 'Psychology student trained in psychosocial first aid. Eager to support survivors.',
    },
    {
      volunteer_id: volByEmail.get('vol4@willing.social')!,
      posting_id: postingByTitle.get('Psychological First Aid Sessions')!,
      message: 'Background in social work and mental health. Familiar with trauma-informed approaches.',
    },
    {
      volunteer_id: volByEmail.get('vol61@willing.social')!,
      posting_id: postingByTitle.get('Psychological First Aid Sessions')!,
      message: 'Child psychologist with psychosocial support training. Can assist the clinical team.',
    },
    {
      volunteer_id: volByEmail.get('vol7@willing.social')!,
      posting_id: postingByTitle.get('Remote Homework Support')!,
      message: 'Software developer with strong maths and science background. Can take evening slots.',
    },
    {
      volunteer_id: volByEmail.get('vol2@willing.social')!,
      posting_id: postingByTitle.get('Remote Homework Support')!,
      message: 'Experienced tutor covering Arabic, English, and maths. Available multiple afternoons per week.',
    },
    {
      volunteer_id: volByEmail.get('vol9@willing.social')!,
      posting_id: postingByTitle.get('Medical Supplies Inventory & Sorting')!,
      message: 'Highly detail-oriented and experienced with inventory systems.',
    },
    {
      volunteer_id: volByEmail.get('vol42@willing.social')!,
      posting_id: postingByTitle.get('Medical Supplies Inventory & Sorting')!,
      message: 'Supply chain analyst. Comfortable managing medical supplies carefully and systematically.',
    },
    {
      volunteer_id: volByEmail.get('vol13@willing.social')!,
      posting_id: postingByTitle.get('Volunteer Helpline Shifts')!,
      message: 'Comfortable with helpline systems and coordinating caller information across multiple shifts.',
    },
    {
      volunteer_id: volByEmail.get('vol14@willing.social')!,
      posting_id: postingByTitle.get('Volunteer Helpline Shifts')!,
      message: 'Strong communication and admin coordination skills. Happy to cover daytime shifts.',
    },
    {
      volunteer_id: volByEmail.get('vol12@willing.social')!,
      posting_id: postingByTitle.get('School Supply Restocking')!,
      message: 'Would love to help schools recover and can support with sorting, packing, and classroom kit prep.',
    },
    {
      volunteer_id: volByEmail.get('vol11@willing.social')!,
      posting_id: postingByTitle.get('School Supply Restocking')!,
      message: 'Warehouse and operations experience. Comfortable with inventory and loading support.',
    },
    {
      volunteer_id: volByEmail.get('vol26@willing.social')!,
      posting_id: postingByTitle.get('Urban Search & Rescue Logistics')!,
      message: 'Former army officer with crisis management experience. Ready to coordinate logistics in the field.',
    },
    {
      volunteer_id: volByEmail.get('vol58@willing.social')!,
      posting_id: postingByTitle.get('Urban Search & Rescue Logistics')!,
      message: 'Veteran field coordinator with large deployment experience. Can manage comms and supply chains.',
    },
  ])
    .returning(['id', 'volunteer_id', 'posting_id'])
    .execute();

  // Enrollments

  const vol = (e: string) => volByEmail.get(e)!;
  const post = (t: string) => postingByTitle.get(t)!;

  const enrollments = await database.insertInto('enrollment').values([

    // --- Blood Drive Coordination (Nour Relief, past, closed) ---
    {
      volunteer_id: vol('vol2@willing.social'),
      posting_id: post('Blood Drive Coordination'),
      message: 'Happy to help with donor registration.',
      attended: true,
    },
    {
      volunteer_id: vol('vol3@willing.social'),
      posting_id: post('Blood Drive Coordination'),
      message: 'First aid background, happy to support the medical side.',
      attended: false,
    },
    {
      volunteer_id: vol('vol43@willing.social'),
      posting_id: post('Blood Drive Coordination'),
      message: 'Medical lab student with blood drive experience.',
      attended: true,
    },
    {
      volunteer_id: vol('vol19@willing.social'),
      posting_id: post('Blood Drive Coordination'),
      message: 'Nurse, experienced in post-donation care.',
      attended: true,
    },
    {
      volunteer_id: vol('vol60@willing.social'),
      posting_id: post('Blood Drive Coordination'),
      message: 'Pharmacist, can assist with donor screening.',
      attended: true,
    },
    {
      volunteer_id: vol('vol65@willing.social'),
      posting_id: post('Blood Drive Coordination'),
      message: 'HR background, happy to manage registration flow.',
      attended: false,
    },
    {
      volunteer_id: vol('vol39@willing.social'),
      posting_id: post('Blood Drive Coordination'),
      message: 'Event planner, can manage the waiting area.',
      attended: true,
    },

    // --- Emergency Food Packing (Nour Relief, past) ---
    {
      volunteer_id: vol('vol1@willing.social'),
      posting_id: post('Emergency Food Packing'),
      message: 'Comfortable with packing and warehouse work.',
      attended: true,
    },
    {
      volunteer_id: vol('vol9@willing.social'),
      posting_id: post('Emergency Food Packing'),
      message: 'Detail-oriented, good with repetitive packing tasks.',
      attended: true,
    },
    {
      volunteer_id: vol('vol50@willing.social'),
      posting_id: post('Emergency Food Packing'),
      message: 'Warehouse supervisor, can manage stock and packing.',
      attended: true,
    },
    {
      volunteer_id: vol('vol11@willing.social'),
      posting_id: post('Emergency Food Packing'),
      message: 'Operations background, great with logistics.',
      attended: true,
    },
    {
      volunteer_id: vol('vol42@willing.social'),
      posting_id: post('Emergency Food Packing'),
      message: 'Supply chain analyst, can optimise packing flow.',
      attended: true,
    },
    {
      volunteer_id: vol('vol70@willing.social'),
      posting_id: post('Emergency Food Packing'),
      message: 'Logistics manager, comfortable with high-volume packing.',
      attended: false,
    },
    {
      volunteer_id: vol('vol31@willing.social'),
      posting_id: post('Emergency Food Packing'),
      message: 'Nutrition student, can assist with food safety checks.',
      attended: true,
    },
    {
      volunteer_id: vol('vol53@willing.social'),
      posting_id: post('Emergency Food Packing'),
      message: 'Organised and good with sorting tasks.',
      attended: true,
    },

    // --- Mobile Aid Kit Distribution (Nour Relief, past) ---
    {
      volunteer_id: vol('vol1@willing.social'),
      posting_id: post('Mobile Aid Kit Distribution'),
      message: 'Good with logistics and navigating Beirut.',
      attended: true,
    },
    {
      volunteer_id: vol('vol22@willing.social'),
      posting_id: post('Mobile Aid Kit Distribution'),
      message: 'Driver, can handle supply transport efficiently.',
      attended: true,
    },
    {
      volunteer_id: vol('vol30@willing.social'),
      posting_id: post('Mobile Aid Kit Distribution'),
      message: 'Mechanic and driver, experienced with mobile delivery runs.',
      attended: true,
    },
    {
      volunteer_id: vol('vol58@willing.social'),
      posting_id: post('Mobile Aid Kit Distribution'),
      message: 'Field coordinator, good at route planning and team logistics.',
      attended: false,
    },
    {
      volunteer_id: vol('vol70@willing.social'),
      posting_id: post('Mobile Aid Kit Distribution'),
      message: 'Logistics manager, can organise distribution runs.',
      attended: true,
    },

    // --- Winter Clothing Distribution (Ajialouna, past, closed) ---
    {
      volunteer_id: vol('vol1@willing.social'),
      posting_id: post('Winter Clothing Distribution'),
      message: 'Good at sorting and organising. Can commit to the full session.',
      attended: true,
    },
    {
      volunteer_id: vol('vol53@willing.social'),
      posting_id: post('Winter Clothing Distribution'),
      message: 'Fashion design student, experienced in sorting and sizing clothing.',
      attended: true,
    },
    {
      volunteer_id: vol('vol9@willing.social'),
      posting_id: post('Winter Clothing Distribution'),
      message: 'Detail-oriented, reliable with inventory and sorting.',
      attended: true,
    },
    {
      volunteer_id: vol('vol14@willing.social'),
      posting_id: post('Winter Clothing Distribution'),
      message: 'Patient and dependable, great at clothing distribution.',
      attended: true,
    },
    {
      volunteer_id: vol('vol27@willing.social'),
      posting_id: post('Winter Clothing Distribution'),
      message: 'Happy to help sort and hand out winter clothes.',
      attended: false,
    },

    // --- Debris Clearance (Arz Community, past, closed) ---
    {
      volunteer_id: vol('vol1@willing.social'),
      posting_id: post('Debris Clearance'),
      message: 'Ready for physically demanding work.',
      attended: true,
    },
    {
      volunteer_id: vol('vol5@willing.social'),
      posting_id: post('Debris Clearance'),
      message: 'Strong and used to outdoor heavy work.',
      attended: true,
    },
    {
      volunteer_id: vol('vol24@willing.social'),
      posting_id: post('Debris Clearance'),
      message: 'Carpenter, experienced with debris clearance and site safety.',
      attended: true,
    },
    {
      volunteer_id: vol('vol16@willing.social'),
      posting_id: post('Debris Clearance'),
      message: 'Civil engineering student, comfortable with construction sites.',
      attended: true,
    },
    {
      volunteer_id: vol('vol40@willing.social'),
      posting_id: post('Debris Clearance'),
      message: 'Structural engineer, can guide safe clearance approaches.',
      attended: true,
    },
    { volunteer_id: vol('vol56@willing.social'),
      posting_id: post('Debris Clearance'),
      message: 'Engineering student, ready for heavy physical work.',
      attended: true,
    },
    { volunteer_id: vol('vol66@willing.social'),
      posting_id: post('Debris Clearance'),
      message: 'Electrician, aware of site safety in damaged structures.',
      attended: true,
    },
    { volunteer_id: vol('vol76@willing.social'),
      posting_id: post('Debris Clearance'),
      message: 'Safety officer, can ensure volunteers follow proper procedures.',
      attended: true,
    },

    // --- First Aid Support (Nour Relief, review-based) ---
    {
      volunteer_id: vol('vol73@willing.social'),
      posting_id: post('First Aid Support'),
      message: 'Medical doctor volunteering in crisis clinics across Lebanon.',
      attended: false,
    },
    {
      volunteer_id: vol('vol18@willing.social'),
      posting_id: post('First Aid Support'),
      message: 'First responder with firefighting and emergency management background.',
      attended: false,
    },

    // --- Displaced Families Registration (Nour Relief, review-based, partial) ---
    {
      volunteer_id: vol('vol65@willing.social'),
      posting_id: post('Displaced Families Registration'),
      message: 'HR professional, experienced with intake and onboarding workflows.',
      attended: false,
    },

    // --- Emergency Shelter Setup (Nour Relief) ---
    {
      volunteer_id: vol('vol1@willing.social'),
      posting_id: post('Emergency Shelter Setup'),
      message: 'Strong with physical tasks and challenging field environments.',
      attended: false,
    },
    {
      volunteer_id: vol('vol5@willing.social'),
      posting_id: post('Emergency Shelter Setup'),
      message: 'Physically fit and used to outdoor work.',
      attended: false,
    },
    {
      volunteer_id: vol('vol16@willing.social'),
      posting_id: post('Emergency Shelter Setup'),
      message: 'Civil engineering student, comfortable with construction and logistics.',
      attended: false,
    },
    {
      volunteer_id: vol('vol24@willing.social'),
      posting_id: post('Emergency Shelter Setup'),
      message: 'Carpenter, experienced with structure assembly and site work.',
      attended: false,
    },
    {
      volunteer_id: vol('vol34@willing.social'),
      posting_id: post('Emergency Shelter Setup'),
      message: 'Plumber, can help with water point setup at shelter sites.',
      attended: false,
    },
    {
      volunteer_id: vol('vol56@willing.social'),
      posting_id: post('Emergency Shelter Setup'),
      message: 'Engineering student, ready to assist with tent and structure assembly.',
      attended: false,
    },
    {
      volunteer_id: vol('vol66@willing.social'),
      posting_id: post('Emergency Shelter Setup'),
      message: 'Electrician, can help with safe power setup at shelters.',
      attended: false,
    },

    // --- War Survivor Psychosocial Support (Nour Relief, review-based) ---
    {
      volunteer_id: vol('vol61@willing.social'),
      posting_id: post('War Survivor Psychosocial Support'),
      message: 'Child psychologist with psychosocial support training.',
      attended: false,
    },

    // --- Meals for the Displaced (Nour Relief) ---
    {
      volunteer_id: vol('vol8@willing.social'),
      posting_id: post('Meals for the Displaced'),
      message: 'Catering background, comfortable with large-scale food prep.',
      attended: false,
    },
    {
      volunteer_id: vol('vol44@willing.social'),
      posting_id: post('Meals for the Displaced'),
      message: 'Experienced chef, can manage kitchen operations for large groups.',
      attended: false,
    },
    {
      volunteer_id: vol('vol62@willing.social'),
      posting_id: post('Meals for the Displaced'),
      message: 'Professional chef with community kitchen experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol31@willing.social'),
      posting_id: post('Meals for the Displaced'),
      message: 'Nutrition student, happy to assist with food prep and hygiene.',
      attended: false,
    },
    {
      volunteer_id: vol('vol35@willing.social'),
      posting_id: post('Meals for the Displaced'),
      message: 'Public health grad, knowledgeable about food safety and hygiene.',
      attended: false,
    },

    // --- Psychological First Aid Sessions (Nour Relief, review-based) ---
    {
      volunteer_id: vol('vol17@willing.social'),
      posting_id: post('Psychological First Aid Sessions'),
      message: 'Psychology student eager to support survivors.',
      attended: false,
    },

    // --- Winter Blanket Distribution (Nour Relief) ---
    {
      volunteer_id: vol('vol1@willing.social'),
      posting_id: post('Winter Blanket Distribution'),
      message: 'Available to sort and distribute blankets.',
      attended: false,
    },
    {
      volunteer_id: vol('vol53@willing.social'),
      posting_id: post('Winter Blanket Distribution'),
      message: 'Experienced with clothing donation sorting and distribution.',
      attended: false,
    },
    {
      volunteer_id: vol('vol9@willing.social'),
      posting_id: post('Winter Blanket Distribution'),
      message: 'Detail-oriented, reliable with sorting tasks.',
      attended: false,
    },
    {
      volunteer_id: vol('vol27@willing.social'),
      posting_id: post('Winter Blanket Distribution'),
      message: 'Happy to help sort and hand out winter items.',
      attended: false,
    },

    // --- Community Health Screening Day (Nour Relief) ---
    {
      volunteer_id: vol('vol19@willing.social'),
      posting_id: post('Community Health Screening Day'),
      message: 'Nurse, experienced in basic health screenings.',
      attended: false,
    },
    {
      volunteer_id: vol('vol35@willing.social'),
      posting_id: post('Community Health Screening Day'),
      message: 'Public health grad, can assist with health education.',
      attended: false,
    },
    {
      volunteer_id: vol('vol60@willing.social'),
      posting_id: post('Community Health Screening Day'),
      message: 'Pharmacist, can help with medicine info and screening support.',
      attended: false,
    },
    {
      volunteer_id: vol('vol73@willing.social'),
      posting_id: post('Community Health Screening Day'),
      message: 'Doctor volunteering in community health settings.',
      attended: false,
    },
    {
      volunteer_id: vol('vol43@willing.social'),
      posting_id: post('Community Health Screening Day'),
      message: 'Medical lab student, can assist with sample handling.',
      attended: false,
    },

    // --- Supply Convoy Loading (Nour Relief) ---
    {
      volunteer_id: vol('vol1@willing.social'),
      posting_id: post('Supply Convoy Loading'),
      message: 'Experienced with logistics and heavy loading work.',
      attended: false,
    },
    {
      volunteer_id: vol('vol70@willing.social'),
      posting_id: post('Supply Convoy Loading'),
      message: 'Logistics manager, can oversee convoy loading and coordination.',
      attended: false,
    },
    {
      volunteer_id: vol('vol22@willing.social'),
      posting_id: post('Supply Convoy Loading'),
      message: 'Driver with supply transport experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol30@willing.social'),
      posting_id: post('Supply Convoy Loading'),
      message: 'Mechanic and driver, great for convoy logistics.',
      attended: false,
    },

    // --- Inclusive Sports Day (Ajialouna) ---
    {
      volunteer_id: vol('vol20@willing.social'),
      posting_id: post('Inclusive Sports Day'),
      message: 'Fitness coach passionate about inclusive sport.',
      attended: false,
    },
    {
      volunteer_id: vol('vol38@willing.social'),
      posting_id: post('Inclusive Sports Day'),
      message: 'Football coach with inclusive sports experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol68@willing.social'),
      posting_id: post('Inclusive Sports Day'),
      message: 'Student athlete coaching inclusive fitness sessions.',
      attended: false,
    },
    {
      volunteer_id: vol('vol29@willing.social'),
      posting_id: post('Inclusive Sports Day'),
      message: 'Sign language interpreter, can support deaf participants.',
      attended: false,
    },

    // --- Community Kitchen (Ajialouna) ---
    {
      volunteer_id: vol('vol8@willing.social'),
      posting_id: post('Community Kitchen'),
      message: 'Catering background, comfortable with prep, serving, and hygiene.',
      attended: false,
    },
    {
      volunteer_id: vol('vol62@willing.social'),
      posting_id: post('Community Kitchen'),
      message: 'Professional chef, experienced in high-volume community kitchens.',
      attended: false,
    },
    {
      volunteer_id: vol('vol44@willing.social'),
      posting_id: post('Community Kitchen'),
      message: 'Chef and culinary trainer, can manage large-scale meal prep.',
      attended: false,
    },
    {
      volunteer_id: vol('vol31@willing.social'),
      posting_id: post('Community Kitchen'),
      message: 'Nutrition student, keen on food security programs.',
      attended: false,
    },

    // --- Remote Homework Support (Ajialouna, review-based, partial) ---
    {
      volunteer_id: vol('vol28@willing.social'),
      posting_id: post('Remote Homework Support'),
      message: 'Retired schoolteacher, happy to tutor across all subjects.',
      attended: false,
    },
    {
      volunteer_id: vol('vol12@willing.social'),
      posting_id: post('Remote Homework Support'),
      message: 'Community educator who enjoys tutoring and youth engagement.',
      attended: false,
    },

    // --- Community Storytelling Circle (Ajialouna) ---
    {
      volunteer_id: vol('vol6@willing.social'),
      posting_id: post('Community Storytelling Circle'),
      message: 'Art teacher with storytelling and facilitation experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol33@willing.social'),
      posting_id: post('Community Storytelling Circle'),
      message: 'Theater student with drama workshop experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol47@willing.social'),
      posting_id: post('Community Storytelling Circle'),
      message: 'Student journalist who loves hearing and sharing community stories.',
      attended: false,
    },

    // --- Youth Reading Circle (Ajialouna) ---
    {
      volunteer_id: vol('vol6@willing.social'),
      posting_id: post('Youth Reading Circle'),
      message: 'Art teacher, great with children and creative activities.',
      attended: false,
    },
    {
      volunteer_id: vol('vol28@willing.social'),
      posting_id: post('Youth Reading Circle'),
      message: 'Retired teacher, experienced in literacy and reading sessions.',
      attended: false,
    },
    {
      volunteer_id: vol('vol79@willing.social'),
      posting_id: post('Youth Reading Circle'),
      message: 'Youth mentor, runs after-school programs for teenagers.',
      attended: false,
    },
    {
      volunteer_id: vol('vol49@willing.social'),
      posting_id: post('Youth Reading Circle'),
      message: 'Early childhood educator, experienced with young learners.',
      attended: false,
    },

    // --- Junior Sports Field Prep (Ajialouna) ---
    {
      volunteer_id: vol('vol38@willing.social'),
      posting_id: post('Junior Sports Field Prep'),
      message: 'Football coach, happy to prep fields and set up equipment.',
      attended: false,
    },
    {
      volunteer_id: vol('vol68@willing.social'),
      posting_id: post('Junior Sports Field Prep'),
      message: 'Student athlete, comfortable with field setup and groundskeeping.',
      attended: false,
    },
    {
      volunteer_id: vol('vol5@willing.social'),
      posting_id: post('Junior Sports Field Prep'),
      message: 'Physically fit and loves outdoor community work.',
      attended: false,
    },

    // --- Refugee Family Intake Support (Ajialouna, review-based, partial) ---
    {
      volunteer_id: vol('vol46@willing.social'),
      posting_id: post('Refugee Family Intake Support'),
      message: 'Former UNHCR field officer with refugee registration experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol4@willing.social'),
      posting_id: post('Refugee Family Intake Support'),
      message: 'Social worker, Arabic fluent, experienced with family intake.',
      attended: false,
    },
    {
      volunteer_id: vol('vol37@willing.social'),
      posting_id: post('Refugee Family Intake Support'),
      message: 'Lawyer providing legal info to displaced families.',
      attended: false,
    },

    // --- Wildfire Relief Distribution (Arz Community) ---
    {
      volunteer_id: vol('vol1@willing.social'),
      posting_id: post('Wildfire Relief Distribution'),
      message: 'Strong with physical tasks and field logistics.',
      attended: false,
    },
    {
      volunteer_id: vol('vol5@willing.social'),
      posting_id: post('Wildfire Relief Distribution'),
      message: 'Physically fit and used to outdoor conditions.',
      attended: false,
    },
    {
      volunteer_id: vol('vol70@willing.social'),
      posting_id: post('Wildfire Relief Distribution'),
      message: 'Logistics manager, can coordinate distribution efficiently.',
      attended: false,
    },
    {
      volunteer_id: vol('vol42@willing.social'),
      posting_id: post('Wildfire Relief Distribution'),
      message: 'Supply chain analyst, can optimise distribution runs.',
      attended: false,
    },
    {
      volunteer_id: vol('vol58@willing.social'),
      posting_id: post('Wildfire Relief Distribution'),
      message: 'Field coordinator with large volunteer deployment experience.',
      attended: false,
    },

    // --- Medical Supplies Inventory & Sorting (Arz Community, review-based) ---
    {
      volunteer_id: vol('vol50@willing.social'),
      posting_id: post('Medical Supplies Inventory & Sorting'),
      message: 'Warehouse supervisor, experienced with stock management.',
      attended: false,
    },

    // --- Community Garden Open Help Day (Arz Community) ---
    {
      volunteer_id: vol('vol5@willing.social'),
      posting_id: post('Community Garden Open Help Day'),
      message: 'Environmentally conscious and loves outdoor work.',
      attended: false,
    },
    {
      volunteer_id: vol('vol64@willing.social'),
      posting_id: post('Community Garden Open Help Day'),
      message: 'Youth garden project leader in Tripoli.',
      attended: false,
    },
    {
      volunteer_id: vol('vol69@willing.social'),
      posting_id: post('Community Garden Open Help Day'),
      message: 'Biology student passionate about habitat and plant work.',
      attended: false,
    },
    {
      volunteer_id: vol('vol32@willing.social'),
      posting_id: post('Community Garden Open Help Day'),
      message: 'Agricultural specialist, great with soil and planting.',
      attended: false,
    },

    // --- Coastal Cleanup (Arz Community) ---
    {
      volunteer_id: vol('vol5@willing.social'),
      posting_id: post('Coastal Cleanup'),
      message: 'Passionate about environmental work, comfortable with outdoor physical tasks.',
      attended: false,
    },
    {
      volunteer_id: vol('vol63@willing.social'),
      posting_id: post('Coastal Cleanup'),
      message: 'Environmental scientist with coastal cleanup experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol74@willing.social'),
      posting_id: post('Coastal Cleanup'),
      message: 'Marine biologist, can monitor wildlife during the cleanup.',
      attended: false,
    },
    {
      volunteer_id: vol('vol23@willing.social'),
      posting_id: post('Coastal Cleanup'),
      message: 'University student active in beach cleanup campaigns.',
      attended: false,
    },
    {
      volunteer_id: vol('vol45@willing.social'),
      posting_id: post('Coastal Cleanup'),
      message: 'Teen environmentalist passionate about ocean conservation.',
      attended: false,
    },
    {
      volunteer_id: vol('vol59@willing.social'),
      posting_id: post('Coastal Cleanup'),
      message: 'Teen environmental volunteer, runs school awareness campaigns.',
      attended: false,
    },

    // --- Youth Garden Helpers (Arz Community) ---
    {
      volunteer_id: vol('vol64@willing.social'),
      posting_id: post('Youth Garden Helpers'),
      message: 'Youth gardener and activist in Tripoli.',
      attended: false,
    },
    {
      volunteer_id: vol('vol23@willing.social'),
      posting_id: post('Youth Garden Helpers'),
      message: 'Student active in campus environmental clubs.',
      attended: false,
    },
    {
      volunteer_id: vol('vol69@willing.social'),
      posting_id: post('Youth Garden Helpers'),
      message: 'Biology student helping with plant and habitat restoration.',
      attended: false,
    },

    // --- Family Water Station Support (Arz Community) ---
    {
      volunteer_id: vol('vol27@willing.social'),
      posting_id: post('Family Water Station Support'),
      message: 'High school student, happy to assist at the water station.',
      attended: false,
    },
    {
      volunteer_id: vol('vol45@willing.social'),
      posting_id: post('Family Water Station Support'),
      message: 'Friendly and reliable, great with community service.',
      attended: false,
    },

    // --- Reforestation Day – Akkar (Arz Community) ---
    {
      volunteer_id: vol('vol5@willing.social'),
      posting_id: post('Reforestation Day – Akkar'),
      message: 'Environmentally conscious, loves tree planting and outdoor work.',
      attended: false,
    },
    {
      volunteer_id: vol('vol64@willing.social'),
      posting_id: post('Reforestation Day – Akkar'),
      message: 'Youth gardener experienced with community greening projects.',
      attended: false,
    },
    {
      volunteer_id: vol('vol69@willing.social'),
      posting_id: post('Reforestation Day – Akkar'),
      message: 'Biology student passionate about habitat restoration.',
      attended: false,
    },
    {
      volunteer_id: vol('vol23@willing.social'),
      posting_id: post('Reforestation Day – Akkar'),
      message: 'Active in environmental clubs, excited about reforestation.',
      attended: false,
    },
    {
      volunteer_id: vol('vol32@willing.social'),
      posting_id: post('Reforestation Day – Akkar'),
      message: 'Agricultural specialist, experienced with soil and seedling work.',
      attended: false,
    },
    {
      volunteer_id: vol('vol78@willing.social'),
      posting_id: post('Reforestation Day – Akkar'),
      message: 'Drone operator, can assist with aerial progress documentation.',
      attended: false,
    },

    // --- Volunteer Helpline Shifts (Cedar Response, review-based, partial) ---
    {
      volunteer_id: vol('vol36@willing.social'),
      posting_id: post('Volunteer Helpline Shifts'),
      message: 'IT support background, comfortable with remote helpline systems.',
      attended: false,
    },
    {
      volunteer_id: vol('vol65@willing.social'),
      posting_id: post('Volunteer Helpline Shifts'),
      message: 'HR professional experienced in managing intake and coordination.',
      attended: false,
    },

    // --- Neighborhood Repair Week (Cedar Response, partial) ---
    {
      volunteer_id: vol('vol11@willing.social'),
      posting_id: post('Neighborhood Repair Week'),
      message: 'Can support repair teams and help keep materials organised.',
      attended: false,
    },
    {
      volunteer_id: vol('vol24@willing.social'),
      posting_id: post('Neighborhood Repair Week'),
      message: 'Carpenter, experienced in community repair and renovation work.',
      attended: false,
    },
    {
      volunteer_id: vol('vol40@willing.social'),
      posting_id: post('Neighborhood Repair Week'),
      message: 'Structural engineer, can guide safe repair approaches.',
      attended: false,
    },
    {
      volunteer_id: vol('vol16@willing.social'),
      posting_id: post('Neighborhood Repair Week'),
      message: 'Civil engineering student, comfortable with repair and construction.',
      attended: false,
    },
    {
      volunteer_id: vol('vol34@willing.social'),
      posting_id: post('Neighborhood Repair Week'),
      message: 'Plumber, can handle pipe and water point repairs.',
      attended: false,
    },
    {
      volunteer_id: vol('vol21@willing.social'),
      posting_id: post('Neighborhood Repair Week'),
      message: 'Graphic designer, happy to assist with mural and painting work.',
      attended: false,
    },

    // --- One-Day Hotline Sprint (Cedar Response, partial) ---
    {
      volunteer_id: vol('vol13@willing.social'),
      posting_id: post('One-Day Hotline Sprint'),
      message: 'Available all day to support hotline documentation.',
      attended: false,
    },
    {
      volunteer_id: vol('vol14@willing.social'),
      posting_id: post('One-Day Hotline Sprint'),
      message: 'Can assist with caller support and accurate note taking.',
      attended: false,
    },
    {
      volunteer_id: vol('vol36@willing.social'),
      posting_id: post('One-Day Hotline Sprint'),
      message: 'IT background, comfortable with helpline systems and data entry.',
      attended: false,
    },

    // --- Crisis Hotline Coverage Week (Cedar Response, partial) ---
    {
      volunteer_id: vol('vol13@willing.social'),
      posting_id: post('Crisis Hotline Coverage Week'),
      message: 'Ready to cover multiple hotline days.',
      attended: false,
    },
    {
      volunteer_id: vol('vol14@willing.social'),
      posting_id: post('Crisis Hotline Coverage Week'),
      message: 'Can commit to the full coverage window and support caller triage.',
      attended: false,
    },

    // --- Urban Search & Rescue Logistics (Cedar Response, review-based) ---
    {
      volunteer_id: vol('vol76@willing.social'),
      posting_id: post('Urban Search & Rescue Logistics'),
      message: 'Safety officer ensuring volunteer protection on field sites.',
      attended: false,
    },

    // --- First Aid Training Day (Cedar Response) ---
    {
      volunteer_id: vol('vol3@willing.social'),
      posting_id: post('First Aid Training Day'),
      message: 'Paramedic student, keen to take the refresher training.',
      attended: false,
    },
    {
      volunteer_id: vol('vol18@willing.social'),
      posting_id: post('First Aid Training Day'),
      message: 'First responder, excited to support certified training delivery.',
      attended: false,
    },
    {
      volunteer_id: vol('vol27@willing.social'),
      posting_id: post('First Aid Training Day'),
      message: 'High school student eager to get first aid certified.',
      attended: false,
    },
    {
      volunteer_id: vol('vol35@willing.social'),
      posting_id: post('First Aid Training Day'),
      message: 'Public health grad, values community first aid capacity.',
      attended: false,
    },
    {
      volunteer_id: vol('vol72@willing.social'),
      posting_id: post('First Aid Training Day'),
      message: 'Community radio host, wants to promote first aid literacy.',
      attended: false,
    },

    // --- Displacement Shelter Coordination (Cedar Response, partial) ---
    {
      volunteer_id: vol('vol65@willing.social'),
      posting_id: post('Displacement Shelter Coordination'),
      message: 'HR professional, experienced in managing volunteer rosters.',
      attended: false,
    },
    {
      volunteer_id: vol('vol14@willing.social'),
      posting_id: post('Displacement Shelter Coordination'),
      message: 'Admin and coordination background, great with comms logs.',
      attended: false,
    },
    {
      volunteer_id: vol('vol42@willing.social'),
      posting_id: post('Displacement Shelter Coordination'),
      message: 'Supply chain analyst, can manage supply tracking for shelters.',
      attended: false,
    },

    // --- Flood Cleanup Crew (Bekaa Uplift) ---
    {
      volunteer_id: vol('vol11@willing.social'),
      posting_id: post('Flood Cleanup Crew'),
      message: 'Ready to help with cleanup logistics, hauling, and field coordination.',
      attended: false,
    },
    {
      volunteer_id: vol('vol14@willing.social'),
      posting_id: post('Flood Cleanup Crew'),
      message: 'Available for flood recovery support and team coordination.',
      attended: false,
    },
    {
      volunteer_id: vol('vol70@willing.social'),
      posting_id: post('Flood Cleanup Crew'),
      message: 'Logistics manager with 15 years of supply chain experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol1@willing.social'),
      posting_id: post('Flood Cleanup Crew'),
      message: 'Physically strong and comfortable in field conditions.',
      attended: false,
    },
    {
      volunteer_id: vol('vol5@willing.social'),
      posting_id: post('Flood Cleanup Crew'),
      message: 'Physically fit, used to outdoor heavy work.',
      attended: false,
    },
    {
      volunteer_id: vol('vol34@willing.social'),
      posting_id: post('Flood Cleanup Crew'),
      message: 'Plumber with WASH recovery experience, useful for flood cleanup.',
      attended: false,
    },

    // --- School Supply Restocking (Bekaa Uplift, review-based, partial) ---
    {
      volunteer_id: vol('vol9@willing.social'),
      posting_id: post('School Supply Restocking'),
      message: 'Detail-oriented and reliable with sorting and packing tasks.',
      attended: false,
    },

    // --- Farm Recovery Rotation (Bekaa Uplift, partial) ---
    {
      volunteer_id: vol('vol11@willing.social'),
      posting_id: post('Farm Recovery Rotation'),
      message: 'Can help with cleanup and setup tasks across farm recovery days.',
      attended: false,
    },
    {
      volunteer_id: vol('vol32@willing.social'),
      posting_id: post('Farm Recovery Rotation'),
      message: 'Agricultural specialist, can support crop replanting and soil recovery.',
      attended: false,
    },
    {
      volunteer_id: vol('vol5@willing.social'),
      posting_id: post('Farm Recovery Rotation'),
      message: 'Physically fit, loves outdoor work and happy to assist farmers.',
      attended: false,
    },

    // --- Bekaa Food Parcel Drive (Bekaa Uplift) ---
    {
      volunteer_id: vol('vol1@willing.social'),
      posting_id: post('Bekaa Food Parcel Drive'),
      message: 'Comfortable with packing and distribution runs.',
      attended: false,
    },
    {
      volunteer_id: vol('vol9@willing.social'),
      posting_id: post('Bekaa Food Parcel Drive'),
      message: 'Detail-oriented, great with sorting and packing tasks.',
      attended: false,
    },
    {
      volunteer_id: vol('vol50@willing.social'),
      posting_id: post('Bekaa Food Parcel Drive'),
      message: 'Warehouse supervisor, can manage efficient packing lines.',
      attended: false,
    },
    {
      volunteer_id: vol('vol42@willing.social'),
      posting_id: post('Bekaa Food Parcel Drive'),
      message: 'Supply chain analyst, can help optimise distribution.',
      attended: false,
    },

    // --- Bekaa Youth Football League Setup (Bekaa Uplift) ---
    {
      volunteer_id: vol('vol38@willing.social'),
      posting_id: post('Bekaa Youth Football League Setup'),
      message: 'Football coach, can set up fields and manage team registration.',
      attended: false,
    },
    {
      volunteer_id: vol('vol68@willing.social'),
      posting_id: post('Bekaa Youth Football League Setup'),
      message: 'Student athlete, experienced with field prep and equipment setup.',
      attended: false,
    },
    {
      volunteer_id: vol('vol20@willing.social'),
      posting_id: post('Bekaa Youth Football League Setup'),
      message: 'Fitness coach, happy to help coordinate youth sports events.',
      attended: false,
    },

    // --- Stateless Persons Documentation Support (Inssan, review-based) ---
    {
      volunteer_id: vol('vol46@willing.social'),
      posting_id: post('Stateless Persons Documentation Support'),
      message: 'Former UNHCR officer with stateless persons case experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol37@willing.social'),
      posting_id: post('Stateless Persons Documentation Support'),
      message: 'Lawyer, can provide legal context for documentation.',
      attended: false,
    },
    {
      volunteer_id: vol('vol4@willing.social'),
      posting_id: post('Stateless Persons Documentation Support'),
      message: 'Social worker with empathy and Arabic fluency.',
      attended: false,
    },

    // --- Know Your Rights Workshop (Inssan) ---
    {
      volunteer_id: vol('vol37@willing.social'),
      posting_id: post('Know Your Rights Workshop'),
      message: 'Lawyer, can co-facilitate rights workshops effectively.',
      attended: false,
    },
    {
      volunteer_id: vol('vol46@willing.social'),
      posting_id: post('Know Your Rights Workshop'),
      message: 'Refugee specialist with rights training experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol2@willing.social'),
      posting_id: post('Know Your Rights Workshop'),
      message: 'Strong communication skills, happy to facilitate sessions.',
      attended: false,
    },

    // --- Asylum Seeker Intake Assistance (Inssan, partial) ---
    {
      volunteer_id: vol('vol46@willing.social'),
      posting_id: post('Asylum Seeker Intake Assistance'),
      message: 'Former UNHCR officer experienced with asylum case processing.',
      attended: false,
    },
    {
      volunteer_id: vol('vol4@willing.social'),
      posting_id: post('Asylum Seeker Intake Assistance'),
      message: 'Social worker, empathetic with vulnerable groups.',
      attended: false,
    },

    // --- Home Repair Volunteer Day (Offre Joie) ---
    {
      volunteer_id: vol('vol16@willing.social'),
      posting_id: post('Home Repair Volunteer Day'),
      message: 'Civil engineering student, comfortable with repair and construction.',
      attended: false,
    },
    {
      volunteer_id: vol('vol24@willing.social'),
      posting_id: post('Home Repair Volunteer Day'),
      message: 'Carpenter, experienced in community home repair.',
      attended: false,
    },
    {
      volunteer_id: vol('vol40@willing.social'),
      posting_id: post('Home Repair Volunteer Day'),
      message: 'Structural engineer, can guide safe repair approaches.',
      attended: false,
    },
    {
      volunteer_id: vol('vol56@willing.social'),
      posting_id: post('Home Repair Volunteer Day'),
      message: 'Engineering student, ready for construction tasks.',
      attended: false,
    },
    {
      volunteer_id: vol('vol66@willing.social'),
      posting_id: post('Home Repair Volunteer Day'),
      message: 'Electrician, can handle wiring and power repair work.',
      attended: false,
    },
    {
      volunteer_id: vol('vol34@willing.social'),
      posting_id: post('Home Repair Volunteer Day'),
      message: 'Plumber, experienced with water system repairs.',
      attended: false,
    },

    // --- Akkar Rebuilding Week (Offre Joie, partial) ---
    {
      volunteer_id: vol('vol16@willing.social'),
      posting_id: post('Akkar Rebuilding Week'),
      message: 'Civil engineering student, ready for week-long rebuild work.',
      attended: false,
    },
    {
      volunteer_id: vol('vol24@willing.social'),
      posting_id: post('Akkar Rebuilding Week'),
      message: 'Carpenter, experienced with structural repair and community rebuilding.',
      attended: false,
    },
    {
      volunteer_id: vol('vol26@willing.social'),
      posting_id: post('Akkar Rebuilding Week'),
      message: 'Former army officer, experienced managing field teams.',
      attended: false,
    },
    {
      volunteer_id: vol('vol56@willing.social'),
      posting_id: post('Akkar Rebuilding Week'),
      message: 'Engineering student, comfortable with heavy construction work.',
      attended: false,
    },

    // --- Urban Mural & Beautification Day (Offre Joie) ---
    {
      volunteer_id: vol('vol21@willing.social'),
      posting_id: post('Urban Mural & Beautification Day'),
      message: 'Graphic designer with street mural experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol41@willing.social'),
      posting_id: post('Urban Mural & Beautification Day'),
      message: 'Calligrapher and art educator, happy to paint community murals.',
      attended: false,
    },
    {
      volunteer_id: vol('vol6@willing.social'),
      posting_id: post('Urban Mural & Beautification Day'),
      message: 'Art teacher, experienced with large creative community projects.',
      attended: false,
    },
    {
      volunteer_id: vol('vol47@willing.social'),
      posting_id: post('Urban Mural & Beautification Day'),
      message: 'Student journalist, can document the project for outreach.',
      attended: false,
    },

    // --- Weekend Food Sort & Pack (Lebanese Food Bank) ---
    {
      volunteer_id: vol('vol9@willing.social'),
      posting_id: post('Weekend Food Sort & Pack'),
      message: 'Detail-oriented and fast with sorting and inventory tasks.',
      attended: false,
    },
    {
      volunteer_id: vol('vol50@willing.social'),
      posting_id: post('Weekend Food Sort & Pack'),
      message: 'Warehouse supervisor, happy to manage the sort and pack workflow.',
      attended: false,
    },
    {
      volunteer_id: vol('vol11@willing.social'),
      posting_id: post('Weekend Food Sort & Pack'),
      message: 'Operations background, great with warehouse logistics.',
      attended: false,
    },
    {
      volunteer_id: vol('vol42@willing.social'),
      posting_id: post('Weekend Food Sort & Pack'),
      message: 'Supply chain analyst, can optimise warehouse packing.',
      attended: false,
    },
    {
      volunteer_id: vol('vol70@willing.social'),
      posting_id: post('Weekend Food Sort & Pack'),
      message: 'Logistics manager, experienced with high-volume food distribution.',
      attended: false,
    },

    // --- Mobile Food Pantry – Tripoli (Lebanese Food Bank) ---
    {
      volunteer_id: vol('vol22@willing.social'),
      posting_id: post('Mobile Food Pantry – Tripoli'),
      message: 'Driver, can support mobile distribution runs.',
      attended: false,
    },
    {
      volunteer_id: vol('vol30@willing.social'),
      posting_id: post('Mobile Food Pantry – Tripoli'),
      message: 'Mechanic and driver, experienced with mobile delivery logistics.',
      attended: false,
    },
    {
      volunteer_id: vol('vol64@willing.social'),
      posting_id: post('Mobile Food Pantry – Tripoli'),
      message: 'Youth volunteer based in Tripoli, familiar with local neighborhoods.',
      attended: false,
    },

    // --- Crisis Food Parcel Assembly Line (Lebanese Food Bank, partial) ---
    {
      volunteer_id: vol('vol1@willing.social'),
      posting_id: post('Crisis Food Parcel Assembly Line'),
      message: 'Available for multiple shifts, great with packing.',
      attended: false,
    },
    {
      volunteer_id: vol('vol31@willing.social'),
      posting_id: post('Crisis Food Parcel Assembly Line'),
      message: 'Nutrition student, can assist with food safety during assembly.',
      attended: false,
    },
    {
      volunteer_id: vol('vol50@willing.social'),
      posting_id: post('Crisis Food Parcel Assembly Line'),
      message: 'Warehouse supervisor, can manage the assembly line efficiently.',
      attended: false,
    },
    {
      volunteer_id: vol('vol9@willing.social'),
      posting_id: post('Crisis Food Parcel Assembly Line'),
      message: 'Detail-oriented, reliable for repetitive packing tasks.',
      attended: false,
    },

    // --- Accessibility Audit – Beirut Streets (Arc en Ciel) ---
    {
      volunteer_id: vol('vol29@willing.social'),
      posting_id: post('Accessibility Audit – Beirut Streets'),
      message: 'Sign language interpreter with disability inclusion experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol71@willing.social'),
      posting_id: post('Accessibility Audit – Beirut Streets'),
      message: 'Occupational therapist, understands mobility and access needs.',
      attended: false,
    },
    {
      volunteer_id: vol('vol54@willing.social'),
      posting_id: post('Accessibility Audit – Beirut Streets'),
      message: 'Geography teacher, can help map accessibility barriers.',
      attended: false,
    },

    // --- Persons with Disabilities Evacuation Support (Arc en Ciel, review-based) ---
    {
      volunteer_id: vol('vol29@willing.social'),
      posting_id: post('Persons with Disabilities Evacuation Support'),
      message: 'Sign language interpreter with inclusive support experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol71@willing.social'),
      posting_id: post('Persons with Disabilities Evacuation Support'),
      message: 'Occupational therapist, experienced assisting people with disabilities.',
      attended: false,
    },
    {
      volunteer_id: vol('vol20@willing.social'),
      posting_id: post('Persons with Disabilities Evacuation Support'),
      message: 'Fitness coach with physical rehabilitation experience.',
      attended: false,
    },

    // --- Adaptive Sports Morning (Arc en Ciel) ---
    {
      volunteer_id: vol('vol20@willing.social'),
      posting_id: post('Adaptive Sports Morning'),
      message: 'Fitness coach passionate about inclusive and adaptive sports.',
      attended: false,
    },
    {
      volunteer_id: vol('vol38@willing.social'),
      posting_id: post('Adaptive Sports Morning'),
      message: 'Football coach with disability sports inclusion experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol29@willing.social'),
      posting_id: post('Adaptive Sports Morning'),
      message: 'Sign language interpreter, can support deaf participants.',
      attended: false,
    },
    {
      volunteer_id: vol('vol68@willing.social'),
      posting_id: post('Adaptive Sports Morning'),
      message: 'Student athlete, excited about inclusive fitness programs.',
      attended: false,
    },

    // --- Tyre Shoreline Tar Removal (Green Hand) ---
    {
      volunteer_id: vol('vol5@willing.social'),
      posting_id: post('Tyre Shoreline Tar Removal'),
      message: 'Physically fit and loves environmental cleanup work.',
      attended: false,
    },
    {
      volunteer_id: vol('vol63@willing.social'),
      posting_id: post('Tyre Shoreline Tar Removal'),
      message: 'Environmental scientist with coastal cleanup coordination experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol74@willing.social'),
      posting_id: post('Tyre Shoreline Tar Removal'),
      message: 'Marine biologist, can assess ecological impact during cleanup.',
      attended: false,
    },
    {
      volunteer_id: vol('vol23@willing.social'),
      posting_id: post('Tyre Shoreline Tar Removal'),
      message: 'Student active in environmental clubs and beach cleanups.',
      attended: false,
    },
    {
      volunteer_id: vol('vol45@willing.social'),
      posting_id: post('Tyre Shoreline Tar Removal'),
      message: 'Teen environmentalist passionate about protecting the coastline.',
      attended: false,
    },

    // --- Urban Tree Planting – Beirut (Green Hand) ---
    {
      volunteer_id: vol('vol5@willing.social'),
      posting_id: post('Urban Tree Planting – Beirut'),
      message: 'Loves outdoor community work and environmental projects.',
      attended: false,
    },
    {
      volunteer_id: vol('vol64@willing.social'),
      posting_id: post('Urban Tree Planting – Beirut'),
      message: 'Youth gardener and community greening activist.',
      attended: false,
    },
    {
      volunteer_id: vol('vol23@willing.social'),
      posting_id: post('Urban Tree Planting – Beirut'),
      message: 'Active in campus environmental clubs, excited about tree planting.',
      attended: false,
    },
    {
      volunteer_id: vol('vol59@willing.social'),
      posting_id: post('Urban Tree Planting – Beirut'),
      message: 'Teen environmental volunteer running school awareness campaigns.',
      attended: false,
    },

    // --- Recycling Awareness Day – Schools (Green Hand) ---
    {
      volunteer_id: vol('vol35@willing.social'),
      posting_id: post('Recycling Awareness Day – Schools'),
      message: 'Public health grad, experienced in community education sessions.',
      attended: false,
    },
    {
      volunteer_id: vol('vol2@willing.social'),
      posting_id: post('Recycling Awareness Day – Schools'),
      message: 'Experienced tutor, comfortable facilitating school workshops.',
      attended: false,
    },
    {
      volunteer_id: vol('vol45@willing.social'),
      posting_id: post('Recycling Awareness Day – Schools'),
      message: 'Teen environmentalist, relatable to school-age audiences.',
      attended: false,
    },

    // --- Refugee Community Learning Support (Basmeh & Zeitooneh) ---
    {
      volunteer_id: vol('vol2@willing.social'),
      posting_id: post('Refugee Community Learning Support'),
      message: 'Experienced tutor covering literacy, numeracy, and Arabic.',
      attended: false,
    },
    {
      volunteer_id: vol('vol12@willing.social'),
      posting_id: post('Refugee Community Learning Support'),
      message: 'Community educator, loves working with youth learners.',
      attended: false,
    },
    {
      volunteer_id: vol('vol28@willing.social'),
      posting_id: post('Refugee Community Learning Support'),
      message: 'Retired schoolteacher, great with literacy and numeracy.',
      attended: false,
    },
    { volunteer_id: vol('vol49@willing.social'),
      posting_id: post('Refugee Community Learning Support'),
      message: 'Early childhood educator, experienced with young learners.',
      attended: false,
    },

    // --- Emergency NFI Distribution (Basmeh & Zeitooneh) ---
    {
      volunteer_id: vol('vol1@willing.social'),
      posting_id: post('Emergency NFI Distribution'),
      message: 'Comfortable with packing and distribution of relief items.',
      attended: false,
    },
    {
      volunteer_id: vol('vol70@willing.social'),
      posting_id: post('Emergency NFI Distribution'),
      message: 'Logistics manager, experienced with high-volume relief distribution.',
      attended: false,
    },
    {
      volunteer_id: vol('vol42@willing.social'),
      posting_id: post('Emergency NFI Distribution'),
      message: 'Supply chain analyst, can coordinate NFI distribution efficiently.',
      attended: false,
    },
    {
      volunteer_id: vol('vol11@willing.social'),
      posting_id: post('Emergency NFI Distribution'),
      message: 'Operations background, reliable for relief distribution work.',
      attended: false,
    },

    // --- Community Kitchen – Shatila (Basmeh & Zeitooneh) ---
    {
      volunteer_id: vol('vol8@willing.social'),
      posting_id: post('Community Kitchen – Shatila'),
      message: 'Catering background, comfortable with prep, serving, and hygiene.',
      attended: false,
    },
    {
      volunteer_id: vol('vol44@willing.social'),
      posting_id: post('Community Kitchen – Shatila'),
      message: 'Experienced chef managing high-volume community kitchens.',
      attended: false,
    },
    {
      volunteer_id: vol('vol62@willing.social'),
      posting_id: post('Community Kitchen – Shatila'),
      message: 'Professional chef with community kitchen experience.',
      attended: false,
    },

    // --- Non-Formal Education Volunteer (Kayany Foundation, review-based) ---
    {
      volunteer_id: vol('vol2@willing.social'),
      posting_id: post('Non-Formal Education Volunteer'),
      message: 'Experienced tutor, comfortable with Arabic, English, and maths.',
      attended: false,
    },
    {
      volunteer_id: vol('vol28@willing.social'),
      posting_id: post('Non-Formal Education Volunteer'),
      message: 'Retired schoolteacher, experienced in classroom delivery.',
      attended: false,
    },
    {
      volunteer_id: vol('vol12@willing.social'),
      posting_id: post('Non-Formal Education Volunteer'),
      message: 'Community educator who enjoys youth engagement and facilitation.',
      attended: false,
    },

    // --- Psychosocial Activities for Children (Kayany Foundation) ---
    {
      volunteer_id: vol('vol6@willing.social'),
      posting_id: post('Psychosocial Activities for Children'),
      message: 'Art teacher, experienced running creative activities for children.',
      attended: false,
    },
    {
      volunteer_id: vol('vol61@willing.social'),
      posting_id: post('Psychosocial Activities for Children'),
      message: 'Child psychologist, can run structured psychosocial activities.',
      attended: false,
    },
    {
      volunteer_id: vol('vol33@willing.social'),
      posting_id: post('Psychosocial Activities for Children'),
      message: 'Theater student, experienced in drama and storytelling for youth.',
      attended: false,
    },
    {
      volunteer_id: vol('vol49@willing.social'),
      posting_id: post('Psychosocial Activities for Children'),
      message: 'Early childhood educator, great with play-based activities.',
      attended: false,
    },

    // --- Displaced Women Support Circle (Sawa, review-based, partial) ---
    {
      volunteer_id: vol('vol4@willing.social'),
      posting_id: post('Displaced Women Support Circle'),
      message: 'Social worker with trauma-informed facilitation experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol17@willing.social'),
      posting_id: post('Displaced Women Support Circle'),
      message: 'Psychology student trained in psychosocial approaches.',
      attended: false,
    },
    {
      volunteer_id: vol('vol61@willing.social'),
      posting_id: post('Displaced Women Support Circle'),
      message: 'Psychologist with group support facilitation experience.',
      attended: false,
    },

    // --- Mobile Health Clinic Support (Amel Association, review-based) ---
    {
      volunteer_id: vol('vol19@willing.social'),
      posting_id: post('Mobile Health Clinic Support'),
      message: 'Nurse with experience in mobile clinic environments.',
      attended: false,
    },
    {
      volunteer_id: vol('vol60@willing.social'),
      posting_id: post('Mobile Health Clinic Support'),
      message: 'Pharmacist, can support medicine distribution in mobile clinics.',
      attended: false,
    },
    {
      volunteer_id: vol('vol73@willing.social'),
      posting_id: post('Mobile Health Clinic Support'),
      message: 'Doctor volunteering in rural health missions across Lebanon.',
      attended: false,
    },
    {
      volunteer_id: vol('vol35@willing.social'),
      posting_id: post('Mobile Health Clinic Support'),
      message: 'Public health grad, can assist with health education and registration.',
      attended: false,
    },

    // --- Emergency Health Triage Support (Amel Association, review-based) ---
    {
      volunteer_id: vol('vol3@willing.social'),
      posting_id: post('Emergency Health Triage Support'),
      message: 'Paramedic student with first aid and triage training.',
      attended: false,
    },
    {
      volunteer_id: vol('vol19@willing.social'),
      posting_id: post('Emergency Health Triage Support'),
      message: 'ICU nurse with emergency triage experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol73@willing.social'),
      posting_id: post('Emergency Health Triage Support'),
      message: 'Doctor with field emergency experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol80@willing.social'),
      posting_id: post('Emergency Health Triage Support'),
      message: 'Trauma surgeon, experienced in emergency triage settings.',
      attended: false,
    },

    // --- Food Basket Delivery – South Lebanon (Amel Association) ---
    {
      volunteer_id: vol('vol22@willing.social'),
      posting_id: post('Food Basket Delivery – South Lebanon'),
      message: 'Driver, experienced with supply transport and rural delivery.',
      attended: false,
    },
    {
      volunteer_id: vol('vol30@willing.social'),
      posting_id: post('Food Basket Delivery – South Lebanon'),
      message: 'Mechanic and driver, comfortable with rural delivery routes.',
      attended: false,
    },
    {
      volunteer_id: vol('vol1@willing.social'),
      posting_id: post('Food Basket Delivery – South Lebanon'),
      message: 'Physically fit, happy to carry and deliver food baskets.',
      attended: false,
    },

    // --- Blood Donation Campaign (LRC) ---
    {
      volunteer_id: vol('vol43@willing.social'),
      posting_id: post('Blood Donation Campaign'),
      message: 'Medical lab student with blood drive support experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol39@willing.social'),
      posting_id: post('Blood Donation Campaign'),
      message: 'Event planner, can manage donor flow and waiting area.',
      attended: false,
    },
    {
      volunteer_id: vol('vol60@willing.social'),
      posting_id: post('Blood Donation Campaign'),
      message: 'Pharmacist, can assist with donor screening.',
      attended: false,
    },
    {
      volunteer_id: vol('vol19@willing.social'),
      posting_id: post('Blood Donation Campaign'),
      message: 'Nurse, experienced in blood donation post-care.',
      attended: false,
    },
    {
      volunteer_id: vol('vol65@willing.social'),
      posting_id: post('Blood Donation Campaign'),
      message: 'HR background, can manage registration and donor flow.',
      attended: false,
    },

    // --- CPR & First Aid Public Training (LRC) ---
    {
      volunteer_id: vol('vol18@willing.social'),
      posting_id: post('CPR & First Aid Public Training'),
      message: 'First responder, excited to support certified training delivery.',
      attended: false,
    },
    {
      volunteer_id: vol('vol3@willing.social'),
      posting_id: post('CPR & First Aid Public Training'),
      message: 'Paramedic student, happy to assist the training team.',
      attended: false,
    },
    {
      volunteer_id: vol('vol35@willing.social'),
      posting_id: post('CPR & First Aid Public Training'),
      message: 'Public health grad, values community first aid capacity.',
      attended: false,
    },

    // --- Emergency Ambulance Dispatch Support (LRC, review-based) ---
    {
      volunteer_id: vol('vol13@willing.social'),
      posting_id: post('Emergency Ambulance Dispatch Support'),
      message: 'Tech-savvy coordinator, comfortable with dispatch systems.',
      attended: false,
    },
    {
      volunteer_id: vol('vol36@willing.social'),
      posting_id: post('Emergency Ambulance Dispatch Support'),
      message: 'IT support background, comfortable with comms systems.',
      attended: false,
    },

    // --- Youth Entrepreneurship Mentorship (Nawaya Network, review-based, partial) ---
    {
      volunteer_id: vol('vol25@willing.social'),
      posting_id: post('Youth Entrepreneurship Mentorship'),
      message: 'Social media manager who can advise on digital marketing.',
      attended: false,
    },
    {
      volunteer_id: vol('vol57@willing.social'),
      posting_id: post('Youth Entrepreneurship Mentorship'),
      message: 'Accountant, can mentor on business planning and financials.',
      attended: false,
    },
    {
      volunteer_id: vol('vol7@willing.social'),
      posting_id: post('Youth Entrepreneurship Mentorship'),
      message: 'Software developer who can mentor on tech entrepreneurship.',
      attended: false,
    },

    // --- Food Micro-Enterprise Support (Nawaya Network, review-based) ---
    {
      volunteer_id: vol('vol44@willing.social'),
      posting_id: post('Food Micro-Enterprise Support'),
      message: 'Chef and culinary trainer, can teach food production skills.',
      attended: false,
    },
    {
      volunteer_id: vol('vol62@willing.social'),
      posting_id: post('Food Micro-Enterprise Support'),
      message: 'Professional chef, can advise on scaling community food enterprises.',
      attended: false,
    },
    {
      volunteer_id: vol('vol57@willing.social'),
      posting_id: post('Food Micro-Enterprise Support'),
      message: 'Accountant, can help with basic business finance and costing.',
      attended: false,
    },

    // --- Akkar Household Assessment Teams (AND, review-based, partial) ---
    {
      volunteer_id: vol('vol54@willing.social'),
      posting_id: post('Akkar Household Assessment Teams'),
      message: 'Geography teacher, experienced in mapping and field assessment.',
      attended: false,
    },
    {
      volunteer_id: vol('vol78@willing.social'),
      posting_id: post('Akkar Household Assessment Teams'),
      message: 'Drone operator, can assist with aerial damage documentation.',
      attended: false,
    },
    {
      volunteer_id: vol('vol58@willing.social'),
      posting_id: post('Akkar Household Assessment Teams'),
      message: 'Field coordinator with village assessment experience.',
      attended: false,
    },

    // --- Agricultural Revival Day – Akkar (AND) ---
    {
      volunteer_id: vol('vol32@willing.social'),
      posting_id: post('Agricultural Revival Day – Akkar'),
      message: 'Agricultural specialist, experienced with soil and crop replanting.',
      attended: false,
    },
    {
      volunteer_id: vol('vol5@willing.social'),
      posting_id: post('Agricultural Revival Day – Akkar'),
      message: 'Physically fit and loves outdoor farm work.',
      attended: false,
    },
    {
      volunteer_id: vol('vol64@willing.social'),
      posting_id: post('Agricultural Revival Day – Akkar'),
      message: 'Youth gardener, experienced with community planting projects.',
      attended: false,
    },
    {
      volunteer_id: vol('vol69@willing.social'),
      posting_id: post('Agricultural Revival Day – Akkar'),
      message: 'Biology student passionate about soil and habitat recovery.',
      attended: false,
    },

    // --- Monthly Food Parcel Distribution (Sidon Welfare) ---
    {
      volunteer_id: vol('vol1@willing.social'),
      posting_id: post('Monthly Food Parcel Distribution'),
      message: 'Comfortable with logistics and distribution work.',
      attended: false,
    },
    {
      volunteer_id: vol('vol9@willing.social'),
      posting_id: post('Monthly Food Parcel Distribution'),
      message: 'Detail-oriented, reliable for sorting and distribution tasks.',
      attended: false,
    },
    {
      volunteer_id: vol('vol14@willing.social'),
      posting_id: post('Monthly Food Parcel Distribution'),
      message: 'Dependable and patient, great with community distribution.',
      attended: false,
    },

    // --- Elderly Home Visiting Program (Sidon Welfare) ---
    {
      volunteer_id: vol('vol4@willing.social'),
      posting_id: post('Elderly Home Visiting Program'),
      message: 'Social worker background, comfortable providing elderly companionship.',
      attended: false,
    },
    {
      volunteer_id: vol('vol71@willing.social'),
      posting_id: post('Elderly Home Visiting Program'),
      message: 'Occupational therapist, great with elderly daily living support.',
      attended: false,
    },
    {
      volunteer_id: vol('vol28@willing.social'),
      posting_id: post('Elderly Home Visiting Program'),
      message: 'Retired teacher, enjoys spending time with the elderly.',
      attended: false,
    },
    {
      volunteer_id: vol('vol79@willing.social'),
      posting_id: post('Elderly Home Visiting Program'),
      message: 'Youth mentor, happy to provide intergenerational companionship.',
      attended: false,
    },

    // --- Tyre Beach Rehabilitation (Tyre Community Foundation, partial) ---
    {
      volunteer_id: vol('vol63@willing.social'),
      posting_id: post('Tyre Beach Rehabilitation'),
      message: 'Environmental scientist, can help assess and coordinate cleanup.',
      attended: false,
    },
    {
      volunteer_id: vol('vol45@willing.social'),
      posting_id: post('Tyre Beach Rehabilitation'),
      message: 'Teen environmentalist passionate about ocean conservation.',
      attended: false,
    },
    {
      volunteer_id: vol('vol74@willing.social'),
      posting_id: post('Tyre Beach Rehabilitation'),
      message: 'Marine biologist monitoring ecosystem recovery.',
      attended: false,
    },
    {
      volunteer_id: vol('vol23@willing.social'),
      posting_id: post('Tyre Beach Rehabilitation'),
      message: 'Student active in beach cleanup campaigns.',
      attended: false,
    },
    {
      volunteer_id: vol('vol5@willing.social'),
      posting_id: post('Tyre Beach Rehabilitation'),
      message: 'Physically fit and passionate about environmental cleanup.',
      attended: false,
    },

    // --- Heritage Site Cleanup Day (Tyre Community Foundation) ---
    {
      volunteer_id: vol('vol5@willing.social'),
      posting_id: post('Heritage Site Cleanup Day'),
      message: 'Loves outdoor community work, happy to assist with site cleanup.',
      attended: false,
    },
    {
      volunteer_id: vol('vol23@willing.social'),
      posting_id: post('Heritage Site Cleanup Day'),
      message: 'Student environmentalist, excited about heritage conservation.',
      attended: false,
    },
    {
      volunteer_id: vol('vol54@willing.social'),
      posting_id: post('Heritage Site Cleanup Day'),
      message: 'Geography teacher with interest in archaeology and cultural heritage.',
      attended: false,
    },

    // --- Volunteer Tutor – South Lebanon (SLEN, partial) ---
    {
      volunteer_id: vol('vol2@willing.social'),
      posting_id: post('Volunteer Tutor – South Lebanon'),
      message: 'Experienced tutor covering Arabic, English, and maths.',
      attended: false,
    },
    {
      volunteer_id: vol('vol28@willing.social'),
      posting_id: post('Volunteer Tutor – South Lebanon'),
      message: 'Retired schoolteacher, happy to tutor across all subjects.',
      attended: false,
    },
    {
      volunteer_id: vol('vol12@willing.social'),
      posting_id: post('Volunteer Tutor – South Lebanon'),
      message: 'Community educator who enjoys tutoring and youth engagement.',
      attended: false,
    },
    {
      volunteer_id: vol('vol7@willing.social'),
      posting_id: post('Volunteer Tutor – South Lebanon'),
      message: 'Software developer, strong in maths and sciences tutoring.',
      attended: false,
    },

    // --- Catch-Up Classes for Displaced Children (SLEN, partial) ---
    {
      volunteer_id: vol('vol2@willing.social'),
      posting_id: post('Catch-Up Classes for Displaced Children'),
      message: 'Tutor with Arabic and maths experience.',
      attended: false,
    },
    {
      volunteer_id: vol('vol12@willing.social'),
      posting_id: post('Catch-Up Classes for Displaced Children'),
      message: 'Community educator, great with displaced youth.',
      attended: false,
    },
    {
      volunteer_id: vol('vol49@willing.social'),
      posting_id: post('Catch-Up Classes for Displaced Children'),
      message: 'Early childhood educator, experienced with young learners.',
      attended: false,
    },

    // --- Zahle Flood Relief Pack & Deliver (Zahle Youth Council) ---
    {
      volunteer_id: vol('vol27@willing.social'),
      posting_id: post('Zahle Flood Relief Pack & Deliver'),
      message: 'Eager to contribute to local relief.',
      attended: false,
    },
    {
      volunteer_id: vol('vol42@willing.social'),
      posting_id: post('Zahle Flood Relief Pack & Deliver'),
      message: 'Supply chain analyst, can help optimise packing and delivery.',
      attended: false,
    },
    {
      volunteer_id: vol('vol9@willing.social'),
      posting_id: post('Zahle Flood Relief Pack & Deliver'),
      message: 'Detail-oriented, reliable for packing and sorting tasks.',
      attended: false,
    },
    {
      volunteer_id: vol('vol50@willing.social'),
      posting_id: post('Zahle Flood Relief Pack & Deliver'),
      message: 'Warehouse supervisor, comfortable with high-volume pack runs.',
      attended: false,
    },

    // --- Youth Clean City Campaign (Zahle Youth Council) ---
    {
      volunteer_id: vol('vol27@willing.social'),
      posting_id: post('Youth Clean City Campaign'),
      message: 'High school student passionate about community activism.',
      attended: false,
    },
    {
      volunteer_id: vol('vol59@willing.social'),
      posting_id: post('Youth Clean City Campaign'),
      message: 'Teen environmental volunteer.',
      attended: false,
    },
    {
      volunteer_id: vol('vol23@willing.social'),
      posting_id: post('Youth Clean City Campaign'),
      message: 'University student active in environmental clubs.',
      attended: false,
    },
    {
      volunteer_id: vol('vol64@willing.social'),
      posting_id: post('Youth Clean City Campaign'),
      message: 'Youth activist, experienced in community cleanup campaigns.',
      attended: false,
    },
    {
      volunteer_id: vol('vol45@willing.social'),
      posting_id: post('Youth Clean City Campaign'),
      message: 'Teen environmentalist, keen on city beautification.',
      attended: false,
    },

    // --- Bekaa After-School Sports Program (Zahle Youth Council, partial) ---
    {
      volunteer_id: vol('vol38@willing.social'),
      posting_id: post('Bekaa After-School Sports Program'),
      message: 'Football coach, experienced running after-school sports sessions.',
      attended: false,
    },
    {
      volunteer_id: vol('vol20@willing.social'),
      posting_id: post('Bekaa After-School Sports Program'),
      message: 'Fitness coach, happy to run inclusive fitness sessions.',
      attended: false,
    },
    {
      volunteer_id: vol('vol68@willing.social'),
      posting_id: post('Bekaa After-School Sports Program'),
      message: 'Student athlete, experienced coaching school-age youth.',
      attended: false,
    },

    // --- Youth Leadership Summit Volunteer (Beyond) ---
    {
      volunteer_id: vol('vol39@willing.social'),
      posting_id: post('Youth Leadership Summit Volunteer'),
      message: 'Event planner, experienced with large-scale event coordination.',
      attended: false,
    },
    {
      volunteer_id: vol('vol65@willing.social'),
      posting_id: post('Youth Leadership Summit Volunteer'),
      message: 'HR professional, experienced managing volunteer teams at events.',
      attended: false,
    },
    {
      volunteer_id: vol('vol25@willing.social'),
      posting_id: post('Youth Leadership Summit Volunteer'),
      message: 'Social media manager, can handle event communications.',
      attended: false,
    },
    {
      volunteer_id: vol('vol72@willing.social'),
      posting_id: post('Youth Leadership Summit Volunteer'),
      message: 'Community radio presenter, great for MC and announcements.',
      attended: false,
    },

    // --- Civic Engagement Workshop Facilitator (Beyond, review-based) ---
    {
      volunteer_id: vol('vol37@willing.social'),
      posting_id: post('Civic Engagement Workshop Facilitator'),
      message: 'Lawyer, can facilitate civic education sessions.',
      attended: false,
    },
    {
      volunteer_id: vol('vol55@willing.social'),
      posting_id: post('Civic Engagement Workshop Facilitator'),
      message: 'Community organizer experienced in advocacy workshops.',
      attended: false,
    },

    // --- Recycling Drive – Tripoli (Arcenciel Tripoli) ---
    {
      volunteer_id: vol('vol23@willing.social'),
      posting_id: post('Recycling Drive – Tripoli'),
      message: 'Student active in environmental clubs and recycling campaigns.',
      attended: false,
    },
    {
      volunteer_id: vol('vol64@willing.social'),
      posting_id: post('Recycling Drive – Tripoli'),
      message: 'Youth activist in Tripoli, familiar with local neighborhoods.',
      attended: false,
    },
    {
      volunteer_id: vol('vol59@willing.social'),
      posting_id: post('Recycling Drive – Tripoli'),
      message: 'Teen environmental volunteer, runs school awareness campaigns.',
      attended: false,
    },
    {
      volunteer_id: vol('vol45@willing.social'),
      posting_id: post('Recycling Drive – Tripoli'),
      message: 'Teen environmentalist passionate about recycling.',
      attended: false,
    },

    // --- Disability-Sensitive Relief Distribution (Arcenciel Tripoli, review-based) ---
    {
      volunteer_id: vol('vol29@willing.social'),
      posting_id: post('Disability-Sensitive Relief Distribution'),
      message: 'Sign language interpreter, experienced in inclusive support.',
      attended: false,
    },
    {
      volunteer_id: vol('vol71@willing.social'),
      posting_id: post('Disability-Sensitive Relief Distribution'),
      message: 'Occupational therapist, understands accessibility and dignity needs.',
      attended: false,
    },
    {
      volunteer_id: vol('vol20@willing.social'),
      posting_id: post('Disability-Sensitive Relief Distribution'),
      message: 'Fitness coach with physical rehabilitation background.',
      attended: false,
    },

    // --- Child Safety Awareness Event (Himaya) ---
    {
      volunteer_id: vol('vol6@willing.social'),
      posting_id: post('Child Safety Awareness Event'),
      message: 'Art teacher experienced running creative sessions with children.',
      attended: false,
    },
    {
      volunteer_id: vol('vol12@willing.social'),
      posting_id: post('Child Safety Awareness Event'),
      message: 'Community educator who enjoys engaging children and parents.',
      attended: false,
    },
    {
      volunteer_id: vol('vol61@willing.social'),
      posting_id: post('Child Safety Awareness Event'),
      message: 'Child psychologist, great with age-appropriate safety education.',
      attended: false,
    },

    // --- Child Protection Hotline Backup (Himaya, review-based) ---
    {
      volunteer_id: vol('vol13@willing.social'),
      posting_id: post('Child Protection Hotline Backup'),
      message: 'Tech-savvy coordinator comfortable with hotline systems.',
      attended: false,
    },
    {
      volunteer_id: vol('vol36@willing.social'),
      posting_id: post('Child Protection Hotline Backup'),
      message: 'IT support background, comfortable with call management systems.',
      attended: false,
    },

    // --- Child-Friendly Space Activities (TDH, partial) ---
    {
      volunteer_id: vol('vol6@willing.social'),
      posting_id: post('Child-Friendly Space Activities'),
      message: 'Art teacher with experience in child-friendly displacement settings.',
      attended: false,
    },
    {
      volunteer_id: vol('vol61@willing.social'),
      posting_id: post('Child-Friendly Space Activities'),
      message: 'Child psychologist, can run structured safe space activities.',
      attended: false,
    },
    {
      volunteer_id: vol('vol49@willing.social'),
      posting_id: post('Child-Friendly Space Activities'),
      message: 'Early childhood educator, experienced with play-based activities.',
      attended: false,
    },
    {
      volunteer_id: vol('vol33@willing.social'),
      posting_id: post('Child-Friendly Space Activities'),
      message: 'Theater student, experienced in drama and storytelling for youth.',
      attended: false,
    },

    // --- Child Rights Education Session (TDH, review-based) ---
    {
      volunteer_id: vol('vol2@willing.social'),
      posting_id: post('Child Rights Education Session'),
      message: 'Experienced tutor, comfortable facilitating school workshops.',
      attended: false,
    },
    {
      volunteer_id: vol('vol12@willing.social'),
      posting_id: post('Child Rights Education Session'),
      message: 'Community educator who enjoys engaging with children.',
      attended: false,
    },

    // --- Relief Fund Transparency Reporting (Impact Lebanon, partial) ---
    {
      volunteer_id: vol('vol57@willing.social'),
      posting_id: post('Relief Fund Transparency Reporting'),
      message: 'Accountant, can assist with financial documentation and audit.',
      attended: false,
    },
    {
      volunteer_id: vol('vol47@willing.social'),
      posting_id: post('Relief Fund Transparency Reporting'),
      message: 'Student journalist, experienced in documenting community projects.',
      attended: false,
    },
    {
      volunteer_id: vol('vol54@willing.social'),
      posting_id: post('Relief Fund Transparency Reporting'),
      message: 'Geography teacher, can help with field site documentation.',
      attended: false,
    },

    // --- Diaspora Connect Volunteer Event (Impact Lebanon) ---
    {
      volunteer_id: vol('vol39@willing.social'),
      posting_id: post('Diaspora Connect Volunteer Event'),
      message: 'Event planner, experienced with networking event coordination.',
      attended: false,
    },
    {
      volunteer_id: vol('vol65@willing.social'),
      posting_id: post('Diaspora Connect Volunteer Event'),
      message: 'HR professional, great at matching volunteers with opportunities.',
      attended: false,
    },
    {
      volunteer_id: vol('vol25@willing.social'),
      posting_id: post('Diaspora Connect Volunteer Event'),
      message: 'Social media manager, can help promote the event online.',
      attended: false,
    },
    {
      volunteer_id: vol('vol67@willing.social'),
      posting_id: post('Diaspora Connect Volunteer Event'),
      message: 'Social media coordinator, can amplify the event reach.',
      attended: false,
    },

  ])
    .returning(['id', 'volunteer_id', 'posting_id', 'attended'])
    .execute();

  const applicationByKey = new Map(
    applications.map(a => [`${a.volunteer_id}:${a.posting_id}`, a.id] as const),
  );

  // Enrollment Application Dates (partial attendance postings)

  const partialApplicationDateSelections: Array<{ volunteerEmail: string; postingTitle: string; dates: string[] }> = [
    {
      volunteerEmail: 'vol4@willing.social',
      postingTitle: 'Displaced Families Registration',
      dates: [toIsoDate(relDate(5)), toIsoDate(relDate(7))],
    },
    {
      volunteerEmail: 'vol2@willing.social',
      postingTitle: 'Displaced Families Registration',
      dates: [toIsoDate(relDate(6))],
    },
    {
      volunteerEmail: 'vol7@willing.social',
      postingTitle: 'Remote Homework Support',
      dates: [toIsoDate(relDate(3)), toIsoDate(relDate(10)), toIsoDate(relDate(17))],
    },
    {
      volunteerEmail: 'vol2@willing.social',
      postingTitle: 'Remote Homework Support',
      dates: [toIsoDate(relDate(2)), toIsoDate(relDate(9))],
    },
    {
      volunteerEmail: 'vol13@willing.social',
      postingTitle: 'Volunteer Helpline Shifts',
      dates: [toIsoDate(relDate(10)), toIsoDate(relDate(12)), toIsoDate(relDate(14))],
    },
    {
      volunteerEmail: 'vol14@willing.social',
      postingTitle: 'Volunteer Helpline Shifts',
      dates: [toIsoDate(relDate(11)), toIsoDate(relDate(13))],
    },
    {
      volunteerEmail: 'vol12@willing.social',
      postingTitle: 'School Supply Restocking',
      dates: [toIsoDate(relDate(24)), toIsoDate(relDate(26))],
    },
    {
      volunteerEmail: 'vol11@willing.social',
      postingTitle: 'School Supply Restocking',
      dates: [toIsoDate(relDate(25))],
    },
  ];

  await database.insertInto('enrollment_application_date').values(
    partialApplicationDateSelections.flatMap(({ volunteerEmail, postingTitle, dates }) => {
      const volunteerId = volByEmail.get(volunteerEmail);
      const postingId = postingByTitle.get(postingTitle);
      const applicationId = volunteerId && postingId ? applicationByKey.get(`${volunteerId}:${postingId}`) : undefined;
      if (!applicationId) return [];
      return dates.map(date => ({
        application_id: applicationId,
        date: new Date(`${date}T00:00:00.000Z`),
      }));
    }),
  ).execute();

  // Enrollment Dates

  const partialEnrollmentDateSelections = new Map<string, string[]>([
    [`${volByEmail.get('vol4@willing.social')}:${postingByTitle.get('Displaced Families Registration')}`, [toIsoDate(relDate(5)), toIsoDate(relDate(7))]],
    [`${volByEmail.get('vol7@willing.social')}:${postingByTitle.get('Remote Homework Support')}`, [toIsoDate(relDate(3)), toIsoDate(relDate(10)), toIsoDate(relDate(17))]],
    [`${volByEmail.get('vol11@willing.social')}:${postingByTitle.get('Neighborhood Repair Week')}`, [toIsoDate(relDate(18)), toIsoDate(relDate(19)), toIsoDate(relDate(21))]],
    [`${volByEmail.get('vol24@willing.social')}:${postingByTitle.get('Neighborhood Repair Week')}`, [toIsoDate(relDate(20)), toIsoDate(relDate(22))]],
    [`${volByEmail.get('vol13@willing.social')}:${postingByTitle.get('One-Day Hotline Sprint')}`, [toIsoDate(relDate(25))]],
    [`${volByEmail.get('vol14@willing.social')}:${postingByTitle.get('One-Day Hotline Sprint')}`, [toIsoDate(relDate(25))]],
    [`${volByEmail.get('vol11@willing.social')}:${postingByTitle.get('Farm Recovery Rotation')}`, [toIsoDate(relDate(28)), toIsoDate(relDate(29))]],
    [`${volByEmail.get('vol32@willing.social')}:${postingByTitle.get('Farm Recovery Rotation')}`, [toIsoDate(relDate(28)), toIsoDate(relDate(30))]],
    [`${volByEmail.get('vol13@willing.social')}:${postingByTitle.get('Crisis Hotline Coverage Week')}`, [toIsoDate(relDate(35)), toIsoDate(relDate(36)), toIsoDate(relDate(37))]],
    [`${volByEmail.get('vol14@willing.social')}:${postingByTitle.get('Crisis Hotline Coverage Week')}`, [toIsoDate(relDate(35)), toIsoDate(relDate(36)), toIsoDate(relDate(37))]],
  ]);

  await database.insertInto('enrollment_date').values(
    enrollments.flatMap((enrollment) => {
      const posting = postings.find(p => p.id === enrollment.posting_id);
      if (!posting) return [];

      const partialKey = `${enrollment.volunteer_id}:${enrollment.posting_id}`;
      const dateStrings = posting.allows_partial_attendance
        ? (partialEnrollmentDateSelections.get(partialKey) ?? [])
        : getDateRange(posting.start_date, posting.end_date);

      return dateStrings.map(date => ({
        enrollment_id: enrollment.id,
        posting_id: enrollment.posting_id,
        date: new Date(`${date}T00:00:00.000Z`),
        attended: enrollment.attended,
      }));
    }),
  ).execute();

  console.log('---------------------------------------------');
  console.log('Seed complete.');
  console.log('Password (all accounts):', PASSWORD_PLAIN);
  console.log('');
  console.log('Admin: admin@willing.social');
  console.log('');
  console.log('Organizations: org1–org30@willing.social');
  console.log('');
  console.log('Volunteers: vol1–vol80@willing.social');

  await database.destroy();
}

seed().catch(async (err) => {
  console.error('Seed failed:', err);
  try {
    await database.destroy();
  } catch (_error) {
    // Ignore
  }
  process.exit(1);
});
