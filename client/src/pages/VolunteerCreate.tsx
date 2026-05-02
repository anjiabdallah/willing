import { zodResolver } from '@hookform/resolvers/zod';
import {
  User,
  Mail,
  LockKeyhole,
  UserCircle,
  UserPlus,
  CheckCircle2,
  LogIn,
  RotateCcw,
} from 'lucide-react';
import { useContext, useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';

import AuthContext from '../auth/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';
import Hero from '../components/layout/Hero';
import LinkButton from '../components/LinkButton';
import useNotifications from '../notifications/useNotifications';
import { volunteerSignupSchema, type VolunteerSignupFormData } from '../schemas/volunteer';
import { executeAndShowError, FormField, FormRootError } from '../utils/formUtils';
import useAsync from '../utils/useAsync';

export default function VolunteerCreate() {
  const auth = useContext(AuthContext);
  const { push } = useNotifications();
  const [emailSent, setEmailSent] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');

  const {
    loading: resendLoading,
    trigger: triggerResend,
  } = useAsync(async () => auth.resendVolunteerVerification(pendingVerificationEmail), {
    notifyOnError: false,
  });

  const form = useForm<VolunteerSignupFormData>({
    resolver: zodResolver(volunteerSignupSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      confirmPassword: '',
      date_of_birth: '',
      gender: 'male',
    },
  });

  const passwordValue = useWatch({ control: form.control, name: 'password' });
  const confirmPasswordValue = useWatch({ control: form.control, name: 'confirmPassword' });
  useEffect(() => {
    if (!confirmPasswordValue) return;
    void form.trigger('confirmPassword');
  }, [confirmPasswordValue, form, passwordValue]);

  const handleSubmit = form.handleSubmit(async (data) => {
    await executeAndShowError(form, async () => {
      const { confirmPassword: _, ...volunteerData } = data;
      const response = await auth.createVolunteer(volunteerData);

      if (response.requires_email_verification) {
        setPendingVerificationEmail(volunteerData.email);
        setEmailSent(true);
        push({
          type: 'success',
          message: 'Verification email sent. Please check your inbox before logging in.',
        });
      }
    });
  });

  if (emailSent) {
    return (
      <Hero>
        <Card>
          <h2 className="font-bold text-2xl text-center">Check your email</h2>
          <p className="opacity-80">
            We sent you a verification link. Please confirm your email to activate your volunteer account.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <LinkButton
              color="primary"
              to="/login"
              Icon={LogIn}
            >
              Go to login
            </LinkButton>
            <Button
              color="secondary"
              style="outline"
              type="button"
              loading={resendLoading}
              disabled={!pendingVerificationEmail || resendLoading}
              Icon={RotateCcw}
              onClick={() => {
                triggerResend()
                  .then(() => {
                    push({
                      type: 'success',
                      message: 'If your account is still pending verification, a new link has been sent.',
                    });
                  })
                  .catch((error) => {
                    push({
                      type: 'error',
                      message: error instanceof Error ? error.message : 'Failed to resend verification email.',
                    });
                  });
              }}
            >
              Resend verification email
            </Button>
          </div>
        </Card>
      </Hero>
    );
  }

  return (
    <Hero
      title="Volunteer Registration"
      description="Fill out the form to register as a volunteer."
    >
      <Card>
        <form onSubmit={handleSubmit}>
          <div className="flex gap-4">
            <div className="flex-1">
              <FormField
                form={form}
                label="First Name"
                name="first_name"
                type="text"
                Icon={User}
              />
            </div>
            <div className="flex-1">
              <FormField
                form={form}
                label="Last Name"
                name="last_name"
                type="text"
                Icon={User}
              />
            </div>
          </div>

          <FormField
            form={form}
            label="Email"
            name="email"
            type="email"
            Icon={Mail}
          />

          <FormField
            form={form}
            label="Password"
            name="password"
            type="password"
            Icon={LockKeyhole}
          />

          <FormField
            form={form}
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            Icon={CheckCircle2}
          />

          <div className="flex gap-4">
            <div className="flex-1">
              <FormField
                form={form}
                label="Date of Birth"
                name="date_of_birth"
                type="date"
              />
            </div>
            <div className="flex-1">
              <div className="flex-1">
                <FormField
                  form={form}
                  label="Gender"
                  name="gender"
                  Icon={UserCircle}
                  selectOptions={[
                    { label: 'Male', value: 'male' },
                    { label: 'Female', value: 'female' },
                    { label: 'Other', value: 'other' },
                  ]}
                />
              </div>
            </div>
          </div>

          <FormRootError form={form} />

          <Button
            type="submit"
            color="primary"
            layout="block"
            loading={form.formState.isSubmitting}
            Icon={UserPlus}
            className="mt-4"
          >
            Register
          </Button>

          <div className="text-center mt-4">
            <span className="text-sm">
              Already have an account?
              {' '}
              <Link to="/login" className="link link-primary">
                Log in
              </Link>
            </span>
          </div>
        </form>
      </Card>
    </Hero>
  );
}
