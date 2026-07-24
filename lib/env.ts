import { z } from "zod";

const serverSchema = z.object({
	NEXT_PUBLIC_SUPABASE_URL: z.url(),
	NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
	SUPABASE_SECRET_KEY: z.string().min(1),
	APP_ORIGIN: z.url(),
	GUEST_ENTRY_TOKEN: z.string().min(32),
	GUEST_ACCESS_PASSPHRASE: z.string().min(12),
	GUEST_SESSION_SECRET: z.string().min(32),
	ADMIN_ENTRY_TOKEN: z.string().min(32),
	ADMIN_SESSION_SECRET: z.string().min(32),
	ARCHIVE_WORKER_URL: z.url(),
	ARCHIVE_TOKEN_SECRET: z.string().min(32),
	GOOGLE_CLOUD_PROJECT_ID: z.string().min(1),
	GOOGLE_VISION_CLIENT_EMAIL: z.email(),
	GOOGLE_VISION_PRIVATE_KEY: z.string().min(1),
	DELETION_CONTACT_EMAIL: z.email(),
	CONSENT_VERSION: z.string().min(1).default("2026-07-23"),
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
