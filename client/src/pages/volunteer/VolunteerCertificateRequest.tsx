import {
  AlertCircle,
  Award,
  Building2,
  Building,
  CheckCircle2,
  Download,
  FileText,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useVolunteer } from '../../auth/useUsers';
import Button from '../../components/Button';
import Card from '../../components/Card';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import Loading from '../../components/Loading';
import requestServer, { SERVER_BASE_URL } from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type { VolunteerCertificateIssueResponse, VolunteerCertificateResponse } from '../../../../server/src/api/types';

const MAX_ORGANIZATION_SELECTION = 4;
const CERTIFICATE_PREVIEW_ID = 'certificate-preview';
const CERTIFICATE_PREVIEW_WIDTH = 1123;
const CERTIFICATE_PREVIEW_HEIGHT = 794;
const formatHours = (value: number) => Math.floor(value);

const getOrganizationEligibilityStatus = (organization: VolunteerCertificateResponse['organizations'][number]) => {
  if (organization.eligible) {
    return {
      label: 'Eligible',
      className: 'badge badge-success',
    };
  }

  if (!organization.certificate_feature_enabled) {
    return {
      label: 'Certificates not enabled',
      className: 'badge badge-warning',
    };
  }

  if (
    organization.hours_threshold !== null
    && organization.hours < organization.hours_threshold
  ) {
    return {
      label: 'Threshold not reached',
      className: 'badge badge-info',
    };
  }

  return {
    label: 'Setup incomplete',
    className: 'badge badge-ghost',
  };
};

function VolunteerCertificateRequest() {
  const volunteer = useVolunteer();
  const [selectedOrganizationIds, setSelectedOrganizationIds] = useState<number[]>([]);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [certificateGeneratedAt, setCertificateGeneratedAt] = useState<Date | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const [certificateScale, setCertificateScale] = useState(1);

  const loadCertificateData = useCallback(async () => {
    return requestServer<VolunteerCertificateResponse>('/volunteer/certificate', { includeJwt: true });
  }, []);

  const { data, loading, error, trigger } = useAsync<VolunteerCertificateResponse, []>(loadCertificateData, {
    immediate: true,
  });
  const {
    loading: issuingCertificate,
    trigger: issueCertificate,
  } = useAsync<VolunteerCertificateIssueResponse, [number[]]>(
    async orgIds => requestServer<VolunteerCertificateIssueResponse>(
      '/volunteer/certificate/issue',
      {
        method: 'POST',
        body: { org_ids: orgIds },
        includeJwt: true,
      },
    ),
    { notifyOnError: true },
  );

  const rankedOrganizations = useMemo(
    () => [...(data?.organizations ?? [])].sort((left, right) => {
      if (left.certificate_feature_enabled !== right.certificate_feature_enabled) {
        return left.certificate_feature_enabled ? -1 : 1;
      }
      return right.hours - left.hours;
    }),
    [data?.organizations],
  );

  const organizationsWithEligibility = useMemo(
    () => rankedOrganizations,
    [rankedOrganizations],
  );

  const eligibleOrganizations = useMemo(
    () => organizationsWithEligibility.filter(org => org.eligible),
    [organizationsWithEligibility],
  );

  const totalHours = useMemo(
    () => Number(data?.total_hours ?? 0),
    [data?.total_hours],
  );

  const selectedOrganizations = useMemo(
    () => organizationsWithEligibility
      .filter(org => selectedOrganizationIds.includes(org.id))
      .sort((left, right) => right.hours - left.hours),
    [organizationsWithEligibility, selectedOrganizationIds],
  );

  const volunteerName = useMemo(() => {
    const firstName = data?.volunteer.first_name ?? volunteer?.first_name ?? '';
    const lastName = data?.volunteer.last_name ?? volunteer?.last_name ?? '';
    return `${firstName} ${lastName}`.trim() || 'Volunteer';
  }, [data?.volunteer.first_name, data?.volunteer.last_name, volunteer?.first_name, volunteer?.last_name]);

  const platformSignatureUrl = useMemo(() => {
    if (!data?.platform_certificate?.signature_path) return null;
    return `${SERVER_BASE_URL}/public/certificate-signature?v=${encodeURIComponent(data.platform_certificate.signature_path)}`;
  }, [data?.platform_certificate?.signature_path]);

  useEffect(() => {
    const viewportElement = previewViewportRef.current;
    if (!viewportElement) return undefined;

    const updateScale = () => {
      const availableWidth = viewportElement.clientWidth;
      if (!availableWidth) return;
      const nextScale = Math.min(1, availableWidth / CERTIFICATE_PREVIEW_WIDTH);
      setCertificateScale(currentScale => (Math.abs(currentScale - nextScale) < 0.001 ? currentScale : nextScale));
    };

    updateScale();

    const observer = new ResizeObserver(() => {
      updateScale();
    });
    observer.observe(viewportElement);

    return () => {
      observer.disconnect();
    };
  }, [certificateGeneratedAt]);

  const toggleOrganization = (organizationId: number, eligible: boolean) => {
    if (!eligible) return;

    setSelectionError(null);
    setCertificateGeneratedAt(null);
    setVerificationToken(null);
    setIssueError(null);

    setSelectedOrganizationIds((current) => {
      if (current.includes(organizationId)) {
        return current.filter(id => id !== organizationId);
      }

      if (current.length >= MAX_ORGANIZATION_SELECTION) {
        setSelectionError(`You can select up to ${MAX_ORGANIZATION_SELECTION} organizations.`);
        return current;
      }

      return [...current, organizationId];
    });
  };

  const createCertificate = async () => {
    setSelectionError(null);
    setIssueError(null);

    try {
      const response = await issueCertificate(selectedOrganizationIds);
      setCertificateGeneratedAt(new Date(response.issued_at));
      setVerificationToken(response.verification_token);
    } catch (err) {
      setVerificationToken(null);
      setCertificateGeneratedAt(null);
      setIssueError(err instanceof Error ? err.message : 'Failed to generate certificate token.');
    }
  };

  const downloadCertificateAsPdf = () => {
    if (!certificateGeneratedAt) return;
    window.print();
  };

  return (
    <PageContainer>
      <style>
        {`
          #${CERTIFICATE_PREVIEW_ID} .certificate-title {
            font-size: 72px;
            line-height: 0.95;
            font-weight: 800;
            margin-top: 6px;
          }

          #${CERTIFICATE_PREVIEW_ID} .certificate-subtitle {
            font-size: 54px;
            line-height: 1.1;
          }

          #${CERTIFICATE_PREVIEW_ID} .certificate-name {
            font-size: 58px;
            margin-top: 8px;
            line-height: 1.05;
          }

          #${CERTIFICATE_PREVIEW_ID} .certificate-main-copy {
            font-size: 31px;
            margin-top: 10px;
            line-height: 1.35;
          }

          #${CERTIFICATE_PREVIEW_ID} .certificate-token-value {
            user-select: text;
            -webkit-user-select: text;
          }

          @media print {
            @page {
              size: A4 landscape;
              margin: 0;
            }

            html, body, #root {
              margin: 0 !important;
              padding: 0 !important;
              width: 297mm;
              height: 210mm;
              max-width: 297mm !important;
              max-height: 210mm !important;
              overflow: hidden !important;
              background: #fff !important;
            }

            .certificate-preview-viewport,
            .certificate-preview-stage,
            .certificate-preview-scaler {
              width: auto !important;
              height: auto !important;
              min-width: 0 !important;
              min-height: 0 !important;
              transform: none !important;
              overflow: visible !important;
            }

            body * {
              visibility: hidden;
            }

            #${CERTIFICATE_PREVIEW_ID},
            #${CERTIFICATE_PREVIEW_ID} * {
              visibility: visible;
            }

            #${CERTIFICATE_PREVIEW_ID} {
              position: fixed;
              left: 0;
              top: 0;
              width: 297mm;
              height: 210mm;
              max-height: 210mm;
              box-sizing: border-box;
              padding: 8mm 10mm 8mm;
              margin: 0;
              overflow: hidden;
              background: #fff !important;
              color: #111 !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            .certificate-slot {
              border: 1px solid #ddd !important;
              min-height: 18mm !important;
            }

            .certificate-sign-line {
              border-bottom: none !important;
              height: 1px !important;
              background: #222 !important;
            }

            .certificate-meta p {
              white-space: nowrap !important;
            }

            .certificate-token-value {
              user-select: text !important;
              -webkit-user-select: text !important;
            }

            .certificate-name {
              font-size: 56px !important;
              margin-top: 8px !important;
              line-height: 1.05 !important;
            }

            .certificate-main-copy {
              font-size: 30px !important;
              margin-top: 10px !important;
              line-height: 1.35 !important;
            }

            .certificate-org-section {
              margin-top: 2px !important;
              min-height: 0 !important;
            }

            .certificate-footer {
              margin-top: 6px !important;
              padding-bottom: 0 !important;
              break-inside: avoid !important;
            }

            .certificate-footer * {
              color: #111 !important;
            }

            .certificate-title {
              font-size: 70px !important;
              line-height: 0.95 !important;
            }

            .certificate-subtitle {
              font-size: 52px !important;
              line-height: 1.1 !important;
            }

            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      <PageHeader
        title="Generate Certificate"
        subtitle="Review your volunteering stats, then generate your certificate."
        showBack
        defaultBackTo="/volunteer/profile"
        icon={Award}
      />

      {loading && (
        <div className="flex justify-center mt-8">
          <Loading size="xl" />
        </div>
      )}

      {error && (
        <div className="mt-4 no-print">
          <div className="alert alert-error">
            <span>{error.message || 'Failed to load certificate data.'}</span>
          </div>
          <button className="btn btn-outline mt-3" onClick={() => { void trigger(); }}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid gap-6 md:grid-cols-3 no-print">
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm opacity-70">Total Volunteering Hours</p>
                  <p className="text-3xl font-bold mt-1">{formatHours(totalHours)}</p>
                </div>
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Award size={18} />
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm opacity-70">Organizations Involved</p>
                  <p className="text-3xl font-bold mt-1">{rankedOrganizations.length}</p>
                </div>
                <div className="rounded-full bg-secondary/10 p-2 text-secondary">
                  <Building size={18} />
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm opacity-70">Eligible Organizations</p>
                  <p className="text-3xl font-bold mt-1">{eligibleOrganizations.length}</p>
                </div>
                <div className="rounded-full bg-success/10 p-2 text-success">
                  <Users size={18} />
                </div>
              </div>
            </Card>
          </div>

          <Card
            title="Select Organizations (Max 4)"
            description="Ranked by your attended hours. Only organizations meeting threshold and certificate settings are selectable."
          >
            {selectionError && (
              <div className="alert alert-error mt-3">
                <AlertCircle size={16} />
                <span>{selectionError}</span>
              </div>
            )}
            {issueError && (
              <div className="alert alert-error mt-3">
                <AlertCircle size={16} />
                <span>{issueError}</span>
              </div>
            )}

            <div className="space-y-2 mt-3">
              {organizationsWithEligibility.map((organization, index) => {
                const selected = selectedOrganizationIds.includes(organization.id);
                const eligibilityStatus = getOrganizationEligibilityStatus(organization);
                const certificatesNotEnabled = !organization.certificate_feature_enabled;

                return (
                  <label
                    key={organization.id}
                    className={`flex items-center justify-between gap-3 rounded-box border p-3 ${
                      organization.eligible ? 'cursor-pointer border-base-300' : 'opacity-60 border-base-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="badge badge-ghost">{`#${index + 1}`}</span>
                      <div>
                        <p className="font-semibold">{organization.name}</p>
                        {certificatesNotEnabled
                          ? (
                              <p className="text-sm opacity-70">Certificates not enabled</p>
                            )
                          : (
                              <p className="text-sm opacity-70">
                                Hours:
                                {' '}
                                {formatHours(organization.hours)}
                                {' '}
                                |
                                {' '}
                                Threshold:
                                {' '}
                                {organization.hours_threshold ?? '-'}
                              </p>
                            )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!certificatesNotEnabled && (
                        <span className={eligibilityStatus.className}>{eligibilityStatus.label}</span>
                      )}
                      <input
                        type="checkbox"
                        className="checkbox checkbox-primary"
                        checked={selected}
                        disabled={!organization.eligible}
                        onChange={() => toggleOrganization(organization.id, organization.eligible)}
                      />
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-4">
              <Button className="btn btn-primary" onClick={() => { void createCertificate(); }} Icon={FileText} loading={issuingCertificate}>
                Create Certificate
              </Button>
            </div>
          </Card>

          {certificateGeneratedAt && (
            <Card
              title="Certificate Preview"
              right={(
                <Button
                  style="outline"
                  onClick={downloadCertificateAsPdf}
                  Icon={Download}
                >
                  Download as PDF
                </Button>
              )}
            >
            </Card>
          )}

          {certificateGeneratedAt && (
            <div className="mt-4">
              <div ref={previewViewportRef} className="w-full certificate-preview-viewport">
                <div
                  className="mx-auto certificate-preview-stage"
                  style={{
                    width: `${CERTIFICATE_PREVIEW_WIDTH * certificateScale}px`,
                    height: `${CERTIFICATE_PREVIEW_HEIGHT * certificateScale}px`,
                  }}
                >
                  <div
                    className="certificate-preview-scaler"
                    style={{
                      width: `${CERTIFICATE_PREVIEW_WIDTH}px`,
                      height: `${CERTIFICATE_PREVIEW_HEIGHT}px`,
                      transform: `scale(${certificateScale})`,
                      transformOrigin: 'top left',
                    }}
                  >
                    <div
                      id={CERTIFICATE_PREVIEW_ID}
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
                            {selectedOrganizations.length > 0
                              ? (
                                  <div className="grid grid-cols-4 gap-3">
                                    {Array.from({ length: MAX_ORGANIZATION_SELECTION }).map((_, index) => {
                                      const org = selectedOrganizations[index];
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
                                )
                              : (
                                  <div className="h-44" aria-hidden />
                                )}
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
                              <p className="text-xs opacity-70 mt-0.5 truncate">{data?.platform_certificate?.signatory_name || 'Name'}</p>
                              <p className="text-[11px] opacity-60 truncate">
                                {data?.platform_certificate?.signatory_position || 'Title'}
                              </p>
                            </div>
                            <div className="certificate-meta text-right text-base ml-auto">
                              <p className="text-neutral-700 text-sm">
                                Generated:
                                {' '}
                                {certificateGeneratedAt.toLocaleDateString()}
                              </p>
                              <p className="mt-1 ml-auto w-[560px] max-w-full text-[14px] leading-tight flex items-baseline justify-end gap-1 text-neutral-500">
                                <span className="whitespace-nowrap font-semibold">Verification Token:</span>
                                <span className="certificate-token-value whitespace-nowrap font-mono tracking-tight">
                                  {verificationToken ?? 'Pending'}
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}

export default VolunteerCertificateRequest;
