import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Card, CardHeader, CardContent, Input, Label, Badge } from '@eghissab/ui';
import { registerUser, getApiError } from '@eghissab/api';
import { Building2, ArrowRight } from 'lucide-react';

const registerSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
    .regex(/[a-z]/, 'Password must include at least one lowercase letter')
    .regex(/[0-9]/, 'Password must include at least one digit'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError(null);
    setLoading(true);
    try {
      await registerUser(values);
      navigate(`/auth/verify?email=${encodeURIComponent(values.email)}`);
    } catch (err: unknown) {
      const errorData = getApiError(err);
      if (errorData) {
        if (errorData.field) {
          setError(errorData.field as keyof RegisterFormValues, {
            message: errorData.message,
          });
        } else {
          setServerError(errorData.message || 'Registration failed. Please review your details.');
        }
      } else {
        setServerError('Unable to reach registration service. Please try again later.');
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
          <h1 className="text-2xl font-bold tracking-tight text-ink">Create an account</h1>
          <p className="text-sm text-muted mt-1">
            Get started with multi-store management and expense tracking
          </p>
        </div>

        <Card>
          <CardHeader
            title="Account Registration"
            action={<Badge tone="green">New Identity</Badge>}
          />
          <CardContent className="space-y-4 pt-4">
            {serverError && (
              <div className="rounded-md border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    placeholder="John"
                    autoComplete="given-name"
                    {...register('first_name')}
                  />
                  {errors.first_name && (
                    <p className="mt-1 text-xs text-danger">{errors.first_name.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    placeholder="Doe"
                    autoComplete="family-name"
                    {...register('last_name')}
                  />
                  {errors.last_name && (
                    <p className="mt-1 text-xs text-danger">{errors.last_name.message}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  autoComplete="email"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-danger">{errors.email.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min 8 characters with upper, lower & digits"
                  autoComplete="new-password"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" disabled={loading} className="w-full gap-2">
                {loading ? 'Creating Account...' : 'Continue to Verification'}{' '}
                <ArrowRight className="size-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted">
          Already have an account?{' '}
          <Link to="/auth/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
