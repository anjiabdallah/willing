import { Building2, CheckCircle2 } from 'lucide-react';

import {
  CERTIFICATE_PREVIEW_HEIGHT,
  CERTIFICATE_PREVIEW_WIDTH,
  MAX_CERTIFICATE_ORGANIZATIONS,
} from './certificatePreview.constants';
import { SERVER_BASE_URL } from '../../utils/requestServer';

import type {
  CertificatePreviewOrganization,
  CertificatePreviewPlatformCertificate,
} from './certificatePreview.constants';

type CertificatePreviewProps = {
  previewId: string;
  volunteerName: string;
  totalHours: number;
  organizations: CertificatePreviewOrganization[];
  platformCertificate: CertificatePreviewPlatformCertificate;
  generatedAtLabel: string;
  verificationToken: string;
};

const formatHours = (value: number) => Math.floor(value);

function CertificatePreview({
  previewId,
  volunteerName,
  totalHours,
  organizations,
  platformCertificate,
  generatedAtLabel,
  verificationToken,
}: CertificatePreviewProps) {
  const platformSignatureUrl = platformCertificate?.signature_path
    ? `${SERVER_BASE_URL}/public/certificate-signature?v=${encodeURIComponent(platformCertificate.signature_path)}`
    : null;

  return (
    <div
      id={previewId}
      className="bg-white text-black border border-neutral-200 rounded-box pt-6 px-8 pb-4 shadow-xl text-[1.05rem]"
      style={{
        width: `${CERTIFICATE_PREVIEW_WIDTH}px`,
        height: `${CERTIFICATE_PREVIEW_HEIGHT}px`,
        minWidth: `${CERTIFICATE_PREVIEW_WIDTH}px`,
      }}
    >
      <div className="h-full grid grid-rows-[168px_1fr_272px]">
        <div>
          <div>
            <div className="flex items-center gap-2">
              <img src="/willing.svg" alt="Willing Logo" className="h-7 w-7" />
              <p className="text-base uppercase tracking-[0.2em] text-primary font-semibold">Willing Platform</p>
            </div>
            <h2 className="certificate-title">Certificate of Volunteering</h2>
            <div className="flex items-center gap-2 mt-2 text-success">
              <CheckCircle2 size={16} />
              <span className="font-semibold text-base">Participation Verified</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center px-10 pt-4">
          <div className="text-center max-w-4xl mx-auto">
            <p className="certificate-subtitle">This is to certify that</p>
            <p className="certificate-name font-bold text-primary">{volunteerName}</p>
            <div className="w-[910px] max-w-full mx-auto border-b-2 border-primary/60 mt-2" />
            <p className="certificate-main-copy">
              has contributed a total of
              {' '}
              <span className="font-bold">{formatHours(totalHours)}</span>
              {' '}
              volunteering hours through Willing.
              This certificate recognizes meaningful service and participation across the platform.
            </p>
          </div>
        </div>

        <div className="certificate-org-section mt-1 h-full flex flex-col">
          <div className="grow">
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: MAX_CERTIFICATE_ORGANIZATIONS }).map((_, index) => {
                const org = organizations[index];
                if (!org) {
                  return <div key={`empty-org-slot-${index}`} className="h-40" aria-hidden />;
                }

                const logoUrl = org.logo_path
                  ? `${SERVER_BASE_URL}/organization/${org.id}/logo`
                  : null;
                const signatureUrl = org.signature_path
                  ? `${SERVER_BASE_URL}/organization/${org.id}/signature?v=${encodeURIComponent(org.signature_path)}`
                  : null;

                return (
                  <div key={org.id} className="certificate-slot rounded-box border border-neutral-300 bg-gradient-to-b from-white to-neutral-50 p-3 h-44 shadow-sm">
                    <div className="flex items-center gap-3">
                      {logoUrl
                        ? (
                            <div className="h-10 w-10 rounded-md border border-neutral-200 bg-white flex items-center justify-center overflow-hidden">
                              <img src={logoUrl} alt={`${org.name} logo`} className="h-8 w-8 object-contain" />
                            </div>
                          )
                        : (
                            <div className="h-10 w-10 rounded-md border border-neutral-200 bg-white flex items-center justify-center">
                              <Building2 size={18} />
                            </div>
                          )}
                      <p className="font-bold text-lg leading-tight line-clamp-2">{org.name}</p>
                    </div>
                    <p className="text-base mt-2">
                      Hours:
                      {' '}
                      <span className="font-bold">{formatHours(org.hours)}</span>
                    </p>
                    <div className="mt-2 h-8 flex items-end">
                      {signatureUrl
                        ? (
                            <img
                              src={signatureUrl}
                              alt={`${org.name} signature`}
                              className="max-h-7 w-auto object-contain object-bottom"
                            />
                          )
                        : <div className="h-7" />}
                    </div>
                    <div className="certificate-sign-line h-px border-b border-neutral-400" />
                    <p className="text-xs mt-1 font-semibold truncate" title={org.signatory_name || ''}>{org.signatory_name || ''}</p>
                    <p className="text-[11px] opacity-70 truncate" title={org.signatory_position || ''}>{org.signatory_position || ''}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="certificate-footer mt-auto flex items-end justify-between gap-6">
            <div className="w-48">
              <p className="text-xs uppercase tracking-wide opacity-60">Willing Admin Signature</p>
              <div className="mt-1 h-7 flex items-end">
                {platformSignatureUrl
                  ? (
                      <img
                        src={platformSignatureUrl}
                        alt="Willing admin signature"
                        className="max-h-6 w-auto object-contain object-bottom"
                      />
                    )
                  : <div className="h-6" />}
              </div>
              <div className="certificate-sign-line h-px border-b border-neutral-300 mt-0.5" />
              <p className="text-xs opacity-70 mt-0.5 truncate">{platformCertificate?.signatory_name || 'Name'}</p>
              <p className="text-[11px] opacity-60 truncate">{platformCertificate?.signatory_position || 'Title'}</p>
            </div>
            <div className="certificate-meta text-right text-base ml-auto">
              <p className="text-neutral-700 text-sm">
                Generated:
                {' '}
                {generatedAtLabel}
              </p>
              <p className="mt-1 ml-auto w-[560px] max-w-full text-[14px] leading-tight flex items-baseline justify-end gap-1 text-neutral-500">
                <span className="whitespace-nowrap font-semibold">Verification Token:</span>
                <span className="certificate-token-value whitespace-nowrap font-mono tracking-tight">
                  {verificationToken}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CertificatePreview;
