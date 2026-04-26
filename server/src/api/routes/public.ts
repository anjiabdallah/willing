import path from 'path';

import { type Response, Router } from 'express';
import { type Kysely } from 'kysely';
import zod from 'zod';

import { type PublicCertificateSignatureResponse, type PublicCertificateVerificationResponse, type PublicHomeStatsResponse } from './public.types.ts';
import { createCertificateVerificationRateLimit } from './utils/rateLimit.ts';
import config from '../../config.ts';
import { type Database } from '../../db/tables/index.ts';
import { verifySignedCertificateToken } from '../../services/certificates/token.ts';
import { verifyCertificatePayloadAgainstDatabase } from '../../services/certificates/verification.ts';
import { PLATFORM_SIGNATURE_UPLOAD_DIR } from '../../services/uploads/paths.ts';

const certificateVerificationBodySchema = zod.object({
  token: zod.string().trim().min(1, 'Certificate token is required.').max(512, 'Certificate token is too long.'),
});

function createPublicRouter(db: Kysely<Database>) {
  const publicRouter = Router();
  const certificateVerificationRateLimit = createCertificateVerificationRateLimit();

  publicRouter.get('/home-stats', async (_req, res: Response<PublicHomeStatsResponse>) => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [postingsResult, organizationsResult, volunteersResult, newPostingsResult, newOrganizationsResult, newVolunteersResult] = await Promise.all([
      db
        .selectFrom('organization_posting')
        .innerJoin('organization_account', 'organization_account.id', 'organization_posting.organization_id')
        .select(eb => eb.fn.countAll().as('count'))
        .where('organization_account.is_deleted', '=', false)
        .where('organization_account.is_disabled', '=', false)
        .executeTakeFirstOrThrow(),
      db
        .selectFrom('organization_account')
        .select(eb => eb.fn.countAll().as('count'))
        .where('is_deleted', '=', false)
        .where('is_disabled', '=', false)
        .executeTakeFirstOrThrow(),
      db
        .selectFrom('volunteer_account')
        .select(eb => eb.fn.countAll().as('count'))
        .where('is_deleted', '=', false)
        .where('is_disabled', '=', false)
        .executeTakeFirstOrThrow(),
      db
        .selectFrom('organization_posting')
        .innerJoin('organization_account', 'organization_account.id', 'organization_posting.organization_id')
        .select(eb => eb.fn.countAll().as('count'))
        .where('organization_posting.created_at', '>=', weekAgo)
        .where('organization_account.is_deleted', '=', false)
        .where('organization_account.is_disabled', '=', false)
        .executeTakeFirstOrThrow(),
      db
        .selectFrom('organization_account')
        .select(eb => eb.fn.countAll().as('count'))
        .where('created_at', '>=', weekAgo)
        .where('is_deleted', '=', false)
        .where('is_disabled', '=', false)
        .executeTakeFirstOrThrow(),
      db
        .selectFrom('volunteer_account')
        .select(eb => eb.fn.countAll().as('count'))
        .where('created_at', '>=', weekAgo)
        .where('is_deleted', '=', false)
        .where('is_disabled', '=', false)
        .executeTakeFirstOrThrow(),
    ]);

    res.json({
      totalOpportunities: Number(postingsResult.count),
      totalOrganizations: Number(organizationsResult.count),
      totalVolunteers: Number(volunteersResult.count),
      newOpportunitiesThisWeek: Number(newPostingsResult.count),
      newOrganizationsThisWeek: Number(newOrganizationsResult.count),
      newVolunteersThisWeek: Number(newVolunteersResult.count),
    });
  });

  publicRouter.get('/certificate-signature', async (_req, res: Response<PublicCertificateSignatureResponse>, next) => {
    const settings = await db
      .selectFrom('platform_certificate_settings')
      .select(['signature_path'])
      .orderBy('id', 'desc')
      .executeTakeFirst();

    if (!settings?.signature_path) {
      res.status(404);
      throw new Error('Certificate signature not found');
    }

    const ext = path.extname(settings.signature_path).toLowerCase();
    if (ext === '.png') {
      res.setHeader('Content-Type', 'image/png');
    } else if (ext === '.svg') {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else {
      res.setHeader('Content-Type', 'image/jpeg');
    }
    res.setHeader('Content-Disposition', 'inline; filename="platform-certificate-signature"');

    res.sendFile(settings.signature_path, { root: PLATFORM_SIGNATURE_UPLOAD_DIR }, (error) => {
      if (!error) return;
      next(error);
    });
  });

  publicRouter.post('/certificate/verify', certificateVerificationRateLimit, async (req, res: Response<PublicCertificateVerificationResponse>) => {
    const parsedBody = certificateVerificationBodySchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({
        valid: false,
        message: 'Invalid certificate token format.',
      });
      return;
    }

    const body = parsedBody.data;
    const tokenResult = verifySignedCertificateToken(body.token, config.CERTIFICATE_VERIFICATION_SECRET);

    if (!tokenResult.valid) {
      if (tokenResult.reason === 'malformed') {
        res.status(400).json({
          valid: false,
          message: 'Invalid certificate token format.',
        });
        return;
      }

      res.json({
        valid: false,
        message: 'Certificate is invalid.',
      });
      return;
    }

    const dbVerification = await verifyCertificatePayloadAgainstDatabase(tokenResult.payload, db);
    if (!dbVerification.valid) {
      res.json({
        valid: false,
        message: 'Certificate is invalid.',
      });
      return;
    }

    const volunteerId = Number(tokenResult.payload.uid);
    const volunteer = await db
      .selectFrom('volunteer_account')
      .select(['first_name', 'last_name'])
      .where('id', '=', volunteerId)
      .executeTakeFirst();

    if (!volunteer) {
      res.json({
        valid: false,
        message: 'Certificate is invalid.',
      });
      return;
    }

    const organizationIds = tokenResult.payload.org_ids.map(Number);
    const organizations = organizationIds.length === 0
      ? []
      : await db
          .selectFrom('organization_account')
          .leftJoin(
            'organization_certificate_info',
            'organization_certificate_info.id',
            'organization_account.certificate_info_id',
          )
          .select([
            'organization_account.id',
            'organization_account.name',
            'organization_account.logo_path',
            'organization_certificate_info.signatory_name',
            'organization_certificate_info.signatory_position',
            'organization_certificate_info.signature_path',
          ])
          .where('organization_account.id', 'in', organizationIds)
          .execute();

    const organizationById = new Map(organizations.map(organization => [organization.id, organization]));

    const platformCertificate = await db
      .selectFrom('platform_certificate_settings')
      .select(['signatory_name', 'signatory_position', 'signature_path'])
      .orderBy('id', 'desc')
      .executeTakeFirst();

    res.json({
      valid: true,
      message: 'Certificate is valid.',
      issued_at: tokenResult.payload.issued_at,
      certificate_type: tokenResult.payload.type,
      volunteer_name: `${volunteer.first_name} ${volunteer.last_name}`.trim(),
      total_hours: tokenResult.payload.total_hours,
      organizations: organizationIds.map(orgId => ({
        id: orgId,
        name: organizationById.get(orgId)?.name ?? `Organization ${orgId}`,
        hours: tokenResult.payload.hours_per_org[String(orgId)] ?? 0,
        logo_path: organizationById.get(orgId)?.logo_path ?? null,
        signatory_name: organizationById.get(orgId)?.signatory_name ?? null,
        signatory_position: organizationById.get(orgId)?.signatory_position ?? null,
        signature_path: organizationById.get(orgId)?.signature_path ?? null,
      })),
      platform_certificate: platformCertificate
        ? {
            signatory_name: platformCertificate.signatory_name ?? null,
            signatory_position: platformCertificate.signatory_position ?? null,
            signature_path: platformCertificate.signature_path ?? null,
          }
        : null,
    });
  });

  return publicRouter;
};

export default createPublicRouter;
