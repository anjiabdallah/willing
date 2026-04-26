import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, FileSearch, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import Button from '../components/Button';
import Card from '../components/Card';
import CertificatePreview from '../components/certificates/CertificatePreview';
import {
  CERTIFICATE_PREVIEW_HEIGHT,
  CERTIFICATE_PREVIEW_WIDTH,
  getCertificatePreviewStyles,
} from '../components/certificates/certificatePreview.constants';
import Footer from '../components/layout/Footer';
import UserNavbar from '../components/layout/navbars/UserNavbar';
import PageContainer from '../components/layout/PageContainer';
import PageHeader from '../components/layout/PageHeader';
import { executeAndShowError, FormField, FormRootError } from '../utils/formUtils';
import requestServer from '../utils/requestServer';

import type { PublicCertificateVerificationResponse } from '../../../server/src/api/types';

const verificationSchema = z.object({
  token: z.string().trim().min(1, 'Certificate token is required.').max(512, 'Certificate token is too long.'),
});

type VerificationFormData = z.infer<typeof verificationSchema>;
const CERTIFICATE_PREVIEW_ID = 'certificate-preview-verify';

function CertificateVerification() {
  const [result, setResult] = useState<PublicCertificateVerificationResponse | null>(null);
  const [verifiedToken, setVerifiedToken] = useState<string>('');
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const [certificateScale, setCertificateScale] = useState(1);

  const form = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
    mode: 'onTouched',
    defaultValues: {
      token: '',
    },
  });

  const onVerify = form.handleSubmit(async (data) => {
    setResult(null);
    await executeAndShowError(form, async () => {
      const response = await requestServer<PublicCertificateVerificationResponse>(
        '/public/certificate/verify',
        {
          method: 'POST',
          body: {
            token: data.token.trim(),
          },
        },
      );
      setResult(response);
      setVerifiedToken(data.token.trim());
    });
  });

  useEffect(() => {
    const viewportElement = previewViewportRef.current;
    if (!viewportElement || !result?.valid) return undefined;

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
  }, [result?.valid]);

  return (
    <div className="min-h-screen flex flex-col bg-base-100">
      <UserNavbar />
      <PageContainer>
        <style>
          {getCertificatePreviewStyles(CERTIFICATE_PREVIEW_ID, false)}
        </style>

        <PageHeader
          title="Verify Certificate"
          subtitle="Enter a certificate verification token to validate authenticity."
          icon={FileSearch}
          showBack
          defaultBackTo="/"
        />

        <Card>
          <form onSubmit={onVerify} className="space-y-4">
            <FormField
              form={form}
              name="token"
              label="Verification Token"
              placeholder="Paste certificate token"
            />
            <FormRootError form={form} />
            <Button type="submit" color="primary" Icon={FileSearch}>
              Verify Certificate
            </Button>
          </form>
        </Card>

        {result && (
          <Card
            title={result.valid ? 'Certificate is valid' : 'Certificate is invalid'}
            Icon={result.valid ? CheckCircle2 : ShieldAlert}
          >
            <p className={result.valid ? 'text-success' : 'text-error'}>
              {result.message}
            </p>
            {result.valid && result.issued_at && (
              <p className="mt-2 text-sm opacity-70">
                Issued at:
                {' '}
                {new Date(result.issued_at).toLocaleString()}
              </p>
            )}
            {result.valid && result.volunteer_name && (
              <p className="mt-2 text-sm">
                Volunteer:
                {' '}
                <span className="font-semibold">{result.volunteer_name}</span>
              </p>
            )}
            {result.valid && typeof result.total_hours === 'number' && (
              <p className="mt-1 text-sm">
                Total Hours:
                {' '}
                <span className="font-semibold">{Math.floor(result.total_hours)}</span>
              </p>
            )}
            {result.valid && result.organizations && result.organizations.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-semibold">Hours by Organization</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {result.organizations.map(organization => (
                    <li key={organization.id}>
                      {organization.name}
                      {': '}
                      <span className="font-semibold">{organization.hours}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}

        {result?.valid && (
          <Card title="Regenerated Certificate">
            <div ref={previewViewportRef} className="w-full certificate-preview-viewport overflow-hidden">
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
                  <CertificatePreview
                    previewId={CERTIFICATE_PREVIEW_ID}
                    volunteerName={result.volunteer_name ?? 'Volunteer'}
                    totalHours={result.total_hours ?? 0}
                    organizations={result.organizations ?? []}
                    platformCertificate={result.platform_certificate ?? null}
                    generatedAtLabel={result.issued_at ? new Date(result.issued_at).toLocaleDateString() : '-'}
                    verificationToken={verifiedToken}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}
      </PageContainer>
      <Footer />
    </div>
  );
}

export default CertificateVerification;
