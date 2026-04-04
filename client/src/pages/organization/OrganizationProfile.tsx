import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Globe, ImageUp, Mail, MapPin, Phone, ShieldCheck, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { newOrganizationCertificateInfoSchema, organizationAccountSchema } from '../../../../server/src/db/tables';
import { useOrganization } from '../../auth/useUsers';
import Alert from '../../components/Alert';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ColumnLayout from '../../components/layout/ColumnLayout';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import Loading from '../../components/Loading';
import LocationPicker from '../../components/LocationPicker';
import OrganizationProfilePicture from '../../components/OrganizationProfilePicture';
import SignatureUploadField from '../../components/SignatureUploadField';
import { ToggleButton } from '../../components/ToggleButton';
import useNotifications from '../../notifications/useNotifications';
import { executeAndShowError, FormField, FormRootError } from '../../utils/formUtils';
import requestServer, { SERVER_BASE_URL } from '../../utils/requestServer';

import type {
  DeleteCertificateSignatureResponse,
  GetCertificateInfoResponse,
  OrganizationDeleteLogoResponse,
  OrganizationGetMeResponse,
  OrganizationUploadLogoResponse,
  UpdateCertificateInfoResponse,
  UploadCertificateSignatureResponse,
} from '../../../../server/src/api/types';

const ORG_DESCRIPTION_MAX_LENGTH = 300;

const profileFormSchema = organizationAccountSchema.omit({
  id: true,
  password: true,
  email: true,
  name: true,
  url: true,
  org_vector: true,
  token_version: true,
  is_disabled: true,
  is_deleted: true,
  created_at: true,
  updated_at: true,
});

const certificateFormSchema = newOrganizationCertificateInfoSchema.pick({
  certificate_feature_enabled: true,
  signatory_name: true,
  signatory_position: true,
}).extend({
  hours_threshold: z.preprocess(
    (value) => {
      if (value === '' || value === null || value === undefined) return null;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? value : parsed;
      }
      return value;
    },
    z.number().int().min(0, 'Hours threshold must be >= 0').nullable(),
  ),
  hasLogo: z.boolean(),
  hasSignature: z.boolean(),
}).superRefine((data, ctx) => {
  if (!data.certificate_feature_enabled) return;

  if (!data.hasLogo) {
    ctx.addIssue({
      code: 'custom',
      path: ['certificate_feature_enabled'],
      message: 'Organization profile picture is required to enable certificates.',
    });
  }
  if (data.hours_threshold === null) {
    ctx.addIssue({
      code: 'custom',
      path: ['hours_threshold'],
      message: 'Minimum volunteer hours are required when certificate feature is enabled.',
    });
  }
  if (!data.signatory_name?.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['signatory_name'],
      message: 'Signatory name is required when certificate feature is enabled.',
    });
  }
  if (!data.signatory_position?.trim()) {
    ctx.addIssue({
      code: 'custom',
      path: ['signatory_position'],
      message: 'Signatory position is required when certificate feature is enabled.',
    });
  }
  if (!data.hasSignature) {
    ctx.addIssue({
      code: 'custom',
      path: ['hasSignature'],
      message: 'Signature image is required when certificate feature is enabled.',
    });
  }
});

function OrganizationProfile() {
  const organizationFromAuth = useOrganization();
  const notifications = useNotifications();
  const [profile, setProfile] = useState<OrganizationGetMeResponse | null>(null);
  const [certificateInfo, setCertificateInfo] = useState<GetCertificateInfoResponse['certificateInfo']>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [position, setPosition] = useState<[number, number]>([33.90192863620578, 35.477959277880416]);
  const [logoBusy, setLogoBusy] = useState(false);
  const [signatureBusy, setSignatureBusy] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm({
    resolver: zodResolver(profileFormSchema),
    mode: 'onTouched',
    defaultValues: {
      phone_number: '',
      description: '',
      location_name: '',
      latitude: undefined,
      longitude: undefined,
    },
  });

  const certificateForm = useForm({
    resolver: zodResolver(certificateFormSchema),
    mode: 'onTouched',
    defaultValues: {
      certificate_feature_enabled: false,
      hours_threshold: null,
      signatory_name: '',
      signatory_position: '',
      hasLogo: false,
      hasSignature: false,
    },
  });

  const resetFormsFromData = useCallback((
    organizationResponse: OrganizationGetMeResponse,
    certificateInfoResponse: GetCertificateInfoResponse['certificateInfo'],
  ) => {
    form.reset({
      phone_number: organizationResponse.organization.phone_number,
      description: organizationResponse.organization.description ?? '',
      location_name: organizationResponse.organization.location_name,
      latitude: organizationResponse.organization.latitude,
      longitude: organizationResponse.organization.longitude,
    });
    certificateForm.reset({
      certificate_feature_enabled: certificateInfoResponse?.certificate_feature_enabled ?? false,
      hours_threshold: certificateInfoResponse?.hours_threshold ?? null,
      signatory_name: certificateInfoResponse?.signatory_name ?? '',
      signatory_position: certificateInfoResponse?.signatory_position ?? '',
      hasLogo: Boolean(organizationResponse.organization.logo_path),
      hasSignature: Boolean(certificateInfoResponse?.signature_path),
    });
    setPosition([
      organizationResponse.organization.latitude ?? 33.90192863620578,
      organizationResponse.organization.longitude ?? 35.477959277880416,
    ]);
  }, [form, certificateForm]);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);

      const [organizationResponse, certificateResponse] = await Promise.all([
        requestServer<OrganizationGetMeResponse>('/organization/me', { includeJwt: true }),
        requestServer<GetCertificateInfoResponse>('/organization/certificate-info', { includeJwt: true }),
      ]);

      setProfile(organizationResponse);
      setCertificateInfo(certificateResponse.certificateInfo);
      resetFormsFromData(organizationResponse, certificateResponse.certificateInfo);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load organization profile';
      setFetchError(message);
    } finally {
      setLoading(false);
    }
  }, [resetFormsFromData]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const formValues = form.watch();
  const certificateValues = certificateForm.watch();

  const signatureUrl = useMemo(() => {
    if (!profile || !certificateInfo?.signature_path) return '';
    return `${SERVER_BASE_URL}/organization/${profile.organization.id}/signature?v=${encodeURIComponent(certificateInfo.signature_path)}`;
  }, [certificateInfo?.signature_path, profile]);

  const onMapPositionPick = useCallback((coords: [number, number], name?: string) => {
    setPosition(coords);
    form.setValue('latitude', coords[0]);
    form.setValue('longitude', coords[1]);

    if (name && !form.getFieldState('location_name').isDirty) {
      form.setValue('location_name', name);
    }
  }, [form]);

  const onUploadLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLogoBusy(true);
      const formData = new FormData();
      formData.append('logo', file);

      const response = await requestServer<OrganizationUploadLogoResponse>(
        '/organization/logo',
        {
          method: 'POST',
          body: formData,
          includeJwt: true,
        },
      );

      setProfile(response);
      certificateForm.setValue('hasLogo', true, { shouldValidate: true });
      notifications.push({ type: 'success', message: 'Profile picture uploaded.' });
    } catch (error) {
      notifications.push({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload profile picture',
      });
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const onDeleteLogo = async () => {
    try {
      setLogoBusy(true);

      // If the organization disabled certificates in edit mode but didn't save yet,
      // persist the disable first so logo deletion can proceed immediately.
      if (certificateInfo?.certificate_feature_enabled && !certificateForm.getValues('certificate_feature_enabled')) {
        const certificateResponse = await requestServer<UpdateCertificateInfoResponse>(
          '/organization/certificate-info',
          {
            method: 'PUT',
            body: { certificate_feature_enabled: false },
            includeJwt: true,
          },
        );
        setCertificateInfo(certificateResponse.certificateInfo);
      }

      const response = await requestServer<OrganizationDeleteLogoResponse>(
        '/organization/logo',
        {
          method: 'DELETE',
          includeJwt: true,
        },
      );

      setProfile(response);
      certificateForm.setValue('hasLogo', false, { shouldValidate: true });
      notifications.push({ type: 'success', message: 'Profile picture removed.' });
    } catch (error) {
      notifications.push({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to remove profile picture',
      });
    } finally {
      setLogoBusy(false);
    }
  };

  const uploadSignatureFile = async (file: File) => {
    try {
      setSignatureBusy(true);
      const formData = new FormData();
      formData.append('signature', file);

      const response = await requestServer<UploadCertificateSignatureResponse>(
        '/organization/certificate-info/upload-signature',
        {
          method: 'POST',
          body: formData,
          includeJwt: true,
        },
      );

      setCertificateInfo(response.certificateInfo);
      certificateForm.setValue('hasSignature', true, { shouldValidate: true });
      notifications.push({ type: 'success', message: 'Certificate signature uploaded.' });
    } catch (error) {
      notifications.push({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to upload signature',
      });
    } finally {
      setSignatureBusy(false);
    }
  };

  const onDeleteSignature = async () => {
    try {
      setSignatureBusy(true);

      await requestServer<DeleteCertificateSignatureResponse>(
        '/organization/certificate-info/signature',
        {
          method: 'DELETE',
          includeJwt: true,
        },
      );

      setCertificateInfo(prev => prev ? { ...prev, signature_path: null } : prev);
      certificateForm.setValue('hasSignature', false, { shouldValidate: true });
      notifications.push({ type: 'success', message: 'Certificate signature removed.' });
    } catch (error) {
      notifications.push({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to remove signature',
      });
    } finally {
      setSignatureBusy(false);
    }
  };

  const onSave = form.handleSubmit(async (profileData) => {
    if (!isEditMode) return;

    await executeAndShowError(form, async () => {
      const certificateIsValid = await certificateForm.trigger();
      if (!certificateIsValid) {
        const validationMessages = [
          certificateForm.formState.errors.certificate_feature_enabled?.message,
          certificateForm.formState.errors.hours_threshold?.message,
          certificateForm.formState.errors.signatory_name?.message,
          certificateForm.formState.errors.signatory_position?.message,
          certificateForm.formState.errors.hasSignature?.message,
        ]
          .filter((message): message is string => Boolean(message));

        throw new Error(validationMessages[0] ?? 'Please fix the certificate settings errors.');
      }

      const certificateData = certificateFormSchema.parse(certificateForm.getValues());

      try {
        setSaving(true);

        const [organizationResponse, certificateResponse] = await Promise.all([
          requestServer<OrganizationGetMeResponse>(
            '/organization/profile',
            {
              method: 'PUT',
              body: {
                phone_number: profileData.phone_number,
                description: profileData.description,
                location_name: profileData.location_name,
                latitude: profileData.latitude,
                longitude: profileData.longitude,
              },
              includeJwt: true,
            },
          ),
          requestServer<UpdateCertificateInfoResponse>(
            '/organization/certificate-info',
            {
              method: 'PUT',
              body: {
                certificate_feature_enabled: certificateData.certificate_feature_enabled,
                hours_threshold: certificateData.hours_threshold,
                signatory_name: certificateData.signatory_name?.trim() ? certificateData.signatory_name.trim() : null,
                signatory_position: certificateData.signatory_position?.trim() ? certificateData.signatory_position.trim() : null,
              },
              includeJwt: true,
            },
          ),
        ]);

        setProfile(organizationResponse);
        setCertificateInfo(certificateResponse.certificateInfo);
        resetFormsFromData(organizationResponse, certificateResponse.certificateInfo);
        setIsEditMode(false);
        notifications.push({ type: 'success', message: 'Profile changes saved.' });
      } catch (error) {
        notifications.push({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to save profile',
        });
      } finally {
        setSaving(false);
      }
    });
  });

  const onCancelEdit = useCallback(() => {
    if (!profile) return;
    resetFormsFromData(profile, certificateInfo);
    setIsEditMode(false);
    form.clearErrors();
    certificateForm.clearErrors();
  }, [certificateForm, certificateInfo, form, profile, resetFormsFromData]);

  if (loading) {
    return (
      <div className="grow bg-base-200">
        <div className="p-6 md:container mx-auto">
          <div className="flex justify-center mt-8">
            <Loading size="xl" />
          </div>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="grow bg-base-200">
        <div className="p-6 md:container mx-auto">
          <Alert color="error">
            {fetchError}
          </Alert>
          <button className="btn btn-outline mt-4" onClick={loadProfile}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="grow bg-base-200">
        <div className="p-6 md:container mx-auto">
          <Alert color="warning">
            Profile not found.
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Profile"
        subtitle="Manage your organization profile details."
        actions={(
          <>
            {isEditMode
              ? (
                  <Button color="primary" style="outline" onClick={onCancelEdit} loading={saving} Icon={X}>
                    Cancel
                  </Button>
                )
              : (
                  <button className="btn btn-outline" onClick={() => setIsEditMode(true)}>
                    Edit Profile
                  </button>
                )}
            {isEditMode && (
              <button className="btn btn-primary" onClick={onSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </>
        )}
      />

      <FormRootError form={form} />
      <FormRootError form={certificateForm} />

      <ColumnLayout
        sidebar={(
          <Card>
            <div className="flex items-center gap-4">
              <OrganizationProfilePicture
                organizationName={profile.organization.name || organizationFromAuth?.name || 'Organization'}
                organizationId={profile.organization.id!}
                logoPath={profile.organization.logo_path}
                size={80}
              />
              <div>
                <h4 className="text-xl font-bold">{profile.organization.name || organizationFromAuth?.name || 'Organization'}</h4>
                <span className="badge badge-primary badge-sm mt-1 gap-1">
                  <Building2 size={12} />
                  Organization
                </span>
              </div>
            </div>

            {isEditMode && (
              <div className="mt-4 flex flex-wrap gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={onUploadLogo}
                />
                <button
                  type="button"
                  className="btn btn-outline btn-sm gap-2"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoBusy || saving}
                >
                  <ImageUp size={14} />
                  {logoBusy ? 'Uploading...' : 'Upload Picture'}
                </button>
                {profile.organization.logo_path && (
                  <button
                    type="button"
                    className="btn btn-outline btn-error btn-sm gap-2"
                    onClick={onDeleteLogo}
                    disabled={logoBusy || saving}
                  >
                    <Trash2 size={14} />
                    Remove Picture
                  </button>
                )}
              </div>
            )}

            <div className="divider my-4" />

            {isEditMode
              ? (
                  <div className={`space-y-3 ${saving ? 'pointer-events-none opacity-70' : ''}`}>
                    <div className="rounded-box border border-base-300 p-3">
                      <p className="text-xs opacity-70">Organization Name</p>
                      <p className="font-semibold mt-1">{profile.organization.name || '-'}</p>
                    </div>
                    <div className="rounded-box border border-base-300 p-3">
                      <p className="text-xs opacity-70">Website</p>
                      <a href={profile.organization.url} target="_blank" rel="noreferrer" className="font-semibold mt-1 inline-flex items-center gap-2 text-primary break-all">
                        <Globe size={14} />
                        {profile.organization.url}
                      </a>
                    </div>
                    <FormField form={form} name="phone_number" label="Phone Number" Icon={Phone} />
                    <FormField form={form} name="location_name" label="Location Name" Icon={MapPin} />
                    <div>
                      <label className="text-sm font-medium mb-2 block">Description</label>
                      <textarea
                        id="organization-description"
                        className="textarea textarea-bordered w-full"
                        {...form.register('description')}
                        disabled={saving}
                        rows={5}
                        maxLength={ORG_DESCRIPTION_MAX_LENGTH}
                        placeholder="Describe your organization and impact."
                      />
                      <p className="text-xs opacity-60 mt-1 text-right">
                        {formValues.description?.length || 0}
                        /
                        {ORG_DESCRIPTION_MAX_LENGTH}
                      </p>
                    </div>
                  </div>
                )
              : (
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="opacity-70 flex items-center gap-2">
                        <Mail size={14} />
                        Email
                      </span>
                      <span className="font-medium text-right break-all">{profile.organization.email}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="opacity-70 flex items-center gap-2">
                        <Phone size={14} />
                        Phone
                      </span>
                      <span className="font-medium text-right">{formValues.phone_number || '-'}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="opacity-70 flex items-center gap-2">
                        <Globe size={14} />
                        Website
                      </span>
                      <a href={profile.organization.url} target="_blank" rel="noreferrer" className="font-medium text-right text-primary break-all hover:underline">
                        {profile.organization.url || '-'}
                      </a>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="opacity-70 flex items-center gap-2">
                        <MapPin size={14} />
                        Location
                      </span>
                      <span className="font-medium text-right">{formValues.location_name || '-'}</span>
                    </div>
                    <div className="pt-2">
                      <p className="opacity-70 mb-1">Description</p>
                      <p className="whitespace-pre-wrap wrap-break-word">{formValues.description?.trim() || 'No description added yet.'}</p>
                    </div>
                  </div>
                )}
          </Card>
        )}
      >
        <Card
          title="Location"
          description="Update your pinned location for volunteers."
          Icon={MapPin}
        >
          <LocationPicker
            position={position}
            setPosition={isEditMode ? onMapPositionPick : () => {}}
            readOnly={!isEditMode}
            className="h-72"
          />
        </Card>

        <Card
          title="Certificate Settings"
          description="Allow volunteers to include this organization on generated certificates."
          Icon={ShieldCheck}
        >

          {isEditMode
            ? (
                <div className={`mt-3 space-y-4 ${saving ? 'pointer-events-none opacity-70' : ''}`}>
                  <ToggleButton
                    form={certificateForm}
                    name="certificate_feature_enabled"
                    label="Enable Certificate Feature"
                    compact={true}
                    options={[
                      { value: true, label: 'Enabled', btnColor: 'btn-primary' },
                      { value: false, label: 'Disabled' },
                    ]}
                    disabled={saving}
                  />

                  {!profile.organization.logo_path && (
                    <Alert color="warning">
                      Upload organization profile picture before enabling this feature.
                    </Alert>
                  )}

                  {certificateValues.certificate_feature_enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        form={certificateForm}
                        name="hours_threshold"
                        label="Minimum Volunteer Hours (for certificate eligibility)"
                        type="number"
                        placeholder="Minimum Volunteer Hours (for certificate eligibility)"
                        registerOptions={{
                          onChange: () => certificateForm.clearErrors('root'),
                          setValueAs: (value) => {
                            if (value === '' || value === null || value === undefined) return null;
                            const parsed = Number(value);
                            if (!Number.isFinite(parsed)) return null;
                            return Math.trunc(parsed);
                          },
                        }}
                        inputProps={{
                          min: 0,
                          step: 1,
                        }}
                      />
                      <FormField
                        form={certificateForm}
                        name="signatory_name"
                        label="Signatory Name"
                      />
                      <FormField
                        form={certificateForm}
                        name="signatory_position"
                        label="Signatory Position"
                      />
                      <div className="space-y-2">
                        <label className="text-sm font-medium block">Signature</label>
                        <SignatureUploadField
                          busy={signatureBusy}
                          disabled={saving}
                          hasSignature={Boolean(certificateInfo?.signature_path)}
                          previewUrl={signatureUrl}
                          emptyMessage="No signature uploaded yet."
                          uploadLabel="Upload Signature"
                          drawLabel="Draw Signature"
                          fileNamePrefix="signature-drawn"
                          onUploadFile={uploadSignatureFile}
                          onDelete={onDeleteSignature}
                          onError={message => notifications.push({ type: 'error', message })}
                        />
                        {certificateForm.formState.errors.hasSignature?.message && (
                          <p className="text-xs text-error">{certificateForm.formState.errors.hasSignature.message}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            : (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="rounded-box border border-base-300 p-3">
                    <p className="opacity-70">Feature Status</p>
                    <p className="font-semibold mt-1">
                      {certificateInfo?.certificate_feature_enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div className="rounded-box border border-base-300 p-3">
                    <p className="opacity-70">Minimum Volunteer Hours</p>
                    <p className="font-semibold mt-1">{certificateInfo?.hours_threshold ?? '-'}</p>
                  </div>
                  <div className="rounded-box border border-base-300 p-3">
                    <p className="opacity-70">Signatory Name</p>
                    <p className="font-semibold mt-1">{certificateInfo?.signatory_name || '-'}</p>
                  </div>
                  <div className="rounded-box border border-base-300 p-3">
                    <p className="opacity-70">Signatory Position</p>
                    <p className="font-semibold mt-1">{certificateInfo?.signatory_position || '-'}</p>
                  </div>
                  <div className="rounded-box border border-base-300 p-3 md:col-span-2">
                    <p className="opacity-70">Signature</p>
                    {signatureUrl
                      ? (
                          <img
                            src={signatureUrl}
                            alt="Organization signature"
                            className="mt-2 h-14 w-auto object-contain"
                          />
                        )
                      : <p className="font-semibold mt-1">No signature uploaded</p>}
                  </div>
                </div>
              )}
        </Card>
      </ColumnLayout>
    </PageContainer>
  );
}

export default OrganizationProfile;
