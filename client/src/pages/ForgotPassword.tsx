import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, LockKeyhole, Mail, Send, LogIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router-dom';

import Button from '../components/Button';
import Card from '../components/Card';
import Hero from '../components/layout/Hero';
import LinkButton from '../components/LinkButton';
import {
  forgotPasswordRequestSchema,
  forgotPasswordResetSchema,
  type ForgotPasswordRequestFormData,
  type ForgotPasswordResetFormData,
} from '../schemas/auth';
import { executeAndShowError, FormField, FormRootError } from '../utils/formUtils';
import requestServer from '../utils/requestServer';

function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const resetKey = (searchParams.get('key') ?? '').trim();
  const [requestSent, setRequestSent] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  const requestForm = useForm<ForgotPasswordRequestFormData>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  const resetForm = useForm<ForgotPasswordResetFormData>({
    resolver: zodResolver(forgotPasswordResetSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  const resetPasswordValue = resetForm.watch('password');
  const resetConfirmValue = resetForm.watch('confirmPassword');
  useEffect(() => {
    if (!resetConfirmValue) return;
    void resetForm.trigger('confirmPassword');
  }, [resetConfirmValue, resetForm, resetPasswordValue]);

  const submitRequest = requestForm.handleSubmit(async (data) => {
    await executeAndShowError(requestForm, async () => {
      await requestServer('/user/forgot-password', {
        method: 'POST',
        body: { email: data.email },
      });
      setRequestSent(true);
    });
  });

  const submitReset = resetForm.handleSubmit(async (data) => {
    await executeAndShowError(resetForm, async () => {
      await requestServer('/user/forgot-password/reset', {
        method: 'POST',
        body: { key: resetKey, password: data.password },
      });
      setResetComplete(true);
      resetForm.reset();
    });
  });

  if (!resetKey && requestSent) {
    return (
      <Hero>
        <Card>
          <h2 className="font-bold text-2xl text-center">Check your email</h2>
          <p className="opacity-80">
            If an account exists with that email, we've sent you a password reset link. Check your inbox and follow the link to reset your password.
          </p>
          <LinkButton color="primary" className="mx-auto" to="/login" Icon={LogIn} layout="wide">
            Back to login
          </LinkButton>
        </Card>
      </Hero>
    );
  }

  if (resetKey && resetComplete) {
    return (
      <Hero>
        <Card>
          <h2 className="font-bold text-2xl text-center">Password reset successful</h2>
          <p className="opacity-80">
            Your password has been updated. You can now log in with your new password.
          </p>
          <LinkButton color="primary" className="mt-2" to="/login" Icon={LogIn} layout="wide">
            Go to login
          </LinkButton>
        </Card>
      </Hero>
    );
  }

  return (
    <Hero
      title="Forgot Password"
      description={resetKey
        ? 'Set a new password for your account to regain access.'
        : 'Enter your email address and we\'ll send you a link to reset your password.'}
    >
      <Card>
        <div className="w-full max-w-lg">
          {!resetKey
            ? (
                <form onSubmit={submitRequest}>
                  <FormField
                    form={requestForm}
                    label="Email"
                    name="email"
                    type="email"
                    Icon={Mail}
                  />

                  <FormRootError form={requestForm} />

                  <div className="card-actions justify-between items-center mt-4">
                    <Link to="/login" className="link link-hover">
                      Back to login
                    </Link>
                    <Button
                      color="primary"
                      type="submit"
                      loading={requestForm.formState.isSubmitting}
                      Icon={Send}
                    >
                      Send Link
                    </Button>
                  </div>
                </form>
              )
            : (
                <form onSubmit={submitReset}>
                  <FormField
                    form={resetForm}
                    label="New Password"
                    name="password"
                    type="password"
                    Icon={LockKeyhole}
                  />

                  <FormField
                    form={resetForm}
                    label="Confirm Password"
                    name="confirmPassword"
                    type="password"
                    Icon={CheckCircle}
                  />

                  <FormRootError form={resetForm} />

                  <div className="card-actions justify-between items-center mt-4">
                    <Link to="/login" className="link link-hover">
                      Back to login
                    </Link>
                    <Button
                      color="primary"
                      type="submit"
                      loading={resetForm.formState.isSubmitting}
                      Icon={CheckCircle}
                    >
                      Reset Password
                    </Button>
                  </div>
                </form>
              )}
        </div>
      </Card>
    </Hero>
  );
}

export default ForgotPasswordPage;
