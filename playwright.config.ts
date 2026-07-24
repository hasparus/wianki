import { defineConfig, devices } from "@playwright/test";

const ciEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e",
  SUPABASE_SECRET_KEY: "sb_secret_e2e",
  APP_ORIGIN: "http://localhost:3000",
  NEXT_PUBLIC_APP_ORIGIN: "http://localhost:3000",
  GUEST_ENTRY_TOKEN: "e2e_guest_entry_token_value_32_bytes",
  GUEST_ACCESS_PASSPHRASE: "e2e invitation passphrase",
  GUEST_SESSION_SECRET: "e2e_guest_session_secret_value_32b",
  ADMIN_ENTRY_TOKEN: "e2e_admin_entry_token_value_32_bytes",
  ADMIN_SESSION_SECRET: "e2e_admin_session_secret_value_32b",
  ARCHIVE_WORKER_URL: "https://archive.example.workers.dev",
  NEXT_PUBLIC_ARCHIVE_WORKER_URL: "https://archive.example.workers.dev",
  ARCHIVE_TOKEN_SECRET: "e2e_archive_token_secret_value_32b",
  GOOGLE_CLOUD_PROJECT_ID: "e2e-project",
  GOOGLE_VISION_CLIENT_EMAIL: "vision@example.iam.gserviceaccount.com",
  GOOGLE_VISION_PRIVATE_KEY: "unused-e2e-key",
  DELETION_CONTACT_EMAIL: "couple@example.com",
  CONSENT_VERSION: "e2e",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 15"] } },
  ],
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER
    ? undefined
    : {
        command: "node node_modules/next/dist/bin/next dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: false,
        env: { ...process.env, ...ciEnv },
        timeout: 120_000,
      },
});
