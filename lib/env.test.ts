import { describe, expect, it } from "vitest";
import { parseServerEnv, platformOrigin } from "@/lib/env";

const baseEnv: Record<string, string> = {
	PLATFORM_HOST: "wianki.app",
	NEXT_PUBLIC_ARCHIVE_WORKER_URL: "https://archive.example.workers.dev",
	SESSION_SECRET: "session_secret_value_32_bytes_long!!",
	ARCHIVE_WORKER_URL: "https://archive.example.workers.dev",
	ARCHIVE_TOKEN_SECRET: "archive_token_secret_value_32b!!!",
};

const visionEnv: Record<string, string> = {
	GOOGLE_VISION_CLIENT_EMAIL: "vision@example.iam.gserviceaccount.com",
	GOOGLE_VISION_PRIVATE_KEY: "test-key",
};

describe("server env schema", () => {
	it("accepts the minimal platform configuration", () => {
		const env = parseServerEnv(baseEnv);
		expect(env.SIGNUP_ENABLED).toBe(true);
		expect(env.GOOGLE_VISION_PRIVATE_KEY).toBeUndefined();
		expect(platformOrigin(env)).toBe("https://wianki.app");
	});

	it("uses http for a local platform host", () => {
		expect(
			platformOrigin(
				parseServerEnv({ ...baseEnv, PLATFORM_HOST: "localhost:3000" }),
			),
		).toBe("http://localhost:3000");
	});

	it("requires both Vision credentials once one is set", () => {
		expect(() =>
			parseServerEnv({
				...baseEnv,
				GOOGLE_VISION_CLIENT_EMAIL: visionEnv.GOOGLE_VISION_CLIENT_EMAIL,
			}),
		).toThrow(
			/GOOGLE_VISION_PRIVATE_KEY: Wymagane, gdy skonfigurowano Google Vision/,
		);
		expect(
			parseServerEnv({ ...baseEnv, ...visionEnv }).GOOGLE_VISION_PRIVATE_KEY,
		).toBe("test-key");
	});

	it("requires the whole Stripe set once one key is set", () => {
		expect(() =>
			parseServerEnv({ ...baseEnv, STRIPE_SECRET_KEY: "sk_test" }),
		).toThrow(/STRIPE_WEBHOOK_SECRET: Wymagane, gdy skonfigurowano Stripe/);
	});

	it("names every missing or invalid variable in one readable error", () => {
		const { PLATFORM_HOST: _host, ...withoutHost } = baseEnv;
		let error: unknown;
		try {
			parseServerEnv({ ...withoutHost, SESSION_SECRET: "short" });
		} catch (caught) {
			error = caught;
		}
		expect(error).toMatchObject({
			name: "ServerEnvError",
			issues: expect.arrayContaining([
				{ key: "PLATFORM_HOST", reason: "brak wartości" },
				expect.objectContaining({ key: "SESSION_SECRET" }),
			]),
		});
		expect(String((error as Error).message)).toMatch(/^Środowisko serwera/);
		expect(String((error as Error).message)).not.toMatch(
			/ZodError|"code"|expected:/,
		);
	});

	it("rejects a platform host with a scheme", () => {
		expect(() =>
			parseServerEnv({ ...baseEnv, PLATFORM_HOST: "https://wianki.app" }),
		).toThrow(/PLATFORM_HOST/);
	});
});
