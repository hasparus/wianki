import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT ?? "3000");
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
	throw new Error("PLAYWRIGHT_PORT must be a valid port number.");
}
const origin = `http://localhost:${port}`;

/**
 * The dev server resolves the Host header to a site: PLATFORM_HOST is the
 * owner console, anything else is looked up as a site's custom domain. The
 * tests visit `localhost`, so the platform lives on `platform.localhost` and
 * db/seed-dev.sql (applied by `npm run db:reset:local` before the run) holds
 * a site whose custom_domain is `localhost`, together with the entry tokens
 * and passphrases the specs type in.
 */
const ciEnv = {
	PLATFORM_HOST: "platform.localhost",
	SESSION_SECRET: "e2e_session_secret_value_at_least_32b",
	ARCHIVE_WORKER_URL: "https://archive.example.workers.dev",
	NEXT_PUBLIC_ARCHIVE_WORKER_URL: "https://archive.example.workers.dev",
	ARCHIVE_TOKEN_SECRET: "e2e_archive_token_secret_value_32b",
	CONSENT_VERSION: "e2e",
};

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? "github" : "list",
	use: {
		baseURL: origin,
		trace: "on-first-retry",
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
		{ name: "mobile-safari", use: { ...devices["iPhone 15"] } },
	],
	webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER
		? undefined
		: {
				command: `node node_modules/next/dist/bin/next dev --port ${port}`,
				url: `${origin}/login`,
				reuseExistingServer: false,
				env: { ...process.env, ...ciEnv },
				timeout: 120_000,
			},
});
