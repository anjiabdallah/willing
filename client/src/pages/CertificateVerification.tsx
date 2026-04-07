import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, FileSearch, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import Button from '../components/Button';
import Card from '../components/Card';
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

function CertificateVerification() {
  const [result, setResult] = useState<PublicCertificateVerificationResponse | null>(null);

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
    });
  });

  return (
    <div className="min-h-screen flex flex-col bg-base-100">
      <UserNavbar />
      <PageContainer>
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
      </PageContainer>
      <Footer />
    </div>
  );
}

export default CertificateVerification;
