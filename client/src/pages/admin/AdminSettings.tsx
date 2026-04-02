import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Save, Signature, UserRound } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { newPlatformCertificateSettingsSchema } from '../../../../server/src/db/tables';
import Alert from '../../components/Alert';
import Card from '../../components/Card';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import Loading from '../../components/Loading';
import PasswordResetCard from '../../components/PasswordResetCard';
import SignatureUploadField from '../../components/SignatureUploadField';
import useNotifications from '../../notifications/useNotifications';
import { executeAndShowError, FormField, FormRootError } from '../../utils/formUtils';
import requestServer, { SERVER_BASE_URL } from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type {
  AdminCertificateSettingsDeleteSignatureResponse,
  AdminCertificateSettingsGetResponse,
  AdminCertificateSettingsUpdateResponse,
  AdminCertificateSettingsUploadSignatureResponse,
} from '../../../../server/src/api/types';

const certificateSettingsFormSchema = newPlatformCertificateSettingsSchema.pick({
  signatory_name: true,
  signatory_position: true,
}).transform(value => ({
  signatory_name: value.signatory_name ?? '',
  signatory_position: value.signatory_position ?? '',
}));

function AdminSettings() {
  const notifications = useNotifications();
  const [signatureBusy, setSignatureBusy] = useState(false);
  const [signatureVersion, setSignatureVersion] = useState(0);
  const [settings, setSettings] = useState<AdminCertificateSettingsGetResponse['settings']>(null);

  const form = useForm({
    resolver: zodResolver(certificateSettingsFormSchema),
    defaultValues: {
      signatory_name: '',
      signatory_position: '',
    },
    mode: 'onTouched',
  });

  const loadSettings = useCallback(async () => {
    const response = await requestServer<AdminCertificateSettingsGetResponse>('/admin/certificate-settings', {
      includeJwt: true,
    });

    setSettings(response.settings);
    form.reset({
      signatory_name: response.settings?.signatory_name ?? '',
      signatory_position: response.settings?.signatory_position ?? '',
    });

    return response;
  }, [form]);

  const {
    loading,
    error,
    trigger,
  } = useAsync(loadSettings, { immediate: true });

  const signatureUrl = useMemo(() => {
    if (!settings?.signature_path) return null;
    return `${SERVER_BASE_URL}/public/certificate-signature?v=${signatureVersion}`;
  }, [settings?.signature_path, signatureVersion]);

  const saveTextSettings = form.handleSubmit(async (values) => {
    await executeAndShowError(form, async () => {
      const response = await requestServer<AdminCertificateSettingsUpdateResponse>('/admin/certificate-settings', {
        method: 'PUT',
        includeJwt: true,
        body: {
          signatory_name: values.signatory_name.trim() || null,
          signatory_position: values.signatory_position.trim() || null,
        },
      });

      setSettings(response.settings);
      form.reset({
        signatory_name: response.settings.signatory_name ?? '',
        signatory_position: response.settings.signatory_position ?? '',
      });
      notifications.push({ type: 'success', message: 'Certificate signatory settings saved.' });
      setSignatureVersion(prev => prev + 1);
    });
  });

  const uploadSignatureFile = async (file: File) => {
    try {
      setSignatureBusy(true);
      const body = new FormData();
      body.append('signature', file);

      const response = await requestServer<AdminCertificateSettingsUploadSignatureResponse>(
        '/admin/certificate-settings/upload-signature',
        {
          method: 'POST',
          includeJwt: true,
          body,
        },
      );

      setSettings(response.settings);
      setSignatureVersion(prev => prev + 1);
      notifications.push({ type: 'success', message: 'Platform signature uploaded.' });
    } catch (error) {
      notifications.push({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload signature',
      });
    } finally {
      setSignatureBusy(false);
    }
  };

  const deleteSignature = async () => {
    try {
      setSignatureBusy(true);
      await requestServer<AdminCertificateSettingsDeleteSignatureResponse>('/admin/certificate-settings/signature', {
        method: 'DELETE',
        includeJwt: true,
      });
      setSettings(prev => prev ? { ...prev, signature_path: null } : prev);
      setSignatureVersion(prev => prev + 1);
      notifications.push({ type: 'success', message: 'Platform signature removed.' });
    } catch (error) {
      notifications.push({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to remove signature',
      });
    } finally {
      setSignatureBusy(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        subtitle="Manage admin security and platform certificate signatory settings."
        icon={Lock}
      />

      {loading && (
        <div className="flex justify-center mt-8">
          <Loading size="xl" />
        </div>
      )}

      {error && (
        <div>
          <Alert color="error">
            {error.message || 'Failed to load settings.'}
          </Alert>
          <button className="btn btn-outline mt-3" onClick={() => { void trigger(); }}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <PasswordResetCard />

          <Card
            title="Website Certificate Signatory"
            description="These values appear on all newly generated volunteer certificates."
            Icon={Signature}
          >
            <FormRootError form={form} />

            <div className="grid gap-4 mt-2">
              <FormField form={form} name="signatory_name" label="Signatory Name" Icon={UserRound} />
              <FormField form={form} name="signatory_position" label="Signatory Position" Icon={Signature} />

              <div>
                <label className="text-sm font-medium mb-2 block">Signature Image</label>
                <SignatureUploadField
                  busy={signatureBusy}
                  hasSignature={Boolean(settings?.signature_path)}
                  previewUrl={signatureUrl}
                  emptyMessage="No platform signature uploaded yet."
                  uploadLabel="Upload Signature"
                  drawLabel="Draw Signature"
                  fileNamePrefix="platform-signature-drawn"
                  onUploadFile={uploadSignatureFile}
                  onDelete={deleteSignature}
                  onError={message => notifications.push({ type: 'error', message })}
                />
              </div>

              <div>
                <button
                  type="button"
                  className="btn btn-primary gap-2"
                  onClick={saveTextSettings}
                  disabled={form.formState.isSubmitting || signatureBusy}
                >
                  <Save size={14} />
                  {form.formState.isSubmitting ? 'Saving...' : 'Save Signatory Settings'}
                </button>
              </div>
            </div>
          </Card>
        </>
      )}
    </PageContainer>
  );
}

export default AdminSettings;
