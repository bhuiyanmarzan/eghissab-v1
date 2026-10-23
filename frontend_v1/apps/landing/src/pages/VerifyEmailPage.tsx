import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Card, CardHeader, CardContent, Input, Label, Badge } from '@eghissab/ui';
import { verifyEmail, resendVerification, getApiError } from '@eghissab/api';
import { Building2, CheckCircle2, RotateCw } from 'lucide-react';

const verifySchema = z.object({
  token: z.string().trim().min(6, 'Verification code must be at least 6 characters'),
});

type VerifyFormValues = z.infer<typeof verifySchema>;

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
  });

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const onSubmit = async (values: VerifyFormValues) => {
    setServerError(null);
    setLoading(true);
    try {
      await verifyEmail({ token: values.token });
      setSuccessMessage('Email verified successfully! Redirecting to sign in...');
      setTimeout(() => navigate('/auth/login'), 2000);
    } catch (err: unknown) {
      const errorData = getApiError(err);
      if (errorData) {
        setServerError(errorData.message || 'Invalid or expired verification token.');
      } else {
        setServerError('Unable to reach verification service.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!emailParam || cooldown > 0) return;
    setServerError(null);
    try {
      await resendVerification({ email: emailParam });
      setSuccessMessage('A new verification code has been dispatched to your email.');
      setCooldown(60);
    } catch (err: unknown) {
      const errorData = getApiError(err);
      if (errorData) {
        setServerError(errorData.message || 'Failed to resend verification code.');
      } else {
        setServerError('Failed to resend code.');
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-white font-bold shadow-sm">
              <Building2 className="size-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-ink">EGHissab</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Verify your email</h1>
          <p className="text-sm text-muted mt-1">
            {emailParam ? (
              <>We sent a verification code to <span className="font-semibold text-ink">{emailParam}</span></>
            ) : (
              'Enter the verification code sent to your email address'
            )}
          </p>
        </div>

        <Card>
          <CardHeader
            title="Email Verification"
            action={<Badge tone="amber">Pending Verification</Badge>}
          />
          <CardContent className="space-y-4 pt-4">
            {serverError && (
              <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                {serverError}
              </div>
            )}

            {successMessage && (
              <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-xs text-success">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="token">Verification Code / Token</Label>
                <Input
                  id="token"
                  placeholder="Enter 6-digit code or token"
                  autoComplete="one-time-code"
                  {...register('token')}
                />
                {errors.token && (
                  <p className="mt-1 text-xs text-danger">{errors.token.message}</p>
                )}
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Verifying...' : 'Verify Email'}
              </Button>
            </form>

            {emailParam && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline disabled:text-muted disabled:no-underline"
                >
                  <RotateCw className={`size-3.5 ${cooldown > 0 ? 'animate-spin' : ''}`} />
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend verification code'}
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted">
          Return to{' '}
          <Link to="/auth/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
