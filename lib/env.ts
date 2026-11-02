import { z } from "zod";
import { runtimeEnv } from "@/lib/cloudflare";

const visionKeys = [
	"GOOGLE_VISION_CLIENT_EMAIL",
	"GOOGLE_VISION_PRIVATE_KEY",
] as const;

const stripeKeys = [
	"STRIPE_SECRET_KEY",
	"STRIPE_WEBHOOK_SECRET",
	"STRIPE_PRICE_YEARLY",
	"STRIPE_PRICE_OVERAGE",
] as const;

/**
 * Platform-wide configuration. Everything that used to be one wedding's
 * `.env` (passphrases, entry tokens, couple's names, moderation switch) now
 * lives per site in D1; what is left here is shared by every wedding the
 * deployment serves.
 */
const serverSchema = z
	.object({
		/** Host (no scheme) the owner console lives on; sites are subdomains of it. */
		PLATFORM_HOST: z
			.string()
			.min(1)
			.regex(/^[a-z0-9.-]+(:\d+)?$/i, "host bez schematu, np. wianki.app"),
		NEXT_PUBLIC_ARCHIVE_WORKER_URL: z.url(),
		/** Root of every derived cookie and token key. Rotating it logs everyone out. */
		SESSION_SECRET: z.string().min(32),
		ARCHIVE_WORKER_URL: z.url(),
		ARCHIVE_TOKEN_SECRET: z.string().min(32),
		SLIDESHOW_LIVE_URL: z.url().optional(),
		SLIDESHOW_LIVE_SECRET: z.string().min(32).optional(),
		GOOGLE_VISION_CLIENT_EMAIL: z.email().optional(),
		GOOGLE_VISION_PRIVATE_KEY: z.string().min(1).optional(),
		STRIPE_SECRET_KEY: z.string().min(1).optional(),
		STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
		STRIPE_PRICE_YEARLY: z.string().min(1).optional(),
		STRIPE_PRICE_OVERAGE: z.string().min(1).optional(),
		/** Sender for magic links. Unset = links are logged, not mailed (dev only). */
		EMAIL_FROM: z.email().optional(),
		SIGNUP_ENABLED: z.stringbool().default(true),
		CONSENT_VERSION: z.string().min(1).default("2026-07-23"),
	})
	.superRefine((env, ctx) => {
		if (
			Boolean(env.SLIDESHOW_LIVE_URL) !== Boolean(env.SLIDESHOW_LIVE_SECRET)
		) {
			ctx.addIssue({
				code: "custom",
				path: [
					env.SLIDESHOW_LIVE_URL
						? "SLIDESHOW_LIVE_SECRET"
						: "SLIDESHOW_LIVE_URL",
				],
				message:
					"SLIDESHOW_LIVE_URL i SLIDESHOW_LIVE_SECRET muszą być ustawione razem.",
			});
		}
		requireAllOrNone(env, ctx, visionKeys, "Google Vision");
		requireAllOrNone(env, ctx, stripeKeys, "Stripe");
	});

function requireAllOrNone(
	env: Record<string, unknown>,
	ctx: z.RefinementCtx,
	keys: readonly string[],
	label: string,
) {
	const set = keys.filter((key) => env[key]);
	if (set.length === 0 || set.length === keys.length) return;
	for (const key of keys) {
		if (!env[key]) {
			ctx.addIssue({
				code: "custom",
				path: [key],
				message: `Wymagane, gdy skonfigurowano ${label} (ustawiono ${set.join(", ")}).`,
			});
		}
	}
}

export type ServerEnv = z.infer<typeof serverSchema>;

let cachedServerEnv: ServerEnv | undefined;

export type ServerEnvIssue = {
	key: string;
	reason: string;
};

function normalizeEnvIssues(
	issues: z.core.$ZodIssue[],
	env: Record<string, string | undefined>,
): ServerEnvIssue[] {
	return issues.map((issue) => {
		const key = issue.path.map(String).join(".") || "(env)";
		return {
			key,
			reason:
				env[key] === undefined && issue.code !== "custom"
					? "brak wartości"
					: issue.message,
		};
	});
}

function envErrorMessage(issues: ServerEnvIssue[]) {
	return [
		"Środowisko serwera jest źle skonfigurowane. Ustaw brakujące zmienne w alchemy.run.ts (sekrety Workera) albo w .env.local:",
		...issues.map(({ key, reason }) => `- ${key}: ${reason}`),
	].join("\n");
}

/** An expected deployment error that the HTTP boundary can render safely. */
export class ServerEnvError extends Error {
	readonly issues: ServerEnvIssue[];

	constructor(issues: ServerEnvIssue[]) {
		super(envErrorMessage(issues));
		this.name = "ServerEnvError";
		this.issues = issues;
	}
}

/**
 * One line per variable, readable in a deploy log: which name, and whether it
 * is missing or what is wrong with it. Never the raw Zod issue list.
 */
export function describeEnvIssues(
	issues: z.core.$ZodIssue[],
	env: Record<string, string | undefined>,
) {
	return envErrorMessage(normalizeEnvIssues(issues, env));
}

export function parseServerEnv(
	source: Record<string, string | undefined>,
): ServerEnv {
	const result = serverSchema.safeParse(source);
	if (!result.success) {
		throw new ServerEnvError(normalizeEnvIssues(result.error.issues, source));
	}
	return result.data;
}

export function serverEnv(): ServerEnv {
	if (cachedServerEnv) return cachedServerEnv;
	cachedServerEnv = parseServerEnv(runtimeEnv());
	return cachedServerEnv;
}

/** Tests and the dev server re-read the environment after changing it. */
export function resetServerEnvCache() {
	cachedServerEnv = undefined;
}

/** `localhost`, any `*.localhost` subdomain (dev sites) and loopback addresses. */
export function isLocalHost(host: string) {
	return /^(([a-z0-9-]+\.)*localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
}

export function platformScheme(host: string) {
	return isLocalHost(host) ? "http" : "https";
}

export function platformOrigin(env: ServerEnv = serverEnv()) {
	return `${platformScheme(env.PLATFORM_HOST)}://${env.PLATFORM_HOST}`;
}

export function moderationConfigured(env: ServerEnv = serverEnv()) {
	return Boolean(
		env.GOOGLE_VISION_CLIENT_EMAIL && env.GOOGLE_VISION_PRIVATE_KEY,
	);
}

export function billingConfigured(env: ServerEnv = serverEnv()) {
	return Boolean(env.STRIPE_SECRET_KEY);
}
