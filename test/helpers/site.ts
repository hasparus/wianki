import { hashPassphrase } from "@/lib/auth/secrets";
import { run } from "@/lib/db";
import { resetServerEnvCache } from "@/lib/env";
import { findSiteById, type Site } from "@/lib/sites";
import { installTestBindings } from "./d1";

export const TEST_ENV = {
	PLATFORM_HOST: "wianki.test",
	SESSION_SECRET: "test_session_secret_value_32_bytes!!",
	ARCHIVE_WORKER_URL: "https://archive.example.workers.dev",
	NEXT_PUBLIC_ARCHIVE_WORKER_URL: "https://archive.example.workers.dev",
	ARCHIVE_TOKEN_SECRET: "test_archive_token_secret_32_bytes!!",
};

/**
 * A fresh in-memory D1 and bucket with one account and one site, the way a
 * route test needs them. Secrets are deterministic so tests can log in.
 */
export async function setupSite(
	overrides: Partial<{
		slug: string;
		title: string;
		guestPassphrase: string;
		adminPassphrase: string;
		customDomain: string | null;
		moderationEnabled: boolean;
		planStatus: Site["plan_status"];
		guestOpenUntil: string | null;
		guestJoinCode: string | null;
	}> = {},
	env: Record<string, string> = {},
) {
	const bindings = installTestBindings({ ...TEST_ENV, ...env });
	resetServerEnvCache();
	const accountId = "11111111-1111-4111-8111-111111111111";
	const siteId = "22222222-2222-4222-8222-222222222222";
	await run("insert into accounts (id, email) values (?, ?)", [
		accountId,
		"owner@example.com",
	]);
	await run(
		`insert into sites (id, account_id, slug, custom_domain, title, guest_passphrase_hash,
		   admin_passphrase_hash, guest_entry_token, admin_entry_token, guest_join_code,
		   guest_open_until, moderation_enabled, plan_status)
		 values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			siteId,
			accountId,
			overrides.slug ?? "rosia",
			overrides.customDomain ?? null,
			overrides.title ?? "Rosia & Piotrek",
			await hashPassphrase(overrides.guestPassphrase ?? "guest passphrase"),
			await hashPassphrase(
				overrides.adminPassphrase ?? "admin passphrase long",
			),
			"guest-entry-token-value-32-bytes-long!!",
			"admin-entry-token-value-32-bytes-long!!",
			overrides.guestJoinCode ?? null,
			overrides.guestOpenUntil ?? null,
			overrides.moderationEnabled ? 1 : 0,
			overrides.planStatus ?? "active",
		],
	);
	const site = (await findSiteById(siteId)) as Site;
	return { ...bindings, site, accountId };
}

export function siteRequest(
	site: Site,
	path: string,
	init: RequestInit & { sameOrigin?: boolean } = {},
) {
	const headers = new Headers(init.headers);
	headers.set("host", new URL(site.origin).host);
	if (init.sameOrigin !== false && !headers.has("origin"))
		headers.set("origin", site.origin);
	return new Request(`${site.origin}${path}`, { ...init, headers });
}

export async function insertPhoto(
	siteId: string,
	photo: Partial<{
		id: string;
		guestId: string;
		hotStatus: string;
		archiveStatus: string;
		moderationStatus: string;
		archiveKey: string | null;
		originalSize: number;
		derivativeSize: number | null;
		createdAt: string;
	}> = {},
) {
	const id = photo.id ?? crypto.randomUUID();
	const batchId = crypto.randomUUID();
	const guestId = photo.guestId ?? "33333333-3333-4333-8333-333333333333";
	await run(
		"insert into upload_batches (id, site_id, guest_id, item_count, consent_version) values (?, ?, ?, 1, 'test')",
		[batchId, siteId, guestId],
	);
	await run(
		`insert into photos (id, site_id, batch_id, guest_id, original_filename, original_content_type,
		   original_size, derivative_size, storage_path, archive_key, hot_status, archive_status,
		   moderation_status, created_at)
		 values (?, ?, ?, ?, 'photo.jpg', 'image/jpeg', ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			siteId,
			batchId,
			guestId,
			photo.originalSize ?? 8,
			photo.derivativeSize ?? null,
			`${batchId}/${id}.jpg`,
			photo.archiveKey ?? null,
			photo.hotStatus ?? "pending",
			photo.archiveStatus ?? "pending",
			photo.moderationStatus ?? "pending",
			photo.createdAt ?? new Date().toISOString(),
		],
	);
	return { id, batchId, guestId, storagePath: `${batchId}/${id}.jpg` };
}
