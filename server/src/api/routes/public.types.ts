export type PublicHomeStatsResponse = {
  totalOpportunities: number;
  totalOrganizations: number;
  totalVolunteers: number;
  newOpportunitiesThisWeek: number;
  newOrganizationsThisWeek: number;
  newVolunteersThisWeek: number;
};

export type PublicCertificateSignatureResponse = never;

export type PublicCertificateVerificationOrganization = {
  id: number;
  name: string;
  hours: number;
  logo_path: string | null;
  signatory_name: string | null;
  signatory_position: string | null;
  signature_path: string | null;
};

export type PublicCertificateVerificationResponse = {
  valid: boolean;
  message: string;
  issued_at?: string;
  certificate_type?: 'volunteer_hours_certificate';
  volunteer_name?: string;
  total_hours?: number;
  organizations?: PublicCertificateVerificationOrganization[];
  platform_certificate?: {
    signatory_name: string | null;
    signatory_position: string | null;
    signature_path: string | null;
  } | null;
};
