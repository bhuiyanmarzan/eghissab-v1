interface ImportMetaEnv {
  readonly VITE_LANDING_URL?: string;
  readonly VITE_MERCHANT_URL?: string;
  readonly VITE_CONSUMER_URL?: string;
  readonly VITE_ADMIN_URL?: string;
  readonly DEV?: boolean;
  readonly [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
