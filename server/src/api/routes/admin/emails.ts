import { OrganizationRequest } from '../../../db/types.js';

export async function sendOrganizationAcceptanceEmail(
  organizationRequest: OrganizationRequest,
  reason: string | null,
) {
  console.log('UNIMPLEMENTED - Send an email to the organization that the request was accepted');
}

export async function sendOrganizationRejectionEmail(
  organizationRequest: OrganizationRequest,
  reason: string | null,
) {
  console.log('UNIMPLEMENTED - Send an email to the organization that the request was rejected');
}
