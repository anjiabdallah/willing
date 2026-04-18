import { sql } from 'kysely';

import config from '../config.ts';
import database from '../db/index.ts';
import { hash } from '../services/bcrypt/index.ts';

const PASSWORD_PLAIN = 'Willing123';

async function seed() {
  if (config.NODE_ENV === 'production') {
    throw new Error('Refusing to seed in production.');
  }

  const passwordHash = await hash(PASSWORD_PLAIN);

  await sql`
  TRUNCATE TABLE
    enrollment_application_date,
    enrollment_date,
    enrollment_application,
    enrollment,
    posting_skill,
    volunteer_skill,
    organization_posting,
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
    signature_path: 'platform-signatures/willing-platform-signature.png',
    signature_uploaded_by_admin_id: 1,
  }).execute();

  const certificateInfos = await database.insertInto('organization_certificate_info')
    .values([
      {
        certificate_feature_enabled: true,
        hours_threshold: 8,
        signatory_name: 'Mira Khoury',
        signatory_position: 'Programs Director',
        signature_path: 'org-signatures/nour-relief-signature.png',
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
        signatory_name: 'Fadi Daher',
        signatory_position: 'Community Partnerships Lead',
        signature_path: 'org-signatures/arz-community-signature.png',
      },
      {
        certificate_feature_enabled: true,
        hours_threshold: 6,
        signatory_name: 'Nadine Saliba',
        signatory_position: 'Executive Director',
        signature_path: 'org-signatures/cedar-response-signature.png',
      },
      {
        certificate_feature_enabled: false,
        hours_threshold: null,
        signatory_name: null,
        signatory_position: null,
        signature_path: null,
      },
    ])
    .returning(['id'])
    .execute();

  const [
    nourReliefCertificateInfo,
    ajialounaCertificateInfo,
    arzCommunityCertificateInfo,
    cedarResponseCertificateInfo,
    bekaaUpliftCertificateInfo,
  ] = certificateInfos;

  if (
    !nourReliefCertificateInfo
    || !ajialounaCertificateInfo
    || !arzCommunityCertificateInfo
    || !cedarResponseCertificateInfo
    || !bekaaUpliftCertificateInfo
  ) {
    throw new Error('Failed to seed organization certificate info');
  }

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
        logo_path: 'org-logos/nour-relief.png',
        certificate_info_id: nourReliefCertificateInfo.id,
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
        logo_path: 'org-logos/ajialouna.png',
        certificate_info_id: ajialounaCertificateInfo.id,
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
        logo_path: 'org-logos/arz-community.png',
        certificate_info_id: arzCommunityCertificateInfo.id,
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
        logo_path: 'org-logos/cedar-response.png',
        certificate_info_id: cedarResponseCertificateInfo.id,
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
        logo_path: 'org-logos/bekaa-uplift.png',
        certificate_info_id: bekaaUpliftCertificateInfo.id,
        password: passwordHash,
      },
      {
        name: 'Scam Organization',
        email: 'org6@willing.social',
        phone_number: '+96199990000',
        url: 'https://scam-organization.example.social',
        latitude: 33.5000,
        longitude: 35.5000,
        location_name: 'Test Beirut',
        description: 'Fraudulent organization seeded for manual reporting and disable-account testing.',
        logo_path: 'org-logos/scam-organization.png',
        certificate_info_id: bekaaUpliftCertificateInfo.id,
        password: passwordHash,
      },
    ])
    .returning(['id', 'name'])
    .execute();

  const orgByName = new Map(orgs.map(o => [o.name, o.id]));

  // --- Pending Onboarding Requests ----------------------------------------------

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

  // --- Volunteers ---------------------------------------------------------------

  const volunteers = await database.insertInto('volunteer_account')
    .values([
      {
        first_name: 'Karim',
        last_name: 'Mansour',
        email: 'vol1@willing.social',
        password: passwordHash,
        gender: 'male',
        date_of_birth: '1998-03-15',
        description: 'Experienced in field logistics and heavy lifting. Reliable in high-pressure environments.',
      },
      {
        first_name: 'Aya',
        last_name: 'Sadek',
        email: 'vol2@willing.social',
        password: passwordHash,
        gender: 'female',
        date_of_birth: '2000-07-22',
        description: 'Former student tutor with strong communication skills and a passion for education.',
      },
      {
        first_name: 'Jad',
        last_name: 'Nassar',
        email: 'vol3@willing.social',
        password: passwordHash,
        gender: 'male',
        date_of_birth: '1996-11-04',
        description: 'Paramedic student with first aid certification and crisis response training.',
      },
      {
        first_name: 'Hala',
        last_name: 'Farah',
        email: 'vol4@willing.social',
        password: passwordHash,
        gender: 'female',
        date_of_birth: '1994-01-30',
        description: 'com worker background. Comfortable with elderly care and emotional support.',
      },
      {
        first_name: 'Tarek',
        last_name: 'Slim',
        email: 'vol5@willing.social',
        password: passwordHash,
        gender: 'male',
        date_of_birth: '2001-09-18',
        description: 'Environmentally conscious and physically fit. Loves outdoor community work.',
      },
      {
        first_name: 'Nina',
        last_name: 'Choufany',
        email: 'vol6@willing.social',
        password: passwordHash,
        gender: 'female',
        date_of_birth: '2002-05-11',
        description: 'Art teacher background. Great with children and creative activities.',
      },
      {
        first_name: 'Marc',
        last_name: 'Hamamji',
        email: 'vol7@willing.social',
        password: passwordHash,
        gender: 'male',
        date_of_birth: '1999-12-01',
        description: 'Software developer who volunteers for tech literacy programs and remote support.',
      },
      {
        first_name: 'Rana',
        last_name: 'Saad',
        email: 'vol8@willing.social',
        password: passwordHash,
        gender: 'female',
        date_of_birth: '1997-08-25',
        description: 'Catering background. Expert in food prep and community kitchen coordination.',
      },
      {
        first_name: 'Ziad',
        last_name: 'Bou Habib',
        email: 'vol9@willing.social',
        password: passwordHash,
        gender: 'male',
        date_of_birth: '2003-02-14',
        description: 'Detail-oriented and great at organizing and sorting donated supplies.',
      },
      {
        first_name: 'Maya',
        last_name: 'Tannous',
        email: 'vol10@willing.social',
        password: passwordHash,
        gender: 'female',
        date_of_birth: '2001-06-06',
        description: 'Flexible volunteer. Prefers to keep profile private.',
      },
      {
        first_name: 'Sami',
        last_name: 'Khater',
        email: 'vol11@willing.social',
        password: passwordHash,
        gender: 'male',
        date_of_birth: '1995-04-09',
        description: 'Operations-minded volunteer with warehouse and dispatch experience.',
      },
      {
        first_name: 'Lea',
        last_name: 'Rizk',
        email: 'vol12@willing.social',
        password: passwordHash,
        gender: 'female',
        date_of_birth: '1999-10-02',
        description: 'Community educator who enjoys tutoring, facilitation, and youth engagement.',
      },
      {
        first_name: 'Omar',
        last_name: 'Haddad',
        email: 'vol13@willing.social',
        password: passwordHash,
        gender: 'male',
        date_of_birth: '1997-12-19',
        description: 'Tech-savvy coordinator comfortable with helplines, spreadsheets, and operations support.',
      },
      {
        first_name: 'Dana',
        last_name: 'Mokbel',
        email: 'vol14@willing.social',
        password: passwordHash,
        gender: 'female',
        date_of_birth: '2000-03-27',
        description: 'Patient and dependable volunteer with experience in admin support and event coordination.',
      },
      {
        first_name: 'Scam',
        last_name: 'Volunteer',
        email: 'vol15@willing.social',
        password: passwordHash,
        gender: 'other',
        date_of_birth: '1998-12-12',
        description: 'Seeded test volunteer for reporting and account disable scenarios.',
      },
    ].map(volunteer => ({
      ...volunteer,
      gender: volunteer.gender as 'male' | 'female' | 'other',
    })))
    .returning(['id', 'email'])
    .execute();

  const volByEmail = new Map(volunteers.map(v => [v.email, v.id]));

  await database.insertInto('organization_report').values([
    {
      reported_organization_id: orgByName.get('Scam Organization')!,
      reporter_volunteer_id: volByEmail.get('vol1@willing.social')!,
      title: 'scam',
      message: 'Claimed to be a legitimate nonprofit but provided fake credentials and payment requests.',
    },
    {
      reported_organization_id: orgByName.get('Scam Organization')!,
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
      message: 'Asked volunteers to pay a registration fee despite the platform policy against it.',
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
    {
      reported_volunteer_id: volByEmail.get('vol9@willing.social')!,
      reporter_organization_id: orgByName.get('Bekaa Uplift')!,
      title: 'other',
      message: 'Missed a confirmed shift and did not respond to several scheduling messages.',
    },
    {
      reported_volunteer_id: volByEmail.get('vol10@willing.social')!,
      reporter_organization_id: orgByName.get('Cedar Response')!,
      title: 'harassment',
      message: 'Raised their voice at our staff during a debrief for no valid reason.',
    },
    {
      reported_volunteer_id: volByEmail.get('vol11@willing.social')!,
      reporter_organization_id: orgByName.get('Ajialouna')!,
      title: 'scam',
      message: 'Repeatedly offered unauthorized services to community members and requested personal details.',
    },
    {
      reported_volunteer_id: volByEmail.get('vol12@willing.social')!,
      reporter_organization_id: orgByName.get('Arz Community')!,
      title: 'other',
      message: 'Arrived without required paperwork and declined to complete intake forms when asked.',
    },
  ]).execute();

  // --- Crises -------------------------------------------------------------------

  const crises = await database.insertInto('crisis')
    .values([
      {
        name: 'Lebanon 2026 War',
        description:
          'Lebanon is facing a severe humanitarian crisis in 2026, with families displaced and basic needs like '
          + 'food, water, and medical care becoming scarce. Urgent support is needed to help civilians and provide '
          + 'essential aid. ',
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
          + 'decades of work. Families who had nothing to spare lost everything. Many are now '
          + 'staying with relatives or in makeshift shelters, waiting for help to rebuild.',
        pinned: false,
      },
      {
        name: 'Economic Food Insecurity',
        description:
          'With the lira in freefall and salaries worth a fraction of what they were, '
          + 'more Lebanese families than ever are skipping meals. The people lining up at '
          + 'community kitchens are teachers, nurses, and retired civil servants — '
          + 'people who never imagined they would need this kind of help.',
        pinned: false,
      },
      {
        name: 'Tyre Coastal Pollution Emergency',
        description:
          'A fuel spill and years of unchecked waste dumping have left the Tyre coastline '
          + 'visibly damaged — tar on the sand, dead fish, and a smell that carries for kilometers. '
          + 'Local fishermen say they have not been able to work in weeks.',
        pinned: false,
      },
      {
        name: 'Bekaa Valley Flooding',
        description:
          'Flash floods tore through several Bekaa villages last month, sweeping away crops, '
          + 'flooding homes to the ceiling, and cutting off roads. Farmers who had just planted '
          + 'for the season are starting from zero.',
        pinned: false,
      },
    ])
    .returning(['id', 'name'])
    .execute();

  const crisisByName = new Map(crises.map(c => [c.name, c.id]));

  // --- Temporal helpers ---------------------------------------------------------

  const nowYear = 2026;

  const buildTemporalFields = (startIsoUtc: string, endIsoUtc?: string) => {
    const start = new Date(startIsoUtc);
    const end = endIsoUtc ? new Date(endIsoUtc) : start;

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

    return {
      start_date: formatDate(start),
      start_time: formatTime(start),
      end_date: formatDate(end),
      end_time: formatTime(end),
    };
  };

  const toIsoDate = (value: Date) => {
    const year = value.getUTCFullYear();
    const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${value.getUTCDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
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

  // --- Postings -----------------------------------------------------------------

  const postings = await database.insertInto('organization_posting')
    .values([

      // (org1)
      // 8 Lebanon 2026 War postings (mix of open and review-based) + 2 other crises

      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: crisisByName.get('Lebanon 2026 War')!,
        title: 'First Aid Support',
        description: 'Assist certified medics in providing first aid to war-affected civilians '
          + 'at a Beirut field hospital. Tasks include triage support, supply management, and '
          + 'patient transport within the facility.',
        latitude: 33.8700,
        longitude: 35.5050,
        location_name: 'Beirut Field Hospital, Cola',
        max_volunteers: 15,
        ...buildTemporalFields(`${nowYear}-02-10T07:00:00Z`, `${nowYear}-02-10T19:00:00Z`),
        minimum_age: 18,
        automatic_acceptance: false,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: crisisByName.get('Lebanon 2026 War')!,
        title: 'Displaced Families Registration',
        description: 'Help register and document displaced families arriving at Beirut shelters. '
          + 'Duties include data entry, family intake interviews, and guiding families to services.',
        latitude: 33.8850,
        longitude: 35.4950,
        location_name: 'Beirut Municipal Stadium Shelter',
        max_volunteers: 20,
        ...buildTemporalFields(`${nowYear}-02-12T08:00:00Z`, `${nowYear}-02-14T18:00:00Z`),
        minimum_age: 18,
        automatic_acceptance: false,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: crisisByName.get('Lebanon 2026 War')!,
        title: 'Emergency Shelter Setup',
        description: 'Help assemble and maintain temporary shelters for displaced families '
          + 'at a Beirut staging site. Tasks include tent assembly, site sanitation, and '
          + 'organising sleeping areas.',
        latitude: 33.8900,
        longitude: 35.5000,
        location_name: 'Mar Elias Shelter Site, Beirut',
        max_volunteers: 30,
        ...buildTemporalFields(`${nowYear}-02-11T09:00:00Z`, `${nowYear}-02-11T17:00:00Z`),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: crisisByName.get('Lebanon 2026 War')!,
        title: 'Mobile Aid Kit Distribution',
        description: 'Distribute hygiene and first-aid kits to displaced families in affected '
          + 'Beirut neighborhoods. Requires solid communication skills, basic route planning, '
          + 'and situational safety awareness.',
        latitude: 33.8800,
        longitude: 35.5100,
        location_name: 'Beirut Northern Districts',
        max_volunteers: 20,
        ...buildTemporalFields(`${nowYear}-02-13T10:00:00Z`, `${nowYear}-02-13T15:00:00Z`),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: crisisByName.get('Lebanon 2026 War')!,
        title: 'War Survivor Psychocom Support',
        description: 'Support trained counsellors running group psychocom sessions for '
          + 'adults displaced by the conflict. Volunteers help facilitate safe spaces, '
          + 'manage attendance, and assist participants who need extra attention.',
        latitude: 33.8870,
        longitude: 35.5030,
        location_name: 'Hamra Community Hall, Beirut',
        max_volunteers: 10,
        ...buildTemporalFields(`${nowYear}-02-16T09:00:00Z`, `${nowYear}-02-16T13:00:00Z`),
        minimum_age: 21,
        automatic_acceptance: false,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: crisisByName.get('Lebanon 2026 War')!,
        title: 'Meals for the Displaced',
        description: 'Help cook and distribute hot meals to displaced families sheltering '
          + 'in schools across Beirut. Shifts run morning and evening. No cooking experience '
          + 'required — just willingness to work hard and stay organised.',
        latitude: 33.8760,
        longitude: 35.4980,
        location_name: 'Ras Beirut School Shelter',
        max_volunteers: 25,
        ...buildTemporalFields(`${nowYear}-02-14T07:00:00Z`),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: crisisByName.get('Lebanon 2026 War')!,
        title: 'Children\'s Activities',
        description: 'Run structured play and learning activities for children in displacement '
          + 'shelters. The goal is to give kids a few hours of normalcy. '
          + 'Bring patience, energy, and a willingness to be silly.',
        latitude: 33.8820,
        longitude: 35.5050,
        location_name: 'Tallet el-Khayat School Shelter',
        max_volunteers: 12,
        ...buildTemporalFields(`${nowYear}-02-17T10:00:00Z`, `${nowYear}-02-17T14:00:00Z`),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: crisisByName.get('Lebanon 2026 War')!,
        title: 'Blood Drive Coordination',
        description: 'Support the blood donation drive set up in response to the surge in '
          + 'casualties. Tasks include donor registration, managing the waiting area, '
          + 'preparing refreshments, and providing post-donation care.',
        latitude: 33.8938,
        longitude: 35.5018,
        location_name: 'Nour Relief Centre, Beirut',
        max_volunteers: 10,
        ...buildTemporalFields(`${nowYear}-01-15T08:00:00Z`, `${nowYear}-01-15T16:00:00Z`),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: true,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: crisisByName.get('Beirut Port Explosion Aftermath')!,
        title: 'Psychological First Aid Sessions',
        description: 'Support trained psychologists delivering group psychological first aid '
          + 'sessions to explosion survivors. Volunteers facilitate sessions, manage logistics, '
          + 'and provide comfort to participants.',
        latitude: 33.9010,
        longitude: 35.5200,
        location_name: 'Mar Mikhael Community Hall',
        max_volunteers: 8,
        ...buildTemporalFields(`${nowYear}-03-01T10:00:00Z`, `${nowYear}-03-01T15:00:00Z`),
        minimum_age: 21,
        automatic_acceptance: false,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Nour Relief')!,
        crisis_id: crisisByName.get('Economic Food Insecurity')!,
        title: 'Emergency Food Packing',
        description: 'Pack monthly food parcels for families enrolled in the emergency food '
          + 'assistance programme. Fast-paced warehouse environment; comfortable shoes required.',
        latitude: 33.8820,
        longitude: 35.5100,
        location_name: 'Nour Relief Warehouse, Barbir',
        max_volunteers: 30,
        ...buildTemporalFields(`${nowYear}-02-20T09:00:00Z`, `${nowYear}-02-20T14:00:00Z`),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },

      // org2

      {
        organization_id: orgByName.get('Ajialouna')!,
        crisis_id: null,
        title: 'Inclusive Sports Day',
        description: 'Help organise and run an inclusive sports day for children and young adults '
          + 'with physical disabilities. Volunteers assist with activities, mobility support, and '
          + 'equipment setup. Prior experience with disability inclusion is a plus but not required.',
        latitude: 33.3600,
        longitude: 35.5000,
        location_name: 'Saida Municipal Sports Ground',
        max_volunteers: 18,
        ...buildTemporalFields(`${nowYear}-03-08T09:00:00Z`, `${nowYear}-03-08T15:00:00Z`),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Ajialouna')!,
        crisis_id: crisisByName.get('Economic Food Insecurity')!,
        title: 'Community Kitchen',
        description: 'Assist the community kitchen in preparing and serving daily hot meals '
          + 'to vulnerable families. Roles include food prep, serving, kitchen cleanup, and '
          + 'interacting with beneficiaries respectfully.',
        latitude: 33.3520,
        longitude: 35.4880,
        location_name: 'Jeel Kitchen, Saida Old City',
        max_volunteers: 14,
        ...buildTemporalFields(`${nowYear}-02-18T10:00:00Z`),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Ajialouna')!,
        crisis_id: null,
        title: 'Remote Homework Support',
        description: 'Provide online academic support to public school students in South Lebanon '
          + 'via phone or video call. Each volunteer takes 2–3 one-hour slots per week. '
          + 'Subjects: Arabic, English, Maths, Sciences.',
        latitude: 33.3547,
        longitude: 35.4955,
        location_name: 'Remote (South Lebanon)',
        max_volunteers: 20,
        ...buildTemporalFields(`${nowYear}-02-01T15:00:00Z`, `${nowYear}-04-30T18:00:00Z`),
        minimum_age: 18,
        automatic_acceptance: false,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Ajialouna')!,
        crisis_id: null,
        title: 'Winter Clothing Distribution',
        description: 'Sort and distribute donated winter clothing to families in Saida and '
          + 'surrounding villages. Volunteers sort by size, pack, and hand out items at distribution points.',
        latitude: 33.3480,
        longitude: 35.4900,
        location_name: 'Saida Community Centre',
        max_volunteers: 10,
        ...buildTemporalFields(`${nowYear}-01-20T09:00:00Z`, `${nowYear}-01-20T14:00:00Z`),
        minimum_age: 14,
        automatic_acceptance: true,
        is_closed: true,
      },

      // org3

      {
        organization_id: orgByName.get('Arz Community')!,
        crisis_id: crisisByName.get('Akkar Wildfires')!,
        title: 'Wildfire Relief Distribution',
        description: 'Help distribute emergency relief kits (food, hygiene, blankets) to families '
          + 'displaced by the Akkar wildfires, at a Tripoli staging area. Physical tasks involved.',
        latitude: 34.4367,
        longitude: 35.8333,
        location_name: 'Arz Community Warehouse, Tripoli',
        max_volunteers: 25,
        ...buildTemporalFields(`${nowYear}-02-05T08:00:00Z`, `${nowYear}-02-05T17:00:00Z`),
        minimum_age: 16,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Arz Community')!,
        crisis_id: null,
        title: 'Medical Supplies Inventory & Sorting',
        description: 'Organise and verify incoming donations of medical supplies at the Tripoli '
          + 'depot. Tasks include labelling, expiry checking, and stacking. Attention to detail critical.',
        latitude: 34.4300,
        longitude: 35.8150,
        location_name: 'Tripoli Medical Depot',
        max_volunteers: 7,
        ...buildTemporalFields(`${nowYear}-03-05T09:00:00Z`, `${nowYear}-03-05T13:00:00Z`),
        minimum_age: 18,
        automatic_acceptance: false,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Arz Community')!,
        crisis_id: undefined,
        title: 'Community Garden Open Help Day',
        description: 'Join a drop-in garden day with no fixed volunteer cap. Help is welcome '
          + 'for planting, watering, and cleanup alongside local community gardeners.',
        latitude: 34.4370,
        longitude: 35.8340,
        location_name: 'Tripoli Community Garden',
        max_volunteers: null,
        ...buildTemporalFields(`${nowYear}-03-27T09:00:00Z`, `${nowYear}-03-27T13:00:00Z`),
        minimum_age: 12,
        automatic_acceptance: true,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Cedar Response')!,
        crisis_id: crisisByName.get('Beirut Port Explosion Aftermath')!,
        title: 'Volunteer Helpline Shifts',
        description: 'Take scheduled helpline shifts to guide affected residents toward support services, legal referrals, and psychocom resources. Clear communication and calm call handling are important.',
        latitude: 33.8955,
        longitude: 35.5140,
        location_name: 'Cedar Response Office, Gemmayze',
        max_volunteers: 12,
        ...buildTemporalFields(`${nowYear}-03-10T09:00:00Z`, `${nowYear}-03-14T17:00:00Z`),
        minimum_age: 18,
        automatic_acceptance: false,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Cedar Response')!,
        crisis_id: crisisByName.get('Beirut Port Explosion Aftermath')!,
        title: 'Neighborhood Repair Week',
        description: 'Support teams repainting, cleaning, and repairing damaged community spaces over a five-day neighborhood recovery push.',
        latitude: 33.8981,
        longitude: 35.5182,
        location_name: 'Mar Mikhael Recovery Hub',
        max_volunteers: 24,
        ...buildTemporalFields(`${nowYear}-03-18T08:00:00Z`, `${nowYear}-03-22T16:00:00Z`),
        minimum_age: 17,
        automatic_acceptance: true,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Bekaa Uplift')!,
        crisis_id: crisisByName.get('Bekaa Valley Flooding')!,
        title: 'Flood Cleanup Crew',
        description: 'Join teams helping families clear mud, salvage belongings, and reset homes after flooding in the Bekaa Valley.',
        latitude: 33.8462,
        longitude: 35.9020,
        location_name: 'Zahle Flood Recovery Point',
        max_volunteers: 18,
        ...buildTemporalFields(`${nowYear}-03-12T08:00:00Z`, `${nowYear}-03-13T15:00:00Z`),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Bekaa Uplift')!,
        crisis_id: crisisByName.get('Bekaa Valley Flooding')!,
        title: 'School Supply Restocking',
        description: 'Help restock school materials and classroom kits for schools affected by flooding. Includes sorting, packing, and local delivery coordination.',
        latitude: 33.8500,
        longitude: 35.9100,
        location_name: 'Bekaa Uplift Learning Hub',
        max_volunteers: 16,
        ...buildTemporalFields(`${nowYear}-03-24T09:00:00Z`, `${nowYear}-03-26T14:00:00Z`),
        minimum_age: 16,
        automatic_acceptance: false,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Cedar Response')!,
        crisis_id: crisisByName.get('Beirut Port Explosion Aftermath')!,
        title: 'One-Day Hotline Sprint',
        description: 'Support the hotline team for a single high-volume day by answering calls, escalating urgent cases, and updating referral notes.',
        latitude: 33.8940,
        longitude: 35.5132,
        location_name: 'Cedar Response Office, Gemmayze',
        max_volunteers: 6,
        ...buildTemporalFields(`${nowYear}-03-25T09:00:00Z`, `${nowYear}-03-25T17:00:00Z`),
        minimum_age: 18,
        automatic_acceptance: true,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Bekaa Uplift')!,
        crisis_id: crisisByName.get('Bekaa Valley Flooding')!,
        title: 'Farm Recovery Rotation',
        description: 'Help farm families recover across a three-day rotation of cleanup, seed sorting, and irrigation setup support in flood-affected areas.',
        latitude: 33.8525,
        longitude: 35.9150,
        location_name: 'Bekaa Farm Support Hub',
        max_volunteers: 2,
        ...buildTemporalFields(`${nowYear}-03-28T08:00:00Z`, `${nowYear}-03-30T15:00:00Z`),
        minimum_age: 18,
        automatic_acceptance: true,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Cedar Response')!,
        crisis_id: crisisByName.get('Beirut Port Explosion Aftermath')!,
        title: 'Crisis Hotline Coverage Week',
        description: 'Cover every hotline shift for a three-day support push. Volunteers handle caller triage, documentation, and referral follow-ups.',
        latitude: 33.8950,
        longitude: 35.5144,
        location_name: 'Cedar Response Coordination Room',
        max_volunteers: 2,
        ...buildTemporalFields(`${nowYear}-04-05T09:00:00Z`, `${nowYear}-04-07T17:00:00Z`),
        minimum_age: 18,
        automatic_acceptance: true,
        allows_partial_attendance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Arz Community')!,
        crisis_id: crisisByName.get('Tyre Coastal Pollution')!,
        title: 'Coastal Cleanup',
        description: 'Join a large-scale beach and coastal cleanup at the Tyre coast following '
          + 'the fuel spill. Volunteers collect debris, assist with waste sorting, and support '
          + 'marine wildlife monitoring teams.',
        latitude: 33.2705,
        longitude: 35.2038,
        location_name: 'Tyre Al-Bass Coast',
        max_volunteers: 50,
        ...buildTemporalFields(`${nowYear}-03-15T07:30:00Z`, `${nowYear}-03-15T13:00:00Z`),
        minimum_age: 14,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Arz Community')!,
        crisis_id: null,
        title: 'Children\'s Art & Story Workshop',
        description: 'Run creative storytelling and art sessions for underprivileged children '
          + 'at the Tripoli community centre. Materials provided. Sessions run every Saturday morning.',
        latitude: 34.4370,
        longitude: 35.8340,
        location_name: 'Tripoli Community Centre',
        max_volunteers: 10,
        ...buildTemporalFields(`${nowYear}-02-08T09:00:00Z`, `${nowYear}-02-08T12:00:00Z`),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Ajialouna')!,
        crisis_id: null,
        title: 'Community Storytelling Circle',
        description: 'Lead a welcoming storytelling and conversation circle for women and youth in Saida. No prior experience is required and all ages are encouraged to participate.',
        latitude: 33.3560,
        longitude: 35.4950,
        location_name: 'Saida Women\'s Centre',
        max_volunteers: 12,
        ...buildTemporalFields(`${nowYear}-03-12T16:00:00Z`, `${nowYear}-03-12T19:00:00Z`),
        minimum_age: null,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Ajialouna')!,
        crisis_id: null,
        title: 'Youth Reading Circle',
        description: 'Host a youth reading circle for students and pre-teens at the Saida library. All ages are welcome and no previous experience is needed.',
        latitude: 33.3545,
        longitude: 35.4960,
        location_name: 'Saida Public Library',
        max_volunteers: 14,
        ...buildTemporalFields(`${nowYear}-03-22T10:00:00Z`, `${nowYear}-03-22T13:00:00Z`),
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
        ...buildTemporalFields(`${nowYear}-03-23T08:00:00Z`, `${nowYear}-03-23T12:00:00Z`),
        minimum_age: 14,
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
        ...buildTemporalFields(`${nowYear}-03-24T09:00:00Z`, `${nowYear}-03-24T13:00:00Z`),
        minimum_age: 12,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Arz Community')!,
        crisis_id: null,
        title: 'Family Water Station Support',
        description: 'Support a community water station in Tripoli by handing out water and refreshments to families. This shift is suitable for younger volunteers and focuses on friendly, helpful service.',
        latitude: 34.4360,
        longitude: 35.8335,
        location_name: 'Tripoli Al-Akhdar Community Hub',
        max_volunteers: 18,
        ...buildTemporalFields(`${nowYear}-03-26T09:00:00Z`, `${nowYear}-03-26T13:00:00Z`),
        minimum_age: null,
        automatic_acceptance: true,
        is_closed: false,
      },
      {
        organization_id: orgByName.get('Arz Community')!,
        crisis_id: crisisByName.get('Akkar Wildfires')!,
        title: 'Debris Clearance',
        description: 'Physical volunteer work helping wildfire-affected families in Akkar clear '
          + 'debris and begin rebuilding. Heavy lifting involved. Bring work gloves.',
        latitude: 34.5500,
        longitude: 36.0500,
        location_name: 'Akkar, North Lebanon',
        max_volunteers: 30,
        ...buildTemporalFields(`${nowYear}-01-28T07:00:00Z`, `${nowYear}-01-28T16:00:00Z`),
        minimum_age: 18,
        automatic_acceptance: true,
        is_closed: true,
      },
    ])
    .returning(['id', 'title', 'start_date', 'end_date', 'allows_partial_attendance'])
    .execute();

  const postingByTitle = new Map(postings.map(p => [p.title, p.id]));

  // --- Posting Skills -----------------------------------------------------------

  await database.insertInto('posting_skill').values([
    // Field First Aid Support
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

    // Mobile Aid Kit Distribution
    { posting_id: postingByTitle.get('Mobile Aid Kit Distribution')!, name: 'Distribution' },
    { posting_id: postingByTitle.get('Mobile Aid Kit Distribution')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Mobile Aid Kit Distribution')!, name: 'Safety Awareness' },
    { posting_id: postingByTitle.get('Mobile Aid Kit Distribution')!, name: 'Organisation' },

    // War Survivor Psychocom Support
    { posting_id: postingByTitle.get('War Survivor Psychocom Support')!, name: 'Emotional Support' },
    { posting_id: postingByTitle.get('War Survivor Psychocom Support')!, name: 'Active Listening' },
    { posting_id: postingByTitle.get('War Survivor Psychocom Support')!, name: 'Empathy' },
    { posting_id: postingByTitle.get('War Survivor Psychocom Support')!, name: 'Communication' },

    // Hot Meals for Displaced Families
    { posting_id: postingByTitle.get('Meals for the Displaced')!, name: 'Cooking' },
    { posting_id: postingByTitle.get('Meals for the Displaced')!, name: 'Food Preparation' },
    { posting_id: postingByTitle.get('Meals for the Displaced')!, name: 'Serving' },
    { posting_id: postingByTitle.get('Meals for the Displaced')!, name: 'Teamwork' },

    // Children's Safe Space Activities
    { posting_id: postingByTitle.get('Children\'s Activities')!, name: 'Child Engagement' },
    { posting_id: postingByTitle.get('Children\'s Activities')!, name: 'Creativity' },
    { posting_id: postingByTitle.get('Children\'s Activities')!, name: 'Patience' },
    { posting_id: postingByTitle.get('Children\'s Activities')!, name: 'Communication' },

    // Blood Drive Coordination
    { posting_id: postingByTitle.get('Blood Drive Coordination')!, name: 'Organisation' },
    { posting_id: postingByTitle.get('Blood Drive Coordination')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Blood Drive Coordination')!, name: 'Data Entry' },
    { posting_id: postingByTitle.get('Blood Drive Coordination')!, name: 'Customer Service' },

    // Psychological First Aid Sessions
    { posting_id: postingByTitle.get('Psychological First Aid Sessions')!, name: 'Emotional Support' },
    { posting_id: postingByTitle.get('Psychological First Aid Sessions')!, name: 'Active Listening' },
    { posting_id: postingByTitle.get('Psychological First Aid Sessions')!, name: 'Empathy' },
    { posting_id: postingByTitle.get('Psychological First Aid Sessions')!, name: 'Communication' },

    // Emergency Food Parcel Packing
    { posting_id: postingByTitle.get('Emergency Food Packing')!, name: 'Packing' },
    { posting_id: postingByTitle.get('Emergency Food Packing')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Emergency Food Packing')!, name: 'Inventory Handling' },
    { posting_id: postingByTitle.get('Emergency Food Packing')!, name: 'Organisation' },

    // Disability-Inclusive Sports Day
    { posting_id: postingByTitle.get('Inclusive Sports Day')!, name: 'Inclusion Support' },
    { posting_id: postingByTitle.get('Inclusive Sports Day')!, name: 'Physical Assistance' },
    { posting_id: postingByTitle.get('Inclusive Sports Day')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Inclusive Sports Day')!, name: 'Communication' },

    // Community Kitchen - Saida
    { posting_id: postingByTitle.get('Community Kitchen')!, name: 'Cooking' },
    { posting_id: postingByTitle.get('Community Kitchen')!, name: 'Food Preparation' },
    { posting_id: postingByTitle.get('Community Kitchen')!, name: 'Serving' },
    { posting_id: postingByTitle.get('Community Kitchen')!, name: 'Hygiene' },
    { posting_id: postingByTitle.get('Community Kitchen')!, name: 'Teamwork' },

    // Remote Homework Support Hotline
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

    // Wildfire Relief Distribution
    { posting_id: postingByTitle.get('Wildfire Relief Distribution')!, name: 'Logistics' },
    { posting_id: postingByTitle.get('Wildfire Relief Distribution')!, name: 'Packing' },
    { posting_id: postingByTitle.get('Wildfire Relief Distribution')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Wildfire Relief Distribution')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Wildfire Relief Distribution')!, name: 'Organisation' },

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

    // Volunteer Helpline Shifts
    { posting_id: postingByTitle.get('Volunteer Helpline Shifts')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Volunteer Helpline Shifts')!, name: 'Active Listening' },
    { posting_id: postingByTitle.get('Volunteer Helpline Shifts')!, name: 'Remote Support' },
    { posting_id: postingByTitle.get('Volunteer Helpline Shifts')!, name: 'Data Entry' },

    // One-Day Hotline Sprint
    { posting_id: postingByTitle.get('One-Day Hotline Sprint')!, name: 'Communication' },
    { posting_id: postingByTitle.get('One-Day Hotline Sprint')!, name: 'Active Listening' },
    { posting_id: postingByTitle.get('One-Day Hotline Sprint')!, name: 'Data Entry' },
    { posting_id: postingByTitle.get('One-Day Hotline Sprint')!, name: 'Calm Under Pressure' },

    // Neighborhood Repair Week
    { posting_id: postingByTitle.get('Neighborhood Repair Week')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Neighborhood Repair Week')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Neighborhood Repair Week')!, name: 'Painting' },
    { posting_id: postingByTitle.get('Neighborhood Repair Week')!, name: 'Construction' },

    // Farm Recovery Rotation
    { posting_id: postingByTitle.get('Farm Recovery Rotation')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Farm Recovery Rotation')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Farm Recovery Rotation')!, name: 'Organisation' },
    { posting_id: postingByTitle.get('Farm Recovery Rotation')!, name: 'Field Support' },

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

    // Crisis Hotline Coverage Week
    { posting_id: postingByTitle.get('Crisis Hotline Coverage Week')!, name: 'Communication' },
    { posting_id: postingByTitle.get('Crisis Hotline Coverage Week')!, name: 'Active Listening' },
    { posting_id: postingByTitle.get('Crisis Hotline Coverage Week')!, name: 'Remote Support' },
    { posting_id: postingByTitle.get('Crisis Hotline Coverage Week')!, name: 'Data Entry' },

    // Coastal Cleanup - Tyre
    { posting_id: postingByTitle.get('Coastal Cleanup')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Coastal Cleanup')!, name: 'Environmental Awareness' },
    { posting_id: postingByTitle.get('Coastal Cleanup')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Coastal Cleanup')!, name: 'Waste Sorting' },

    // Children's Art & Story Workshop
    { posting_id: postingByTitle.get('Children\'s Art & Story Workshop')!, name: 'Creativity' },
    { posting_id: postingByTitle.get('Children\'s Art & Story Workshop')!, name: 'Storytelling' },
    { posting_id: postingByTitle.get('Children\'s Art & Story Workshop')!, name: 'Child Engagement' },
    { posting_id: postingByTitle.get('Children\'s Art & Story Workshop')!, name: 'Art' },
    { posting_id: postingByTitle.get('Children\'s Art & Story Workshop')!, name: 'Patience' },

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

    // Family Water Station Support
    { posting_id: postingByTitle.get('Family Water Station Support')!, name: 'Customer Service' },
    { posting_id: postingByTitle.get('Family Water Station Support')!, name: 'Hydration Support' },
    { posting_id: postingByTitle.get('Family Water Station Support')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Family Water Station Support')!, name: 'Community Support' },

    // Youth Garden Helpers
    { posting_id: postingByTitle.get('Youth Garden Helpers')!, name: 'Gardening' },
    { posting_id: postingByTitle.get('Youth Garden Helpers')!, name: 'Light Groundskeeping' },
    { posting_id: postingByTitle.get('Youth Garden Helpers')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Youth Garden Helpers')!, name: 'Community Support' },

    // Debris Clearance – Akkar Villages
    { posting_id: postingByTitle.get('Debris Clearance')!, name: 'Physical Stamina' },
    { posting_id: postingByTitle.get('Debris Clearance')!, name: 'Teamwork' },
    { posting_id: postingByTitle.get('Debris Clearance')!, name: 'Construction' },
    { posting_id: postingByTitle.get('Debris Clearance')!, name: 'Safety Awareness' },
  ]).execute();

  // --- Volunteer Skills ---------------------------------------------------------

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

    // vol4 – elderly care / com support
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

    // vol8 – food / community kitchen
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

    // vol10 – general (fewer skills, private profile)
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

    // vol13 - tech / coordination
    { volunteer_id: volByEmail.get('vol13@willing.social')!, name: 'Remote Support' },
    { volunteer_id: volByEmail.get('vol13@willing.social')!, name: 'Data Entry' },
    { volunteer_id: volByEmail.get('vol13@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol13@willing.social')!, name: 'Problem Solving' },

    // vol14 - admin / events
    { volunteer_id: volByEmail.get('vol14@willing.social')!, name: 'Organisation' },
    { volunteer_id: volByEmail.get('vol14@willing.social')!, name: 'Communication' },
    { volunteer_id: volByEmail.get('vol14@willing.social')!, name: 'Data Entry' },
    { volunteer_id: volByEmail.get('vol14@willing.social')!, name: 'Teamwork' },
  ]).execute();

  // --- Enrollment Applications --------------------------------------------------

  const applications = await database.insertInto('enrollment_application').values([
    // Field First Aid Support (org1, review-based)
    {
      volunteer_id: volByEmail.get('vol1@willing.social')!,
      posting_id: postingByTitle.get('First Aid Support')!,
      message: 'I completed a 2-day first aid course last year. I am reliable and calm under pressure and would love to support the medical team.',
    },

    // Displaced Families Registration (org1, review-based)
    {
      volunteer_id: volByEmail.get('vol2@willing.social')!,
      posting_id: postingByTitle.get('Displaced Families Registration')!,
      message: 'Strong communication and data entry skills. Happy to assist with registration and guiding families to services.',
    },
    {
      volunteer_id: volByEmail.get('vol10@willing.social')!,
      posting_id: postingByTitle.get('Displaced Families Registration')!,
      message: 'Available for the full two-day window and comfortable with documentation and interacting with displaced families.',
    },

    // War Survivor Psychocom Support (org1, review-based)
    {
      volunteer_id: volByEmail.get('vol4@willing.social')!,
      posting_id: postingByTitle.get('War Survivor Psychocom Support')!,
      message: 'Background in com work and mental health support. Familiar with trauma-informed approaches and psychocom first aid frameworks.',
    },

    // Remote Homework Support Hotline (org2, review-based)
    {
      volunteer_id: volByEmail.get('vol2@willing.social')!,
      posting_id: postingByTitle.get('Remote Homework Support')!,
      message: 'Experienced tutor covering Arabic, English, and general maths. Available multiple afternoons per week.',
    },

    // Medical Supplies Inventory & Sorting (org3, review-based)
    {
      volunteer_id: volByEmail.get('vol1@willing.social')!,
      posting_id: postingByTitle.get('Medical Supplies Inventory & Sorting')!,
      message: 'Good with physical organisation and sorting. Can commit to the full morning.',
    },
    {
      volunteer_id: volByEmail.get('vol13@willing.social')!,
      posting_id: postingByTitle.get('Volunteer Helpline Shifts')!,
      message: 'Comfortable with helpline systems, spreadsheets, and coordinating information for callers across multiple shifts.',
    },
    {
      volunteer_id: volByEmail.get('vol14@willing.social')!,
      posting_id: postingByTitle.get('Volunteer Helpline Shifts')!,
      message: 'Strong communication and admin coordination skills. Happy to cover selected daytime shifts.',
    },
    {
      volunteer_id: volByEmail.get('vol12@willing.social')!,
      posting_id: postingByTitle.get('School Supply Restocking')!,
      message: 'Would love to help schools recover and can support with sorting, packing, and classroom kit prep.',
    },
    {
      volunteer_id: volByEmail.get('vol11@willing.social')!,
      posting_id: postingByTitle.get('School Supply Restocking')!,
      message: 'Warehouse and operations experience. Comfortable with inventory and loading support for school deliveries.',
    },
  ])
    .returning(['id', 'volunteer_id', 'posting_id'])
    .execute();

  // --- Enrollments --------------------------------------------------------------

  const enrollments = await database.insertInto('enrollment').values([

    // -- Approved from review-based postings ------------------------------------

    {
      volunteer_id: volByEmail.get('vol3@willing.social')!,
      posting_id: postingByTitle.get('First Aid Support')!,
      message: 'Currently completing my paramedic diploma. I have first aid and triage training and am comfortable in high-pressure environments.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol4@willing.social')!,
      posting_id: postingByTitle.get('Displaced Families Registration')!,
      message: 'I work as a com worker and speak Arabic fluently. Comfortable conducting intake interviews with empathy and care.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol4@willing.social')!,
      posting_id: postingByTitle.get('Psychological First Aid Sessions')!,
      message: 'Background in com work and mental health support. Familiar with trauma-informed approaches and psychocom first aid frameworks.',
      attended: true,
    },
    {
      volunteer_id: volByEmail.get('vol7@willing.social')!,
      posting_id: postingByTitle.get('Remote Homework Support')!,
      message: 'Software developer with a strong maths and science background. Can take evening slots.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol9@willing.social')!,
      posting_id: postingByTitle.get('Medical Supplies Inventory & Sorting')!,
      message: 'Highly detail-oriented and experienced with inventory systems.',
      attended: false,
    },

    // -- Direct enrollments (automatic_acceptance: true) ------------------------

    // Emergency Shelter Setup
    {
      volunteer_id: volByEmail.get('vol1@willing.social')!,
      posting_id: postingByTitle.get('Emergency Shelter Setup')!,
      message: 'Strong with physical tasks and comfortable in challenging field environments.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol5@willing.social')!,
      posting_id: postingByTitle.get('Emergency Shelter Setup')!,
      message: 'Physically fit and used to outdoor work. Ready to help build and maintain shelters.',
      attended: false,
    },

    // Mobile Aid Kit Distribution
    {
      volunteer_id: volByEmail.get('vol1@willing.social')!,
      posting_id: postingByTitle.get('Mobile Aid Kit Distribution')!,
      message: 'Good with logistics and comfortable navigating Beirut neighborhoods.',
      attended: false,
    },

    // Hot Meals for Displaced Families
    {
      volunteer_id: volByEmail.get('vol8@willing.social')!,
      posting_id: postingByTitle.get('Meals for the Displaced')!,
      message: 'Catering background - comfortable with large-scale food prep and service.',
      attended: true,
    },
    {
      volunteer_id: volByEmail.get('vol3@willing.social')!,
      posting_id: postingByTitle.get('Meals for the Displaced')!,
      message: 'Happy to help wherever needed in the kitchen or serving line.',
      attended: false,
    },

    // Children's Safe Space Activities
    {
      volunteer_id: volByEmail.get('vol6@willing.social')!,
      posting_id: postingByTitle.get('Children\'s Activities')!,
      message: 'Art teacher with lots of experience running activities for children in difficult situations.',
      attended: true,
    },
    {
      volunteer_id: volByEmail.get('vol2@willing.social')!,
      posting_id: postingByTitle.get('Children\'s Activities')!,
      message: 'Love working with children and good at keeping energy positive and structured.',
      attended: false,
    },

    // Blood Drive Coordination (closed - historical)
    {
      volunteer_id: volByEmail.get('vol2@willing.social')!,
      posting_id: postingByTitle.get('Blood Drive Coordination')!,
      message: 'Happy to help with donor registration and ensure a smooth experience.',
      attended: true,
    },
    {
      volunteer_id: volByEmail.get('vol4@willing.social')!,
      posting_id: postingByTitle.get('Blood Drive Coordination')!,
      message: 'Comfortable handling data entry and supporting donors throughout the process.',
      attended: true,
    },

    // Emergency Food Parcel Packing
    {
      volunteer_id: volByEmail.get('vol1@willing.social')!,
      posting_id: postingByTitle.get('Emergency Food Packing')!,
      message: 'Comfortable with packing, warehouse work, and team environments.',
      attended: true,
    },
    {
      volunteer_id: volByEmail.get('vol9@willing.social')!,
      posting_id: postingByTitle.get('Emergency Food Packing')!,
      message: 'Good with organisation and repetitive packing tasks.',
      attended: true,
    },

    // Disability-Inclusive Sports Day
    {
      volunteer_id: volByEmail.get('vol6@willing.social')!,
      posting_id: postingByTitle.get('Inclusive Sports Day')!,
      message: 'Great with children and used to inclusive activity settings.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol5@willing.social')!,
      posting_id: postingByTitle.get('Inclusive Sports Day')!,
      message: 'Physically fit and enthusiastic about inclusive sport.',
      attended: false,
    },

    // Community Kitchen - Saida
    {
      volunteer_id: volByEmail.get('vol8@willing.social')!,
      posting_id: postingByTitle.get('Community Kitchen')!,
      message: 'Catering background. Comfortable with prep, serving, and kitchen hygiene.',
      attended: true,
    },
    {
      volunteer_id: volByEmail.get('vol3@willing.social')!,
      posting_id: postingByTitle.get('Community Kitchen')!,
      message: 'Happy to help wherever needed in the kitchen.',
      attended: false,
    },

    // Winter Clothing Distribution (closed - historical)
    {
      volunteer_id: volByEmail.get('vol1@willing.social')!,
      posting_id: postingByTitle.get('Winter Clothing Distribution')!,
      message: 'Good at sorting and organising. Can commit to the full session.',
      attended: true,
    },
    {
      volunteer_id: volByEmail.get('vol9@willing.social')!,
      posting_id: postingByTitle.get('Winter Clothing Distribution')!,
      message: 'Detail-oriented; experienced with sorting and packing donated goods.',
      attended: true,
    },

    // Wildfire Relief Distribution
    {
      volunteer_id: volByEmail.get('vol1@willing.social')!,
      posting_id: postingByTitle.get('Wildfire Relief Distribution')!,
      message: 'Strong with physical tasks and field logistics.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol5@willing.social')!,
      posting_id: postingByTitle.get('Wildfire Relief Distribution')!,
      message: 'Physically fit and used to outdoor conditions.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol9@willing.social')!,
      posting_id: postingByTitle.get('Wildfire Relief Distribution')!,
      message: 'Can help with organising and distributing kits systematically.',
      attended: false,
    },

    // Coastal Cleanup - Tyre
    {
      volunteer_id: volByEmail.get('vol5@willing.social')!,
      posting_id: postingByTitle.get('Coastal Cleanup')!,
      message: 'Passionate about environmental work and comfortable with outdoor physical tasks.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol1@willing.social')!,
      posting_id: postingByTitle.get('Coastal Cleanup')!,
      message: 'Happy to do heavy lifting and waste sorting alongside the team.',
      attended: false,
    },

    // Children's Art & Story Workshop
    {
      volunteer_id: volByEmail.get('vol6@willing.social')!,
      posting_id: postingByTitle.get('Children\'s Art & Story Workshop')!,
      message: 'Art teacher background with lots of experience running creative sessions for kids.',
      attended: true,
    },
    {
      volunteer_id: volByEmail.get('vol2@willing.social')!,
      posting_id: postingByTitle.get('Children\'s Art & Story Workshop')!,
      message: 'Love storytelling and reading with children. Happy to assist with activities.',
      attended: false,
    },

    // Debris Clearance - Akkar Villages (closed - historical)
    {
      volunteer_id: volByEmail.get('vol1@willing.social')!,
      posting_id: postingByTitle.get('Debris Clearance')!,
      message: 'Ready for physically demanding work. Bringing my own gloves.',
      attended: true,
    },
    {
      volunteer_id: volByEmail.get('vol5@willing.social')!,
      posting_id: postingByTitle.get('Debris Clearance')!,
      message: 'Strong and used to outdoor heavy work.',
      attended: true,
    },
    {
      volunteer_id: volByEmail.get('vol3@willing.social')!,
      posting_id: postingByTitle.get('Debris Clearance')!,
      message: 'Want to help affected families recover.',
      attended: false, // enrolled but did not attend
    },

    // Ensure minimum 3 enrollments per volunteer
    // vol7 (tech/remote support)
    {
      volunteer_id: volByEmail.get('vol7@willing.social')!,
      posting_id: postingByTitle.get('Emergency Shelter Setup')!,
      message: 'I can support shelter logistics and install relief tents for displaced families.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol7@willing.social')!,
      posting_id: postingByTitle.get('Medical Supplies Inventory & Sorting')!,
      message: 'Happy to help track and manage inventory in the medical supplies depot.',
      attended: false,
    },

    // vol8 (food/kitchen)
    {
      volunteer_id: volByEmail.get('vol8@willing.social')!,
      posting_id: postingByTitle.get('Inclusive Sports Day')!,
      message: 'Can help coordinate meal breaks and hydration for participants and staff.',
      attended: false,
    },

    // vol10 (private profile)
    {
      volunteer_id: volByEmail.get('vol10@willing.social')!,
      posting_id: postingByTitle.get('Emergency Shelter Setup')!,
      message: 'I am experienced with logistics and can assist with shelter set-up.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol10@willing.social')!,
      posting_id: postingByTitle.get('Emergency Food Packing')!,
      message: 'Ready to help pack and prepare food parcels for families in need.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol10@willing.social')!,
      posting_id: postingByTitle.get('Mobile Aid Kit Distribution')!,
      message: 'Available to distribute aid kits across Beirut neighborhoods.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol11@willing.social')!,
      posting_id: postingByTitle.get('Flood Cleanup Crew')!,
      message: 'Ready to help with cleanup logistics, hauling, and field coordination in the Bekaa.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol14@willing.social')!,
      posting_id: postingByTitle.get('Flood Cleanup Crew')!,
      message: 'Available for flood recovery support and team coordination on site.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol13@willing.social')!,
      posting_id: postingByTitle.get('Flood Cleanup Crew')!,
      message: 'Can support field coordination, volunteer communication, and on-site logistics in the Bekaa.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol11@willing.social')!,
      posting_id: postingByTitle.get('Neighborhood Repair Week')!,
      message: 'Can support repair teams for selected days and help keep materials organised.',
      attended: true,
    },
    {
      volunteer_id: volByEmail.get('vol12@willing.social')!,
      posting_id: postingByTitle.get('Neighborhood Repair Week')!,
      message: 'Happy to help the neighborhood recovery team with painting, cleanup, and volunteer support.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol13@willing.social')!,
      posting_id: postingByTitle.get('One-Day Hotline Sprint')!,
      message: 'Available all day to support hotline documentation and urgent call routing.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol14@willing.social')!,
      posting_id: postingByTitle.get('One-Day Hotline Sprint')!,
      message: 'Can assist the team with caller support and accurate note taking throughout the shift.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol11@willing.social')!,
      posting_id: postingByTitle.get('Farm Recovery Rotation')!,
      message: 'Can help with cleanup and setup tasks across selected farm recovery days.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol14@willing.social')!,
      posting_id: postingByTitle.get('Farm Recovery Rotation')!,
      message: 'Available for rotating field support days and logistics coordination.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol13@willing.social')!,
      posting_id: postingByTitle.get('Crisis Hotline Coverage Week')!,
      message: 'Ready to cover multiple hotline days and keep referral notes organised.',
      attended: false,
    },
    {
      volunteer_id: volByEmail.get('vol14@willing.social')!,
      posting_id: postingByTitle.get('Crisis Hotline Coverage Week')!,
      message: 'Can commit to the full hotline coverage window and support caller triage.',
      attended: false,
    },

  ])
    .returning(['id', 'volunteer_id', 'posting_id', 'attended'])
    .execute();

  const applicationByKey = new Map(
    applications.map(application => [`${application.volunteer_id}:${application.posting_id}`, application.id] as const),
  );

  const partialApplicationDateSelections: Array<{ volunteerEmail: string; postingTitle: string; dates: string[] }> = [
    {
      volunteerEmail: 'vol4@willing.social',
      postingTitle: 'Displaced Families Registration',
      dates: ['2026-02-12', '2026-02-14'],
    },
    {
      volunteerEmail: 'vol2@willing.social',
      postingTitle: 'Displaced Families Registration',
      dates: ['2026-02-13'],
    },
    {
      volunteerEmail: 'vol10@willing.social',
      postingTitle: 'Displaced Families Registration',
      dates: ['2026-02-12', '2026-02-13'],
    },
    {
      volunteerEmail: 'vol7@willing.social',
      postingTitle: 'Remote Homework Support',
      dates: ['2026-02-03', '2026-02-10', '2026-02-17', '2026-02-24'],
    },
    {
      volunteerEmail: 'vol2@willing.social',
      postingTitle: 'Remote Homework Support',
      dates: ['2026-02-02', '2026-02-09', '2026-02-16'],
    },
    {
      volunteerEmail: 'vol13@willing.social',
      postingTitle: 'Volunteer Helpline Shifts',
      dates: ['2026-03-10', '2026-03-12', '2026-03-14'],
    },
    {
      volunteerEmail: 'vol14@willing.social',
      postingTitle: 'Volunteer Helpline Shifts',
      dates: ['2026-03-11', '2026-03-13'],
    },
    {
      volunteerEmail: 'vol12@willing.social',
      postingTitle: 'School Supply Restocking',
      dates: ['2026-03-24', '2026-03-26'],
    },
    {
      volunteerEmail: 'vol11@willing.social',
      postingTitle: 'School Supply Restocking',
      dates: ['2026-03-25'],
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

  const partialEnrollmentDateSelections = new Map<string, string[]>([
    [`${volByEmail.get('vol4@willing.social')}:${postingByTitle.get('Displaced Families Registration')}`, [`${nowYear}-02-12`, `${nowYear}-02-14`]],
    [`${volByEmail.get('vol7@willing.social')}:${postingByTitle.get('Remote Homework Support')}`, [`${nowYear}-02-03`, `${nowYear}-02-10`, `${nowYear}-02-17`, `${nowYear}-02-24`]],
    [`${volByEmail.get('vol11@willing.social')}:${postingByTitle.get('Neighborhood Repair Week')}`, [`${nowYear}-03-18`, `${nowYear}-03-19`, `${nowYear}-03-21`]],
    [`${volByEmail.get('vol12@willing.social')}:${postingByTitle.get('Neighborhood Repair Week')}`, [`${nowYear}-03-20`, `${nowYear}-03-22`]],
    [`${volByEmail.get('vol13@willing.social')}:${postingByTitle.get('One-Day Hotline Sprint')}`, [`${nowYear}-03-25`]],
    [`${volByEmail.get('vol14@willing.social')}:${postingByTitle.get('One-Day Hotline Sprint')}`, [`${nowYear}-03-25`]],
    [`${volByEmail.get('vol11@willing.social')}:${postingByTitle.get('Farm Recovery Rotation')}`, [`${nowYear}-03-28`, `${nowYear}-03-29`]],
    [`${volByEmail.get('vol14@willing.social')}:${postingByTitle.get('Farm Recovery Rotation')}`, [`${nowYear}-03-28`, `${nowYear}-03-30`]],
    [`${volByEmail.get('vol13@willing.social')}:${postingByTitle.get('Crisis Hotline Coverage Week')}`, [`${nowYear}-04-05`, `${nowYear}-04-06`, `${nowYear}-04-07`]],
    [`${volByEmail.get('vol14@willing.social')}:${postingByTitle.get('Crisis Hotline Coverage Week')}`, [`${nowYear}-04-05`, `${nowYear}-04-06`, `${nowYear}-04-07`]],
  ]);

  await database.insertInto('enrollment_date').values(
    enrollments.flatMap((enrollment) => {
      const posting = postings.find(postingRow => postingRow.id === enrollment.posting_id);
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
  console.log('Admin:');
  console.log('  admin@willing.social');
  console.log('');
  console.log('Organizations (approved): org1@willing.social, org2@willing.social, org3@willing.social, org4@willing.social, org5@willing.social, org6@willing.social (scam)');

  console.log('');
  console.log('Volunteers: vol1@willing.social, vol2@willing.social, vol3@willing.social, vol4@willing.social, vol5@willing.social, vol6@willing.social, vol7@willing.social, vol8@willing.social, vol9@willing.social, vol10@willing.social, vol11@willing.social, vol12@willing.social, vol13@willing.social, vol14@willing.social, vol15@willing.social (scam)');

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
