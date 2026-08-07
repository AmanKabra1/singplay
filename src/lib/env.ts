/**
 * Environment access.
 *
 * Every value is read lazily so that a missing variable never breaks the build
 * or crashes an unrelated route — it only fails the specific feature that needs
 * it, and it fails with a message that says exactly which key to set.
 */

function read(key: string): string | undefined {
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

/** Throws a readable error naming the missing key. */
export function required(key: string): string {
  const value = read(key);
  if (!value) {
    throw new Error(
      `Missing environment variable ${key}. Add it to .env.local (see .env.example).`,
    );
  }
  return value;
}

export const env = {
  get appUrl(): string {
    return (
      read("NEXT_PUBLIC_APP_URL") ??
      (read("VERCEL_PROJECT_PRODUCTION_URL")
        ? `https://${read("VERCEL_PROJECT_PRODUCTION_URL")}`
        : "http://localhost:3000")
    );
  },
  get authSecret(): string {
    return required("AUTH_SECRET");
  },
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  get adminEmail(): string | undefined {
    return read("ADMIN_EMAIL")?.toLowerCase();
  },

  jamendo: {
    get clientId(): string | undefined {
      return read("JAMENDO_CLIENT_ID");
    },
  },

  google: {
    get clientId(): string | undefined {
      return read("GOOGLE_CLIENT_ID");
    },
    get clientSecret(): string | undefined {
      return read("GOOGLE_CLIENT_SECRET");
    },
    get configured(): boolean {
      return Boolean(read("GOOGLE_CLIENT_ID") && read("GOOGLE_CLIENT_SECRET"));
    },
  },

  r2: {
    get accountId(): string | undefined {
      return read("R2_ACCOUNT_ID");
    },
    get accessKeyId(): string | undefined {
      return read("R2_ACCESS_KEY_ID");
    },
    get secretAccessKey(): string | undefined {
      return read("R2_SECRET_ACCESS_KEY");
    },
    get bucket(): string {
      return read("R2_BUCKET") ?? "singplay";
    },
    get publicBaseUrl(): string | undefined {
      return read("R2_PUBLIC_BASE_URL")?.replace(/\/$/, "");
    },
    get configured(): boolean {
      return Boolean(
        read("R2_ACCOUNT_ID") &&
          read("R2_ACCESS_KEY_ID") &&
          read("R2_SECRET_ACCESS_KEY") &&
          read("R2_PUBLIC_BASE_URL"),
      );
    },
  },

  mail: {
    get apiKey(): string | undefined {
      return read("RESEND_API_KEY");
    },
    get from(): string {
      return read("EMAIL_FROM") ?? "SingPlay <onboarding@resend.dev>";
    },
  },

  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
};
