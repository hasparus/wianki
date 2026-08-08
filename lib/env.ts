import { z } from "zod";

const visionKeys = [
	"GOOGLE_CLOUD_PROJECT_ID",
	"GOOGLE_VISION_CLIENT_EMAIL",
	"GOOGLE_VISION_PRIVATE_KEY",
] as const;

const serverSchema = z
	.object({
		NEXT_PUBLIC_SUPABASE_URL: z.url(),
		NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
		SUPABASE_SECRET_KEY: z.string().min(1),
		APP_ORIGIN: z.url(),
		GUEST_ENTRY_TOKEN: z.string().min(32),
		GUEST_JOIN_CODE: z.string().min(6).optional(),
		GUEST_ACCESS_PASSPHRASE: z.string().min(12),
		GUEST_SESSION_SECRET: z.string().min(32),
		ADMIN_ENTRY_TOKEN: z.string().min(32),
		ADMIN_ACCESS_PASSPHRASE: z.string().min(16).optional(),
		ADMIN_SESSION_SECRET: z.string().min(32),
		ARCHIVE_WORKER_URL: z.url(),
		ARCHIVE_TOKEN_SECRET: z.string().min(32),
		MODERATION_ENABLED: z.stringbool().default(true),
		SLIDESHOW_LIVE_URL: z.url().optional(),
		SLIDESHOW_LIVE_SECRET: z.string().min(32).optional(),
		GOOGLE_CLOUD_PROJECT_ID: z.string().min(1).optional(),
		GOOGLE_VISION_CLIENT_EMAIL: z.email().optional(),
		GOOGLE_VISION_PRIVATE_KEY: z.string().min(1).optional(),
		DELETION_CONTACT_EMAIL: z.email(),
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
		if (!env.MODERATION_ENABLED) return;
		for (const key of visionKeys) {
			if (!env[key]) {
				ctx.addIssue({
					code: "custom",
					path: [key],
					message:
						"Wymagane, gdy MODERATION_ENABLED nie jest ustawione na false.",
				});
			}
		}
	});

export type ServerEnv = z.infer<typeof serverSchema>;

let cachedServerEnv: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
	cachedServerEnv ??= serverSchema.parse(process.env);
	return cachedServerEnv;
}

export function publicEnv() {
	return {
		supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
		supabasePublishableKey:
			process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
		appOrigin: process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000",
	};
}
