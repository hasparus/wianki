import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const baseEnv: Record<string, string> = {
	NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
	NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
	SUPABASE_SECRET_KEY: "sb_secret_test",
	APP_ORIGIN: "http://localhost:3000",
	GUEST_ENTRY_TOKEN: "guest_entry_token_value_32_bytes!!",
	GUEST_ACCESS_PASSPHRASE: "test invitation passphrase",
	GUEST_SESSION_SECRET: "guest_session_secret_value_32b!!!",
	ADMIN_ENTRY_TOKEN: "admin_entry_token_value_32_bytes!",
	ADMIN_SESSION_SECRET: "admin_session_secret_value_32b!!!",
	ARCHIVE_WORKER_URL: "https://archive.example.workers.dev",
	ARCHIVE_TOKEN_SECRET: "archive_token_secret_value_32b!!!",
	DELETION_CONTACT_EMAIL: "couple@example.com",
};

const visionEnv: Record<string, string> = {
	GOOGLE_CLOUD_PROJECT_ID: "test-project",
	GOOGLE_VISION_CLIENT_EMAIL: "vision@example.iam.gserviceaccount.com",
	GOOGLE_VISION_PRIVATE_KEY: "test-key",
};

async function loadServerEnv(env: Record<string, string>) {
	for (const key of [
		...Object.keys(baseEnv),
		...Object.keys(visionEnv),
		"MODERATION_ENABLED",
	]) {
		vi.stubEnv(key, env[key]);
	}
	const { serverEnv } = await import("@/lib/env");
	return serverEnv();
}

describe("server env schema", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("requires Vision credentials when moderation is enabled", async () => {
		await expect(loadServerEnv(baseEnv)).rejects.toThrow();
	});

	it("accepts Vision credentials with moderation enabled by default", async () => {
		const env = await loadServerEnv({ ...baseEnv, ...visionEnv });
		expect(env.MODERATION_ENABLED).toBe(true);
	});

	it("allows omitting Vision credentials when moderation is disabled", async () => {
		const env = await loadServerEnv({
			...baseEnv,
			MODERATION_ENABLED: "false",
		});
		expect(env.MODERATION_ENABLED).toBe(false);
		expect(env.GOOGLE_VISION_PRIVATE_KEY).toBeUndefined();
	});
});
