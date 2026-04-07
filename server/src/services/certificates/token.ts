import crypto from 'crypto';
import zlib from 'zlib';

import zod from 'zod';

import { idSchema } from '../../schemas/index.ts';

export const CERTIFICATE_PAYLOAD_VERSION = 2 as const;
export const CERTIFICATE_TYPE = 'volunteer_hours_certificate' as const;

const HOURS_DECIMAL_PLACES = 2;
const HOURS_SCALE_FACTOR = 10 ** HOURS_DECIMAL_PLACES;
const CERTIFICATE_TYPE_CODE = 0;
const TRUNCATED_SIGNATURE_BYTES = 16;

const idStringSchema = zod.string()
  .trim()
  .transform(value => Number(value))
  .pipe(idSchema)
  .transform(value => String(value));

export const certificateVerificationPayloadSchema = zod.object({
  v: zod.literal(CERTIFICATE_PAYLOAD_VERSION),
  uid: idStringSchema,
  issued_at: zod.string().datetime({ offset: true }),
  org_ids: zod.array(idStringSchema).max(4, 'Up to 4 organization IDs are allowed'),
  total_hours: zod.number().finite().nonnegative(),
  hours_per_org: zod.record(idStringSchema, zod.number().finite().nonnegative()),
  type: zod.literal(CERTIFICATE_TYPE),
}).superRefine((payload, ctx) => {
  const uniqueOrgIds = new Set(payload.org_ids);
  if (uniqueOrgIds.size !== payload.org_ids.length) {
    ctx.addIssue({
      code: zod.ZodIssueCode.custom,
      path: ['org_ids'],
      message: 'Organization IDs must be unique.',
    });
  }

  const payloadOrgIds = new Set(payload.org_ids);
  const hoursOrgIds = Object.keys(payload.hours_per_org);

  for (const orgId of payload.org_ids) {
    if (!(orgId in payload.hours_per_org)) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        path: ['hours_per_org', orgId],
        message: `Missing hours for organization ${orgId}.`,
      });
    }
  }

  for (const orgId of hoursOrgIds) {
    if (!payloadOrgIds.has(orgId)) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        path: ['hours_per_org', orgId],
        message: `Organization ${orgId} is not listed in org_ids.`,
      });
    }
  }
});

type CompactCertificatePayloadTuple = readonly [
  typeof CERTIFICATE_PAYLOAD_VERSION,
  number,
  number,
  number[],
  number,
  number[],
  typeof CERTIFICATE_TYPE_CODE,
];

const compactCertificatePayloadSchema = zod.tuple([
  zod.literal(CERTIFICATE_PAYLOAD_VERSION),
  idSchema,
  zod.number().int().positive(),
  zod.array(idSchema).max(4),
  zod.number().int().nonnegative(),
  zod.array(zod.number().int().nonnegative()),
  zod.literal(CERTIFICATE_TYPE_CODE),
]).superRefine((tuple, ctx) => {
  const [, , , orgIds, , orgHours] = tuple;
  if (new Set(orgIds).size !== orgIds.length) {
    ctx.addIssue({
      code: zod.ZodIssueCode.custom,
      path: [3],
      message: 'Organization IDs must be unique.',
    });
  }

  if (orgIds.length !== orgHours.length) {
    ctx.addIssue({
      code: zod.ZodIssueCode.custom,
      path: [5],
      message: 'Organization hours must align with organization IDs.',
    });
  }
});

export type CertificateVerificationPayload = zod.infer<typeof certificateVerificationPayloadSchema>;

type VerifiedTokenResult = { valid: true; payload: CertificateVerificationPayload } | { valid: false; reason: 'malformed' | 'invalid_signature' | 'invalid_payload' };

const roundHours = (value: number) => Number(value.toFixed(HOURS_DECIMAL_PLACES));
const encodeHours = (hours: number) => Math.round(roundHours(hours) * HOURS_SCALE_FACTOR);
const decodeHours = (scaledHours: number) => Number((scaledHours / HOURS_SCALE_FACTOR).toFixed(HOURS_DECIMAL_PLACES));

const toCanonicalPayload = (payload: CertificateVerificationPayload): CertificateVerificationPayload => {
  const sortedOrgIds = [...payload.org_ids].sort((left, right) => Number(left) - Number(right));
  const hoursPerOrg: Record<string, number> = {};

  sortedOrgIds.forEach((orgId) => {
    hoursPerOrg[orgId] = roundHours(payload.hours_per_org[orgId] ?? 0);
  });

  return {
    v: payload.v,
    uid: payload.uid,
    issued_at: new Date(payload.issued_at).toISOString(),
    org_ids: sortedOrgIds,
    total_hours: roundHours(payload.total_hours),
    hours_per_org: hoursPerOrg,
    type: CERTIFICATE_TYPE,
  };
};

const payloadToCompactTuple = (payload: CertificateVerificationPayload): CompactCertificatePayloadTuple => {
  const orgIds = payload.org_ids.map(orgId => Number(orgId));
  const orgHours = payload.org_ids.map(orgId => encodeHours(payload.hours_per_org[orgId] ?? 0));
  const issuedAtEpochSeconds = Math.floor(new Date(payload.issued_at).getTime() / 1000);

  return [
    CERTIFICATE_PAYLOAD_VERSION,
    Number(payload.uid),
    issuedAtEpochSeconds,
    orgIds,
    encodeHours(payload.total_hours),
    orgHours,
    CERTIFICATE_TYPE_CODE,
  ];
};

const compactTupleToPayload = (tuple: CompactCertificatePayloadTuple): CertificateVerificationPayload => {
  const [, uid, issuedAtEpochSeconds, orgIds, totalHoursScaled, orgHoursScaled] = tuple;
  const hoursPerOrg = orgIds.reduce<Record<string, number>>((record, orgId, index) => {
    record[String(orgId)] = decodeHours(orgHoursScaled[index] ?? 0);
    return record;
  }, {});

  return {
    v: CERTIFICATE_PAYLOAD_VERSION,
    uid: String(uid),
    issued_at: new Date(issuedAtEpochSeconds * 1000).toISOString(),
    org_ids: orgIds.map(orgId => String(orgId)),
    total_hours: decodeHours(totalHoursScaled),
    hours_per_org: hoursPerOrg,
    type: CERTIFICATE_TYPE,
  };
};

const getSignature = (payloadBytes: Buffer, secret: string) =>
  crypto.createHmac('sha256', secret).update(payloadBytes).digest();

const hasValidSignature = (signatureBytes: Buffer, fullSignature: Buffer) => {
  if (signatureBytes.length === fullSignature.length) {
    return crypto.timingSafeEqual(signatureBytes, fullSignature);
  }

  if (signatureBytes.length === TRUNCATED_SIGNATURE_BYTES) {
    return crypto.timingSafeEqual(signatureBytes, fullSignature.subarray(0, TRUNCATED_SIGNATURE_BYTES));
  }

  return false;
};

const tryParseCompactPayload = (payloadBytes: Buffer): CertificateVerificationPayload | null => {
  try {
    const decompressed = zlib.inflateRawSync(payloadBytes);
    const parsed = JSON.parse(decompressed.toString('utf8'));
    const tupleResult = compactCertificatePayloadSchema.safeParse(parsed);
    if (!tupleResult.success) return null;

    const payload = compactTupleToPayload(tupleResult.data);
    const payloadResult = certificateVerificationPayloadSchema.safeParse(payload);
    if (!payloadResult.success) return null;

    return toCanonicalPayload(payloadResult.data);
  } catch {
    return null;
  }
};

export const signCertificateVerificationPayload = (
  rawPayload: CertificateVerificationPayload,
  secret: string,
) => {
  const canonicalPayload = toCanonicalPayload(rawPayload);
  const compactPayload = payloadToCompactTuple(canonicalPayload);
  const payloadBytes = zlib.deflateRawSync(Buffer.from(JSON.stringify(compactPayload), 'utf8'));
  const signature = getSignature(payloadBytes, secret).subarray(0, TRUNCATED_SIGNATURE_BYTES);

  return `${payloadBytes.toString('base64url')}.${signature.toString('base64url')}`;
};

export const verifySignedCertificateToken = (
  token: string,
  secret: string,
): VerifiedTokenResult => {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, reason: 'malformed' };
  }

  let payloadBytes: Buffer;
  let signatureBytes: Buffer;
  try {
    payloadBytes = Buffer.from(parts[0], 'base64url');
    signatureBytes = Buffer.from(parts[1], 'base64url');
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  if (payloadBytes.length === 0 || signatureBytes.length === 0) {
    return { valid: false, reason: 'malformed' };
  }

  const expectedSignature = getSignature(payloadBytes, secret);
  if (!hasValidSignature(signatureBytes, expectedSignature)) {
    return { valid: false, reason: 'invalid_signature' };
  }

  const compactPayload = tryParseCompactPayload(payloadBytes);
  if (compactPayload) {
    return { valid: true, payload: compactPayload };
  }

  return { valid: false, reason: 'invalid_payload' };
};
