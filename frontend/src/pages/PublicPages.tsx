import { LanguageSelector } from '../components/layout/LanguageSelector';
import { useTranslation } from 'react-i18next';
import { translateNode, translateString } from '../lib/localization';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Eye, EyeOff, Mail, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Card, CardContent, Input } from '../components/ui/primitives';
import { Logo } from '../components/layout/Logo';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import {
  registerUser,
  loginUser,
  verifyEmail,
  resendVerification,
  getCurrentUser,
  type ApiErrorResponse,
} from '../api/auth';
import { useAuthStore } from '../store/useAuthStore';

// Registration validation schema matching backend rules
const registerSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(120, 'Cannot exceed 120 characters'),
  last_name: z.string().trim().max(120, 'Cannot exceed 120 characters').optional(),
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email').max(254, 'Cannot exceed 254 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(72, 'Password cannot exceed 72 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one digit')
    .regex(/[^A-Za-z0-9\s]/, 'Must contain at least one special character'),
});
type RegisterFormValues = z.infer<typeof registerSchema>;

// Login validation schema
const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type LoginFormValues = z.infer<typeof loginSchema>;

// Email verification schema
const verifySchema = z.object({
  token: z.string().trim().min(1, 'Verification token is required'),
});
type VerifyFormValues = z.infer<typeof verifySchema>;

export function AuthPage({ mode }: { mode: string }) {
  useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const queryEmail = searchParams.get('email') || '';
  const queryToken = searchParams.get('token') || '';

  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendEmail, setResendEmail] = useState(queryEmail);

  // Timer for resend verification cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Reset errors when mode changes
  useEffect(() => {
    setGeneralError(null);
    setSuccessMessage(null);
  }, [mode]);

  // 1. Registration form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: queryEmail,
      password: '',
    },
  });

  const onRegisterSubmit = async (values: RegisterFormValues) => {
    setGeneralError(null);
    try {
      await registerUser({
        first_name: values.first_name,
        last_name: values.last_name || undefined,
        email: values.email,
        password: values.password,
      });
      /*
      // Email verification redirect commented out during registration
      navigate(`/auth/check-mail?email=${encodeURIComponent(values.email)}`);
      */
      // Email verification bypassed: automatically authenticate and navigate to dashboard
      try {
        const authRes = await loginUser({ email: values.email, password: values.password });
        useAuthStore.getState().setAccessToken(authRes.access_token);
        const user = await getCurrentUser();
        setAuth(user, authRes.access_token);
        navigate('/dashboard/analytics', { replace: true });
      } catch {
        navigate(`/auth/login?email=${encodeURIComponent(values.email)}`);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const errData = err.response?.data as ApiErrorResponse | undefined;
        if (err.response?.status === 422 && errData?.error?.field) {
          const field = errData.error.field as keyof RegisterFormValues;
          registerForm.setError(field, { message: errData.error.message });
          return;
        }
        if (err.response?.status === 429) {
          setGeneralError('Too many attempts. Please try again later.');
          return;
        }
        /*
        // Verification email delivery error handling commented out
        if (err.response?.status === 503) {
          setGeneralError('Email delivery service unavailable. Please try again shortly.');
          return;
        }
        */
        setGeneralError(errData?.error?.message || 'Registration failed. Please check your details.');
      } else {
        setGeneralError('An unexpected error occurred. Please try again.');
      }
    }
  };

  // 2. Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: queryEmail || 'info@codedthemes.com',
      password: '',
    },
  });

  const onLoginSubmit = async (values: LoginFormValues) => {
    setGeneralError(null);
    try {
      const authRes = await loginUser(values);
      useAuthStore.getState().setAccessToken(authRes.access_token);
      const user = await getCurrentUser();
      setAuth(user, authRes.access_token);

      const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard/analytics';
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const errData = err.response?.data as ApiErrorResponse | undefined;
        if (err.response?.status === 401) {
          setGeneralError('Invalid email or password.');
          return;
        }
        if (err.response?.status === 429) {
          setGeneralError('Too many failed login attempts. Please try again later.');
          return;
        }
        setGeneralError(errData?.error?.message || 'Failed to sign in. Please try again.');
      } else {
        setGeneralError('An unexpected network error occurred.');
      }
    }
  };

  // 3. Verification form
  const verifyForm = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      token: queryToken,
    },
  });

  const onVerifySubmit = async (values: VerifyFormValues) => {
    setGeneralError(null);
    setSuccessMessage(null);
    try {
      const res = await verifyEmail({ token: values.token });
      setSuccessMessage(res.message || 'Email verified successfully! You can now log in.');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const errData = err.response?.data as ApiErrorResponse | undefined;
        setGeneralError(errData?.error?.message || 'Verification failed. The token may be expired or already used.');
      } else {
        setGeneralError('An unexpected error occurred during verification.');
      }
    }
  };

  const onResend = async () => {
    if (!resendEmail || resendCooldown > 0) return;
    setGeneralError(null);
    try {
      await resendVerification({ email: resendEmail });
      setResendCooldown(60);
      setSuccessMessage('If eligible, a fresh verification token has been sent to your email.');
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        setGeneralError('Please wait before requesting another verification email.');
      } else {
        setGeneralError('Unable to resend verification email. Please try again later.');
      }
    }
  };

  const labels: Record<string, [string, string]> = {
    login: ['Login', "Don't have an account?"],
    register: ['Sign up', 'Already have an account?'],
    'forgot-password': ['Forgot Password', 'Remember your password?'],
    'reset-password': ['Reset Password', 'Choose a secure new password'],
    'check-mail': ['Check your mail', 'We sent a verification link to your inbox.'],
    'code-verification': ['Verify Your Email', 'Enter the verification token from your email.'],
  };
  const [title, sub] = labels[mode] || labels.login;

  return (
    <PublicLayout>
      <Card className="w-full max-w-md">
        <CardContent className="p-7 lg:p-8">
          <div className="mb-7 flex items-center">
            <h1 className="text-2xl font-semibold">{translateNode(title)}</h1>
            <span className="ms-auto text-sm text-primary">
              {mode === 'login' ? (
                <Link to="/auth/register" className="hover:underline">
                  {translateNode(sub)}
                </Link>
              ) : mode === 'register' ? (
                <Link to="/auth/login" className="hover:underline">
                  {translateNode(sub)}
                </Link>
              ) : (
                translateNode(sub)
              )}
            </span>
          </div>

          {generalError && (
            <div className="mb-5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
              <Check className="mt-0.5 size-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {mode === 'check-mail' ? (
            <div className="text-center">
              <span className="mx-auto grid size-20 place-items-center rounded-full bg-primary-soft">
                <Mail className="size-9 text-primary" />
              </span>
              <p className="mt-5 text-sm leading-6 text-muted">
                {translateNode("We emailed verification instructions to ")}
                <b className="text-ink">{queryEmail || 'your email address'}</b>
                {translateNode(". Check your spam folder if it does not appear within a minute.")}
              </p>
              <div className="mt-6 space-y-3">
                <Button className="w-full" asChild>
                  <Link to={`/auth/code-verification?email=${encodeURIComponent(queryEmail)}`}>
                    {translateNode("Enter verification token")}
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link to="/auth/login">{translateNode("Back to login")}</Link>
                </Button>
              </div>
            </div>
          ) : mode === 'code-verification' ? (
            <form onSubmit={verifyForm.handleSubmit(onVerifySubmit)} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">{translateNode("Verification Token")}</span>
                <Input
                  placeholder="Paste token or uuid.secret"
                  {...verifyForm.register('token')}
                  disabled={verifyForm.formState.isSubmitting}
                />
                {verifyForm.formState.errors.token && (
                  <span className="mt-1 block text-xs text-danger">
                    {verifyForm.formState.errors.token.message}
                  </span>
                )}
              </label>

              <Button type="submit" className="w-full" disabled={verifyForm.formState.isSubmitting}>
                {verifyForm.formState.isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    {translateNode("Verifying...")}
                  </span>
                ) : (
                  translateNode("Verify Email")
                )}
              </Button>

              <div className="pt-2 text-center text-sm">
                <p className="text-muted mb-2">{translateNode("Didn't receive the email?")}</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="email@example.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    type="email"
                    className="text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onResend}
                    disabled={!resendEmail || resendCooldown > 0}
                    className="shrink-0 text-xs"
                  >
                    {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : translateNode("Resend Token")}
                  </Button>
                </div>
              </div>

              <div className="text-center pt-2">
                <Link to="/auth/login" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                  <ArrowLeft className="size-4" />
                  {translateNode("Back to login")}
                </Link>
              </div>
            </form>
          ) : mode === 'register' ? (
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">{translateNode("First Name")}</span>
                  <Input
                    // placeholder="John"
                    {...registerForm.register('first_name')}
                    disabled={registerForm.formState.isSubmitting}
                  />
                  {registerForm.formState.errors.first_name && (
                    <span className="mt-1 block text-xs text-danger">
                      {registerForm.formState.errors.first_name.message}
                    </span>
                  )}
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium">{translateNode("Last Name")}</span>
                  <Input
                    // placeholder="Doe"
                    {...registerForm.register('last_name')}
                    disabled={registerForm.formState.isSubmitting}
                  />
                  {registerForm.formState.errors.last_name && (
                    <span className="mt-1 block text-xs text-danger">
                      {registerForm.formState.errors.last_name.message}
                    </span>
                  )}
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">{translateNode("Email Address")}</span>
                <Input
                  type="email"
                  // placeholder="john.doe@example.com"
                  {...registerForm.register('email')}
                  disabled={registerForm.formState.isSubmitting}
                />
                {registerForm.formState.errors.email && (
                  <span className="mt-1 block text-xs text-danger">
                    {registerForm.formState.errors.email.message}
                  </span>
                )}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">{translateNode("Password")}</span>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    // placeholder="Min 8 chars, 1 uppercase, 1 digit, 1 symbol"
                    {...registerForm.register('password')}
                    disabled={registerForm.formState.isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-3 text-muted hover:text-ink"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {registerForm.formState.errors.password && (
                  <span className="mt-1 block text-xs text-danger">
                    {registerForm.formState.errors.password.message}
                  </span>
                )}
                <span className="mt-1 block text-xs text-muted">
                  Must be 8–72 characters with uppercase, lowercase, digit, and special character.
                </span>
              </label>

              <Button type="submit" className="w-full mt-2" disabled={registerForm.formState.isSubmitting}>
                {registerForm.formState.isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    {translateNode("Creating account...")}
                  </span>
                ) : (
                  translateNode("Sign up")
                )}
              </Button>

              <div className="text-center pt-2">
                <Link to="/auth/login" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                  <ArrowLeft className="size-4" />
                  {translateNode("Already have an account? Log in")}
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">{translateNode("Email Address")}</span>
                <Input
                  type="email"
                  // placeholder="name@example.com"
                  {...loginForm.register('email')}
                  disabled={loginForm.formState.isSubmitting}
                />
                {loginForm.formState.errors.email && (
                  <span className="mt-1 block text-xs text-danger">
                    {loginForm.formState.errors.email.message}
                  </span>
                )}
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">{translateNode("Password")}</span>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    // placeholder="Enter your password"
                    {...loginForm.register('password')}
                    disabled={loginForm.formState.isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-3 text-muted hover:text-ink"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <span className="mt-1 block text-xs text-danger">
                    {loginForm.formState.errors.password.message}
                  </span>
                )}
              </label>

              <div className="flex items-center text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="size-4 accent-primary" />
                  {translateNode("Keep me signed in")}
                </label>
                <Link to="/auth/forgot-password" className="ms-auto text-primary hover:underline">
                  {translateNode("Forgot Password?")}
                </Link>
              </div>

              <Button type="submit" className="w-full mt-2" disabled={loginForm.formState.isSubmitting}>
                {loginForm.formState.isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    {translateNode("Signing in...")}
                  </span>
                ) : (
                  translateNode("Login")
                )}
              </Button>

              <div className="text-center pt-2">
                <Link to="/auth/register" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                  {translateNode("Don't have an account? Sign up")}
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </PublicLayout>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  useTranslation();
  return (
    <main className="auth-page min-h-screen">
      <div className="absolute start-6 top-12 z-10">
        <Logo />
      </div>
      <div className="absolute end-6 top-12 z-20">
        <LanguageSelector />
      </div>
      <div className="auth-ribbons" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="relative z-[2] grid min-h-screen place-items-center p-5">{translateNode(children)}</div>
    </main>
  );
}

export function MaintenancePage({ type }: { type: string }) {
  useTranslation();
  const config: Record<string, [string, string, string]> = {
    '404': ['404', 'Page not found', 'The page you are looking for may have been moved or removed.'],
    '500': ['500', 'Internal server error', 'Something went wrong on our side. Please try again shortly.'],
    'under-construction': ['Under construction', 'We are improving this page', 'The team is working hard to bring you a better experience.'],
    'coming-soon': ['Coming soon', 'Something useful is on the way', 'Leave your email and we will let you know when it is ready.'],
    'join-waitlist': ['Join the waitlist', 'Get early access', 'Be among the first to explore the next Mantis release.'],
  };
  const [code, title, body] = config[type] || config['404'];
  return (
    <PublicLayout>
      <div className="max-w-xl text-center">
        <div className="mx-auto mb-6 grid size-24 place-items-center rounded-full bg-primary-soft">
          <ShieldCheck className="size-12 text-primary" />
        </div>
        <p className="text-7xl font-bold text-primary">{translateNode(code)}</p>
        <h1 className="mt-4 text-3xl font-semibold">{translateNode(title)}</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">{translateNode(body)}</p>
        {['coming-soon', 'join-waitlist'].includes(type) && (
          <div className="mx-auto mt-6 flex max-w-md gap-2">
            <Input placeholder={translateString("Email address")} />
            <Button>{translateNode("Notify me")}</Button>
          </div>
        )}
        <Button asChild className="mt-7">
          <Link to="/dashboard/analytics">{translateNode("Back to dashboard")}</Link>
        </Button>
      </div>
    </PublicLayout>
  );
}

export function PricingPage() {
  useTranslation();
  const plans = [
    ['Starter', '$19', ['5 team members', '10 projects', 'Basic reporting']],
    ['Professional', '$49', ['Unlimited members', 'Unlimited projects', 'Advanced analytics', 'Priority support']],
    ['Enterprise', 'Custom', ['Dedicated workspace', 'SAML SSO', 'Audit logs', 'Account manager']],
  ];
  return (
    <div>
      <div className="mb-9 text-center">
        <h2 className="text-3xl font-semibold">{translateNode("Plans for teams of every size")}</h2>
        <p className="mt-2 text-muted">{translateNode("Start with the essentials and upgrade when you need more control.")}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map(([name, price, features], i) => (
          <Card key={String(name)} className={i === 1 ? 'border-primary shadow-lg' : ''}>
            <CardContent className="p-7">
              {i === 1 && (
                <span className="mb-3 inline-block rounded bg-primary px-2 py-1 text-xs font-medium text-white">
                  {translateNode("Most popular")}
                </span>
              )}
              <h3 className="text-lg font-semibold">{translateNode(name as string)}</h3>
              <p className="my-5 text-4xl font-bold">
                {translateNode(price)}
                <small className="text-sm font-normal text-muted">{translateNode(price !== 'Custom' && '/month')}</small>
              </p>
              <div className="space-y-3">
                {(features as string[]).map((feature) => (
                  <p key={feature} className="flex gap-2 text-sm">
                    <Check className="size-4 text-success" />
                    {translateNode(feature)}
                  </p>
                ))}
              </div>
              <Button variant={i === 1 ? 'default' : 'outline'} className="mt-7 w-full">
                {translateNode("Choose ")}
                {translateNode(name)}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
