import * as Sentry from '@sentry/react';
import posthog from 'posthog-js';

export function initializeMonitoring() {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
  if (sentryDsn) Sentry.init({ dsn: sentryDsn, sendDefaultPii: false });
  if (posthogKey) posthog.init(posthogKey, { api_host: 'https://us.i.posthog.com', person_profiles: 'identified_only' });
}
