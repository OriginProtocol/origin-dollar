// This file configures the initialization of Sentry on the browser.
// The config you add here will be used whenever a page is visited.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
const env =
  process.env.APP_ENV === "staging" ? "staging" : process.env.NODE_ENV;

Sentry.init({
  dsn:
    SENTRY_DSN ||
    "https://eb1f0409a018475fb4e604b7d8f7c277@o225462.ingest.sentry.io/4504532247314432",
  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1.0,
  environment: env,
  // ...
  // Note: if you want to override the automatic release value, do not set a
  // `release` value here - use the environment variable `SENTRY_RELEASE`, so
  // that it will also get attached to your source maps
});
