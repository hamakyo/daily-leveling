type AssetFetcher = {
  fetch(input: Request | URL | string): Promise<Response>;
};

interface Env {
  ASSETS: AssetFetcher;
  APP_BASE_URL: string;
  DATABASE_URL: string;
  DEFAULT_TIMEZONE?: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_COOKIE_NAME?: string;
  SESSION_TTL_SECONDS?: string;
}
