type AssetFetcher = {
  fetch(input: Request | URL | string): Promise<Response>;
};

type HyperdriveBinding = {
  connectionString: string;
};

interface Env {
  ASSETS: AssetFetcher;
  APP_BASE_URL: string;
  DATABASE_URL?: string;
  DEFAULT_TIMEZONE?: string;
  E2E_TEST_MODE?: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  HYPERDRIVE?: HyperdriveBinding;
  SESSION_COOKIE_NAME?: string;
  SESSION_TTL_SECONDS?: string;
}
