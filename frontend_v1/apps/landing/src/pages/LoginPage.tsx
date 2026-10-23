import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Card, CardHeader, CardContent, Input, Label, Badge } from '@eghissab/ui';
import { loginUser, getCurrentUser, getApiError } from '@eghissab/api';
import { useAuthStore, redirectToPortal, type PortalTarget } from '@eghissab/auth';
import { Building2, Lock, Mail, ArrowRight } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const fromUrl = searchParams.get('from');
  const [selectedTarget, setSelectedTarget] = useState<PortalTarget>('merchant');
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    setLoading(true);
    try {
      const response = await loginUser(values);
      // Fetch full profile if needed or set with token
      const profile = await getCurrentUser().catch(() => ({
        id: 'me',
        email: values.email,
        first_name: 'User',
        last_name: '',
        status: 'active',
      }));

      setAuth(profile, response.access_token);

      // Execute Subdomain Redirect Strategy
      if (fromUrl) {
        window.location.href = fromUrl;
      } else {
        redirectToPortal(selectedTarget);
      }
    } catch (err: unknown) {
      const errorData = getApiError(err);
      if (errorData) {
        if (errorData.field) {
          setError(errorData.field as keyof LoginFormValues, {
            message: errorData.message,
          });
        } else {
          setServerError(errorData.message || 'Invalid email or password. Please try again.');
        }
      } else {
        setServerError('Unable to reach authentication server. Please check your network.');
      }
    } finally {
      setLoading(false);
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
          <h1 className="text-2xl font-bold tracking-tight text-ink">Sign in to your account</h1>
          <p className="text-sm text-muted mt-1">
            Access your merchant operations, consumer receipts, or admin portal
          </p>
        </div>

        <Card>
          <CardHeader
            title="Account Credentials"
            action={<Badge tone="blue">Secure Session</Badge>}
          />
          <CardContent className="space-y-4 pt-4">
            {serverError && (
              <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    autoComplete="email"
                    {...register('email')}
                  />
                  <Mail className="absolute right-3 top-2.5 size-4 text-muted pointer-events-none" />
                </div>
                {errors.email && (
                  <p className="mt-1 text-xs text-danger">{errors.email.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...register('password')}
                  />
                  <Lock className="absolute right-3 top-2.5 size-4 text-muted pointer-events-none" />
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
                )}
              </div>

              {/* Subdomain Destination Selector */}
              {!fromUrl && (
                <div>
                  <Label>Redirect to Portal</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'merchant', label: 'Merchant', domain: 'app.' },
                      { id: 'consumer', label: 'Consumer', domain: 'me.' },
                      { id: 'admin', label: 'Admin', domain: 'admin.' },
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        onClick={() => setSelectedTarget(opt.id as PortalTarget)}
                        className={`rounded-md border px-2 py-2 text-center text-xs transition-colors ${
                          selectedTarget === opt.id
                            ? 'border-primary bg-primary-soft text-primary font-semibold'
                            : 'border-border bg-surface text-ink hover:bg-subtle'
                        }`}
                      >
                        <div>{opt.label}</div>
                        <div className="text-[10px] text-muted">{opt.domain}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full gap-2">
                {loading ? 'Authenticating...' : 'Sign In'} <ArrowRight className="size-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted space-y-2">
          <p>
            Don&apos;t have an account?{' '}
            <Link to="/auth/register" className="font-semibold text-primary hover:underline">
              Create account
            </Link>
          </p>
          <p>
            Need to verify email?{' '}
            <Link to="/auth/verify" className="font-semibold text-primary hover:underline">
              Enter verification code
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
