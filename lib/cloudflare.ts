import type {
	D1Database,
	R2Bucket,
	SendEmail,
} from "@cloudflare/workers-types";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Everything the Worker is given by alchemy.run.ts. Resources arrive as
 * bindings, secrets as strings. This is the only place the app touches the
 * Cloudflare runtime; lib/db, lib/storage and lib/env sit on top of it, and
 * tests swap the whole object with setBindingsForTests.
 */
export type Bindings = {
	DB: D1Database;
	/** Private bucket holding EXIF-free derivatives. */
	GALLERY: R2Bucket;
	/** Cloudflare Email Sending, when configured. */
	SEND_EMAIL?: SendEmail;
} & Record<string, unknown>;

let override: Bindings | undefined;

export function setBindingsForTests(value: Bindings | undefined) {
	override = value;
}

export function bindings(): Bindings {
	if (override) return override;
	return getCloudflareContext().env as unknown as Bindings;
}

/** String vars and secrets from the Worker env, falling back to process.env. */
export function runtimeEnv(): Record<string, string | undefined> {
	const out: Record<string, string | undefined> = { ...process.env };
	let env: Record<string, unknown> | undefined;
	try {
		env = override ?? (getCloudflareContext().env as Record<string, unknown>);
	} catch {
		env = undefined;
	}
	if (env) {
		for (const [key, value] of Object.entries(env)) {
			if (typeof value === "string") out[key] = value;
		}
	}
	return out;
}
