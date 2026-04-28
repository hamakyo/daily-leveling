type AssetFetcher = {
  fetch(input: Request | URL | string): Promise<Response>;
};

type KVNamespaceBinding = {
  get(key: string, type: "text"): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

type HyperdriveBinding = {
  connectionString: string;
};

interface Env {
  ASSETS: AssetFetcher;
  AUTH_RATE_LIMITS?: KVNamespaceBinding;
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
