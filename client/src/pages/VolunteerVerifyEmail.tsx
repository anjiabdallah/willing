import { CheckCircle2, LoaderCircle, LogIn } from 'lucide-react';
import { useEffect, useState, useContext, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import AuthContext from '../auth/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';
import Hero from '../components/layout/Hero';
import LinkButton from '../components/LinkButton';
import useNotifications from '../notifications/useNotifications';
import { forgotPasswordRequestSchema } from '../schemas/auth';
import useAsync from '../utils/useAsync';

export default function VolunteerVerifyEmail() {
  const [searchParams] = useSearchParams();
  const verificationKey = (searchParams.get('key') ?? '').trim();
  const initialEmail = (searchParams.get('email') ?? '').trim();
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const notifications = useNotifications();
  const [resendEmail, setResendEmail] = useState(initialEmail);
  const hasAttemptedRef = useRef(false);

  const {
    loading,
    error,
    trigger,
  } = useAsync(async () => auth.verifyVolunteerEmail(verificationKey), {
    notifyOnError: false,
  });

  const {
    loading: resendLoading,
    trigger: triggerResend,
  } = useAsync(async (email: string) => auth.resendVolunteerVerification(email), {
    notifyOnError: false,
  });

  useEffect(() => {
    if (!verificationKey || hasAttemptedRef.current) {
      return;
    }

    hasAttemptedRef.current = true;

    trigger()
      .then(() => {
        navigate('/volunteer', { replace: true });
      })
      .catch(() => {});
  }, [verificationKey, trigger, notifications, navigate]);

  if (!verificationKey) {
    return (
      <Hero>
        <Card>
          <h2 className="font-bold text-2xl text-center">Invalid verification link</h2>
          <p className="opacity-80">
            This email verification link is missing a token. Please use the latest link from your email.
          </p>
          <LinkButton color="primary" className="mx-auto" to="/login" Icon={LogIn} layout="wide">
            Back to login
          </LinkButton>
        </Card>
      </Hero>
    );
  }

  if (loading) {
    return (
      <Hero>
        <Card>
          <h2 className="font-bold text-2xl text-center">Verifying your email</h2>
          <p className="opacity-80 text-center">
            Please wait while we activate your volunteer account.
          </p>
          <div className="flex justify-center">
            <LoaderCircle className="animate-spin" size={28} />
          </div>
        </Card>
      </Hero>
    );
  }

  if (error) {
    return (
      <Hero>
        <Card>
          <h2 className="font-bold text-2xl text-center">Email verification failed</h2>
          <p className="opacity-80 text-center text-error">{error.message}</p>
          <div className="form-control w-full max-w-md mx-auto mt-4">
            <label className="label mb-2" htmlFor="resend-verification-email">
              <span className="label-text">Need a new link? Enter your email</span>
            </label>
            <input
              id="resend-verification-email"
              type="email"
              className="input input-bordered w-full mt-2"
              placeholder="name@example.com"
              value={resendEmail}
              onChange={event => setResendEmail(event.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-center">
            <Button
              color="secondary"
              type="button"
              loading={resendLoading}
              disabled={resendLoading}
              onClick={() => {
                const email = resendEmail.trim().toLowerCase();
                if (!email) {
                  notifications.push({
                    type: 'warning',
                    message: 'Please enter your email to resend verification.',
                  });
                  return;
                }

                const validation = forgotPasswordRequestSchema.safeParse({ email });
                if (!validation.success) {
                  notifications.push({
                    type: 'warning',
                    message: validation.error.issues[0]?.message ?? 'Please enter a valid email address.',
                  });
                  return;
                }

                triggerResend(email)
                  .then(() => {
                    notifications.push({
                      type: 'success',
                      message: 'A new verification link has been sent.',
                    });
                  })
                  .catch((err) => {
                    notifications.push({
                      type: 'error',
                      message: err instanceof Error ? err.message : 'Failed to resend verification email.',
                    });
                  });
              }}
            >
              Resend link
            </Button>
            <LinkButton color="ghost" to="/login" Icon={LogIn}>
              Back to login
            </LinkButton>
          </div>
        </Card>
      </Hero>
    );
  }

  return (
    <Hero>
      <Card>
        <h2 className="font-bold text-2xl text-center">Email verified</h2>
        <p className="opacity-80 text-center">Redirecting you to your volunteer dashboard...</p>
        <div className="flex justify-center">
          <CheckCircle2 size={28} />
        </div>
      </Card>
    </Hero>
  );
}
